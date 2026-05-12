import { Card, CardContent } from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <div className="space-y-6 max-w-app">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-navy-900">Guten Tag.</h1>
          <p className="text-sm text-stone-500 mt-1">
            Foundation-Setup abgeschlossen — folgende Phasen liefern den fachlichen Inhalt.
          </p>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Unter Mindestbestand", value: "—" },
          { label: "Offene Bestellungen", value: "—" },
          { label: "Wareneingänge heute", value: "—" },
          { label: "Webhook-Fehler (24h)", value: "—" },
        ].map((k) => (
          <Card key={k.label} className="shadow-soft">
            <CardContent className="p-5">
              <div className="text-[11px] tracking-[0.18em] uppercase text-stone-500">
                {k.label}
              </div>
              <div className="font-display text-3xl text-navy-900 mt-1.5">{k.value}</div>
              <div className="text-[11px] text-stone-500 mt-1">Phase M2 liefert echte Daten</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
