import type { NextRequest } from "next/server";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders } from "@/lib/api/guard";
import { ok } from "@/lib/api/respond";
import { as2Service } from "@/lib/services/as2-service";
import { As2IdentityGenerateSchema } from "@/lib/schemas/edi";

/** GET /api/v1/settings/edi/as2-identity — AS2-ID + certificate (never the private key). */
export const GET = handler(async (req: NextRequest) => {
  const ctx = await requireRoleFromHeaders(req.headers, "MANAGER");
  return ok(await as2Service.getIdentity(ctx.tenantId));
});

/** POST /api/v1/settings/edi/as2-identity — generate/renew the key pair + certificate. */
export const POST = handler(async (req: NextRequest) => {
  const ctx = await requireRoleFromHeaders(req.headers, "MANAGER");
  const body = As2IdentityGenerateSchema.parse(await req.json().catch(() => ({})));
  const identity = await as2Service.generateIdentity(ctx.tenantId, body.as2Id);
  return ok(identity);
});
