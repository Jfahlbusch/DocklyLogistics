import { cn } from "@/lib/utils";

/** User badge shown at the bottom of the sidebar / mobile drawer. */
export function SidebarUser({
  user,
  collapsed,
}: {
  user: { name: string; role: string; tenant: string };
  collapsed?: boolean;
}) {
  const initials = user.name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("");
  return (
    <div
      className={cn(
        "flex items-center border-t border-white/10 py-4",
        collapsed ? "justify-center px-2" : "gap-3 px-5",
      )}
      title={collapsed ? `${user.name} · ${user.role} · ${user.tenant}` : undefined}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-medium text-white">
        {initials}
      </div>
      {!collapsed && (
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-white">{user.name}</div>
          <div className="truncate text-xs text-white/50">
            {user.role} · {user.tenant}
          </div>
        </div>
      )}
    </div>
  );
}
