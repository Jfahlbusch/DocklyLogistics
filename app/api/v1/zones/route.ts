import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { zoneRepo } from "@/lib/db/repos/zone";
import { appendAudit } from "@/lib/audit/append";
import { auth } from "@/lib/auth";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders, UnauthenticatedError } from "@/lib/api/guard";
import { ok, created, fail } from "@/lib/api/respond";
import { ZoneCreateSchema } from "@/lib/schemas/zone";

export const GET = handler(async (req: NextRequest) => {
  const ctx = await requireRoleFromHeaders(req.headers, "VIEWER");
  return ok(await zoneRepo.list(ctx.tenantId));
});

export const POST = handler(async (req: NextRequest) => {
  const ctx = await requireRoleFromHeaders(req.headers, "MANAGER");
  const body = ZoneCreateSchema.parse(await req.json());

  if (await zoneRepo.findByName(ctx.tenantId, body.name)) return fail(409, "Zone name already exists");

  const session = await auth();
  if (!session?.user) throw new UnauthenticatedError();
  const actorEmail = session.user.email ?? "unknown";
  const actorId = (session.user as { id?: string }).id ?? actorEmail;

  try {
    const zone = await prisma.$transaction(async (tx) => {
      const z = await zoneRepo.create(tx, ctx.tenantId, body);
      await appendAudit(tx, {
        tenantId: ctx.tenantId, entity: "Zone", entityId: z.id, action: "CREATE",
        actorId, actorEmail,
        ip: req.headers.get("x-forwarded-for") ?? undefined,
        userAgent: req.headers.get("user-agent") ?? undefined,
        after: { name: z.name, sortOrder: z.sortOrder, active: z.active },
      });
      return z;
    });
    return created({ ...zone, locationCount: 0, articleCount: 0 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return fail(409, "Zone name already exists");
    }
    throw err;
  }
});
