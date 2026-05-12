import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { summary, bySupplier } from "@/lib/services/reports";
import { ReportsView } from "./reports-view";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const session = await auth();
  if (!session?.role || !session.tenant) redirect("/login");

  const tenantId = session.tenant;
  const yearStart = new Date(new Date().getFullYear(), 0, 1);

  const [s, bs] = await Promise.all([
    summary(tenantId, { from: yearStart }),
    bySupplier(tenantId, { from: yearStart }),
  ]);

  return <ReportsView summary={s} bySupplier={bs} yearStart={yearStart.toISOString()} />;
}
