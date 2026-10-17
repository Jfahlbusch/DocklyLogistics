// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "../helpers/intl";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
}));
const toastError = vi.fn();
vi.mock("sonner", () => ({ toast: { error: (...a: unknown[]) => toastError(...a), success: vi.fn() } }));

import { StockView } from "@/app/(app)/stock/stock-view";
import { ApiKeysTab } from "@/app/(app)/settings/api-keys-tab";
import { ArticleDetailModal } from "@/app/(app)/articles/article-detail-modal";

function json(body: unknown, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(body), { status });
}
type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>;
function stubFetch(handler: Handler) {
  const fn = vi.fn(async (url: string, init?: RequestInit) => handler(url, init));
  vi.stubGlobal("fetch", fn);
  return fn;
}
const deletes = (fn: ReturnType<typeof stubFetch>) =>
  fn.mock.calls.filter(([, i]) => (i as RequestInit | undefined)?.method === "DELETE");

beforeEach(() => {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: true, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  vi.stubGlobal("confirm", vi.fn(() => { throw new Error("natives confirm() darf nicht aufgerufen werden"); }));
  vi.stubGlobal("alert", vi.fn(() => { throw new Error("natives alert() darf nicht aufgerufen werden"); }));
  refresh.mockClear();
  toastError.mockClear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Lagerplatz löschen (stock-view)", () => {
  const loc = { id: "l1", code: "A-01", name: "Regal A", zone: "Trocken", capacity: 10, used: 2 };
  const props = { locations: [loc], articles: [], totalUnits: 2, role: "MANAGER" };

  it("ruft DELETE erst nach Bestätigung auf", async () => {
    const fetchFn = stubFetch(() => json(null, 204));
    renderWithIntl(<StockView {...props} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Lagerplatz A-01 löschen" })[0]);
    const dlg = await screen.findByRole("alertdialog");
    expect(within(dlg).getByText(/Lagerplatz "A-01" wirklich/)).toBeTruthy();
    expect(deletes(fetchFn)).toHaveLength(0);
    fireEvent.click(within(dlg).getByRole("button", { name: "Löschen" }));
    await waitFor(() => expect(deletes(fetchFn)).toHaveLength(1));
    expect(deletes(fetchFn)[0][0]).toBe("/api/v1/locations/l1");
  });

  it("Abbrechen ruft nichts auf", async () => {
    const fetchFn = stubFetch(() => json(null, 204));
    renderWithIntl(<StockView {...props} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Lagerplatz A-01 löschen" })[0]);
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Abbrechen" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe("API-Key widerrufen (api-keys-tab)", () => {
  const key = { id: "k1", label: "CI", prefix: "dk_abc", role: "USER", lastUsedAt: null, expiresAt: null, createdAt: "2026-10-01T00:00:00Z" };
  const handler: Handler = (url, init) =>
    init?.method === "DELETE" ? json(null, 204) : json({ data: [key] });

  it("widerruft erst nach Bestätigung", async () => {
    const fetchFn = stubFetch(handler);
    renderWithIntl(<ApiKeysTab role="USER" />);
    const btn = (await screen.findAllByRole("button", { name: /Widerrufen/i }))[0];
    fireEvent.click(btn);
    const dlg = await screen.findByRole("alertdialog");
    expect(within(dlg).getByText(/verlieren sofort den Zugriff/)).toBeTruthy();
    expect(deletes(fetchFn)).toHaveLength(0);
    fireEvent.click(within(dlg).getByRole("button", { name: "Widerrufen" }));
    await waitFor(() => expect(deletes(fetchFn)).toHaveLength(1));
  });

  it("Abbrechen widerruft nicht", async () => {
    const fetchFn = stubFetch(handler);
    renderWithIntl(<ApiKeysTab role="USER" />);
    fireEvent.click((await screen.findAllByRole("button", { name: /Widerrufen/i }))[0]);
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Abbrechen" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(deletes(fetchFn)).toHaveLength(0);
  });
});

describe("Artikel löschen (article-detail-modal)", () => {
  const article = {
    id: "a1", sku: "SKU-1", name: "Mehl", shortDesc: null, longDesc: null, category: null, eanGtin: null,
    baseUnit: "kg", orderUnit: "kg", packFactor: 1, barcodeSource: "SKU", minStock: 0, defaultLocationId: null, vatRate: null,
  };

  it("zeigt den Lösch-Fehler als Toast statt alert()", async () => {
    stubFetch((url, init) => {
      if (init?.method === "DELETE") return json({ title: "Conflict", detail: "Artikel hat Bestand" }, 409);
      return json({ data: url.endsWith("/suppliers") ? [] : article });
    });
    renderWithIntl(<ArticleDetailModal articleId="a1" role="MANAGER" onClose={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Löschen" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Löschen" }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Artikel hat Bestand"));
  });

  it("löscht nicht ohne Bestätigung", async () => {
    const fetchFn = stubFetch((url) => json({ data: url.endsWith("/suppliers") ? [] : article }));
    renderWithIntl(<ArticleDetailModal articleId="a1" role="MANAGER" onClose={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Löschen" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Abbrechen" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(deletes(fetchFn)).toHaveLength(0);
    expect(toastError).not.toHaveBeenCalled();
  });
});
