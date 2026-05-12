import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { orderSuggestionRepo } from "@/lib/db/repos/order-suggestion";
import { supplierRepo } from "@/lib/db/repos/supplier";
import { SuggestionsView } from "./suggestions-view";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ status?: string }>;

export default async function SuggestionsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth();
  if (!session?.role || !session.tenant) redirect("/login");

  const tenantId = session.tenant;
  const sp = await searchParams;
  const status =
    sp.status === "CONFIRMED" || sp.status === "DISMISSED" || sp.status === "PENDING"
      ? sp.status
      : undefined;

  const [{ items, total }, suppliers] = await Promise.all([
    orderSuggestionRepo.list({ tenantId, status, page: 1, pageSize: 500 }),
    supplierRepo.list({ tenantId, page: 1, pageSize: 200 }),
  ]);

  const rows = items.map((s) => ({
    id: s.id,
    status: s.status,
    reason: s.reason,
    qtyOrderUnit: s.qtyOrderUnit,
    note: s.note,
    article: {
      sku: s.article.sku,
      name: s.article.name,
      minStock: s.article.minStock,
      orderUnit: s.article.orderUnit,
      packFactor: s.article.packFactor,
    },
    supplier: s.supplier
      ? { id: s.supplier.id, name: s.supplier.name, channel: s.supplier.channel }
      : null,
    createdAt: s.createdAt.toISOString(),
  }));

  const supplierOptions = suppliers.items.map((s) => ({
    id: s.id,
    name: s.name,
    channel: s.channel,
  }));

  const canConfirm =
    session.role === "USER" || session.role === "MANAGER" || session.role === "GLOBAL_ADMIN";

  return (
    <SuggestionsView
      rows={rows}
      total={total}
      currentStatus={status ?? "PENDING"}
      suppliers={supplierOptions}
      canConfirm={canConfirm}
    />
  );
}
