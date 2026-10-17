// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "../helpers/intl";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

import { ArticleForm, defaultArticleValues, type ArticleFormValues } from "@/app/(app)/articles/article-form";
import { ArticleDetailModal } from "@/app/(app)/articles/article-detail-modal";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const baseValues: ArticleFormValues = {
  ...defaultArticleValues,
  sku: "A-1",
  name: "Mehl",
  baseUnit: "KG",
  minStock: 100,
  targetStock: 300,
  maxStock: 500,
};

function stubLocations() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 })),
  );
}

describe("ArticleForm: Mengen", () => {
  beforeEach(stubLocations);

  it("zeigt Mindest-, empfohlene und Maximalmenge vorbelegt mit Basiseinheit", () => {
    renderWithIntl(
      <ArticleForm initial={baseValues} isCreate={false} busy={false} onSubmit={vi.fn()} onCancel={vi.fn()} />,
    );
    expect((screen.getByLabelText(/Mindestmenge/) as HTMLInputElement).value).toBe("100");
    expect((screen.getByLabelText(/Empfohlene Menge/) as HTMLInputElement).value).toBe("300");
    expect((screen.getByLabelText(/Maximalmenge \(Lagerkapazität\)/) as HTMLInputElement).value).toBe("500");
    expect(screen.getAllByText("KG").length).toBeGreaterThanOrEqual(3);
    for (const re of [/Mindestmenge/, /Empfohlene Menge/, /Maximalmenge/]) {
      expect(screen.getByLabelText(re).getAttribute("inputmode")).toBe("numeric");
    }
  });

  it("sendet maxStock und targetStock; leer wird null", () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderWithIntl(
      <ArticleForm initial={baseValues} isCreate={false} busy={false} onSubmit={onSubmit} onCancel={vi.fn()} />,
    );
    fireEvent.change(screen.getByLabelText(/Empfohlene Menge/), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText(/Maximalmenge/), { target: { value: "" } });
    fireEvent.submit(screen.getByRole("button", { name: "Speichern" }).closest("form")!);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const sent = onSubmit.mock.calls[0][0];
    expect(sent.minStock).toBe(100);
    expect(sent.targetStock).toBeNull();
    expect(sent.maxStock).toBeNull();
  });

  it("sendet gesetzte Werte als Zahlen", () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderWithIntl(
      <ArticleForm initial={baseValues} isCreate={false} busy={false} onSubmit={onSubmit} onCancel={vi.fn()} />,
    );
    fireEvent.change(screen.getByLabelText(/Maximalmenge/), { target: { value: "800" } });
    fireEvent.submit(screen.getByRole("button", { name: "Speichern" }).closest("form")!);
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ minStock: 100, targetStock: 300, maxStock: 800 });
  });

  it("zeigt Feldfehler aus fieldErrors am jeweiligen Feld", () => {
    renderWithIntl(
      <ArticleForm
        initial={baseValues}
        isCreate={false}
        busy={false}
        fieldErrors={{ targetStock: ["Die empfohlene Menge darf die Maximalmenge nicht übersteigen."] }}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const input = screen.getByLabelText(/Empfohlene Menge/);
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("Die empfohlene Menge darf die Maximalmenge nicht übersteigen.")).toBeTruthy();
    expect(screen.getByLabelText(/Mindestmenge/).getAttribute("aria-invalid")).not.toBe("true");
  });

  it("zeigt sofortigen Hinweis bei ungültiger Kombination", () => {
    renderWithIntl(
      <ArticleForm initial={baseValues} isCreate={false} busy={false} onSubmit={vi.fn()} onCancel={vi.fn()} />,
    );
    fireEvent.change(screen.getByLabelText(/Maximalmenge/), { target: { value: "50" } });
    expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
  });
});

const article = {
  id: "art1",
  sku: "A-1",
  name: "Mehl",
  shortDesc: null,
  longDesc: null,
  category: null,
  eanGtin: null,
  baseUnit: "KG",
  orderUnit: "SACK",
  packFactor: 25,
  barcodeSource: "SKU",
  minStock: 100,
  maxStock: 500,
  targetStock: null,
  defaultLocationId: null,
  vatRate: null,
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

describe("ArticleDetailModal: Mengen", () => {
  it("zeigt alle drei Werte, nicht gesetzte als Gedankenstrich", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.endsWith("/suppliers")) return json({ data: [] });
        return json({ data: article });
      }),
    );
    renderWithIntl(<ArticleDetailModal articleId="art1" role="USER" onClose={vi.fn()} />);
    await screen.findByText("Mehl");
    const min = await screen.findByTestId("qty-minStock");
    const target = screen.getByTestId("qty-targetStock");
    const max = screen.getByTestId("qty-maxStock");
    expect(min.textContent).toContain("100 KG");
    expect(target.textContent).toContain("—");
    expect(max.textContent).toContain("500 KG");
  });

  it("zeigt 422-Feldfehler am Feld und speichert nichts", async () => {
    const calls: Array<{ url: string; method?: string }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, method: init?.method });
        if (init?.method === "PATCH") {
          return json(
            {
              title: "Validation failed",
              status: 422,
              errors: { targetStock: ["Die empfohlene Menge darf die Maximalmenge nicht übersteigen."] },
            },
            422,
          );
        }
        if (url.startsWith("/api/v1/locations")) return json({ data: [] });
        if (url.endsWith("/suppliers")) return json({ data: [] });
        return json({ data: article });
      }),
    );
    renderWithIntl(<ArticleDetailModal articleId="art1" role="USER" onClose={vi.fn()} />);
    await screen.findByText("Mehl");
    fireEvent.click(await screen.findByRole("button", { name: /Bearbeiten/ }));
    fireEvent.change(await screen.findByLabelText(/Empfohlene Menge/), { target: { value: "900" } });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    await waitFor(() =>
      expect(screen.getByText("Die empfohlene Menge darf die Maximalmenge nicht übersteigen.")).toBeTruthy(),
    );
    expect(screen.getByLabelText(/Empfohlene Menge/).getAttribute("aria-invalid")).toBe("true");
    const patch = calls.find((c) => c.method === "PATCH");
    expect(patch).toBeTruthy();
    // Dialog bleibt im Bearbeitungsmodus
    expect(screen.getByRole("button", { name: "Speichern" })).toBeTruthy();
  });
});
