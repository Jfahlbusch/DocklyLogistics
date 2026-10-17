// @vitest-environment jsdom
import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "../helpers/intl";
import { hasClass, json, stubFetch, stubViewport } from "./settings-mobile-helpers";

import { AdminView } from "@/app/(app)/admin/admin-view";

const features = [{ key: "orders", label: "Bestellungen", group: "Einkauf" }];
const tenants = [
  { id: "t1", name: "Bäckerei", users: 3, profile: null, overridesOn: 0, overridesOff: 0, createdAt: "2026-01-01T00:00:00Z" },
];
const profiles = [
  { id: "p1", name: "Basis", description: null, features: { orders: false }, tenants: 1, updatedAt: "2026-01-01T00:00:00Z" },
];

beforeEach(() => {
  stubViewport(false);
  stubFetch((url) => {
    if (url.includes("/admin/tenants/t1/features")) {
      return json({
        data: {
          tenant: { id: "t1", name: "Bäckerei" }, profile: null, overrides: {}, profileFeatures: null, effective: { orders: true },
        },
      });
    }
    return json({ data: [] });
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderAdmin() {
  return renderWithIntl(<AdminView initialTenants={tenants} initialProfiles={profiles} features={features} />);
}

describe("Admin mobil", () => {
  it("Tabs scrollen seitwärts mit 44-px-Triggern", () => {
    renderAdmin();
    const list = screen.getByRole("tablist");
    expect(hasClass(list, "overflow-x-auto")).toBe(true);
    for (const t of screen.getAllByRole("tab")) expect(t.className).toMatch(/max-md:min-h-11/);
  });

  it("Profil-Karte: Bearbeiten/Löschen 44 px (F-M1)", async () => {
    const user = userEvent.setup();
    renderAdmin();
    await user.click(screen.getByRole("tab", { name: "Funktionsprofile" }));
    for (const name of ["Bearbeiten", "Löschen"]) {
      const b = screen.getByRole("button", { name });
      expect(b.className).toMatch(/max-md:min-h-11/);
    }
  });

  it("Profil-Formular: Bottom-Sheet, Checkboxen 20 px, Fußzeile (F-M2/F-M5)", async () => {
    const user = userEvent.setup();
    renderAdmin();
    await user.click(screen.getByRole("tab", { name: "Funktionsprofile" }));
    await user.click(screen.getByRole("button", { name: "+ Neues Profil" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.querySelector('[data-slot="responsive-dialog-handle"]')).toBeTruthy();
    expect(dialog.innerHTML).not.toMatch(/\[8\dvh\]/);
    const cb = within(dialog).getByRole("checkbox", { name: /Bestellungen/ });
    expect(hasClass(cb, "size-5")).toBe(true);
    expect(cb.closest("label")!.className).toMatch(/min-h-11/);
    const footer = dialog.querySelector('[data-slot="responsive-dialog-footer"]') as HTMLElement;
    expect(within(footer).getByRole("button", { name: "Speichern" })).toBeTruthy();
  });

  it("Tenant-Dialog: Sheet, select nativ, Segment-Knöpfe 44 px (F-M2/3/4)", async () => {
    const user = userEvent.setup();
    renderAdmin();
    await user.click(screen.getByRole("button", { name: /Bäckerei/ }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.querySelector('[data-slot="responsive-dialog-handle"]')).toBeTruthy();
    expect(dialog.innerHTML).not.toMatch(/\[8\dvh\]/);
    const select = await within(dialog).findByRole("combobox");
    expect(hasClass(select, "min-h-11")).toBe(true);
    expect(select.className).not.toMatch(/(^|\s)text-sm/);
    for (const name of ["Standard", "Erlaubt", "Gesperrt"]) {
      const b = within(dialog).getByRole("button", { name });
      expect(b.className).toMatch(/max-md:min-h-11/);
    }
  });
});
