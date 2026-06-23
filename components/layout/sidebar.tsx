import { Brand } from "./brand";
import { NavLinks } from "./nav-links";
import { SidebarUser } from "./sidebar-user";

type Props = {
  user: { name: string; role: string; tenant: string };
};

export function Sidebar({ user }: Props) {
  return (
    <aside className="app-sidebar hidden w-[260px] flex-shrink-0 md:flex md:flex-col">
      <Brand />
      <NavLinks />
      <SidebarUser user={user} />
    </aside>
  );
}
