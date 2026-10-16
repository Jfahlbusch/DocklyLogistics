// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("./profile-actions", () => ({ logoutAction: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

import { SidebarProfile } from "./sidebar-profile";
import { MobileNav } from "./mobile-nav";
import type { ProfilUser } from "./profile-menu-content";

const user: ProfilUser = {
  name: "Max Mustermann",
  email: "max@example.com",
  role: "GLOBAL_ADMIN",
  tenant: "demo-bakery",
};

afterEach(cleanup);

describe("SidebarProfile (Sidebar-Fuß-Auslöser)", () => {
  it("ausgeklappt: Avatar (initials), Name, übersetzte Rolle und Mandant", () => {
    render(<SidebarProfile user={user} />);
    const trigger = screen.getByRole("button", { name: "Profilmenü" });
    expect(within(trigger).getByText("MM")).toBeTruthy();
    expect(within(trigger).getByText("Max Mustermann")).toBeTruthy();
    expect(trigger.textContent).toContain("Plattform-Admin · demo-bakery");
    expect(trigger.textContent).not.toContain("GLOBAL_ADMIN");
    expect(trigger.hasAttribute("title")).toBe(false);
  });

  it("eingeklappt: nur der Avatar, Name · Rolle · Mandant als title", () => {
    render(<SidebarProfile user={user} collapsed />);
    const trigger = screen.getByRole("button", { name: "Profilmenü" });
    expect(trigger.textContent).toBe("MM");
    expect(trigger.getAttribute("title")).toBe("Max Mustermann · Plattform-Admin · demo-bakery");
  });

  it("Klick öffnet nach oben dasselbe Menü mit Kopf, Farbschema und Abmelden", async () => {
    const ev = userEvent.setup();
    render(<SidebarProfile user={user} />);
    await ev.click(screen.getByRole("button", { name: "Profilmenü" }));

    const menu = await screen.findByRole("menu");
    expect(within(menu).getByText("Max Mustermann")).toBeTruthy();
    expect(within(menu).getByText("max@example.com")).toBeTruthy();
    expect(within(menu).getByText("Plattform-Admin")).toBeTruthy();
    expect(within(menu).getByText("demo-bakery").className).toContain("font-mono");
    expect(within(menu).getByRole("radiogroup", { name: "Farbschema" })).toBeTruthy();
    expect(within(menu).getByRole("menuitem", { name: "Abmelden" })).toBeTruthy();
    expect(menu.getAttribute("data-side")).toBe("top");
  });

  it("Tastatur: Enter öffnet, Escape schließt und gibt den Fokus zurück", async () => {
    const ev = userEvent.setup();
    render(<SidebarProfile user={user} />);
    const trigger = screen.getByRole("button", { name: "Profilmenü" });
    trigger.focus();
    await ev.keyboard("{Enter}");
    await screen.findByRole("menu");
    await ev.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});

describe("MobileNav", () => {
  it("enthält am Ende des Drawers denselben Auslöser, der das Menü öffnet", async () => {
    const ev = userEvent.setup();
    render(<MobileNav user={user} />);
    await ev.click(screen.getByRole("button", { name: "Menü öffnen" }));
    await ev.click(await screen.findByRole("button", { name: "Profilmenü" }));
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: "Abmelden" })).toBeTruthy();
  });
});
