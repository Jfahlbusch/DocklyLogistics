import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { supplierRepo } from "@/lib/db/repos/supplier";
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

  const cards = items.map((s) => ({
    id: s.id,
    name: s.name,
    contactName: s.contactName ?? "—",
    email: s.email ?? "—",
    phone: s.phone ?? "—",
    city: s.city ?? "—",
    channel: s.channel,
    active: s.active,
    openOrders: 0, // Orders ship in M4
    ytdRevenue: "0,00", // Orders ship in M4
  }));

  const canCreate = session.role === "MANAGER" || session.role === "GLOBAL_ADMIN";

  return <SuppliersView cards={cards} total={total} canCreate={canCreate} q={sp.q ?? ""} />;
}
