// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "../helpers/intl";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push }),
  useSearchParams: () => new URLSearchParams("q=mehl"),
  usePathname: () => "/articles",
}));

import { ArticleForm, defaultArticleValues, type ArticleFormValues } from "@/app/(app)/articles/article-form";
import { ArticleDetailModal } from "@/app/(app)/articles/article-detail-modal";
import { ArticlesView } from "@/app/(app)/articles/articles-view";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  push.mockClear();
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

const zones = [
  { id: "zA", name: "Zone A", active: true },
  { id: "zB", name: "Zone B", active: true },
  { id: "zX", name: "Alte Zone", active: false },
];
const locations = [
  { id: "l1", code: "A-1", name: "Regal A1", zoneId: "zA" },
  { id: "l2", code: "B-1", name: "Regal B1", zoneId: "zB" },
  { id: "l3", code: "N-1", name: "Ohne", zoneId: null },
];

function stubApi() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.startsWith("/api/v1/zones")) return json({ data: zones });
      if (url.startsWith("/api/v1/locations")) return json({ data: locations });
      return json({ data: [] });
    }),
  );
}

const values: ArticleFormValues = { ...defaultArticleValues, sku: "A-1", name: "Mehl", baseUnit: "KG" };

function renderForm(initial: ArticleFormValues, extra: Partial<React.ComponentProps<typeof ArticleForm>> = {}) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  renderWithIntl(<ArticleForm initial={initial} isCreate={false} busy={false} onSubmit={onSubmit} onCancel={vi.fn()} {...extra} />);
  return onSubmit;
}
const zoneSel = () => screen.getByTestId("field-zone") as HTMLSelectElement;
const locSel = () => screen.getByTestId("field-location") as HTMLSelectElement;
const optionValues = (s: HTMLSelectElement) => Array.from(s.options).map((o) => o.value);

describe("ArticleForm: Zone und Lagerplatz", () => {
  it("zeigt nur aktive Zonen und „— keine —“", async () => {
    stubApi();
    renderForm(values);
    await waitFor(() => expect(optionValues(zoneSel())).toContain("zA"));
    expect(optionValues(zoneSel())).toEqual(["", "zA", "zB"]);
    expect(within(zoneSel()).getByText("— keine —")).toBeTruthy();
  });

  it("filtert Lagerplätze nach gewählter Zone; ohne Zone alle", async () => {
    stubApi();
    renderForm(values);
    await waitFor(() => expect(optionValues(locSel())).toContain("l1"));
    expect(optionValues(locSel())).toEqual(["", "l1", "l2", "l3"]);
    fireEvent.change(zoneSel(), { target: { value: "zB" } });
    expect(optionValues(locSel())).toEqual(["", "l2"]);
  });

  it("leert beim Zonenwechsel einen nicht passenden Lagerplatz, behält einen passenden", async () => {
    stubApi();
    const onSubmit = renderForm({ ...values, zoneId: "zA", defaultLocationId: "l1" });
    await waitFor(() => expect(optionValues(locSel())).toContain("l1"));
    expect(locSel().value).toBe("l1");
    fireEvent.change(zoneSel(), { target: { value: "zB" } });
    expect(locSel().value).toBe("");
    fireEvent.submit(screen.getByRole("button", { name: "Speichern" }).closest("form")!);
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ zoneId: "zB", defaultLocationId: null });
  });

  it("Wahl eines Lagerplatzes setzt dessen Zone", async () => {
    stubApi();
    renderForm(values);
    await waitFor(() => expect(optionValues(locSel())).toContain("l2"));
    fireEvent.change(locSel(), { target: { value: "l2" } });
    expect(zoneSel().value).toBe("zB");
    // Lagerplatz ohne Zone ist bei gewählter Zone nicht auswählbar; ohne Zone wählbar, ohne Zone zu setzen
    fireEvent.change(zoneSel(), { target: { value: "" } });
    fireEvent.change(locSel(), { target: { value: "l3" } });
    expect(zoneSel().value).toBe("");
  });

  it("zeigt Feldfehler zu zoneId und defaultLocationId am Feld", async () => {
    stubApi();
    renderForm(values, { fieldErrors: { zoneId: ["Zone nicht gefunden"], defaultLocationId: ["Lagerplatz gehört zu einer anderen Zone"] } });
    expect(screen.getByText("Zone nicht gefunden")).toBeTruthy();
    expect(screen.getByText("Lagerplatz gehört zu einer anderen Zone")).toBeTruthy();
    expect(zoneSel().getAttribute("aria-invalid")).toBe("true");
    expect(locSel().getAttribute("aria-invalid")).toBe("true");
  });

  it("Selects sind mobil bedienbar (>= 16 px, >= 44 px)", async () => {
    stubApi();
    renderForm(values);
    for (const el of [zoneSel(), locSel()]) {
      expect(el.className).toMatch(/text-base/);
      expect(el.className).toMatch(/min-h-11/);
    }
  });
});

