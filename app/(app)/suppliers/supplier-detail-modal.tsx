"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type Supplier = {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  street: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
  channel: "EMAIL" | "API" | "EDI";
  channelConfig: unknown;
  active: boolean;
};

export function SupplierDetailModal({
  supplierId,
  onClose,
}: {
  supplierId: string | null;
  onClose: () => void;
}) {
  const open = supplierId !== null;
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!supplierId) {
      setSupplier(null);
      return;
    }
    setLoading(true);
    fetch(`/api/v1/suppliers/${supplierId}`)
      .then((r) => r.json())
      .then((body) => setSupplier(body?.data ?? null))
      .finally(() => setLoading(false));
  }, [supplierId]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl sm:max-w-3xl">
        {loading || !supplier ? (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>Lieferanten-Detail wird geladen</DialogTitle>
            </DialogHeader>
            <div className="py-10 text-center text-stone-500">Lade…</div>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="text-[11px] tracking-[0.18em] uppercase text-stone-500 font-mono">
                {supplier.id}
              </div>
              <DialogTitle className="font-display text-2xl text-navy-900">
                {supplier.name}
              </DialogTitle>
              <DialogDescription className="text-stone-500">
                {[supplier.contactName, supplier.city, supplier.email]
                  .filter(Boolean)
                  .join(" · ")}
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="stamm">
              <TabsList>
                <TabsTrigger value="stamm">Stamm</TabsTrigger>
                <TabsTrigger value="kanal">Kanal</TabsTrigger>
                <TabsTrigger value="orders">Bestellungen</TabsTrigger>
                <TabsTrigger value="integrations" disabled>
                  API-Keys / Webhooks (M5)
                </TabsTrigger>
              </TabsList>

              <TabsContent value="stamm" className="space-y-2 text-sm mt-4">
                <Field label="Name" value={supplier.name} />
                <Field label="Kontakt" value={supplier.contactName ?? "—"} />
                <Field label="E-Mail" value={supplier.email ?? "—"} mono />
                <Field label="Telefon" value={supplier.phone ?? "—"} />
                <Field label="Straße" value={supplier.street ?? "—"} />
                <Field
                  label="PLZ / Ort"
                  value={`${supplier.postalCode ?? "—"} ${supplier.city ?? ""}`.trim()}
                />
                <Field label="Land" value={supplier.country ?? "—"} />
                <Field label="Status" value={supplier.active ? "aktiv" : "inaktiv"} />
              </TabsContent>

              <TabsContent value="kanal" className="space-y-4 mt-4">
                <div className="flex gap-2">
                  {(["EMAIL", "API", "EDI"] as const).map((c) => (
                    <div
                      key={c}
                      className={
                        "flex-1 rounded-xl border px-4 py-3 text-left " +
                        (supplier.channel === c
                          ? "bg-navy-900 text-white border-navy-900"
                          : "bg-white text-stone-500 border-stone-200")
                      }
                    >
                      <div className="font-medium">{c}</div>
                      <div className="text-xs mt-1 opacity-80">
                        {c === "EMAIL"
                          ? "PDF-Bestellschein per Mail"
                          : c === "API"
                            ? "JSON HTTP POST"
                            : "EDIFACT/ORDERS D.96A"}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border border-stone-200 rounded-xl p-4 bg-stone-50">
                  <div className="text-[11px] tracking-[0.18em] uppercase text-stone-500 mb-2">
                    Empfänger-Konfiguration
                  </div>
                  <pre className="text-xs font-mono whitespace-pre-wrap break-words text-stone-900">
                    {JSON.stringify(supplier.channelConfig ?? {}, null, 2)}
                  </pre>
                </div>

                <div className="text-xs text-stone-500">
                  Die Tenant-seitige Absender-Identität (z. B. Mailadresse, EDI-Sender-ID) wird
                  unter
                  <strong className="text-navy-900"> Einstellungen → Versand </strong>
                  konfiguriert.
                </div>
              </TabsContent>

              <TabsContent value="orders" className="mt-4">
                <SupplierOrdersPanel supplierId={supplier.id} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-2 items-baseline">
      <div className="text-[11px] tracking-[0.18em] uppercase text-stone-500 w-44 flex-shrink-0">
        {label}
      </div>
      <div className={mono ? "font-mono" : ""}>{value}</div>
    </div>
  );
}

type SupplierOrder = {
  id: string;
  orderNo: string;
  status: string;
  total: string;
  currency: string;
  createdAt: string;
  sentAt: string | null;
  _count?: { items: number };
};

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-stone-100 text-stone-700",
  REVIEW: "bg-gold-50 text-gold-700",
  APPROVED: "bg-gold-50 text-gold-700",
  SENT: "bg-navy-100 text-navy-700",
  CONFIRMED: "bg-emerald-50 text-emerald-700",
  PARTIALLY_RECEIVED: "bg-emerald-50 text-emerald-700",
  RECEIVED: "bg-emerald-50 text-emerald-700",
  CLOSED: "bg-stone-100 text-stone-500",
  CANCELLED: "bg-rose-50 text-rose-700",
};

function SupplierOrdersPanel({ supplierId }: { supplierId: string }) {
  const [orders, setOrders] = useState<SupplierOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/v1/orders?supplierId=${supplierId}&pageSize=20`)
      .then((r) => r.json())
      .then((body) => { if (!cancelled) { setOrders(body?.data ?? []); setLoading(false); } });
    return () => { cancelled = true; };
  }, [supplierId]);

  if (loading) return <div className="py-6 text-center text-stone-500 text-sm">Lade Bestellungen…</div>;
  if (orders.length === 0) {
    return <div className="py-6 text-center text-stone-500 text-sm">Noch keine Bestellungen für diesen Lieferanten.</div>;
  }

  return (
    <div className="border border-stone-200 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-stone-50 text-[11px] tracking-[0.16em] uppercase text-stone-500">
            <th className="text-left font-medium px-3 py-2">Nr.</th>
            <th className="text-left font-medium px-3 py-2">Status</th>
            <th className="text-left font-medium px-3 py-2">Pos.</th>
            <th className="text-right font-medium px-3 py-2">Summe</th>
            <th className="text-left font-medium px-3 py-2">Erstellt</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="border-t border-stone-100">
              <td className="px-3 py-2 font-mono text-xs">{o.orderNo}</td>
              <td className="px-3 py-2">
                <span className={"inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium " + (STATUS_STYLES[o.status] ?? "bg-stone-100 text-stone-700")}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />{o.status}
                </span>
              </td>
              <td className="px-3 py-2 text-xs">{o._count?.items ?? "—"}</td>
              <td className="px-3 py-2 text-right font-medium">{Number(o.total).toFixed(2)} {o.currency}</td>
              <td className="px-3 py-2 text-xs text-stone-500">{new Date(o.createdAt).toLocaleDateString("de-DE")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
