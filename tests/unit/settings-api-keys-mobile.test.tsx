// @vitest-environment jsdom
import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "../helpers/intl";
import { json, stubFetch, stubViewport } from "./settings-mobile-helpers";

import { ApiKeysTab } from "@/app/(app)/settings/api-keys-tab";

const key = {
  id: "k1", label: "ERP", prefix: "dk_abc", role: "MANAGER", lastUsedAt: null, expiresAt: null, createdAt: "2026-01-01T00:00:00Z",
};

beforeEach(() => {
  stubViewport(false);
  stubFetch((url, init) => {
    if (init?.method === "POST") return json({ data: { key: "dk_secret_value" } }, 201);
    return json({ data: [key] });
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("API-Keys mobil", () => {
  it("Widerrufen ist mobil 44 px (F-M70)", async () => {
    renderWithIntl(<ApiKeysTab role="MANAGER" />);
    const btns = await screen.findAllByRole("button", { name: "Widerrufen" });
    expect(btns).toHaveLength(2);
    for (const b of btns) expect(b.className).toMatch(/max-md:min-h-11/);
  });

  it("Neuer-Key-Dialog: Bottom-Sheet, Gültigkeit numerisch (F-M72/73)", async () => {
    const user = userEvent.setup();
    renderWithIntl(<ApiKeysTab role="MANAGER" />);
    await user.click(await screen.findByRole("button", { name: "+ Neuer API-Key" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.querySelector('[data-slot="responsive-dialog-handle"]')).toBeTruthy();
    const days = within(dialog).getByPlaceholderText("ohne Ablauf");
    expect(days.getAttribute("inputmode")).toBe("numeric");
    const footer = dialog.querySelector('[data-slot="responsive-dialog-footer"]') as HTMLElement;
    expect(within(footer).getByRole("button", { name: "Erstellen" })).toBeTruthy();
  });

  it("Neuer-Key-Banner: Kopieren/Schließen 44 px, Zeile bricht um (F-M71)", async () => {
    const user = userEvent.setup();
    renderWithIntl(<ApiKeysTab role="MANAGER" />);
    await user.click(await screen.findByRole("button", { name: "+ Neuer API-Key" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Erstellen" }));
    const copy = await screen.findByRole("button", { name: "Kopieren" });
    const close = screen.getByRole("button", { name: "Schließen" });
    expect(copy.className).toMatch(/max-md:min-h-11/);
    expect(close.className).toMatch(/max-md:min-h-11/);
    expect(copy.parentElement!.className).toMatch(/flex-wrap/);
  });
});
