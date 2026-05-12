import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { stockRepo } from "@/lib/db/repos/stock";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.role || !session.tenant) redirect("/login");

  const tenantId = session.tenant;

  // KPI 1: Articles below min stock
  const articles = await prisma.article.findMany({
    where: { tenantId, active: true, minStock: { gt: 0 } },
    select: { id: true, sku: true, name: true, minStock: true, orderUnit: true },
  });
  const totals = await stockRepo.totalsByArticle(tenantId, articles.map((a) => a.id));
  const belowMin = articles
    .map((a) => ({ ...a, stock: totals.get(a.id) ?? 0 }))
    .filter((a) => a.stock < a.minStock)
    .sort((a, b) => (a.stock - a.minStock) - (b.stock - b.minStock));

  // KPI 2: Open orders (everything not in CLOSED/CANCELLED)
  const openOrders = await prisma.order.count({
    where: { tenantId, status: { notIn: ["CLOSED", "CANCELLED"] } },
  });

  // KPI 3: Receipts today (StockMovement with reason=RECEIPT and refType=ORDER)
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const receiptsToday = await prisma.stockMovement.count({
    where: { tenantId, reason: "RECEIPT", refType: "ORDER", createdAt: { gte: todayStart } },
  });

  // KPI 4: Webhook errors → kommt mit Phase M5
  const webhookErrors = "—";

  // Recent audit activity
  const recentAudit = await prisma.auditLog.findMany({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  const kpis = [
    { label: "Unter Mindestbestand", value: String(belowMin.length), href: "/articles", accent: belowMin.length > 0 },
    { label: "Offene Bestellungen", value: String(openOrders), href: "/orders" },
    { label: "Wareneingänge heute", value: String(receiptsToday), href: "/orders?status=PARTIALLY_RECEIVED" },
    { label: "Webhook-Fehler (24h)", value: webhookErrors, href: "/settings", muted: true },
  ];

  return (
    <div className="space-y-6 max-w-app">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-navy-900">Übersicht</h1>
          <p className="text-sm text-stone-500 mt-1">Tenant: <span className="font-mono">{tenantId}</span></p>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Link key={k.label} href={k.href}>
            <Card className="shadow-soft hover:border-stone-300 transition-colors">
              <CardContent className="p-5">
                <div className="text-[11px] tracking-[0.18em] uppercase text-stone-500">{k.label}</div>
                <div className={"font-display text-3xl mt-1.5 " + (k.accent ? "text-rose-600" : k.muted ? "text-stone-400" : "text-navy-900")}>{k.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="shadow-soft">
          <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
            <h2 className="font-display text-lg text-navy-900">Top Unterdeckungen</h2>
            <Link href="/articles" className="text-xs text-navy-900 underline hover:text-navy-700">Alle Artikel</Link>
          </div>
          <CardContent className="p-0">
            {belowMin.length === 0 ? (
              <div className="px-5 py-8 text-center text-stone-500 text-sm">Keine Unterdeckung — alle Bestände über Mindestbestand.</div>
            ) : (
              <ul className="divide-y divide-stone-100">
                {belowMin.slice(0, 6).map((a) => (
                  <li key={a.id} className="px-5 py-3 flex items-center justify-between text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-navy-900 truncate">{a.name}</div>
                      <div className="text-stone-500 font-mono text-xs">{a.sku}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-rose-600">{a.stock} / {a.minStock}</div>
                      <div className="text-stone-500 text-xs">offen {a.minStock - a.stock}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
            <h2 className="font-display text-lg text-navy-900">Letzte Aktivitäten</h2>
          </div>
          <CardContent className="p-0">
            {recentAudit.length === 0 ? (
              <div className="px-5 py-8 text-center text-stone-500 text-sm">Noch keine Aktivität.</div>
            ) : (
              <ul className="divide-y divide-stone-100">
                {recentAudit.map((e) => (
                  <li key={e.id} className="px-5 py-3 flex items-start gap-3 text-sm">
                    <span className="mt-1.5 w-2 h-2 rounded-full bg-gold-500 flex-none" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-navy-900">{e.action}</span>
                        <span className="text-stone-500 text-xs">{e.entity}</span>
                      </div>
                      <div className="text-xs text-stone-500 mt-0.5">
                        {new Date(e.createdAt).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })} · {e.actorEmail}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
