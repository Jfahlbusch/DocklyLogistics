import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { WarehouseModeView } from "./warehouse-mode-view";

export const dynamic = "force-dynamic";

export default async function WarehouseModePage() {
  const session = await auth();
  if (!session?.role || !session.tenant) redirect("/login");
  return <WarehouseModeView role={session.role} tenant={session.tenant} />;
}
