import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { supplierRepo } from "@/lib/db/repos/supplier";
import { prisma } from "@/lib/db/client";
import { SuppliersView } from "./suppliers-view";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  q?: string;
  channel?: "EMAIL" | "API" | "EDI";
  page?: string;
}>;

export default async function SuppliersPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth();
  if (!session?.role || !session.tenant) redirect("/login");

  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));

  const { items, total } = await supplierRepo.list({
    tenantId: session.tenant,
    q: sp.q,
    channel: sp.channel,
    page,
    pageSize: 50,
  });

  // Aggregate open orders and YTD revenue per supplier
  const supplierIds = items.map((s) => s.id);
  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const [openCounts, ytdSums] = supplierIds.length === 0
    ? [[], []] as const
    : await Promise.all([
        prisma.order.groupBy({
          by: ["supplierId"],
          where: { tenantId: session.tenant, supplierId: { in: supplierIds }, status: { notIn: ["CLOSED", "CANCELLED"] } },
          _count: { _all: true },
        }),
        prisma.order.groupBy({
          by: ["supplierId"],
          where: { tenantId: session.tenant, supplierId: { in: supplierIds }, status: { notIn: ["CANCELLED"] }, createdAt: { gte: yearStart } },
          _sum: { total: true },
        }),
      ]);
  const openByS = new Map(openCounts.map((c) => [c.supplierId, c._count._all]));
  const ytdByS = new Map(ytdSums.map((c) => [c.supplierId, Number(c._sum.total ?? 0)]));

  const cards = items.map((s) => ({
    id: s.id,
    name: s.name,
    contactName: s.contactName ?? "—",
    email: s.email ?? "—",
    phone: s.phone ?? "—",
    city: s.city ?? "—",
    channel: s.channel,
    active: s.active,
    openOrders: openByS.get(s.id) ?? 0,
    ytdRevenue: (ytdByS.get(s.id) ?? 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  }));

  const canCreate = session.role === "MANAGER" || session.role === "GLOBAL_ADMIN";

  return <SuppliersView cards={cards} total={total} canCreate={canCreate} q={sp.q ?? ""} />;
}
