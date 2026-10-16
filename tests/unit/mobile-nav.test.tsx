// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "../helpers/intl";
import { MobileNav } from "@/components/layout/mobile-nav";
import { NavigationStateProvider } from "@/components/layout/navigation-state";

vi.mock("@/components/layout/profile-actions", () => ({ logoutAction: vi.fn() }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => "/dashboard",
}));

beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(1000);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function open() {
  renderWithIntl(
    <NavigationStateProvider>
      <MobileNav role="USER" userName="Jo Beispiel" userEmail="jo@example.test" tenantNavigation={{ currentTenant: "t", homeTenant: "t", currentName: "Bäckerei Muster" }} />
    </NavigationStateProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Menü öffnen" }));
  return screen.getByRole("dialog", { name: "Navigation" });
}

describe("MobileNav (Drawer unter 992 px)", () => {
  it("Burger ist 44 px groß und verschwindet ab 992 px", () => {
    renderWithIntl(<NavigationStateProvider><MobileNav role="USER" userName="" userEmail="" /></NavigationStateProvider>);
    const burger = screen.getByRole("button", { name: "Menü öffnen" });
    expect(burger).toHaveClass("size-11", "nav:hidden");
  });

  it("öffnet die schwebende Leiste: 12 px vom Rand, Höhe Display − 24 px, 268 px, Radius 26 px, Rand rundum", () => {
    const drawer = open();
    for (const cls of ["data-[side=left]:top-3", "data-[side=left]:left-3", "data-[side=left]:h-[calc(100dvh-1.5rem)]", "data-[side=left]:w-[268px]", "rounded-[26px]", "border", "sidebar-panel", "app-sidebar"]) {
      expect(drawer.className).toContain(cls);
    }
  });

  it("zeigt Unternehmen, Bereiche und Profilzeile; ein Ziel-Klick schließt den Drawer", () => {
    const drawer = open();
    expect(drawer).toHaveTextContent("Bäckerei Muster");
    expect(drawer).toHaveTextContent("Jo Beispiel");
    const link = screen.getByRole("link", { name: "Bestellungen" });
    link.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(link);
    expect(screen.queryByRole("dialog", { name: "Navigation" })).not.toBeInTheDocument();
  });
});
