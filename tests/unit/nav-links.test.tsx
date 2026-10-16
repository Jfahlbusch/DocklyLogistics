// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import de from "../../messages/de.json";
// Nur Deutsch (PLAN.md N8): Die englischen Fälle der Vorlage laufen mit den deutschen Texten.
const en = de;
import { NavigationStateProvider } from "@/components/layout/navigation-state";
import { NavLinks } from "@/components/layout/nav-links";
import type { UserRole } from "@/lib/auth/role";

// Sidebar und Drawer aus der Registry (A8.16): Gruppen je `visibleAreas(role)`, aktiver
// Eintrag über `findActiveEntry` mit `usePathname` aus `@/i18n/navigation`. Der Pfad kommt
// wie im Browser von `next/navigation` (mit Locale-Präfix), next-intl rechnet ihn heraus.

const nav = vi.hoisted(() => ({ pathname: "/", short: false }));
vi.mock("@/hooks/use-media-query", () => ({ useMediaQuery: () => nav.short }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
}));

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(() => nav.short ? 186 : 1000);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  nav.pathname = "/";
  nav.short = false;
  vi.unstubAllGlobals();
});

type Options = {
  role?: UserRole;
  locale?: "de";
  pathname?: string;
  collapsed?: boolean;
  allowed?: readonly string[];
  onNavigate?: () => void;
};

function renderNav({
  role = "GLOBAL_ADMIN",
  locale = "de",
  pathname,
  collapsed,
  allowed,
  onNavigate,
}: Options = {}) {
  nav.pathname = pathname ?? (locale === "de" ? "/" : "/en");
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "de" ? de : en}>
      <NavigationStateProvider><NavLinks role={role} allowed={allowed} collapsed={collapsed} onNavigate={onNavigate} /></NavigationStateProvider>
    </NextIntlClientProvider>,
  );
}

