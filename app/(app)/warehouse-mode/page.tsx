import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { WarehouseModeView } from "./warehouse-mode-view";

export const dynamic = "force-dynamic";

export default async function WarehouseModePage({
  searchParams,
}: {
  searchParams: Promise<{ zone?: string | string[]; i?: string | string[] }>;
}) {
  const session = await auth();
  if (!session?.role || !session.tenant) redirect("/login");
  const { zone, i } = await searchParams;
  const zoneId = typeof zone === "string" && zone.trim() ? zone.trim() : undefined;
  const idx = typeof i === "string" && /^\d{1,6}$/.test(i) ? Number(i) : undefined;
  return <WarehouseModeView role={session.role} tenant={session.tenant} zoneId={zoneId} initialIndex={idx} />;
}
