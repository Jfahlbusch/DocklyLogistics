import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { TabBar } from "@/components/layout/tab-bar";
import { CommandPalette } from "@/components/search/command-palette";
import { NAV_ITEMS } from "@/components/layout/nav-items";
import { resolveUserFeatures } from "@/lib/services/feature-access";
import { tenantRepo } from "@/lib/db/repos/tenant";

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

  // Mandantenliste NUR für GLOBAL_ADMIN laden — kein Mandantennamen-Leak an andere Rollen.
  const tenantSwitcher =
    session.role === "GLOBAL_ADMIN"
      ? {
          currentTenant: tenant,
          homeTenant: session.homeTenant ?? tenant,
          tenants: await tenantRepo.list(),
        }
      : null;

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar user={user} allowedNav={allowedNav} tenantSwitcher={tenantSwitcher} />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar user={user} allowedNav={allowedNav} tenantSwitcher={tenantSwitcher} />
        <section
          id="app-scroll"
          className="min-h-0 flex-1 overflow-y-auto p-5 pb-[calc(env(safe-area-inset-bottom)+96px)] md:p-8"
        >
          {children}
        </section>
      </main>
      <TabBar allowedNav={allowedNav} />
      <CommandPalette allowedNav={allowedNav} />
    </div>
  );
}
