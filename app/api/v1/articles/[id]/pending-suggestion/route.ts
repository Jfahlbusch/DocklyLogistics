import { NextResponse, type NextRequest } from "next/server";
import { orderSuggestionRepo } from "@/lib/db/repos/order-suggestion";
import { auth } from "@/lib/auth";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders, UnauthenticatedError } from "@/lib/api/guard";
import { fail, noContent } from "@/lib/api/respond";
import { PendingSuggestionSetSchema } from "@/lib/schemas/order-suggestion";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = handler(async (req: NextRequest, { params }: Ctx) => {
  const ctx = await requireRoleFromHeaders(req.headers, "USER");
  const { id } = await params;
  const body = PendingSuggestionSetSchema.parse(await req.json());

  const session = await auth();
  if (!session?.user) throw new UnauthenticatedError();
  const actorEmail = session.user.email ?? "unknown";
  const actorId = (session.user as { id?: string }).id ?? actorEmail;

  const result = await orderSuggestionRepo.setPendingForArticle(ctx.tenantId, id, {
    qtyOrderUnit: body.qtyOrderUnit,
    note: body.note,
    actorId,
    actorEmail,
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  });

  if (!result) return fail(404, "Article not found");
  if (result.kind === "none") return noContent();
  const capacityWarning = result.kind === "dismissed" ? false : result.capacityWarning;
  return NextResponse.json(
    { data: result.data, capacityWarning },
    { status: result.kind === "created" ? 201 : 200 },
  );
});
