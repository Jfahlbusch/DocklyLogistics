import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { WarehouseModeView } from "./warehouse-mode-view";

export const dynamic = "force-dynamic";

export default async function WarehouseModePage({
  searchParams,
}: {
  searchParams: Promise<{ zone?: string | string[] }>;
}) {
  const session = await auth();
  if (!session?.role || !session.tenant) redirect("/login");
  const { zone } = await searchParams;
  const zoneId = typeof zone === "string" && zone.trim() ? zone.trim() : undefined;
  return <WarehouseModeView role={session.role} tenant={session.tenant} zoneId={zoneId} />;
}
