import type { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders } from "@/lib/api/guard";
import { ok, created, fail } from "@/lib/api/respond";
import { ediPartnerMailboxRepo } from "@/lib/db/repos/edi-partner-mailbox";
import { EdiPartnerCreateSchema } from "@/lib/schemas/edi";

function view(m: {
  id: string; name: string; partnerGln: string | null; supplierId: string | null;
  token: string; active: boolean; lastUsedAt: Date | null; createdAt: Date;
} & { supplierName?: string | null }) {
  return {
    id: m.id,
    name: m.name,
    partnerGln: m.partnerGln,
    supplierId: m.supplierId,
    supplierName: m.supplierName ?? null,
    token: m.token,
    inboundPath: `/api/edi/inbound/${m.token}`,
    active: m.active,
    lastUsedAt: m.lastUsedAt,
    createdAt: m.createdAt,
  };
}

/** GET /api/v1/settings/edi/partners — all partner mailboxes of the tenant. */
export const GET = handler(async (req: NextRequest) => {
  const ctx = await requireRoleFromHeaders(req.headers, "MANAGER");
  const rows = await ediPartnerMailboxRepo.list(ctx.tenantId);
  return ok(rows.map(view));
});

/** POST /api/v1/settings/edi/partners — create a partner mailbox (token generated). */
export const POST = handler(async (req: NextRequest) => {
  const ctx = await requireRoleFromHeaders(req.headers, "MANAGER");
  const body = EdiPartnerCreateSchema.parse(await req.json());
  try {
    const row = await ediPartnerMailboxRepo.create(ctx.tenantId, body);
    return created(view(row));
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return fail(409, "Name existiert", `Ein Partner-Postfach namens „${body.name}“ gibt es bereits.`);
    }
    throw e;
  }
});
