// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let desktop = true;
vi.mock("@/hooks/use-media-query", () => ({
  MD_QUERY: "(min-width: 768px)",
  useMediaQuery: () => desktop,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/orders",
}));
vi.mock("@/lib/search/use-open-param", () => ({ useOpenParam: () => () => {} }));

import { OrdersView } from "@/app/(app)/orders/orders-view";
import { ReceiveModal } from "@/app/(app)/orders/receive-modal";
import { OrderDetailModal } from "@/app/(app)/orders/order-detail-modal";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
beforeEach(() => {
  desktop = true;
});

const row = {
  id: "o1", orderNo: "B-1", supplierName: "Mühle", channel: "EMAIL" as const, status: "SENT",
  itemCount: 2, total: "10", currency: "EUR", createdAt: "2026-10-01T00:00:00Z", sentAt: null,
};

describe("OrdersView mobil/tablet", () => {
  function setup() {
    return render(
      <OrdersView rows={[row]} total={1} suppliers={[{ id: "s1", name: "Mühle" }]} canCreate filters={{ status: "", supplierId: "", q: "" }} />,
    );
  }
  it("zeigt Tabelle erst ab xl und Karten darunter (F-M21/B10)", () => {
    const { container } = setup();
    const table = container.querySelector("table")!;
    expect(table.parentElement).toHaveClass("hidden", "xl:block");
    expect(table.parentElement).not.toHaveClass("md:block");
    const cards = container.querySelector("[data-slot='orders-cards']")!;
    expect(cards).toHaveClass("xl:hidden");
  });
  it("Selects/Suche sind touch- und iOS-tauglich (F-M38/39)", () => {
    setup();
    const search = screen.getByPlaceholderText(/Suche nach Bestell-Nr/);
    expect(search).toHaveAttribute("type", "search");
    expect(search).toHaveAttribute("enterkeyhint", "search");
    for (const s of screen.getAllByRole("combobox")) {
      expect(s.className).toContain("min-h-11");
      expect(s.className).toContain("md:pointer-fine:text-sm");
      expect(s.className).not.toMatch(/(^| )text-sm/);
    }
  });
  it("Begründung der gesperrten Neuanlage ist sichtbar (F-M40)", () => {
    setup();
    expect(screen.getByText(/Manuelle Anlage über die API/)).toBeVisible();
  });
});

describe("ReceiveModal (F-M43–46)", () => {
  const order = {
    id: "o1", orderNo: "B-1",
    items: [{ id: "i1", qtyBase: 10, qtyReceived: 2, article: { sku: "S1", name: "Mehl", baseUnit: "kg", defaultLocationId: null } }],
  };
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ data: [] }) })));
  });
  it("ist ein echter Dialog mit Escape (Desktop)", async () => {
    const onClose = vi.fn();
    render(<ReceiveModal order={order} onClose={onClose} onDone={() => {}} />);
    expect(screen.getByRole("dialog")).toHaveAttribute("data-slot", "dialog-content");
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
  it("ist mobil ein Bottom-Sheet mit Footer-Knöpfen", () => {
    desktop = false;
    render(<ReceiveModal order={order} onClose={() => {}} onDone={() => {}} />);
    expect(screen.getByRole("dialog")).toHaveAttribute("data-slot", "sheet-content");
    const footer = document.querySelector("[data-slot='responsive-dialog-footer']")!;
    expect(footer).toContainElement(screen.getByRole("button", { name: "Wareneingang buchen" }));
  });
  it("Eingaben: 16px, numeric, Grid mobil einspaltig", () => {
    render(<ReceiveModal order={order} onClose={() => {}} onDone={() => {}} />);
    const qty = screen.getByRole("spinbutton");
    expect(qty).toHaveAttribute("inputmode", "numeric");
    expect(qty.className).not.toMatch(/(^| )text-sm/);
    const sel = screen.getByRole("combobox");
    expect(sel.className).toContain("min-h-11");
    expect(sel.closest("div[class*='grid']")!.className).toContain("grid-cols-1");
  });
});

describe("OrderDetailModal (F-M41/42)", () => {
  const order = {
    id: "o1", orderNo: "B-1", status: "SENT", currency: "EUR", total: "10.00", notes: null,
    createdAt: "2026-10-01T00:00:00Z", sentAt: null, confirmedAt: null, cancelledAt: null, pdfHash: null,
    supplier: { id: "s", name: "Mühle", channel: "EMAIL", email: null, city: null },
    items: [{ id: "i1", qtyOrderUnit: 1, qtyBase: 10, qtyReceived: 2, unitPrice: "1", lineTotal: "10",
      article: { sku: "S1", name: "Mehl", orderUnit: "Sack", baseUnit: "kg", packFactor: 10, defaultLocationId: null } }],
    events: [],
  };
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ data: order }) })));
  });
  it("Bottom-Sheet mobil, Positionskarten, Aktionen im Footer", async () => {
    desktop = false;
    render(<OrderDetailModal orderId="o1" onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText("Mühle")).toBeInTheDocument());
    expect(screen.getByRole("dialog")).toHaveAttribute("data-slot", "sheet-content");
    const cards = document.querySelector("[data-slot='order-item-cards']")!;
    expect(cards).toHaveClass("md:hidden");
    expect(cards.textContent).toContain("2 / 10 kg");
    const footer = document.querySelector("[data-slot='responsive-dialog-footer']")!;
    expect(footer).toContainElement(screen.getByRole("button", { name: "Wareneingang" }));
    expect(document.querySelector("[class*='max-h-[85vh]']")).toBeNull();
  });
});
