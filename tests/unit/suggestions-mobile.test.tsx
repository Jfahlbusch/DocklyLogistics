// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { SuggestionsView } from "@/app/(app)/order-suggestions/suggestions-view";

afterEach(cleanup);

const rows = [{
  id: "r1", status: "PENDING", reason: "AUTO_MIN_STOCK", qtyOrderUnit: 3, note: null,
  article: { sku: "S1", name: "Mehl", minStock: 1, orderUnit: "Sack", packFactor: 10 },
  supplier: { id: "s1", name: "Mühle", channel: "EMAIL" }, createdAt: "2026-10-01T10:00:00Z",
}];

function setup() {
  return render(
    <SuggestionsView rows={rows} total={1} currentStatus="PENDING" suppliers={[{ id: "s1", name: "Mühle", channel: "EMAIL" }]} canConfirm />,
  );
}

describe("SuggestionsView mobil/tablet", () => {
  it("Tabelle ab xl, Karten darunter; Nebenspalten erst ab 2xl (B10)", () => {
    const { container } = setup();
    const table = container.querySelector("table")!;
    expect(table.parentElement).toHaveClass("hidden", "xl:block");
    expect(table.parentElement).not.toHaveClass("overflow-x-auto");
    expect(container.querySelector("[data-slot='suggestion-cards']")).toHaveClass("xl:hidden");
    const heads = [...table.querySelectorAll("th")].filter((th) => /Grund|Erstellt/.test(th.textContent ?? ""));
    expect(heads).toHaveLength(2);
    for (const th of heads) expect(th).toHaveClass("hidden", "2xl:table-cell");
  });
  it("Filter-Chips umbrechen und sind touch-tauglich (F-M33)", () => {
    const { container } = setup();
    const chip = screen.getByRole("button", { name: "Alle" });
    expect(chip.className).toContain("min-h-11");
    expect(chip.parentElement).toHaveClass("flex-wrap");
    expect(container).toBeTruthy();
  });
  it("Karte: Checkbox, Select, Menge, Knöpfe touch-tauglich (F-M34–36)", async () => {
    setup();
    const card = document.querySelector("[data-slot='suggestion-cards']") as HTMLElement;
    const cb = within(card).getByRole("checkbox");
    expect(cb.className).toContain("size-5");
    expect(cb.closest("label")).toHaveClass("min-h-11");
    const sel = within(card).getByRole("combobox");
    expect(sel.className).toContain("min-h-11");
    expect(sel.className).toContain("md:pointer-fine:text-sm");
    const qty = within(card).getByRole("spinbutton");
    expect(qty).toHaveAttribute("inputmode", "numeric");
    expect(qty.className).not.toMatch(/(^| )text-sm/);
    await userEvent.clear(qty);
    await userEvent.type(qty, "5");
    const save = within(card).getByRole("button", { name: "Speichern" });
    expect(save.className).toContain("max-md:h-11");
    expect(within(card).getByRole("button", { name: "Verwerfen" }).className).toContain("max-md:h-11");
  });
});
