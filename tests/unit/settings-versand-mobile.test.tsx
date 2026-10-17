// @vitest-environment jsdom
import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "../helpers/intl";
import { hasClass, stubViewport } from "./settings-mobile-helpers";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

import { SettingsView } from "@/app/(app)/settings/settings-view";

const channels = [
  { id: "c1", channel: "EMAIL" as const, label: "Hauptmailbox", isDefault: true, active: true, config: {}, updatedAt: "2026-01-01" },
];

function renderView() {
  return renderWithIntl(
    <SettingsView
      tenant="demo"
      role="MANAGER"
      channels={channels}
      webhooks={[]}
      keycloak={{ clientId: "docklylogistics-app", realm: "dockly", url: "https://auth.example.com/realms/dockly" }}
    />,
  );
}

beforeEach(() => stubViewport(false));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Settings-Tabs-Leiste (F-M51)", () => {
  it("Leiste scrollt seitwärts und Trigger haben 44 px mobil", () => {
    renderView();
    const list = screen.getByRole("tablist");
    expect(hasClass(list, "overflow-x-auto")).toBe(true);
    expect(hasClass(list, "max-w-full")).toBe(true);
    expect(hasClass(list, "w-fit")).toBe(true); // von tabs.tsx, begrenzt durch max-w-full
    for (const tab of screen.getAllByRole("tab")) expect(hasClass(tab, "max-md:min-h-11")).toBe(true);
    // settings-view setzt keine eigenen festen Höhen/Breiten auf die Leiste
    expect(list.className).not.toMatch(/(^|\s)h-\d/);
  });
});

describe("Versand-Tab", () => {
  it("Zeilen-Knöpfe sind mobil 44 px (Standardgröße des Buttons)", () => {
    renderView();
    for (const name of ["Test-Versand", "Bearbeiten", "Löschen", "+ Neues Profil"]) {
      const btns = screen.getAllByRole("button", { name });
      for (const b of btns) {
        expect(b.className).toMatch(/max-md:min-h-11/);
        expect(b.className).not.toMatch(/(^|\s)text-xs/);
      }
    }
  });

  it("Neues Profil öffnet ein Bottom-Sheet mit mobilen Feldern (F-M53/55/56/57)", async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(screen.getAllByRole("button", { name: "+ Neues Profil" })[0]);
    const dialog = await screen.findByRole("dialog");
    expect(dialog.querySelector('[data-slot="responsive-dialog-handle"]')).toBeTruthy();
    expect(dialog.className).not.toMatch(/\[8\d?vh\]/);
    const select = dialog.querySelector("select")!;
    expect(hasClass(select, "min-h-11")).toBe(true);
    expect(select.className).not.toMatch(/(^|\s)text-sm/);
    const ta = dialog.querySelector("textarea")!;
    expect(ta.className).toMatch(/font-mono/);
    expect(ta.className).toMatch(/text-base/);
    expect(ta.className).not.toMatch(/(^|\s)text-xs/);
    for (const cb of dialog.querySelectorAll('input[type="checkbox"]')) {
      expect(hasClass(cb, "size-5")).toBe(true);
      expect(hasClass(cb.closest("label")!, "min-h-11")).toBe(true);
    }
    // Fußzeile mit Knöpfen
    const footer = dialog.querySelector('[data-slot="responsive-dialog-footer"]')!;
    expect(footer.querySelectorAll("button").length).toBe(2);
  });

  it("Desktop: normaler Dialog ohne Griff", async () => {
    stubViewport(true);
    const user = userEvent.setup();
    renderView();
    await user.click(screen.getAllByRole("button", { name: "+ Neues Profil" })[0]);
    const dialog = await screen.findByRole("dialog");
    expect(dialog.querySelector('[data-slot="responsive-dialog-handle"]')).toBeNull();
  });
});

describe("Tenant- und API-Doku-Tab", () => {
  it("Field: Label mobil über dem Wert, Mono-Werte brechen um (F-M52)", async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(screen.getByRole("tab", { name: "Tenant" }));
    const val = screen.getByText("https://auth.example.com/realms/dockly");
    expect(hasClass(val, "break-all")).toBe(true);
    const row = val.parentElement!;
    expect(hasClass(row, "flex-col")).toBe(true);
    expect(hasClass(row, "sm:flex-row")).toBe(true);
    const label = screen.getByText("Keycloak-URL");
    expect(label.className).toMatch(/sm:w-40/);
    expect(hasClass(label, "w-40")).toBe(false);
  });

  it("Link-Buttons sind mobil 44 px (F-M54)", async () => {
    const user = userEvent.setup();
    renderView();
    await user.click(screen.getByRole("tab", { name: "API-Dokumentation" }));
    for (const name of ["Scalar UI öffnen", "openapi.json", "Public Scalar UI öffnen", "public openapi.json"]) {
      expect(hasClass(screen.getByRole("link", { name }), "min-h-11")).toBe(true);
    }
  });
});
