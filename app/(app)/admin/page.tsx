import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { adminFeaturesRepo } from "@/lib/db/repos/admin-features";
import { FEATURES } from "@/lib/features";
import { AdminView } from "./admin-view";

export const dynamic = "force-dynamic";

/** Operator area — hard GLOBAL_ADMIN gate (nav hides it, this enforces it). */
export default async function AdminPage() {
  const session = await auth();
  if (!session?.role) redirect("/login");
  if (session.role !== "GLOBAL_ADMIN") redirect("/dashboard");

  const [tenants, profiles] = await Promise.all([
    adminFeaturesRepo.listTenants(),
    adminFeaturesRepo.listProfiles(),
  ]);

  return (
    <AdminView
      initialTenants={tenants.map((t) => ({ ...t, createdAt: t.createdAt.toISOString() }))}
      initialProfiles={profiles.map((p) => ({ ...p, updatedAt: p.updatedAt.toISOString() }))}
      features={FEATURES.filter((f) => f.minRole !== "GLOBAL_ADMIN").map(({ key, label, group }) => ({
        key, label, group,
      }))}
    />
  );
}
