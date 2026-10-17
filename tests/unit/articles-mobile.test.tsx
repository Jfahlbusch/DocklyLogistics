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
  useSearchParams: () => new URLSearchParams("q=mehl"),
  usePathname: () => "/articles",
}));

import { ArticlesView } from "@/app/(app)/articles/articles-view";
import { ArticleDetailModal } from "@/app/(app)/articles/article-detail-modal";
import { ArticleForm, defaultArticleValues } from "@/app/(app)/articles/article-form";
import { ArticleSupplierForm, defaultLinkValues } from "@/app/(app)/articles/article-supplier-form";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

beforeEach(() => {
  desktop = true;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.includes("/suppliers?pageSize")) return json({ data: [{ id: "s2", name: "Müller", channel: "EMAIL" }] });
      if (url.endsWith("/suppliers"))
        return json({
          data: [
            {
              id: "l1", isPrimary: false, purchasePrice: "2.5", currency: "EUR", leadTimeDays: 3, minOrderQty: 2,
              supplierSku: "X-1", supplier: { id: "s1", name: "Mühle", channel: "EDI", city: "Ulm" },
            },
          ],
        });
      if (url.startsWith("/api/v1/articles/art1"))
        return json({
          data: {
            id: "art1", sku: "A-1", name: "Mehl", shortDesc: null, longDesc: null, category: null, eanGtin: "4000000000001",
            baseUnit: "KG", orderUnit: "SACK", packFactor: 25, barcodeSource: "SKU", minStock: 0,
            defaultLocationId: null, vatRate: null, zoneId: null, zone: null,
          },
        });
      return json({ data: [] });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  push.mockClear();
});

const row = {
  id: "r1", sku: "S-1", name: "Mehl", eanGtin: "123", category: "Mehl", locationCode: "A-1", zoneName: "Z",
  stock: 5, minStock: 2, orderUnit: "SACK", ek: "1.5", primarySupplierName: "Mühle", role: "USER",
};
const props = {
  rows: [row], total: 1, categories: ["Mehl", "Zucker"], belowMinCount: 0, canCreate: true, q: "mehl",
  zones: [{ id: "zA", name: "Zone A" }], zoneId: "",
};

describe("ArticlesView mobil/tablet", () => {
  it("Tabelle erst ab xl, Karten darunter (F-M6 ff., B10)", () => {
    renderWithIntl(<ArticlesView {...props} />);
    const table = screen.getByRole("table");
    const wrap = table.parentElement!;
    expect(wrap.className).toMatch(/\bhidden\b/);
    expect(wrap.className).toMatch(/xl:block/);
    expect(wrap.className).not.toMatch(/md:block/);
    const card = screen.getByTestId("card-zone-r1").closest("button")!;
    expect(card.parentElement!.className).toMatch(/xl:hidden/);
    expect(card.className).toMatch(/min-h-11/);
  });

  it("Nebenspalten Einheit und Primärlieferant erst ab 2xl", () => {
    renderWithIntl(<ArticlesView {...props} />);
    for (const name of ["Einheit", "Primärlieferant"]) {
      expect(screen.getByRole("columnheader", { name }).className).toMatch(/hidden 2xl:table-cell/);
    }
  });

  it("Suchfeld ist ein Such-Input (F-M7)", () => {
    renderWithIntl(<ArticlesView {...props} />);
    const input = screen.getByPlaceholderText(/Suche nach SKU/);
    expect(input).toHaveAttribute("type", "search");
    expect(input).toHaveAttribute("enterkeyhint", "search");
    expect(input).toHaveAttribute("autocapitalize", "none");
  });

  it("Kategorie-Filter wirkt und ist mobil bedienbar (F-M6)", () => {
    renderWithIntl(<ArticlesView {...props} />);
    const sel = screen.getByLabelText("Kategorie") as HTMLSelectElement;
    expect(sel.className).toMatch(/text-base/);
    expect(sel.className).toMatch(/min-h-11/);
    fireEvent.change(sel, { target: { value: "Zucker" } });
    const url = new URL(push.mock.calls[0][0], "http://x");
    expect(url.searchParams.get("category")).toBe("Zucker");
    expect(url.searchParams.get("q")).toBe("mehl");
  });

  it("Zonenfilter nutzt die gemeinsame Select-Klasse", () => {
    renderWithIntl(<ArticlesView {...props} />);
    expect(screen.getByTestId("filter-zone").className).toMatch(/min-h-11/);
  });

  it("Neuer Artikel: Dialog ab md, Sheet darunter (F-M8)", async () => {
    renderWithIntl(<ArticlesView {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "+ Neuer Artikel" }));
    expect((await screen.findByRole("dialog")).getAttribute("data-slot")).toBe("dialog-content");
    cleanup();
    desktop = false;
    renderWithIntl(<ArticlesView {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "+ Neuer Artikel" }));
    expect((await screen.findByRole("dialog")).getAttribute("data-slot")).toBe("sheet-content");
  });
});

