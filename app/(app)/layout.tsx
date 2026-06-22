import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { CommandPalette } from "@/components/search/command-palette";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.role) redirect("/login");

  const user = {
    name: session.user?.name ?? session.user?.email ?? "Unbekannt",
    email: session.user?.email ?? undefined,
    role: session.role,
    tenant: session.tenant ?? "—",
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar user={user} />
      <main className="flex-1 min-w-0">
        <Topbar user={user} />
        <section className="p-5 md:p-8">{children}</section>
      </main>
      <CommandPalette />
    </div>
  );
}
