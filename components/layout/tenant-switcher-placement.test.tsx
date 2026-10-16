// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("./profile-actions", () => ({ logoutAction: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/orders", useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/search/open-search", () => ({ openSearch: vi.fn() }));
vi.mock("./notification-bell", () => ({ NotificationBell: () => null }));

import { Sidebar } from "./sidebar";
import { MobileNav } from "./mobile-nav";
import { Topbar } from "./topbar";
import type { ProfilUser } from "./profile-menu-content";

const user: ProfilUser = { name: "Max Mustermann", email: "max@example.com", role: "GLOBAL_ADMIN", tenant: "daube" };
const switcher = {
  currentTenant: "daube",
  homeTenant: "hylab",
  tenants: [
    { id: "daube", name: "daube" },
    { id: "hylab", name: "hylab" },
  ],
};
const SWITCH = { name: /Mandant wechseln/ };

afterEach(cleanup);

function precedes(a: Node, b: Node) {
  return Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
}

describe("Mandanten-Wechsler: Platzierung", () => {
  it("Sidebar: nur bei tenantSwitcher ≠ null; direkt unter dem Brand, vor der Navigation; kein TenantChip", () => {
    render(<Sidebar user={user} tenantSwitcher={switcher} />);
    const btn = screen.getByRole("button", SWITCH);
    expect(precedes(screen.getByText("LOGISTICS"), btn)).toBe(true);
    expect(precedes(btn, screen.getByRole("navigation", { name: "Hauptnavigation" }))).toBe(true);
    // Der Wechsler ersetzt den statischen Chip: Mandantenname kommt genau einmal vor.
    expect(screen.getAllByText("daube")).toHaveLength(1);
  });

  it("Sidebar ohne Wechsler (Nicht-Admin): statischer TenantChip, kein Wechsel-Auslöser", () => {
    render(<Sidebar user={{ ...user, role: "MANAGER" }} tenantSwitcher={null} />);
    expect(screen.queryByRole("button", SWITCH)).toBeNull();
    expect(screen.getByText("daube")).toBeTruthy();
  });

  it("Sidebar ohne Prop: wie bisher (TenantChip)", () => {
    render(<Sidebar user={user} />);
    expect(screen.queryByRole("button", SWITCH)).toBeNull();
  });

  it("Mobile-Drawer: Wechsler unter dem Logo, vor der Navigation", async () => {
    const ev = userEvent.setup();
    render(<MobileNav user={user} tenantSwitcher={switcher} />);
    await ev.click(screen.getByRole("button", { name: "Menü öffnen" }));
    const dialog = await screen.findByRole("dialog");
    const btn = within(dialog).getByRole("button", SWITCH);
    expect(precedes(within(dialog).getByText("LOGISTICS"), btn)).toBe(true);
    expect(precedes(btn, within(dialog).getByRole("navigation", { name: "Hauptnavigation" }))).toBe(true);
  });

  it("Mobile-Drawer ohne Wechsler: TenantChip", async () => {
    const ev = userEvent.setup();
    render(<MobileNav user={user} tenantSwitcher={null} />);
    await ev.click(screen.getByRole("button", { name: "Menü öffnen" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByRole("button", SWITCH)).toBeNull();
    expect(within(dialog).getByText("daube")).toBeTruthy();
  });

  it("Topbar zeigt den Wechsler selbst nicht (nur der Drawer)", () => {
    render(<Topbar user={user} tenantSwitcher={switcher} />);
    expect(screen.queryByRole("button", SWITCH)).toBeNull();
  });
});
