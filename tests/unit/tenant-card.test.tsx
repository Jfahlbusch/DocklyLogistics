// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import de from "../../messages/de.json";
// Nur Deutsch (PLAN.md N8): Die englischen Fälle der Vorlage laufen mit den deutschen Texten.
const en = de;
import { tenantCardClass } from "@/components/layout/tenant-card";
import { TenantSwitcher } from "@/components/layout/tenant-switcher";

afterEach(cleanup);
const options = [{ id: "home", name: "Goeken backen" }, { id: "other", name: "Fremde Firma" }];
type Collapsed = { collapsed?: boolean };
function show(admin: boolean, { collapsed }: Collapsed = {}, locale: "de" = "de") {
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "de" ? de : en}>
      <TenantSwitcher collapsed={collapsed} navigation={{ currentTenant: "home", homeTenant: "home", currentName: "Goeken backen", ...(admin ? { tenants: options } : {}) }} />
    </NextIntlClientProvider>,
  );
}

// Unternehmens-Karte im Portal-Aufbau (`_tenant_switcher.html.erb`): Gebäude-Symbol, Überschrift „Unternehmen“, Name, Auswahlpfeil.
describe("Unternehmens-Karte", () => {
  it("zeigt berechtigten Nutzern Symbol, Überschrift, Name und Pfeil und öffnet den Wechsler", () => {
    const { container } = show(true);
    const card = screen.getByRole("button", { name: de.shell.tenantSwitcher.label });
    expect(card).toHaveTextContent(de.shell.tenantSwitcher.caption);
    expect(card).toHaveTextContent("Goeken backen");
    expect(card.querySelector("svg")).not.toBeNull();
    expect(container.querySelector('[data-slot="tenant-caret"]')).not.toBeNull();
    fireEvent.click(card);
    expect(screen.getByRole("dialog", { name: de.shell.tenantSwitcher.label })).toBeInTheDocument();
  });
  it("zeigt anderen Nutzern eine statische Anzeige ohne Knopf und Auswahlpfeil", () => {
    const { container } = show(false, {});
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    const card = screen.getByLabelText(en.shell.tenantSwitcher.summary.replace("{name}", "Goeken backen"));
    expect(card).toHaveTextContent(en.shell.tenantSwitcher.caption);
    expect(card).toHaveTextContent("Goeken backen");
    expect(container.querySelector('[data-slot="tenant-caret"]')).toBeNull();
    expect(card.className).toContain("cursor-default");
  });
  it("lässt eingeklappt nur das Symbol stehen, der Name bleibt als Hinweis erreichbar", () => {
    show(true, { collapsed: true });
    const card = screen.getByRole("button", { name: de.shell.tenantSwitcher.label });
    expect(card.textContent).toBe("");
    expect(card).toHaveAttribute("title", "Goeken backen");
    expect(card).toHaveClass("justify-center");
  });
  it("hat die Maße des Portals: 8 px Innenabstand und Abstand, Radius 10 px, 1-px-Linie, Fläche 8 %, Hover 11 %", () => {
    const classes = tenantCardClass({ interactive: true });
    for (const expected of ["p-2", "gap-2", "rounded-[10px]", "border", "border-sidebar-border", "bg-sidebar-foreground/[0.08]", "hover:bg-sidebar-foreground/[0.11]"]) expect(classes).toContain(expected);
    const { container } = show(true);
    expect(container.firstElementChild).toHaveClass("px-2", "my-3");
  });
  it("hält 44 px Mindesthöhe und trägt keine Startkante", () => {
    for (const collapsed of [false, true]) for (const interactive of [false, true]) {
      const classes = tenantCardClass({ collapsed, interactive });
      expect(classes).toContain("min-h-11");
      expect(classes).not.toMatch(/border-(?:l|s)(?:-|\b)|inset|before:|after:/);
    }
  });
});