describe("ArticleDetailModal: Zone", () => {
  it("zeigt den Zonennamen", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.endsWith("/suppliers")) return json({ data: [] });
        return json({
          data: {
            id: "art1", sku: "A-1", name: "Mehl", shortDesc: null, longDesc: null, category: null, eanGtin: null,
            baseUnit: "KG", orderUnit: "SACK", packFactor: 25, barcodeSource: "SKU", minStock: 0,
            defaultLocationId: null, vatRate: null, zoneId: "zA", zone: { id: "zA", name: "Zone A" },
          },
        });
      }),
    );
    renderWithIntl(<ArticleDetailModal articleId="art1" role="USER" onClose={vi.fn()} />);
    await screen.findByText("Mehl");
    expect((await screen.findByTestId("detail-zone")).textContent).toContain("Zone A");
  });
});

const row = (over: Record<string, unknown>) => ({
  id: "r1", sku: "S-1", name: "Mehl", eanGtin: null, category: null, locationCode: "—", zoneName: null,
  stock: 0, minStock: 0, orderUnit: "SACK", ek: null, primarySupplierName: "—", role: "USER", ...over,
});

describe("ArticlesView: Zone", () => {
  const props = {
    rows: [row({ zoneName: "Zone A" })], total: 1, categories: [], belowMinCount: 0, canCreate: false, q: "",
    zones: [{ id: "zA", name: "Zone A" }, { id: "zB", name: "Zone B" }], zoneId: "",
  };

  it("zeigt die Zone in Tabelle und Karte", () => {
    renderWithIntl(<ArticlesView {...props} />);
    expect(screen.getAllByText("Zone A").length).toBeGreaterThanOrEqual(3); // Filteroption + Tabelle + Karte
    expect(screen.getByTestId("row-zone-r1").textContent).toBe("Zone A");
    expect(screen.getByTestId("card-zone-r1").textContent).toContain("Zone A");
  });

  it("Zonenfilter steht im Suchformular, übernimmt q und setzt zoneId in der URL", () => {
    renderWithIntl(<ArticlesView {...props} />);
    const filter = screen.getByTestId("filter-zone") as HTMLSelectElement;
    expect(filter.className).toMatch(/text-base/);
    fireEvent.change(filter, { target: { value: "zB" } });
    expect(push).toHaveBeenCalledTimes(1);
    const url = new URL(push.mock.calls[0][0], "http://x");
    expect(url.pathname).toBe("/articles");
    expect(url.searchParams.get("zoneId")).toBe("zB");
    expect(url.searchParams.get("q")).toBe("mehl");
  });

  it("„Alle Zonen“ entfernt zoneId", () => {
    renderWithIntl(<ArticlesView {...props} zoneId="zA" />);
    const filter = screen.getByTestId("filter-zone") as HTMLSelectElement;
    expect(filter.value).toBe("zA");
    fireEvent.change(filter, { target: { value: "" } });
    expect(new URL(push.mock.calls[0][0], "http://x").searchParams.has("zoneId")).toBe(false);
  });
});
