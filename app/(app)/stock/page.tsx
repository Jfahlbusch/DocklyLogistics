import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { storageLocationRepo } from "@/lib/db/repos/storage-location";
import { articleRepo } from "@/lib/db/repos/article";
import { stockRepo } from "@/lib/db/repos/stock";
import { prisma } from "@/lib/db/client";
import { StockView } from "./stock-view";

export const dynamic = "force-dynamic";

export default async function StockPage() {
  const session = await auth();
  if (!session?.role || !session.tenant) redirect("/login");

  const tenantId = session.tenant;

  const [locResult, artResult, balanceResult] = await Promise.all([
    storageLocationRepo.list({ tenantId, page: 1, pageSize: 200 }),
    articleRepo.list({ tenantId, page: 1, pageSize: 200 }),
    stockRepo.listBalances({ tenantId, page: 1, pageSize: 500 }),
  ]);

  // Aggregate per location: total used quantity = sum of quantities of all balances at that location
  const usedByLocation = new Map<string, number>();
  for (const b of balanceResult.items) {
    usedByLocation.set(b.locationId, (usedByLocation.get(b.locationId) ?? 0) + b.quantity);
  }

  // Aggregate per article: total stock summed across all locations
  const totals = await stockRepo.totalsByArticle(
    tenantId,
    artResult.items.map((a) => a.id),
  );

  // Build article→default location code map (existing pattern)
  const locationIds = artResult.items
    .map((a) => a.defaultLocationId)
    .filter((id): id is string => Boolean(id));
  const locationsForArticles = locationIds.length
    ? await prisma.storageLocation.findMany({ where: { id: { in: locationIds } } })
    : [];
  const locByArticle = new Map(
    artResult.items
      .filter((a) => a.defaultLocationId)
      .map((a) => [
        a.id,
        locationsForArticles.find((l) => l.id === a.defaultLocationId)?.code ?? "—",
      ]),
  );

  const locations = locResult.items.map((l) => ({
    id: l.id,
    code: l.code,
    name: l.name,
    zone: l.zone ?? "—",
    capacity: l.capacity ?? null,
    used: usedByLocation.get(l.id) ?? 0,
  }));

  const articleRows = artResult.items.map((a) => ({
    id: a.id,
    sku: a.sku,
    name: a.name,
    locationCode: locByArticle.get(a.id) ?? "—",
    stock: totals.get(a.id) ?? 0,
    minStock: a.minStock,
  }));

  const totalUnits = Array.from(usedByLocation.values()).reduce((s, x) => s + x, 0);

  return (
    <StockView
      locations={locations}
      articles={articleRows}
      totalUnits={totalUnits}
      role={session.role}
    />
  );
}
