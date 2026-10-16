// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import de from "../../messages/de.json";
import { Sidebar } from "@/components/layout/sidebar";
import { sidebarSpacePx } from "@/lib/sidebar-geometry";

vi.mock("@/components/layout/brand", () => ({ Brand: () => null }));
vi.mock("@/components/layout/nav-links", () => ({ NavLinks: () => null }));
vi.mock("@/components/layout/sidebar-user", () => ({ SidebarUser: () => null }));
vi.mock("@/components/layout/tenant-switcher", () => ({ TenantSwitcher: () => null }));

function sidebar(initialCollapsed: boolean, hasPreference: boolean) {
  return (
    <NextIntlClientProvider locale="de" messages={de}>
      <Sidebar
        role="VIEWER"
        userName=""
        userEmail=""
        initialCollapsed={initialCollapsed}
        hasPreference={hasPreference}
      />
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.cookie = "ui_sidebar=; Path=/; Max-Age=0";
});

describe("Sidebar beim ersten Seitenaufbau", () => {
  it("Server-HTML enthält bereits die eingeklappte Cookie-Breite", () => {
    const html = renderToString(sidebar(true, true));
    expect(html).toContain("w-[76px]");
    expect(html).toContain("var(--app-sidebar-width, 76px)");
    expect(html).not.toContain("transition-[width]");
  });

  it("Cookie-Standard bleibt trotz widersprechendem Altwert bestehen; Umschalten funktioniert", () => {
    localStorage.setItem("sidebar-collapsed", "1");
    const { container } = render(sidebar(false, true));
    expect(container.querySelector("aside")).toHaveClass("w-[268px]");
    expect(container.querySelector("aside")?.style.width).toBe("");
    fireEvent.click(screen.getByRole("button", { name: de.shell.sidebar.collapseMenu }));
    expect(container.querySelector("aside")).toHaveClass("w-[76px]");
    expect(document.cookie).toContain("ui_sidebar=1");
  });

  it("Altwert wird übernommen und Bootstrap-Breite danach entfernt", () => {
    localStorage.setItem("sidebar-collapsed", "1");
    const { container } = render(sidebar(false, false));
    expect(container.querySelector("aside")).toHaveClass("w-[76px]");
    expect(container.querySelector("aside")?.style.width).toBe("");
    expect(document.cookie).toContain("ui_sidebar=1");
    fireEvent.click(screen.getByRole("button", { name: de.shell.sidebar.expandMenu }));
    expect(container.querySelector("aside")).toHaveClass("w-[268px]");
    expect(document.cookie).toContain("ui_sidebar=0");
    expect(localStorage.getItem("sidebar-collapsed")).toBe("0");
  });
});

describe("Sidebar im Portal-Aufbau (develop 1aff3fd)", () => {
  it("ist schwebend: 12 px vom oberen und linken Rand, Höhe Display − 24 px, Radius 26 px, Rand rundum", () => {
    const { container } = render(sidebar(false, true));
    const aside = container.querySelector("aside");
    expect(aside).toHaveClass("fixed", "start-3", "top-3", "h-[calc(100dvh-1.5rem)]", "rounded-[26px]", "border", "border-sidebar-border", "sidebar-panel");
    expect(aside?.className).not.toMatch(/(?:^|\s)(?:left|inset|top|bottom)-0\b|\bh-dvh\b|rounded-none/);
  });
  it("beginnt erst ab 992 px (lg), darunter übernimmt der Drawer", () => {
    const { container } = render(sidebar(false, true));
    expect(container.querySelector("aside")).toHaveClass("hidden", "nav:flex");
    expect(container.querySelector("aside")?.className).not.toMatch(/\bmd:/);
  });
  it("hält im Seitengefüge Platz für Breite plus Abstand links und rechts: 292 px, eingeklappt 100 px", () => {
    const open = render(sidebar(false, true));
    const spacer = open.container.firstElementChild;
    expect(spacer).toHaveClass("hidden", "nav:block", "w-[292px]");
    expect(sidebarSpacePx(false)).toBe(292);
    open.unmount();
    const closed = render(sidebar(true, true));
    expect(closed.container.firstElementChild).toHaveClass("w-[100px]");
    expect(sidebarSpacePx(true)).toBe(100);
  });
  it("trägt den Einklapp-Knopf auf der Kante: 32 px, 24 px von oben, 16 px nach außen, rund", () => {
    render(sidebar(false, true));
    const toggle = screen.getByRole("button", { name: de.shell.sidebar.collapseMenu });
    expect(toggle).toHaveClass("absolute", "-end-4", "top-6", "size-8", "rounded-full", "border", "pointer-coarse:size-11");
    expect(toggle.closest("aside")).not.toBeNull();
  });
  it("hat kein Suchfeld im Menü (das Portal hat dort keines); ⌘K bleibt in Kopfleiste und Tab-Leiste", () => {
    render(sidebar(false, true));
    expect(screen.queryByRole("button", { name: /Suchen…/ })).not.toBeInTheDocument();
  });
  it("ist an die Displayhöhe gebunden und scrollt nicht", () => {
    const { container } = render(sidebar(false, true));
    const aside = container.querySelector("aside");
    expect(aside).toHaveClass("h-[calc(100dvh-1.5rem)]");
    expect(aside?.className).not.toMatch(/overflow-(?:y-)?(?:auto|scroll)/);
  });
});
