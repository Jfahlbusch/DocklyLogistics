// @vitest-environment jsdom
import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "../helpers/intl";
import { hasClass, json, stubFetch, stubViewport } from "./settings-mobile-helpers";

import { EdiTab } from "@/app/(app)/settings/edi-tab";

const partner = {
  id: "p1", name: "Mühle", partnerGln: "4333228000009", supplierId: null, supplierName: null, token: "t",
  inboundPath: "/api/edi/inbound/t", active: true, lastUsedAt: null, as2Id: null, as2Url: null, as2CertPresent: false,
};

beforeEach(() => {
  stubViewport(false);
  stubFetch((url) => {
    if (url.includes("/edi/partners")) return json({ data: [partner] });
    if (url.includes("/edi/sftp")) return json({ data: null });
    if (url.includes("/edi/as2-identity")) return json({ data: null });
    if (url.includes("/suppliers")) return json({ data: [{ id: "s1", name: "Lieferant A" }] });
    if (url.includes("/settings/edi")) {
      return json({ data: { inboundToken: "x", inboundActive: true, autoConfirm: false, inboundPath: "/api/edi/inbound/x" } });
    }
    return json({});
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function renderTab() {
  renderWithIntl(<EdiTab canManage />);
  await screen.findByText("Mühle");
  await screen.findByText("SFTP-Anbindung (Warenwirtschaft)");
}

describe("EDI-Tab mobil", () => {
  it("5 Partner-Aktionen: 44 px und mobil als Raster (F-M63)", async () => {
    await renderTab();
    const row = screen.getByText("Mühle").closest("div.flex-col")!;
    const edit = within(row as HTMLElement).getByRole("button", { name: "Bearbeiten" });
    const group = edit.parentElement!;
    expect(group.querySelectorAll("button")).toHaveLength(5);
    expect(hasClass(group, "grid")).toBe(true);
    expect(hasClass(group, "grid-cols-2")).toBe(true);
    expect(hasClass(group, "sm:flex")).toBe(true);
    for (const b of group.querySelectorAll("button")) expect(b.className).toMatch(/max-md:min-h-11/);
  });

  it("Checkboxen des Fallback-Postfachs: 20 px, Zeile 44 px (F-M68)", async () => {
    await renderTab();
    const cb = screen.getByRole("checkbox", { name: /Allgemeines Postfach aktiv/ });
    expect(hasClass(cb, "size-5")).toBe(true);
    expect(cb.closest("label")!.className).toMatch(/min-h-11/);
  });

  it("Partner-Dialog: Bottom-Sheet mit Fußzeile und mobilen Feldern (F-M64/65/66/67)", async () => {
    const user = userEvent.setup();
    await renderTab();
    await user.click(screen.getByRole("button", { name: "+ Partner-Postfach" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.querySelector('[data-slot="responsive-dialog-handle"]')).toBeTruthy();
    const footer = dialog.querySelector('[data-slot="responsive-dialog-footer"]')!;
    expect(within(footer as HTMLElement).getByRole("button", { name: "Anlegen" })).toBeTruthy();
    expect(within(footer as HTMLElement).getByRole("button", { name: "Abbrechen" })).toBeTruthy();

    const gln = within(dialog).getByPlaceholderText(/4012345000009$/);
    expect(gln.getAttribute("inputmode")).toBe("numeric");
    const url = within(dialog).getByPlaceholderText("https://as2.partner.de/receive");
    expect(url.getAttribute("type")).toBe("url");
    expect(url.getAttribute("inputmode")).toBe("url");
    expect(url.getAttribute("autocapitalize")).toBe("none");
    const as2Id = within(dialog).getByPlaceholderText("z. B. PARTNER-AS2");
    expect(as2Id.getAttribute("autocapitalize")).toBe("none");

    const select = dialog.querySelector("select")!;
    expect(hasClass(select, "min-h-11")).toBe(true);
    expect(select.className).not.toMatch(/(^|\s)text-sm/);
    const pem = dialog.querySelector("textarea")!;
    expect(pem.className).toMatch(/font-mono/);
    expect(pem.className).toMatch(/text-base/);
    expect(pem.className).not.toMatch(/(^|\s)text-xs/);
    expect(pem.getAttribute("spellcheck")).toBe("false");
  });
});

describe("SFTP-Abschnitt mobil", () => {
  it("Eingabe-Attribute (F-M58)", async () => {
    await renderTab();
    const host = screen.getByPlaceholderText(/sftp\.intern/);
    expect(host.getAttribute("autocapitalize")).toBe("none");
    expect(host.getAttribute("autocorrect")).toBe("off");
    expect(host.getAttribute("spellcheck")).toBe("false");
    expect(screen.getByPlaceholderText("22").getAttribute("inputmode")).toBe("numeric");
    const fp = screen.getByPlaceholderText(/MITM-Schutz/);
    expect(fp.getAttribute("autocapitalize")).toBe("none");
    expect(fp.getAttribute("spellcheck")).toBe("false");
  });

  it("selects, Schlüssel-textarea, Checkboxen (F-M59/60/61)", async () => {
    await renderTab();
    const card = screen.getByText("SFTP-Anbindung (Warenwirtschaft)").closest("div.space-y-4")!.parentElement!;
    const selects = card.querySelectorAll("select");
    expect(selects).toHaveLength(3);
    for (const s of selects) {
      expect(hasClass(s, "min-h-11")).toBe(true);
      expect(s.className).not.toMatch(/(^|\s)text-sm/);
    }
    const ta = card.querySelector("textarea")!;
    expect(ta.className).toMatch(/font-mono/);
    expect(ta.className).toMatch(/text-base/);
    expect(ta.className).not.toMatch(/(^|\s)text-xs/);
    expect(ta.getAttribute("autocapitalize")).toBe("none");
    for (const name of [/Anbindung aktiv/, /automatisch versenden/]) {
      const cb = within(card as HTMLElement).getByRole("checkbox", { name });
      expect(hasClass(cb, "size-5")).toBe(true);
      expect(cb.closest("label")!.className).toMatch(/min-h-11/);
    }
  });

  it("Aktionsknöpfe sind 44 px (F-M62)", async () => {
    await renderTab();
    for (const name of ["Verbindung testen", "Jetzt abrufen", "Speichern"]) {
      expect(screen.getByRole("button", { name }).className).toMatch(/max-md:min-h-11/);
    }
  });
});
