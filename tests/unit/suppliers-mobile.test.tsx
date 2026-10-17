// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "../helpers/intl";

let desktop = true;
vi.mock("@/hooks/use-media-query", () => ({
  MD_QUERY: "(min-width: 768px)",
  useMediaQuery: () => desktop,
}));

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push }),
  useSearchParams: () => new URLSearchParams("channel=EMAIL"),
  usePathname: () => "/suppliers",
}));

import { SuppliersView } from "@/app/(app)/suppliers/suppliers-view";
import { SupplierDetailModal } from "@/app/(app)/suppliers/supplier-detail-modal";
import { SupplierForm, defaultSupplierValues } from "@/app/(app)/suppliers/supplier-form";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

const supplier = {
  id: "s1", name: "Mühle", contactName: "Frau M", email: "m@example.com", phone: "1", street: "S", city: "Ulm",
  postalCode: "89073", country: "DE", channel: "EMAIL", channelConfig: { to: "x@y.de" }, active: true,
};

beforeEach(() => {
  desktop = true;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.includes("/api-keys"))
        return json({
          data: [
            { id: "k1", label: "Portal", prefix: "abc", scopes: ["orders:read"], lastUsedAt: null, revokedAt: null, expiresAt: null, createdAt: "2026-10-01T00:00:00Z" },
          ],
        });
      if (url.startsWith("/api/v1/orders"))
        return json({
          data: [
            { id: "o1", orderNo: "PO-1", status: "SENT", total: "12.5", currency: "EUR", createdAt: "2026-10-01T00:00:00Z", sentAt: null, _count: { items: 2 } },
          ],
        });
      if (url.startsWith("/api/v1/suppliers/s1")) return json({ data: supplier });
      return json({ data: [] });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  push.mockClear();
});

const card = {
  id: "s1xxxxxxxx", name: "Mühle", contactName: "Frau M", email: "m@example.com", phone: "1", city: "Ulm",
  channel: "EMAIL" as const, active: true, openOrders: 1, ytdRevenue: "10",
};
const props = { cards: [card], total: 1, canCreate: true, canManage: true, q: "" };

describe("SuppliersView mobil", () => {
  it("Kanal-Chips haben unter md 44 px und umbrechen (F-M96)", () => {
    renderWithIntl(<SuppliersView {...props} />);
    for (const name of ["Alle", "EMAIL", "API", "EDI"]) {
      expect(screen.getByRole("button", { name }).className).toMatch(/max-md:min-h-11/);
    }
    expect(screen.getByRole("button", { name: "Alle" }).parentElement!.className).toMatch(/flex-wrap/);
  });

  it("Suchfeld ist ein Such-Input (F-M97)", () => {
    renderWithIntl(<SuppliersView {...props} />);
    const input = screen.getByPlaceholderText(/Suche nach Name/);
    expect(input).toHaveAttribute("type", "search");
    expect(input).toHaveAttribute("enterkeyhint", "search");
    expect(input).toHaveAttribute("autocapitalize", "none");
  });

  it("Neuer Lieferant: Dialog ab md, Sheet darunter (F-M98)", async () => {
    renderWithIntl(<SuppliersView {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "+ Neuer Lieferant" }));
    expect((await screen.findByRole("dialog")).getAttribute("data-slot")).toBe("dialog-content");
    cleanup();
    desktop = false;
    renderWithIntl(<SuppliersView {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "+ Neuer Lieferant" }));
    expect((await screen.findByRole("dialog")).getAttribute("data-slot")).toBe("sheet-content");
  });
});

describe("SupplierForm Eingabefelder", () => {
  function renderForm() {
    renderWithIntl(<SupplierForm initial={defaultSupplierValues} isCreate busy={false} onSubmit={vi.fn()} onCancel={vi.fn()} />);
  }

  it("Adressraster löst unter sm auf (F-M99)", () => {
    renderForm();
    const grid = screen.getByLabelText("Straße").closest(".grid")!;
    expect(grid.className).toMatch(/grid-cols-1/);
    expect(grid.className).toMatch(/sm:grid-cols-\[2fr_1fr_1fr\]/);
  });

  it("E-Mail, Telefon, PLZ mit passenden Tastaturen (F-M100)", () => {
    renderForm();
    const mail = screen.getByLabelText("E-Mail");
    expect(mail).toHaveAttribute("inputmode", "email");
    expect(mail).toHaveAttribute("autocapitalize", "none");
    const tel = screen.getByLabelText("Telefon");
    expect(tel).toHaveAttribute("type", "tel");
    expect(tel).toHaveAttribute("inputmode", "tel");
    const plz = screen.getByLabelText("PLZ");
    expect(plz).toHaveAttribute("inputmode", "numeric");
    expect(plz).toHaveAttribute("autocomplete", "postal-code");
  });

  it("Select, Textarea, Checkbox mobil bedienbar (F-M101 bis F-M103), Knöpfe in Fußzeile", () => {
    renderForm();
    const sel = screen.getByLabelText(/Kanal/, { selector: "select" });
    expect(sel.className).toMatch(/text-base/);
    expect(sel.className).toMatch(/min-h-11/);
    const ta = document.querySelector("textarea")!;
    expect(ta.className).toMatch(/text-base/);
    expect(ta.className).not.toMatch(/(^|\s)text-xs/);
    const cb = screen.getByRole("checkbox");
    expect(cb.className).toMatch(/size-5/);
    expect(cb.closest("label")!.className).toMatch(/min-h-11/);
    expect(screen.getByRole("button", { name: "Anlegen" }).parentElement!.getAttribute("data-slot")).toBe(
      "responsive-dialog-footer",
    );
  });
});