describe("ArticleDetailModal mobil/tablet", () => {
  it("Detail ist unter md ein Sheet, ab md ein Dialog (F-M9) ohne max-h-Override", async () => {
    desktop = false;
    renderWithIntl(<ArticleDetailModal articleId="art1" role="MANAGER" onClose={vi.fn()} />);
    const d = await screen.findByRole("dialog");
    expect(d.getAttribute("data-slot")).toBe("sheet-content");
    expect(d.className).not.toMatch(/max-h-\[85vh\]/);
    await screen.findByText("Lieferanten (1)");
    cleanup();
    desktop = true;
    renderWithIntl(<ArticleDetailModal articleId="art1" role="MANAGER" onClose={vi.fn()} />);
    expect((await screen.findByRole("dialog")).getAttribute("data-slot")).toBe("dialog-content");
  });

  it("Lieferanten als Karten statt 8-Spalten-Tabelle, Aktionen 44 px (F-M13, F-M14, F-M15, F-M20)", async () => {
    renderWithIntl(<ArticleDetailModal articleId="art1" role="MANAGER" onClose={vi.fn()} />);
    await screen.findByText("Mehl");
    fireEvent.mouseDown(screen.getByRole("tab", { name: /Lieferanten/ }), { button: 0, ctrlKey: false });
    fireEvent.click(screen.getByRole("tab", { name: /Lieferanten/ }));
    const list = await screen.findByTestId("supplier-link-cards");
    expect(document.querySelector("table")!.parentElement!.className).toMatch(/hidden .*xl:block/);
    expect(list.className).toMatch(/xl:hidden/);
    const card = within(list).getByText("Mühle").closest("li")!;
    for (const name of ["als primär", "Bearbeiten", "Löschen"]) {
      expect(within(card).getByRole("button", { name }).className).toMatch(/min-h-11/);
    }
    expect(screen.getByRole("button", { name: "+ Lieferant zuordnen" }).parentElement!.className).toMatch(/flex-wrap/);
  });

  it("Footer-Knöpfe (Löschen/Bearbeiten) liegen in der Dialog-Fußzeile", async () => {
    renderWithIntl(<ArticleDetailModal articleId="art1" role="MANAGER" onClose={vi.fn()} />);
    await screen.findByText("Mehl");
    const footer = document.querySelector("[data-slot='responsive-dialog-footer']")!;
    expect(within(footer as HTMLElement).getByRole("button", { name: "Bearbeiten" })).toBeTruthy();
  });

  it("Lieferant zuordnen öffnet Sheet unter md (F-M10)", async () => {
    desktop = false;
    renderWithIntl(<ArticleDetailModal articleId="art1" role="MANAGER" onClose={vi.fn()} />);
    await screen.findByText("Mehl");
    fireEvent.mouseDown(screen.getByRole("tab", { name: /Lieferanten/ }), { button: 0, ctrlKey: false });
    fireEvent.click(await screen.findByRole("button", { name: "+ Lieferant zuordnen" }));
    await waitFor(() => expect(screen.getAllByRole("dialog", { hidden: true }).length).toBe(2));
    expect(screen.getAllByRole("dialog", { hidden: true }).every((d) => d.getAttribute("data-slot") === "sheet-content")).toBe(true);
  });
});

describe("Artikel-Formulare: Eingabefelder (INP/TCH)", () => {
  it("ArticleForm: Textarea 16 px, Zahlenfelder mit inputMode, Kategorie/SKU ohne Auto-Großschreibung (F-M16, F-M17)", () => {
    renderWithIntl(
      <ArticleForm initial={defaultArticleValues} isCreate busy={false} onSubmit={vi.fn()} onCancel={vi.fn()} />,
    );
    const ta = document.querySelector("textarea")!;
    expect(ta.className).toMatch(/text-base/);
    expect(ta.className).not.toMatch(/(^|\s)text-sm/);
    const pack = screen.getByLabelText(/Verpackungsfaktor/);
    expect(pack).toHaveAttribute("inputmode", "numeric");
    expect(screen.getByLabelText(/MwSt/)).toHaveAttribute("inputmode", "decimal");
    for (const l of [/^Kategorie/, /^SKU/]) {
      const el = screen.getByLabelText(l);
      expect(el).toHaveAttribute("autocapitalize", "none");
    }
    document.querySelectorAll("select").forEach((s) => expect(s.className).toMatch(/text-base/));
  });

  it("ArticleForm: Knöpfe in Dialog-Fußzeile", () => {
    renderWithIntl(
      <ArticleForm initial={defaultArticleValues} isCreate busy={false} onSubmit={vi.fn()} onCancel={vi.fn()} />,
    );
    const footer = screen.getByRole("button", { name: "Anlegen" }).parentElement!;
    expect(footer.getAttribute("data-slot")).toBe("responsive-dialog-footer");
  });

  it("ArticleSupplierForm: Select 16 px/44 px, inputMode, Checkbox-Zeile 44 px (F-M18, F-M19, F-M20)", async () => {
    renderWithIntl(
      <ArticleSupplierForm initial={defaultLinkValues} isCreate busy={false} onSubmit={vi.fn()} onCancel={vi.fn()} />,
    );
    await screen.findByText(/Müller/);
    const sel = screen.getByLabelText(/Lieferant/, { selector: "select" });
    expect(sel.className).toMatch(/text-base/);
    expect(sel.className).toMatch(/min-h-11/);
    expect(screen.getByLabelText(/Einkaufspreis/)).toHaveAttribute("inputmode", "decimal");
    expect(screen.getByLabelText(/Lieferzeit/)).toHaveAttribute("inputmode", "numeric");
    expect(screen.getByLabelText(/Mindestmenge/)).toHaveAttribute("inputmode", "numeric");
    const cb = screen.getByRole("checkbox");
    expect(cb.className).toMatch(/size-5/);
    expect(cb.closest("label")!.className).toMatch(/min-h-11/);
  });
});
