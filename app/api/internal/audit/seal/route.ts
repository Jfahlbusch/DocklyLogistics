import type { NextRequest } from "next/server";
import { handler } from "@/lib/api/handler";
import { ok } from "@/lib/api/respond";
import { requireCronSecret } from "@/lib/api/cron-auth";
import { sealYesterdayForAllTenants, sealDay } from "@/lib/audit/seal";

export const POST = handler(async (req: NextRequest) => {
  const denied = requireCronSecret(req.headers);
  if (denied) return denied;

  // Optional: ?date=YYYY-MM-DD&tenant=demo to seal a specific day/tenant
  const date = req.nextUrl.searchParams.get("date");
  const tenant = req.nextUrl.searchParams.get("tenant");
  if (date && tenant) {
    const r = await sealDay(tenant, date);
    return ok(r ? [r] : []);
  }

  const results = await sealYesterdayForAllTenants();
  return ok(results);
});