describe("SupplierDetailModal mobil", () => {
  it("Detail ist unter md ein Sheet, ab md ein Dialog (F-M104)", async () => {
    desktop = false;
    renderWithIntl(<SupplierDetailModal supplierId="s1" canManage onClose={vi.fn()} />);
    const d = await screen.findByRole("dialog");
    expect(d.getAttribute("data-slot")).toBe("sheet-content");
    expect(d.className).not.toMatch(/85vh/);
    await screen.findByRole("tab", { name: "Stamm" });
    cleanup();
    desktop = true;
    renderWithIntl(<SupplierDetailModal supplierId="s1" canManage onClose={vi.fn()} />);
    expect((await screen.findByRole("dialog")).getAttribute("data-slot")).toBe("dialog-content");
  });

  it("Bestellungen als Karten unter md, Tabelle ab md (F-M107)", async () => {
    renderWithIntl(<SupplierDetailModal supplierId="s1" canManage onClose={vi.fn()} />);
    await screen.findByRole("tab", { name: "Bestellungen" });
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Bestellungen" }), { button: 0, ctrlKey: false });
    const cards = await screen.findByTestId("supplier-order-cards");
    expect(cards.className).toMatch(/md:hidden/);
    expect(within(cards).getByText("PO-1")).toBeTruthy();
    expect(document.querySelector("table")!.closest(".hidden")!.className).toMatch(/md:block/);
  });

  it("Fußzeile mit Löschen/Bearbeiten", async () => {
    renderWithIntl(<SupplierDetailModal supplierId="s1" canManage onClose={vi.fn()} />);
    await screen.findByRole("tab", { name: "Stamm" });
    const footer = document.querySelector("[data-slot='responsive-dialog-footer']") as HTMLElement;
    expect(within(footer).getByRole("button", { name: "Bearbeiten" })).toBeTruthy();
  });

  it("Neuer API-Key: echter Dialog/Sheet statt handgebautem Overlay, Scope-Chips 44 px (F-M109, F-M110)", async () => {
    desktop = false;
    renderWithIntl(<SupplierDetailModal supplierId="s1" canManage onClose={vi.fn()} />);
    await screen.findByRole("tab", { name: "API-Keys" });
    fireEvent.mouseDown(screen.getByRole("tab", { name: "API-Keys" }), { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByRole("button", { name: "+ Neuer Key" }));
    await waitFor(() => expect(screen.getAllByRole("dialog", { hidden: true }).length).toBe(2));
    expect(document.querySelector(".fixed.inset-0.z-\\[60\\]")).toBeNull();
    const top = screen.getAllByRole("dialog")[0];
    expect(top.getAttribute("data-slot")).toBe("sheet-content");
    const chip = within(top).getByText("orders:read").closest("label")!;
    expect(chip.className).toMatch(/max-md:min-h-11/);
    expect(within(top).getByRole("button", { name: "Erstellen" }).parentElement!.getAttribute("data-slot")).toBe(
      "responsive-dialog-footer",
    );
  });

  it("Key-Aktionen haben 44-px-Ziele (F-M108)", async () => {
    renderWithIntl(<SupplierDetailModal supplierId="s1" canManage onClose={vi.fn()} />);
    await screen.findByRole("tab", { name: "API-Keys" });
    fireEvent.mouseDown(screen.getByRole("tab", { name: "API-Keys" }), { button: 0, ctrlKey: false });
    for (const name of ["+ Neuer Key", "Widerrufen"]) {
      expect((await screen.findByRole("button", { name })).className).toMatch(/min-h-11/);
    }
  });
});
