// @vitest-environment jsdom
import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "../helpers/intl";
import { hasClass, json, stubFetch, stubViewport } from "./settings-mobile-helpers";

import { PdfTab } from "@/app/(app)/settings/pdf-tab";
import { UsersTab } from "@/app/(app)/settings/users-tab";

const features = [{ key: "orders", label: "Bestellungen", group: "Einkauf" }];

beforeEach(() => {
  stubViewport(false);
  stubFetch((url) => {
    if (url.includes("/settings/pdf")) {
      return json({ data: { logoDataUri: "data:image/png;base64,AAAA", headerText: "Kopf", footerText: "Fuß" } });
    }
    if (url.includes("/role-features")) {
      return json({ data: { features, roles: { MANAGER: { orders: true }, USER: {} } } });
    }
    if (url.endsWith("/users")) {
      return json({ data: [{ id: "u1", email: "a@b.de", name: "Anna", role: "USER", lastLoginAt: null }] });
    }
    if (url.includes("/users/u1/features")) {
      return json({ data: { effective: { orders: false }, overrides: {}, roleDefault: { orders: false } } });
    }
    return json({});
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Bestellschein-Tab mobil", () => {
  it("Textareas nativ 16 px, Knöpfe und Link 44 px (F-M80/81)", async () => {
    renderWithIntl(<PdfTab canManage />);
    await screen.findByText("Briefkopf-Logo");
    for (const ta of document.querySelectorAll("textarea")) {
      expect(ta.className).toMatch(/text-base/);
      expect(ta.className).not.toMatch(/(^|\s)text-sm/);
      expect(hasClass(ta, "min-h-11")).toBe(true);
    }
    const pick = screen.getByText("Bild wählen").closest("label")!;
    expect(hasClass(pick, "min-h-11")).toBe(true);
    expect(hasClass(screen.getByRole("button", { name: "entfernen" }), "min-h-11")).toBe(true);
    expect(hasClass(screen.getByRole("link", { name: /Vorschau öffnen/ }), "min-h-11")).toBe(true);
  });
});

describe("Benutzer-Tab mobil", () => {
  it("Rollen-Segment 44 px, Rollen-Checkbox 20 px mit 44-px-Zeile (F-M82/84)", async () => {
    renderWithIntl(<UsersTab canManage />);
    const seg = await screen.findByRole("button", { name: "Manager" });
    expect(hasClass(seg, "min-h-11")).toBe(true);
    expect(hasClass(screen.getByRole("button", { name: "Benutzer" }), "min-h-11")).toBe(true);
    const cb = screen.getByRole("checkbox", { name: /Bestellungen/ });
    expect(hasClass(cb, "size-5")).toBe(true);
    expect(cb.closest("label")!.className).toMatch(/min-h-11/);
  });

  it("Override-Zeile: mobil untereinander, Segment-Knöpfe 44 px (F-M83)", async () => {
    const user = userEvent.setup();
    renderWithIntl(<UsersTab canManage />);
    await user.click(await screen.findByText("Anna"));
    const gesperrt = await screen.findByRole("button", { name: "Gesperrt" });
    const group = gesperrt.parentElement!;
    const row = group.parentElement!;
    expect(hasClass(row, "flex-col")).toBe(true);
    expect(row.className).toMatch(/md:flex-row/);
    expect(group.className).toMatch(/max-md:w-full/);
    for (const b of within(group).getAllByRole("button")) {
      expect(b.className).toMatch(/max-md:min-h-11/);
      expect(b.className).toMatch(/max-md:flex-1/);
    }
  });
});
