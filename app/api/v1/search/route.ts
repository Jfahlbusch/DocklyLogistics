import type { NextRequest } from "next/server";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders } from "@/lib/api/guard";
import { ok } from "@/lib/api/respond";
import { articleRepo } from "@/lib/db/repos/article";
import { supplierRepo } from "@/lib/db/repos/supplier";
import { orderRepo } from "@/lib/db/repos/order";

/**
 * GET /api/v1/search?q=…
 *
 * Globale Suche über alle Funktionsbereiche (Artikel, Lieferanten, Bestellungen).
 * Fan-out parallel, tenant-gescoped (aus den Session-Headern, NIE aus dem Request),
 * pro Gruppe gedeckelt. Liefert das portable Kontrakt-Format
 * `{ groups: [{ key, label, items: [{ id, title, subtitle?, href }] }] }`.
 * Leere Gruppen werden serverseitig entfernt; `href` ist der Deep-Link, der den
 * Datensatz direkt öffnet.
 */

const PER_GROUP = 5;
const MIN_LEN = 2;

const ORDER_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Entwurf",
  REVIEW: "Prüfung",
  APPROVED: "Freigegeben",
  SENT: "Versendet",
  CONFIRMED: "Bestätigt",
  PARTIALLY_RECEIVED: "Teilweise erhalten",
  RECEIVED: "Erhalten",
  CLOSED: "Abgeschlossen",
  CANCELLED: "Storniert",
};

type SearchItem = { id: string; title: string; subtitle?: string; href: string };
type SearchGroup = { key: string; label: string; items: SearchItem[] };

function joinParts(...parts: Array<string | null | undefined>): string | undefined {
  const s = parts.filter((p): p is string => Boolean(p && p.trim())).join(" · ");
  return s || undefined;
}

export const GET = handler(async (req: NextRequest) => {
  const ctx = requireRoleFromHeaders(req.headers, "VIEWER");
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();

  // Hard guard: never scan the DB on a single keystroke.
  if (q.length < MIN_LEN) return ok({ groups: [] as SearchGroup[] });

  const [articles, suppliers, orders] = await Promise.all([
    articleRepo.list({ tenantId: ctx.tenantId, q, page: 1, pageSize: PER_GROUP }),
    supplierRepo.list({ tenantId: ctx.tenantId, q, page: 1, pageSize: PER_GROUP }),
    orderRepo.list({ tenantId: ctx.tenantId, q, page: 1, pageSize: PER_GROUP }),
  ]);

  const groups: SearchGroup[] = [
    {
      key: "articles",
      label: "Artikel",
      items: articles.items.map((a) => ({
        id: a.id,
        title: joinParts(a.name, a.sku) ?? a.name,
        subtitle: joinParts(a.eanGtin, a.category),
        href: `/articles?open=${a.id}`,
      })),
    },
    {
      key: "suppliers",
      label: "Lieferanten",
      items: suppliers.items.map((s) => ({
        id: s.id,
        title: s.name,
        subtitle: joinParts(s.contactName, s.city, s.email),
        href: `/suppliers?open=${s.id}`,
      })),
    },
    {
      key: "orders",
      label: "Bestellungen",
      items: orders.items.map((o) => ({
        id: o.id,
        title: o.orderNo,
        subtitle: joinParts(o.supplier?.name, ORDER_STATUS_LABEL[o.status] ?? o.status),
        href: `/orders?open=${o.id}`,
      })),
    },
  ].filter((g) => g.items.length > 0);

  return ok({ groups });
});
