import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { orderRepo } from "@/lib/db/repos/order";
import { supplierRepo } from "@/lib/db/repos/supplier";
import { OrdersView } from "./orders-view";
import type { OrderStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const VALID_STATUSES: OrderStatus[] = [
  "DRAFT", "REVIEW", "APPROVED", "SENT", "CONFIRMED",
  "PARTIALLY_RECEIVED", "RECEIVED", "CLOSED", "CANCELLED",
];

type SearchParams = Promise<{
  status?: string;
  supplierId?: string;
  q?: string;
  from?: string;
  to?: string;
}>;

export default async function OrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth();
  if (!session?.role || !session.tenant) redirect("/login");

  const sp = await searchParams;
  const status = sp.status && VALID_STATUSES.includes(sp.status as OrderStatus) ? (sp.status as OrderStatus) : undefined;

  const [{ items, total }, supplierList] = await Promise.all([
    orderRepo.list({
      tenantId: session.tenant,
      status,
      supplierId: sp.supplierId,
      q: sp.q,
      from: sp.from,
      to: sp.to,
      page: 1, pageSize: 200,
    }),
    supplierRepo.list({ tenantId: session.tenant, page: 1, pageSize: 200 }),
  ]);

  const rows = items.map((o) => ({
    id: o.id,
    orderNo: o.orderNo,
    supplierName: o.supplier.name,
    channel: o.supplier.channel,
    status: o.status,
    itemCount: o._count.items,
    total: o.total.toString(),
    currency: o.currency,
    createdAt: o.createdAt.toISOString(),
    sentAt: o.sentAt?.toISOString() ?? null,
  }));

  const suppliers = supplierList.items.map((s) => ({ id: s.id, name: s.name }));
  const canCreate = session.role === "USER" || session.role === "MANAGER" || session.role === "GLOBAL_ADMIN";

  return <OrdersView rows={rows} total={total} suppliers={suppliers} canCreate={canCreate} filters={{ status: status ?? "", supplierId: sp.supplierId ?? "", q: sp.q ?? "" }} />;
}
