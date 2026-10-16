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
      ["Lager", "/stock"],
      ["Verwaltung", "/audit"],
    ]);
    expect(screen.getByRole("button", { name: "Suche" })).toBeInTheDocument();
  });

  it("markiert den Bereich der aktuellen Seite und zeigt nur dort das Label", () => {
    nav.pathname = "/warehouse-mode/scan";
    renderWithIntl(<TabBar role="USER" />);
    const active = screen.getByRole("link", { current: "page" });
    expect(active).toHaveAttribute("aria-label", "Lager");
    expect(active).toHaveTextContent("Lager");
    expect(screen.getByRole("link", { name: "Einkauf" })).toHaveTextContent("");
  });

  it("respektiert die Feature-Rechte: Ziel = erster erlaubter Eintrag, leere Bereiche entfallen", () => {
    renderWithIntl(<TabBar role="USER" allowed={["dashboard", "orders", "warehouse"]} />);
    expect(screen.getAllByRole("link").map((l) => l.getAttribute("href"))).toEqual(["/dashboard", "/orders", "/warehouse-mode"]);
  });

  it("öffnet über den Such-Tab die ⌘K-Palette", () => {
    const listener = vi.fn();
    window.addEventListener(SEARCH_OPEN_EVENT, listener);
    renderWithIntl(<TabBar role="USER" />);
    fireEvent.click(screen.getByRole("button", { name: "Suche" }));
    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener(SEARCH_OPEN_EVENT, listener);
  });

  it("ist nur unter 992 px sichtbar und liegt über der Safe-Area", () => {
    renderWithIntl(<TabBar role="USER" />);
    const bar = screen.getByRole("navigation", { name: "Bereiche" });
    expect(bar.className).toContain("nav:hidden");
    expect(bar.className).toContain("env(safe-area-inset-bottom)");
  });
});
