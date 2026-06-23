/** User badge shown at the bottom of the sidebar / mobile drawer. */
export function SidebarUser({ user }: { user: { name: string; role: string; tenant: string } }) {
  const initials = user.name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("");
  return (
    <div className="flex items-center gap-3 border-t border-white/10 px-5 py-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xs font-medium text-white">
        {initials}
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-white">{user.name}</div>
        <div className="truncate text-xs text-white/50">
          {user.role} · {user.tenant}
        </div>
      </div>
    </div>
  );
}
