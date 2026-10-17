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
}));

import { EdiView } from "@/app/(app)/edi/edi-view";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
beforeEach(() => {
  desktop = true;
});

const row = {
  id: "m1", direction: "IN" as const, type: "ORDRSP", status: "PROCESSED", transport: "AS2",
  supplierName: "Dohle", documentNo: "D1", interchangeRef: "I1", error: null, createdAt: "2026-10-01T10:00:00Z",
};
const detail = {
  ...row, payload: "UNH+1", orderId: null,
  parsed: { lines: [{ lineNo: 1, ean: "400", sku: null, name: "Mehl", qty: 5, unit: "KG", price: 1.5, articleId: "a", articleName: "Mehl" }], matchedLines: 1 },
};

function setup(rows = [row]) {
  return render(<EdiView rows={rows} total={rows.length} page={1} pageSize={25} filters={{ direction: "", status: "" }} canManage />);
}

describe("EdiView mobil/tablet", () => {
  it("Tabelle erst ab xl, Karten darunter (B10)", () => {
    const { container } = setup();
    expect(container.querySelector("table")!.parentElement).toHaveClass("hidden", "xl:block");
    expect(container.querySelector("[data-slot='edi-cards']")).toHaveClass("xl:hidden");
  });
  it("Chips, Select, Pager sind touch-tauglich (F-M27–29)", () => {
    const { container } = render(
      <EdiView rows={[row]} total={100} page={2} pageSize={25} filters={{ direction: "", status: "" }} canManage />,
    );
    const chip = screen.getByRole("button", { name: "Eingang" });
    expect(chip.className).toContain("min-h-11");
    const sel = screen.getByRole("combobox");
    expect(sel.className).toContain("min-h-11");
    expect(sel.className).toContain("md:text-sm");
    expect(sel.className).not.toMatch(/(^| )text-sm/);
    expect(screen.getByRole("button", { name: "Zurück" }).className).toContain("max-md:h-11");
    expect(screen.getByRole("button", { name: "Weiter" }).className).toContain("max-md:h-11");
    expect(container).toBeTruthy();
  });
  it("Detail ist mobil ein Bottom-Sheet ohne max-h-Override, Aktionen im Footer (F-M30/32)", async () => {
    desktop = false;
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ data: detail }) })));
    setup();
    await userEvent.click(screen.getAllByRole("button", { name: /ORDRSP/ })[0]);
    await waitFor(() => expect(screen.getByText("UNH+1")).toBeInTheDocument());
    const dlg = screen.getByRole("dialog");
    expect(dlg).toHaveAttribute("data-slot", "sheet-content");
    expect(dlg.className).not.toContain("max-h-[85vh]");
    const footer = document.querySelector("[data-slot='responsive-dialog-footer']")!;
    expect(footer).toContainElement(screen.getByRole("button", { name: "Erneut verarbeiten" }));
    expect(footer).toContainElement(screen.getByRole("button", { name: "Payload kopieren" }));
    // F-M31: Positionen mobil als Karten
    expect(document.querySelector("[data-slot='edi-line-cards']")).toHaveClass("md:hidden");
  });
});
