// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({ pathname: "/orders", openSearch: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname }));
vi.mock("@/components/search/open-search", () => ({ openSearch: mocks.openSearch }));

import { TabBar } from "./tab-bar";

let scroller: HTMLDivElement;

function scrollTo(top: number) {
  Object.defineProperty(scroller, "scrollTop", { value: top, configurable: true });
  act(() => {
    fireEvent.scroll(scroller);
  });
}

beforeEach(() => {
  mocks.pathname = "/orders";
  mocks.openSearch.mockClear();
  scroller = document.createElement("div");
  scroller.id = "app-scroll";
  document.body.appendChild(scroller);
});

afterEach(() => {
  cleanup();
  scroller.remove();
});

describe("TabBar", () => {
  it("rendert bei allen Rechten vier Tabs plus Such-Tab mit Kurzlabels", () => {
    render(<TabBar />);
    const nav = screen.getByRole("navigation", { name: "Schnellzugriff" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual(["Start", "Bestellungen", "Bestand", "Scan"]);
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "/dashboard", "/orders", "/stock", "/warehouse-mode",
    ]);
    expect(within(nav).getByRole("button", { name: "Suche" })).toBeTruthy();
    expect(within(nav).getAllByRole("button")).toHaveLength(1);
  });

  it("zeigt mit eingeschränkten Rechten nur erlaubte Tabs plus Suche", () => {
    render(<TabBar allowedNav={["dashboard", "orders"]} />);
    const nav = screen.getByRole("navigation", { name: "Schnellzugriff" });
    expect(within(nav).getAllByRole("link").map((l) => l.textContent)).toEqual(["Start", "Bestellungen"]);
    expect(within(nav).getByRole("button", { name: "Suche" })).toBeTruthy();
  });

  it("markiert nur den aktiven Tab mit aria-current=page (Unterpfad zählt)", () => {
    mocks.pathname = "/orders/abc";
    render(<TabBar />);
    const current = screen.getAllByRole("link").filter((l) => l.getAttribute("aria-current") === "page");
    expect(current.map((l) => l.textContent)).toEqual(["Bestellungen"]);
    expect(screen.getByRole("link", { name: "Bestellungen" }).className).toContain("bg-navy-900");
    expect(screen.getByRole("link", { name: "Bestellungen" }).className).toContain("dark:bg-gold-500");
  });

  it("markiert keinen Tab, wenn der Pfad zu keinem Tab gehört", () => {
    mocks.pathname = "/articles";
    render(<TabBar />);
    expect(screen.getAllByRole("link").some((l) => l.hasAttribute("aria-current"))).toBe(false);
  });

  it("Klick auf Suche öffnet die Palette", async () => {
    const ev = userEvent.setup();
    render(<TabBar />);
    await ev.click(screen.getByRole("button", { name: "Suche" }));
    expect(mocks.openSearch).toHaveBeenCalledTimes(1);
  });

  it("hat keinen Profil-Eintrag", () => {
    render(<TabBar />);
    expect(screen.queryByText(/profil/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /profil/i })).toBeNull();
  });

  it("alle Tab-Elemente haben einen zugänglichen Namen und mindestens 44 px Touch-Ziel", () => {
    render(<TabBar />);
    const nav = screen.getByRole("navigation", { name: "Schnellzugriff" });
    const items = [...within(nav).getAllByRole("link"), ...within(nav).getAllByRole("button")];
    expect(items).toHaveLength(5);
    for (const el of items) {
      expect(el.textContent?.trim()).toBeTruthy();
      expect(el.className).toContain("min-h-11");
      expect(el.className).toContain("min-w-11");
    }
  });

  it("ist nur unter md sichtbar und animiert nicht bei reduzierter Bewegung", () => {
    render(<TabBar />);
    const nav = screen.getByRole("navigation", { name: "Schnellzugriff" });
    expect(nav.parentElement?.className).toContain("md:hidden");
    expect(nav.className).toContain("motion-reduce:transition-none");
    expect(nav.className).toContain("backdrop-blur");
  });

  it("minimiert beim Herunterscrollen und kehrt beim Hochscrollen zurück", () => {
    render(<TabBar />);
    const nav = screen.getByRole("navigation", { name: "Schnellzugriff" });
    expect(nav.getAttribute("data-minimized")).toBe("false");

    scrollTo(10);
    expect(nav.getAttribute("data-minimized")).toBe("false");
    scrollTo(120);
    expect(nav.getAttribute("data-minimized")).toBe("true");
    scrollTo(150);
    expect(nav.getAttribute("data-minimized")).toBe("true");
    scrollTo(100);
    expect(nav.getAttribute("data-minimized")).toBe("false");
  });

  it("ignoriert Zittern unter der Schwelle", () => {
    render(<TabBar />);
    const nav = screen.getByRole("navigation", { name: "Schnellzugriff" });
    scrollTo(200);
    scrollTo(100);
    expect(nav.getAttribute("data-minimized")).toBe("false");
    scrollTo(105);
    scrollTo(102);
    expect(nav.getAttribute("data-minimized")).toBe("false");
  });

  it("langsames Herunterscrollen in kleinen Schritten minimiert trotzdem", () => {
    render(<TabBar />);
    const nav = screen.getByRole("navigation", { name: "Schnellzugriff" });
    for (let top = 60; top <= 120; top += 3) scrollTo(top);
    expect(nav.getAttribute("data-minimized")).toBe("true");
  });

  it("entfernt den Scroll-Listener beim Unmount", () => {
    const remove = vi.spyOn(scroller, "removeEventListener");
    const { unmount } = render(<TabBar />);
    unmount();
    expect(remove).toHaveBeenCalledWith("scroll", expect.any(Function));
  });
});
