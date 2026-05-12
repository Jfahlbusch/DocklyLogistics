import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { storageLocationRepo } from "@/lib/db/repos/storage-location";
import { articleRepo } from "@/lib/db/repos/article";
import { prisma } from "@/lib/db/client";
import { StockView } from "./stock-view";

export const dynamic = "force-dynamic";

export default async function StockPage() {
  const session = await auth();
  if (!session?.role || !session.tenant) redirect("/login");

  const tenantId = session.tenant;

  const [locResult, artResult] = await Promise.all([
    storageLocationRepo.list({ tenantId, page: 1, pageSize: 200 }),
    articleRepo.list({ tenantId, page: 1, pageSize: 200 }),
  ]);

  const locationIds = artResult.items.map((a) => a.defaultLocationId).filter((id): id is string => Boolean(id));
  const locationsForArticles = locationIds.length
    ? await prisma.storageLocation.findMany({ where: { id: { in: locationIds } } })
    : [];
  const locByArticle = new Map(artResult.items
    .filter((a) => a.defaultLocationId)
    .map((a) => [a.id, locationsForArticles.find((l) => l.id === a.defaultLocationId)?.code ?? "—"])
  );

  const locations = locResult.items.map((l) => ({
    id: l.id,
    code: l.code,
    name: l.name,
    zone: l.zone ?? "—",
    capacity: l.capacity ?? null,
    used: 0, // Real usage comes in M3 (StockBalance aggregation)
  }));

  const articleRows = artResult.items.map((a) => ({
    id: a.id,
    sku: a.sku,
    name: a.name,
    locationCode: locByArticle.get(a.id) ?? "—",
    stock: 0,
    minStock: a.minStock,
  }));

  const totalUnits = 0; // M3

  return <StockView locations={locations} articles={articleRows} totalUnits={totalUnits} />;
}
