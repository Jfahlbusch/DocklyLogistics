// @vitest-environment jsdom
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "../helpers/intl";
import { TabBar } from "@/components/layout/tab-bar";
import { SEARCH_OPEN_EVENT } from "@/components/search/open-search";

const nav = vi.hoisted(() => ({ pathname: "/dashboard" }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => nav.pathname,
}));

afterEach(() => {
  cleanup();
  nav.pathname = "/dashboard";
});

describe("TabBar (unter 992 px)", () => {
  it("führt je Bereich einen Tab zum ersten erlaubten Ziel, danach die Suche", () => {
    renderWithIntl(<TabBar role="USER" />);
    const links = screen.getAllByRole("link");
    expect(links.map((l) => [l.getAttribute("aria-label"), l.getAttribute("href")])).toEqual([
      ["Übersicht", "/dashboard"],
      ["Einkauf", "/order-suggestions"],
      ["Lagermodus", "/warehouse-mode"],
      ["Lager", "/stock"],
      ["Verwaltung", "/audit"],
    ]);
    expect(screen.getByRole("button", { name: "Suche" })).toBeInTheDocument();
  });

  it("markiert den Bereich der aktuellen Seite und zeigt nur dort das Label", () => {
    nav.pathname = "/articles/abc";
    renderWithIntl(<TabBar role="USER" />);
    const active = screen.getByRole("link", { current: "page" });
    expect(active).toHaveAttribute("aria-label", "Lager");
    expect(active).toHaveTextContent("Lager");
    // mit Lagermodus-Taste: Label erst ab 430 px Breite sichtbar (6 Tasten passen sonst nicht in 375 px)
    expect(active.querySelector("span")).toHaveClass("hidden", "min-[430px]:inline");
    expect(screen.getByRole("link", { name: "Einkauf" })).toHaveTextContent("");
  });

  it("respektiert die Feature-Rechte: Ziel = erster erlaubter Eintrag, leere Bereiche entfallen", () => {
    renderWithIntl(<TabBar role="USER" allowed={["dashboard", "orders", "stock"]} />);
    expect(screen.getAllByRole("link").map((l) => l.getAttribute("href"))).toEqual(["/dashboard", "/orders", "/stock"]);
  });

  // Nutzerwunsch 18.10.2026: Lagermodus als eigene, hervorgehobene Taste in der Mitte der mobilen Leiste.
  it("zeigt den Lagermodus als hervorgehobene Taste in der Mitte und markiert ihn auf /warehouse-mode", () => {
    nav.pathname = "/warehouse-mode";
    renderWithIntl(<TabBar role="USER" />);
    const scan = screen.getByRole("link", { name: "Lagermodus" });
    expect(scan).toHaveAttribute("href", "/warehouse-mode");
    expect(scan).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Lager" })).not.toHaveAttribute("aria-current");
    expect(scan).toHaveAttribute("data-slot", "tab-scan");
    expect(scan.className).toContain("rounded-full");
  });

  it("blendet den Lagermodus ohne Feature-Recht aus", () => {
    renderWithIntl(<TabBar role="USER" allowed={["dashboard", "stock", "articles"]} />);
    expect(screen.queryByRole("link", { name: "Lagermodus" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("link").map((l) => l.getAttribute("aria-label"))).toEqual(["Übersicht", "Lager"]);
  });

  it("öffnet über den Such-Tab die ⌘K-Palette", () => {
    const listener = vi.fn();
    window.addEventListener(SEARCH_OPEN_EVENT, listener);
    renderWithIntl(<TabBar role="USER" />);
    fireEvent.click(screen.getByRole("button", { name: "Suche" }));
    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener(SEARCH_OPEN_EVENT, listener);
  });

  it("sitzt mittig am unteren Rand (Nutzerwunsch 17.10.2026, abweichend von der linksbündigen Vorlage)", () => {
    renderWithIntl(<TabBar role="USER" />);
    const bar = screen.getByRole("navigation", { name: "Bereiche" });
    expect(bar).toHaveClass("left-1/2", "-translate-x-1/2");
    expect(bar.className).not.toMatch(/(^|\s)left-2(\s|$)|min-\[400px\]:left-4/);
    expect(bar.className).toContain("max-w-[calc(100vw-1rem)]");
  });

  it("ist nur unter 992 px sichtbar und liegt über der Safe-Area", () => {
    renderWithIntl(<TabBar role="USER" />);
    const bar = screen.getByRole("navigation", { name: "Bereiche" });
    expect(bar.className).toContain("nav:hidden");
    expect(bar.className).toContain("env(safe-area-inset-bottom)");
  });
});