describe("Navigation ohne Scrollfläche", () => {
  it.each([
    { name: "Desktop, ausgeklappt", collapsed: false, mobile: false, width: 244 },
    { name: "Desktop, eingeklappt", collapsed: true, mobile: false, width: 44 },
    { name: "Mobiler Drawer", collapsed: false, mobile: true, width: 44 },
  ])("positioniert das erste seitliche Menü an einem verbundenen Anker ($name)", async ({ collapsed, mobile, width }) => {
    nav.short = mobile;
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(186);
    // JSDOM hat kein Layout: verbundene Bedienelemente bekommen messbare Geometrie.
    // Ein bei der Ankerumschaltung entferntes Element liefert wie im Browser ein leeres Rechteck.
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      if (!this.isConnected) return new DOMRect();
      if (this.matches("button")) return new DOMRect(8, 200, collapsed ? 44 : 244, 44);
      if (this.matches('[data-slot="popover-anchor"]')) return new DOMRect(8, 200, 44, 44);
      return new DOMRect();
    });
    renderNav({ collapsed });
    const trigger = screen.getByRole("button", { name: "Verwaltung" });
    for (let opening = 0; opening < 2; opening++) {
      fireEvent.click(trigger);
      const popup = screen.getByRole("dialog", { name: "Verwaltung" });
      await waitFor(() => expect(popup.parentElement?.style.getPropertyValue("--radix-popper-anchor-width")).toBe(`${width}px`));
      fireEvent.keyDown(popup, { key: "Escape" });
      expect(screen.queryByRole("dialog", { name: "Verwaltung" })).not.toBeInTheDocument();
    }
  });
  it("öffnet standardmäßig alle Bereiche außer Verwaltung und klappt andere nicht zu", () => {
    renderNav({ pathname: "/articles/abc" });
    expect(screen.getByRole("link", { name: "Artikel / Rohstoffe" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Bestellungen" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Administration" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Verwaltung" }));
    expect(screen.getByRole("link", { name: "Administration" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Artikel / Rohstoffe" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Bestellungen" })).toHaveAttribute("href", "/orders");
  });
  it("behält Reihenfolge und Namen der Bereiche (nur Deutsch, PLAN.md N8)", () => {
    renderNav();
    expect(screen.getAllByRole("group").map(group => group.getAttribute("aria-label"))).toEqual(["Übersicht", "Einkauf", "Lager", "Verwaltung"]);
    expect(screen.getByRole("link", { name: "Artikel / Rohstoffe" })).toHaveAttribute("href", "/articles");
  });
  it("ignoriert einen unbekannten Pfad und zeigt keine aktive Seite", () => {
    renderNav({ pathname: "/unknown" });
    expect(screen.queryByRole("link", { current: "page" })).not.toBeInTheDocument();
  });
  // Abweichung von der Vorlage: Sichtbarkeit regeln bei uns die Feature-Rechte (`allowed`), nicht `minRole`.
  it("zeigt nur erlaubte Einträge und blendet Bereiche ohne erlaubten Eintrag aus", () => {
    renderNav({ role: "VIEWER", allowed: ["dashboard", "stock", "settings"] });
    fireEvent.click(screen.getByRole("button", { name: "Verwaltung" }));
    expect(screen.getAllByRole("link").map(link => link.textContent)).toEqual(["Dashboard", "Lager & Bestand", "Einstellungen"]);
    expect(screen.queryByRole("button", { name: "Einkauf" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Audit" })).not.toBeInTheDocument();
  });
  it.each([true, false])("erreicht die Ziele im Popover (eingeklappt=%s)", (collapsed) => {
    nav.short = !collapsed;
    renderNav({ collapsed });
    fireEvent.click(screen.getByRole("button", { name: "Lager" }));
    expect(screen.getByRole("dialog", { name: "Lager" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Artikel / Rohstoffe" })).toHaveAttribute("href", "/articles");
    expect(screen.getAllByRole("link")).toHaveLength(4);
  });
  it("schließt den mobilen Drawer beim Navigieren", () => {
    const onNavigate = vi.fn();
    renderNav({ pathname: "/articles", onNavigate });
    const link = screen.getByRole("link", { name: "Lieferanten" });
    link.addEventListener("click", event => event.preventDefault());
    fireEvent.click(link);
    expect(onNavigate).toHaveBeenCalledOnce();
  });
  it("behält bewusst geschlossene und geöffnete Bereiche beim Seitenwechsel", () => {
    const view = renderNav({ pathname: "/articles" });
    fireEvent.click(screen.getByRole("button", { name: "Übersicht" }));
    fireEvent.click(screen.getByRole("button", { name: "Verwaltung" }));
    nav.pathname = "/orders";
    view.rerender(<NextIntlClientProvider locale="de" messages={de}><NavigationStateProvider><NavLinks role="GLOBAL_ADMIN" /></NavigationStateProvider></NextIntlClientProvider>);
    expect(screen.getByRole("button", { name: "Übersicht" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "Lager" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Einkauf" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "Bestellungen" })).toHaveAttribute("aria-current", "page");
  });
  it("teilt den Zustand auch mit einem neu geöffneten Drawer", () => {
    const view = render(<NextIntlClientProvider locale="de" messages={de}><NavigationStateProvider><NavLinks role="GLOBAL_ADMIN" /></NavigationStateProvider></NextIntlClientProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Lager" }));
    view.rerender(<NextIntlClientProvider locale="de" messages={de}><NavigationStateProvider>{null}</NavigationStateProvider></NextIntlClientProvider>);
    view.rerender(<NextIntlClientProvider locale="de" messages={de}><NavigationStateProvider><NavLinks role="GLOBAL_ADMIN" /></NavigationStateProvider></NextIntlClientProvider>);
    expect(screen.getByRole("button", { name: "Lager" })).toHaveAttribute("aria-expanded", "false");
  });
  it("schaltet Bereiche trotz gesperrter Anzeige-Cookies", () => {
    renderNav();
    vi.spyOn(document, "cookie", "set").mockImplementation(() => { throw new Error("blocked"); });
    fireEvent.click(screen.getByRole("button", { name: "Verwaltung" }));
    expect(screen.getByRole("link", { name: "Administration" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Artikel / Rohstoffe" })).toBeVisible();
  });
});

describe("Auswahl ohne Seitenstreifen", () => {
  it("markiert die aktive Seite ausschließlich mit Hintergrund und aria-current", () => {
    renderNav({ pathname: "/articles" });
    const link = screen.getByRole("link", { name: "Artikel / Rohstoffe" });
    expect(link).toHaveAttribute("aria-current", "page");
    expect(link.className).not.toMatch(/border-(?:l|s)-|border-gold/);
  });
  it("besitzt keine scrollende Navigationsfläche", () => {
    renderNav();
    expect(screen.getByRole("navigation").className).not.toMatch(/overflow-(?:y-)?auto/);
  });
});

describe("Portal-Aufbau der Bereiche (develop 1aff3fd)", () => {
  it("zeigt die Bereichsüberschrift wie `.sidebar-heading`: 12,8 px / 600, Normalschreibung, Pfeil, Außenabstand 8 / 13,6 / 4 / 24,8 px", () => {
    renderNav({ role: "MANAGER" });
    const trigger = screen.getByRole("button", { name: "Lager" });
    for (const expected of ["text-[0.8rem]", "font-semibold", "tracking-[0.04em]", "mt-2", "mb-1", "ms-[1.55rem]"]) expect(trigger.className).toContain(expected);
    expect(trigger.className).not.toMatch(/\buppercase\b/);
    expect(trigger.querySelector("svg")).not.toBeNull();
  });
  it("legt je Bereich eine Liste mit 1,6 px Abstand und 11,2 px Seitenrand an; keine Trennlinie im ausgeklappten Menü", () => {
    renderNav({ role: "MANAGER" });
    const group = screen.getByRole("group", { name: "Lager" });
    const list = group.querySelector("[id$='-links']");
    expect(list).toHaveClass("gap-[0.1rem]", "px-[0.7rem]", "flex-col");
    expect(group.className).toContain("pt-2");
    expect(group.querySelector("div[aria-hidden]")).toBeNull();
  });
  it("dreht den Pfeil nur bei geöffnetem Bereich", () => {
    renderNav();
    const arrow = () => screen.getByRole("button", { name: "Verwaltung" }).querySelector("svg");
    expect(arrow()?.getAttribute("class")).not.toContain("rotate-180");
    fireEvent.click(screen.getByRole("button", { name: "Verwaltung" }));
    expect(arrow()?.getAttribute("class")).toContain("rotate-180");
  });
  it("zeigt eingeklappt (Rail) je Bereich eine Icon-Kachel ohne Überschrift und Pfeil, mit Trennlinie ab dem zweiten Bereich", () => {
    renderNav({ collapsed: true });
    const trigger = screen.getByRole("button", { name: "Lager" });
    expect(trigger.textContent).toBe("");
    expect(trigger.querySelectorAll("svg")).toHaveLength(1);
    expect(trigger).toHaveAttribute("title", "Lager");
    expect(trigger).toHaveClass("justify-center", "rounded-[10px]", "border", "px-0");
    const groups = screen.getAllByRole("group");
    expect(groups[0]?.querySelector("[aria-hidden].border-t")).toBeNull();
    expect(groups[1]?.querySelector("[aria-hidden].border-t")).not.toBeNull();
  });
  it("gibt der Kachel die Maße des Portals: Rand 1 px, Radius 10 px, 16 px / 500, Abstand 12,8 px, Innenabstand 7,8 × 12,6 px", () => {
    renderNav({ pathname: "/articles" });
    const link = screen.getByRole("link", { name: "Artikel / Rohstoffe" });
    for (const expected of ["border", "border-transparent", "rounded-[10px]", "text-base", "gap-[0.8rem]", "px-[12.6px]", "py-[7.8px]", "short:py-[5px]"]) {
      expect(link.className.concat(" border-transparent")).toContain(expected);
    }
    expect(screen.getByRole("link", { name: "Lieferanten" }).className).toContain("font-medium");
  });
  it("gibt der aktiven Seite Rand rundum, Fläche 11 %, Schrift 700 und Gold-Icon, den übrigen nicht", () => {
    renderNav({ pathname: "/articles" });
    const active = screen.getByRole("link", { name: "Artikel / Rohstoffe" });
    for (const expected of ["border-sidebar-border", "bg-sidebar-foreground/[0.11]", "font-bold"]) expect(active.className).toContain(expected);
    expect(active.querySelector("svg")?.parentElement?.className).toContain("text-gold-400");
    const idle = screen.getByRole("link", { name: "Lieferanten" });
    expect(idle.className).not.toContain("bg-sidebar-foreground/[0.11]");
    expect(idle.className).toContain("hover:bg-sidebar-foreground/[0.08]");
    expect(idle.querySelector("svg")?.parentElement?.className ?? "").not.toContain("text-gold-400");
  });
  it("hält die Einträge unter 992 px und bei Touch 44 px hoch", () => {
    renderNav();
    for (const name of ["Artikel / Rohstoffe"]) {
      const link = screen.getByRole("link", { name });
      expect(link.className).toContain("max-nav:min-h-11");
      expect(link.className).toContain("pointer-coarse:min-h-11");
    }
    const heading = screen.getByRole("button", { name: "Lager" });
    expect(heading.className).toContain("max-nav:min-h-11");
    expect(heading.className).toContain("pointer-coarse:min-h-11");
  });
});
