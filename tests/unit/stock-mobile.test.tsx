// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "../helpers/intl";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

import { StockView } from "@/app/(app)/stock/stock-view";
import { InventoryModal } from "@/app/(app)/stock/inventory-modal";
import { LocationForm, defaultLocationValues } from "@/app/(app)/stock/location-form";

const locations = [
  { id: "l1", code: "A-01", name: "Regal A", zone: "Trocken", capacity: 100, used: 40 },
  { id: "l2", code: "K-01", name: "Kühlhaus", zone: "Kühl", capacity: null, used: 0 },
];
const articles = [{ id: "a1", sku: "SKU-1", name: "Mehl", locationCode: "A-01", stock: 3, minStock: 5 }];
const props = { locations, articles, totalUnits: 40, role: "MANAGER" as const };

function setDesktop(matches: boolean) {
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches,
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

beforeEach(() => setDesktop(true));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("StockView: Karten statt Tabelle (T17d)", () => {
  it("Lagerplätze: Tabelle erst ab xl, darunter Karten mit 44-px-Aktionen", () => {
    renderWithIntl(<StockView {...props} />);
    const table = screen.getAllByRole("table")[0];
    expect(table.parentElement!.className).toMatch(/hidden/);
    expect(table.parentElement!.className).toMatch(/xl:block/);

    const cards = screen.getByTestId("location-cards");
    expect(cards.className).toMatch(/xl:hidden/);
    const card = within(cards).getByText("A-01").closest("li")!;
    expect(within(card).getByText("Regal A")).toBeTruthy();
    const edit = within(card).getByRole("button", { name: /bearbeiten/i });
    const del = within(card).getByRole("button", { name: /löschen/i });
    for (const b of [edit, del]) expect(b.className).toMatch(/(^|\s)min-h-11(\s|$)/);
  });

  it("Lagerplatz-Karten ohne Verwalter-Recht zeigen keine Aktionen", () => {
    renderWithIntl(<StockView {...props} role="USER" />);
    expect(within(screen.getByTestId("location-cards")).queryByRole("button")).toBeNull();
  });

  it("Bestände je Artikel: Karten-Variante bis md", () => {
    renderWithIntl(<StockView {...props} />);
    const cards = screen.getByTestId("article-cards");
    expect(cards.className).toMatch(/md:hidden/);
    expect(within(cards).getByText("Mehl")).toBeTruthy();
    expect(within(cards).getByText("SKU-1")).toBeTruthy();
    expect(within(cards).getByText("3").className).toMatch(/text-rose-600/);
  });

  it("Karten-Bearbeiten lädt den Lagerplatz in den Dialog", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ data: { code: "A-01", name: "Regal A", zoneId: null, active: true } }), { status: 200 }),
      ),
    );
    renderWithIntl(<StockView {...props} />);
    const card = within(screen.getByTestId("location-cards")).getByText("A-01").closest("li")!;
    fireEvent.click(within(card).getByRole("button", { name: /bearbeiten/i }));
    expect(await screen.findByText("Lagerplatz bearbeiten")).toBeTruthy();
  });
});

describe("StockView: Lagerplatz-Dialog", () => {
  it("mobil als Bottom-Sheet (ResponsiveDialog)", () => {
    setDesktop(false);
    renderWithIntl(<StockView {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "+ Lagerplatz" }));
    const dlg = screen.getByRole("dialog");
    expect(dlg.getAttribute("data-slot")).toBe("sheet-content");
    expect(dlg.querySelector("[data-slot='responsive-dialog-footer']")).toBeTruthy();
  });

  it("Desktop: zentrierter Dialog", () => {
    renderWithIntl(<StockView {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "+ Lagerplatz" }));
    expect(screen.getByRole("dialog").getAttribute("data-slot")).toBe("dialog-content");
  });
});

describe("LocationForm: Eingaben (T17d)", () => {
  it("Code/Bin ohne Auto-Großschreibung/Korrektur, Checkbox und Auswahl touch-tauglich", () => {
    renderWithIntl(
      <LocationForm initial={defaultLocationValues} isCreate busy={false} zones={[{ id: "z", name: "Trocken" }]} onSubmit={async () => {}} onCancel={() => {}} />,
    );
    for (const name of [/Code/, "Bin"]) {
      const input = screen.getByLabelText(name);
      expect(input.getAttribute("autocapitalize")).toBe("none");
      expect(input.getAttribute("autocorrect")).toBe("off");
    }
    const cb = screen.getByRole("checkbox");
    expect(cb.className).toMatch(/size-5/);
    expect(cb.closest("label")!.className).toMatch(/min-h-11/);
    expect(screen.getByLabelText("Zone").className).toMatch(/min-h-11/);
    expect(screen.getByRole("button", { name: "Abbrechen" }).className).toMatch(/min-h-11|h-11/);
  });
});

describe("InventoryModal (T17d)", () => {
  function stub() {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({ data: [{ id: "b1", articleId: "a1", quantity: 7, article: { sku: "SKU-1", name: "Mehl" } }] }),
          { status: 200 },
        ),
      ),
    );
  }
  const modal = () => (
    <InventoryModal locations={locations} onClose={vi.fn()} onPosted={vi.fn()} />
  );

  it("ist ein echter Dialog mit Titel und Escape-Schließen", () => {
    const onClose = vi.fn();
    renderWithIntl(<InventoryModal locations={locations} onClose={onClose} onPosted={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: "Inventur" })).toBeTruthy();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("Lagerplatz-Auswahl hat 16 px mobil und 44 px Höhe", () => {
    renderWithIntl(modal());
    const sel = screen.getByRole("combobox");
    expect(sel.className).toMatch(/min-h-11/);
    expect(sel.className).toMatch(/text-base/);
    expect(sel.className).not.toMatch(/(^|\s)text-sm/);
  });

  it("mobil: Zeilen-Karten mit großem Zähl-Input (inputMode numeric)", async () => {
    setDesktop(false);
    stub();
    renderWithIntl(modal());
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "l1" } });
    await waitFor(() => expect(screen.getByTestId("inventory-cards")).toBeTruthy());
    expect(screen.queryByRole("table")).toBeNull();
    const input = screen.getByRole("spinbutton", { name: /Gezählt.*Mehl/ });
    expect(input.className).toMatch(/h-11/);
    expect(input.getAttribute("inputmode")).toBe("numeric");
  });

  it("Desktop: Tabelle bleibt", async () => {
    stub();
    renderWithIntl(modal());
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "l1" } });
    await waitFor(() => expect(screen.getByRole("table")).toBeTruthy());
    expect(screen.queryByTestId("inventory-cards")).toBeNull();
    expect(screen.getByRole("spinbutton", { name: /Gezählt.*Mehl/ }).getAttribute("inputmode")).toBe("numeric");
  });
});
