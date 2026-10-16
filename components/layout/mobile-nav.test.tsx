// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("./profile-actions", () => ({ logoutAction: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/orders" }));

import { MobileNav } from "./mobile-nav";
import type { ProfilUser } from "./profile-menu-content";

const user: ProfilUser = {
  name: "Max Mustermann",
  email: "max@example.com",
  role: "GLOBAL_ADMIN",
  tenant: "demo-bakery",
};

afterEach(cleanup);

async function openDrawer() {
  const ev = userEvent.setup();
  render(<MobileNav user={user} />);
  await ev.click(screen.getByRole("button", { name: "Menü öffnen" }));
  return { ev, dialog: await screen.findByRole("dialog") };
}

function precedes(a: Node, b: Node) {
  return Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
}

describe("MobileNav-Drawer (Menü-Anatomie wie die Sidebar)", () => {
  it("zeigt Brand-Wortmarke und Mandantenname statt des Logo-Bilds", async () => {
    const { dialog } = await openDrawer();
    expect(within(dialog).getByText("dockly")).toBeTruthy();
    expect(within(dialog).getByText("LOGISTICS")).toBeTruthy();
    expect(within(dialog).getByText("demo-bakery")).toBeTruthy();
    expect(within(dialog).queryByRole("img")).toBeNull();
  });

  it("zeigt alle drei Gruppen in der Reihenfolge Einkauf → Lager → Verwaltung", async () => {
    const { dialog } = await openDrawer();
    const labels = ["Einkauf", "Lager", "Verwaltung"].map((l) => within(dialog).getByText(l));
    expect(precedes(labels[0], labels[1])).toBe(true);
    expect(precedes(labels[1], labels[2])).toBe(true);
  });

  it("ordnet Brand → Mandant → Navigation → Profil-Auslöser", async () => {
    const { dialog } = await openDrawer();
    const brand = within(dialog).getByText("LOGISTICS");
    const tenant = within(dialog).getByText("demo-bakery");
    const nav = within(dialog).getByRole("navigation", { name: "Hauptnavigation" });
    const profile = within(dialog).getByRole("button", { name: "Profilmenü" });
    expect(precedes(brand, tenant)).toBe(true);
    expect(precedes(tenant, nav)).toBe(true);
    expect(precedes(nav, profile)).toBe(true);
    // Profil-Auslöser ist das letzte fokussierbare Element im Drawer
    const focusables = [...dialog.querySelectorAll<HTMLElement>("a[href], button")];
    expect(focusables[focusables.length - 1]).toBe(profile);
  });

  it("hat einen erreichbaren Schließen-Knopf, der den Drawer schließt", async () => {
    const { ev } = await openDrawer();
    await ev.click(screen.getByRole("button", { name: "Menü schließen" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("schließt bei Navigation (Klick auf einen Eintrag)", async () => {
    const { ev, dialog } = await openDrawer();
    // jsdom kann nicht navigieren — Standardaktion des Links unterdrücken (Handler laufen weiter)
    const stop = (e: Event) => e.preventDefault();
    document.addEventListener("click", stop);
    await ev.click(within(dialog).getByRole("link", { name: "Lieferanten" }));
    document.removeEventListener("click", stop);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
