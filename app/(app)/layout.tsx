import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { CommandPalette } from "@/components/search/command-palette";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { resolveUserFeatures } from "@/lib/services/feature-access";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.role) redirect("/login");

  const tenant = session.tenant ?? "—";
  const email = session.user?.email ?? undefined;
  const user = {
    name: session.user?.name ?? email ?? "Unbekannt",
    email,
    role: session.role,
    tenant,
  };

  // Effective feature visibility for this user → which nav areas to show.
  const dbUser = email
    ? await prisma.user.findFirst({ where: { tenantId: tenant, email }, select: { id: true } })
    : null;
  const features = await resolveUserFeatures(tenant, dbUser?.id ?? email ?? "—", session.role);
  const allowedNav = NAV_ITEMS.filter((n) => features[n.id] !== false).map((n) => n.id);

  return (
    <div className="flex min-h-screen">
      <Sidebar user={user} allowedNav={allowedNav} />
      <main className="flex-1 min-w-0">
        <Topbar user={user} allowedNav={allowedNav} />
        <section className="p-5 md:p-8">{children}</section>
      </main>
      <CommandPalette />
    </div>
  );
}
