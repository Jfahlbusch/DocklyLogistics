import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders } from "@/lib/api/guard";
import { ok, noContent, fail } from "@/lib/api/respond";
import { ediPartnerMailboxRepo } from "@/lib/db/repos/edi-partner-mailbox";
import { EdiPartnerUpdateSchema } from "@/lib/schemas/edi";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/v1/settings/edi/partners/{id} — rename, rebind, (de)activate. */
export const PATCH = handler(async (req: NextRequest, { params }: Ctx) => {
  const ctx = await requireRoleFromHeaders(req.headers, "MANAGER");
  const { id } = await params;
  const body = EdiPartnerUpdateSchema.parse(await req.json());
  try {
    const row = await ediPartnerMailboxRepo.update(ctx.tenantId, id, body);
    if (!row) return fail(404, "Nicht gefunden", "Partner-Postfach existiert nicht");
    return ok(row);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return fail(409, "Name existiert", "Ein Partner-Postfach mit diesem Namen gibt es bereits.");
    }
    throw e;
  }
});

/** DELETE /api/v1/settings/edi/partners/{id} — the token stops working immediately. */
export const DELETE = handler(async (req: NextRequest, { params }: Ctx) => {
  const ctx = await requireRoleFromHeaders(req.headers, "MANAGER");
  const { id } = await params;
  const removed = await ediPartnerMailboxRepo.remove(ctx.tenantId, id);
  if (!removed) return fail(404, "Nicht gefunden", "Partner-Postfach existiert nicht");
  return noContent();
});
