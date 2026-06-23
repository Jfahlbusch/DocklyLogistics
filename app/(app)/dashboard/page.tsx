import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getDashboardData } from "@/lib/services/dashboard";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.role || !session.tenant) redirect("/login");

  const tenantId = session.tenant;
  const data = await getDashboardData(tenantId);
  const belowMin = data.belowMinItems;
  const recentAudit = data.recentActivity;

  const kpis = [
    { label: "Unter Mindestbestand", value: String(data.kpis.belowMin), href: "/articles", accent: data.kpis.belowMin > 0 },
    { label: "Offene Bestellungen", value: String(data.kpis.openOrders), href: "/orders" },
    { label: "Wareneingänge heute", value: String(data.kpis.receiptsToday), href: "/orders?status=PARTIALLY_RECEIVED" },
    { label: "Webhook-Fehler (24h)", value: String(data.kpis.webhookErrors24h), href: "/settings", accent: data.kpis.webhookErrors24h > 0, muted: data.kpis.webhookErrors24h === 0 },
  ];

  return (
    <div className="space-y-6 max-w-app">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl text-foreground">Übersicht</h1>
          <p className="text-sm text-muted-foreground mt-1">Tenant: <span className="font-mono">{tenantId}</span></p>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Link key={k.label} href={k.href}>
            <Card className="shadow-soft hover:border-border transition-colors">
              <CardContent className="p-5">
                <div className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground">{k.label}</div>
                <div className={"font-display text-2xl sm:text-3xl mt-1.5 " + (k.accent ? "text-rose-600" : k.muted ? "text-muted-foreground" : "text-foreground")}>{k.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="shadow-soft">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-display text-lg text-foreground">Top Unterdeckungen</h2>
            <Link href="/articles" className="text-xs text-foreground underline hover:text-navy-700">Alle Artikel</Link>
          </div>
          <CardContent className="p-0">
            {belowMin.length === 0 ? (
              <div className="px-5 py-8 text-center text-muted-foreground text-sm">Keine Unterdeckung — alle Bestände über Mindestbestand.</div>
            ) : (
              <ul className="divide-y divide-border">
                {belowMin.slice(0, 6).map((a) => (
                  <li key={a.id} className="px-5 py-3 flex items-center justify-between text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-foreground truncate">{a.name}</div>
                      <div className="text-muted-foreground font-mono text-xs">{a.sku}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-rose-600">{a.stock} / {a.minStock}</div>
                      <div className="text-muted-foreground text-xs">offen {a.minStock - a.stock}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-display text-lg text-foreground">Letzte Aktivitäten</h2>
          </div>
          <CardContent className="p-0">
            {recentAudit.length === 0 ? (
              <div className="px-5 py-8 text-center text-muted-foreground text-sm">Noch keine Aktivität.</div>
            ) : (
              <ul className="divide-y divide-border">
                {recentAudit.map((e) => (
                  <li key={e.id} className="px-5 py-3 flex items-start gap-3 text-sm">
                    <span className="mt-1.5 w-2 h-2 rounded-full bg-gold-500 flex-none" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-foreground">{e.action}</span>
                        <span className="text-muted-foreground text-xs">{e.entity}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
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
