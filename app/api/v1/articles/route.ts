import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { articleRepo } from "@/lib/db/repos/article";
import { appendAudit } from "@/lib/audit/append";
import { auth } from "@/lib/auth";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders, UnauthenticatedError } from "@/lib/api/guard";
import { ok, created, fail } from "@/lib/api/respond";
import { ArticleCreateSchema, ArticleListQuerySchema } from "@/lib/schemas/article";

export const GET = handler(async (req: NextRequest) => {
  const ctx = requireRoleFromHeaders(req.headers, "VIEWER");
  const query = ArticleListQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  const { items, total } = await articleRepo.list({ tenantId: ctx.tenantId, ...query });
  return ok(items, { page: query.page, pageSize: query.pageSize, total });
});

export const POST = handler(async (req: NextRequest) => {
  const ctx = requireRoleFromHeaders(req.headers, "USER");
  const body = ArticleCreateSchema.parse(await req.json());

  const dup = await articleRepo.findBySku(ctx.tenantId, body.sku);
  if (dup) return fail(409, "SKU already exists", `Article with SKU '${body.sku}' already exists.`);

  const session = await auth();
  if (!session?.user) throw new UnauthenticatedError();
  const actorEmail = session.user.email ?? "unknown";
  const actorId = (session.user as { id?: string }).id ?? actorEmail;

  const article = await prisma.$transaction(async (tx) => {
    const c = await articleRepo.create(tx, ctx.tenantId, body);
    await appendAudit(tx, {
      tenantId: ctx.tenantId,
      entity: "Article",
      entityId: c.id,
      action: "CREATE",
      actorId,
      actorEmail,
      ip: req.headers.get("x-forwarded-for") ?? undefined,
      userAgent: req.headers.get("user-agent") ?? undefined,
      after: { sku: c.sku, name: c.name },
    });
    return c;
  });

  return created(article);
});
