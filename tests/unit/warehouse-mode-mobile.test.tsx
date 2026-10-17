// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "../helpers/intl";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import { WarehouseModeView } from "@/app/(app)/warehouse-mode/warehouse-mode-view";

const article = {
  id: "a1", sku: "SKU-1", name: "Mehl", eanGtin: null, category: null, baseUnit: "kg", orderUnit: "Sack",
  packFactor: 25, minStock: 0, targetStock: null, maxStock: null, defaultLocationId: "l1",
};

function json(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 });
}

function setDesktop(matches: boolean) {
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  }));
}

beforeEach(() => {
  setDesktop(false);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.startsWith("/api/v1/articles?q=")) return json({ data: [article] });
      if (url.startsWith("/api/v1/articles/")) return json({ data: article });
      if (url.startsWith("/api/v1/stock?")) return json({ data: [] });
      if (url.startsWith("/api/v1/locations")) return json({ data: [{ id: "l1", code: "A-01", name: "Regal A" }] });
      return json({ data: [] });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const touch = (el: HTMLElement) => expect(el.className).toMatch(/(^|\s)(min-h-11|h-11)(\s|$)/);

describe("Lagermodus mobil (T17d)", () => {
  it("Knöpfe haben 44 px Touch-Ziel", () => {
    renderWithIntl(<WarehouseModeView role="USER" tenant="t" />);
    for (const name of [/Scanner starten/, /Suche/, /Offline-Queue/, /Zur Übersicht/, /Beenden/]) {
      touch(screen.getByRole("button", { name }));
    }
  });

  it("SKU-Eingabe: keine Auto-Großschreibung/Korrektur, Such-Taste", () => {
    renderWithIntl(<WarehouseModeView role="USER" tenant="t" />);
    const input = screen.getByPlaceholderText(/SKU \/ EAN/);
    expect(input.getAttribute("autocapitalize")).toBe("none");
    expect(input.getAttribute("autocorrect")).toBe("off");
    expect(input.getAttribute("spellcheck")).toBe("false");
    expect(input.getAttribute("enterkeyhint")).toBe("search");
  });

  async function openAdjust() {
    renderWithIntl(<WarehouseModeView role="USER" tenant="t" />);
    const input = screen.getByPlaceholderText(/SKU \/ EAN/);
    fireEvent.change(input, { target: { value: "SKU-1" } });
    fireEvent.submit(input.closest("form")!);
    fireEvent.click(await screen.findByRole("button", { name: "Bestand korrigieren" }));
  }

  it("„Bestand korrigieren“ ist mobil ein Bottom-Sheet mit sticky Fußzeile", async () => {
    await openAdjust();
    const dlg = await screen.findByRole("dialog");
    expect(dlg.getAttribute("data-slot")).toBe("sheet-content");
    expect(dlg.querySelector("[data-slot='responsive-dialog-body']")).toBeTruthy();
    expect(dlg.querySelector("[data-slot='responsive-dialog-footer']")).toBeTruthy();
  });

  it("Auswahlfelder: 16 px und min-h-11, Escape schließt", async () => {
    await openAdjust();
    const dlg = await screen.findByRole("dialog");
    const selects = dlg.querySelectorAll("select");
    expect(selects).toHaveLength(2);
    selects.forEach((s) => {
      expect(s.className).toMatch(/min-h-11/);
      expect(s.className).toMatch(/text-base/);
      expect(s.className).not.toMatch(/(^|\s)text-sm/);
    });
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("Desktop: zentrierter Dialog", async () => {
    setDesktop(true);
    await openAdjust();
    expect((await screen.findByRole("dialog")).getAttribute("data-slot")).toBe("dialog-content");
  });
});
