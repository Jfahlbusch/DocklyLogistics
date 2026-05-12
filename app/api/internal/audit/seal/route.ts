import type { NextRequest } from "next/server";
import { handler } from "@/lib/api/handler";
import { ok, fail } from "@/lib/api/respond";
import { sealYesterdayForAllTenants, sealDay } from "@/lib/audit/seal";

export const POST = handler(async (req: NextRequest) => {
  const expected = process.env.CRON_SECRET;
  if (!expected) return fail(503, "Cron not configured");
  const got = req.headers.get("x-internal-cron-secret");
  if (got !== expected) return fail(401, "Unauthorized");

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
