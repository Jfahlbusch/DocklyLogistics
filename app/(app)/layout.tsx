import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { TabBar } from "@/components/layout/tab-bar";
import { NavigationStateProvider } from "@/components/layout/navigation-state";
import { CommandPalette } from "@/components/search/command-palette";
import { NAV_ENTRIES } from "@/lib/navigation";
import { NAVIGATION_COOKIE, readNavigationPreference } from "@/lib/navigation-preference";
import { readSidebarPreference } from "@/lib/sidebar-preference";
import type { TenantNavigation } from "@/lib/schemas/tenant-view";
import { resolveUserFeatures } from "@/lib/services/feature-access";
import { tenantRepo } from "@/lib/db/repos/tenant";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.role) redirect("/login");

  const tenant = session.tenant ?? "—";
  const email = session.user?.email ?? "";
  const userName = session.user?.name ?? (email || "Unbekannt");

  // Effective feature visibility for this user → which nav entries to show.
  const dbUser = email
    ? await prisma.user.findFirst({ where: { tenantId: tenant, email }, select: { id: true } })
    : null;
  const features = await resolveUserFeatures(tenant, dbUser?.id ?? (email || "—"), session.role);
  const allowedNav = NAV_ENTRIES.filter((n) => features[n.id] !== false).map((n) => n.id);

  // Mandantenliste NUR für GLOBAL_ADMIN laden — kein Mandantennamen-Leak an andere Rollen.
  const tenants = session.role === "GLOBAL_ADMIN" ? await tenantRepo.list() : undefined;
  const currentName =
    tenants?.find((t) => t.id === tenant)?.name ?? (await tenantRepo.findById(tenant))?.name ?? tenant;
  const tenantNavigation: TenantNavigation = {
    currentTenant: tenant,
    homeTenant: session.homeTenant ?? tenant,
    currentName,
    tenants,
  };

  // Anzeigepräferenzen schon im Server-HTML (kein Sprung beim Laden): eingeklappte Leiste, offene Bereiche.
  const cookieStore = await cookies();
  const { collapsed, hasPreference } = readSidebarPreference((name) => cookieStore.get(name)?.value);
  const initialOpen = readNavigationPreference(cookieStore.get(NAVIGATION_COOKIE)?.value);

  return (
    <NavigationStateProvider initialOpen={initialOpen}>
      <div className="flex min-h-dvh">
        <Sidebar
          role={session.role}
          allowed={allowedNav}
          userName={userName}
          userEmail={email}
          tenantNavigation={tenantNavigation}
          initialCollapsed={collapsed}
          hasPreference={hasPreference}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            role={session.role}
            allowed={allowedNav}
            userName={userName}
            userEmail={email}
            tenantNavigation={tenantNavigation}
          />
          <main className="min-h-0 flex-1 px-4 pt-5 pb-[calc(6rem+env(safe-area-inset-bottom))] md:px-8 md:pt-8 nav:pb-8">
            {children}
          </main>
        </div>
        <TabBar role={session.role} allowed={allowedNav} />
        <CommandPalette allowedNav={allowedNav} />
      </div>
    </NavigationStateProvider>
  );
}
