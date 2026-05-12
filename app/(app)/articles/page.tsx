import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { articleRepo } from "@/lib/db/repos/article";
import { prisma } from "@/lib/db/client";
import { ArticlesView } from "./articles-view";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  q?: string;
  category?: string;
  supplierId?: string;
  page?: string;
}>;

export default async function ArticlesPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth();
  if (!session?.role || !session.tenant) redirect("/login");

  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));

  const { items, total } = await articleRepo.list({
    tenantId: session.tenant,
    q: sp.q,
    category: sp.category,
    supplierId: sp.supplierId,
    page,
    pageSize: 50,
  });

  // For the "Primärlieferant" column we need the primary supplier per article.
  const primarySuppliers = items.length
    ? await prisma.articleSupplier.findMany({
        where: { articleId: { in: items.map((a) => a.id) }, isPrimary: true },
        include: { supplier: true },
      })
    : [];
  const primaryByArticle = new Map(
    primarySuppliers.map((ps) => [
      ps.articleId,
      { name: ps.supplier.name, purchasePrice: ps.purchasePrice.toString() },
    ]),
  );

  // Default location (Code) per article
  const locationIds = items
    .map((a) => a.defaultLocationId)
    .filter((id): id is string => Boolean(id));
  const locations = locationIds.length
    ? await prisma.storageLocation.findMany({ where: { id: { in: locationIds } } })
    : [];
  const locByArticle = new Map(
    items
      .filter((a) => a.defaultLocationId)
      .map((a) => [a.id, locations.find((l) => l.id === a.defaultLocationId)?.code ?? ""]),
  );

  const belowMinCount = items.filter((a) => a.minStock > 0).length;
  const categories = Array.from(
    new Set(items.map((a) => a.category).filter((c): c is string => Boolean(c))),
  );

  const rows = items.map((a) => {
    const primary = primaryByArticle.get(a.id);
    return {
      id: a.id,
      sku: a.sku,
      name: a.name,
      eanGtin: a.eanGtin,
      category: a.category,
      locationCode: locByArticle.get(a.id) ?? "—",
      stock: 0, // Real stock arrives in M3; for now show 0/—
      minStock: a.minStock,
      orderUnit: a.orderUnit,
      ek: primary?.purchasePrice ?? null,
      primarySupplierName: primary?.name ?? "—",
      role: session.role!,
    };
  });

  const canCreate =
    session.role === "USER" || session.role === "MANAGER" || session.role === "GLOBAL_ADMIN";

  return (
    <ArticlesView
      rows={rows}
      total={total}
      categories={categories}
      belowMinCount={belowMinCount}
      canCreate={canCreate}
      q={sp.q ?? ""}
    />
  );
}
