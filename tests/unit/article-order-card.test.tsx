// @vitest-environment jsdom
import { screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "../helpers/intl";
import { ArticleOrderCard, type OrderCardArticle } from "@/components/warehouse/article-order-card";

const article: OrderCardArticle = {
  id: "cart1",
  sku: "MEH-25",
  name: "Weizenmehl Type 550",
  category: "Mehl",
  baseUnit: "STUECK",
  orderUnit: "KARTON",
  packFactor: 25,
  minStock: 100,
  targetStock: 300,
  maxStock: 1000,
};

type Reply = { status: number; body?: unknown } | Error;
let fetchMock: ReturnType<typeof vi.fn>;

function mockFetch(opts: { pending?: number | null; put?: Reply }) {
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "PUT") {
      const r = opts.put ?? { status: 200, body: { data: { qtyOrderUnit: 8, status: "PENDING" }, capacityWarning: false } };
      if (r instanceof Error) throw r;
      return new Response(r.body === undefined ? null : JSON.stringify(r.body), { status: r.status });
    }
    const data = opts.pending != null ? [{ id: "s1", qtyOrderUnit: opts.pending }] : [];
    return new Response(JSON.stringify({ data }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
}

const input = () => screen.getByLabelText("Bestellmenge") as HTMLInputElement;
const submit = () => screen.getByRole("button", { name: "In Bestellvorschläge übernehmen" });
const putCalls = () => fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === "PUT");

beforeEach(() => mockFetch({}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ArticleOrderCard", () => {
  it("zeigt Kopf und Kennzahlen, fehlende Werte als Strich", () => {
    renderWithIntl(
      <ArticleOrderCard article={{ ...article, targetStock: null, maxStock: null }} stockTotal={120} />,
    );
    expect(screen.getByText("Weizenmehl Type 550")).toBeTruthy();
    expect(screen.getByText("MEH-25")).toBeTruthy();
    expect(screen.getByText("Bestand").nextElementSibling?.textContent).toBe("120");
    expect(screen.getByText("Mindest").nextElementSibling?.textContent).toBe("100");
    expect(screen.getByText("Empfohlen").nextElementSibling?.textContent).toBe("—");
    expect(screen.getByText("Maximal").nextElementSibling?.textContent).toBe("—");
  });

  it("belegt den Stepper mit der Differenz zur empfohlenen Menge vor (300 − 120, Pack 25 → 8)", async () => {
    renderWithIntl(<ArticleOrderCard article={article} stockTotal={120} />);
    expect(input().value).toBe("8");
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  });

  it("rechnet ohne empfohlene Menge gegen die Mindestmenge (100 − 20, Pack 25 → 4)", async () => {
    renderWithIntl(<ArticleOrderCard article={{ ...article, targetStock: null }} stockTotal={20} />);
    expect(input().value).toBe("4");
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  });

  it("fragt den offenen Vorschlag des Artikels ab", async () => {
    renderWithIntl(<ArticleOrderCard article={article} stockTotal={120} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/order-suggestions?status=PENDING&articleId=cart1&pageSize=1");
  });

  it("übernimmt einen offenen Vorschlag (5) in den Stepper und weist darauf hin", async () => {
    mockFetch({ pending: 5 });
    renderWithIntl(<ArticleOrderCard article={article} stockTotal={120} />);
    await waitFor(() => expect(input().value).toBe("5"));
    expect(screen.getByText("Offener Vorschlag: 5")).toBeTruthy();
  });

  it("überschreibt eine bereits geänderte Menge nicht mit dem offenen Vorschlag", async () => {
    mockFetch({ pending: 5 });
    renderWithIntl(<ArticleOrderCard article={article} stockTotal={120} />);
    fireEvent.change(input(), { target: { value: "11" } });
    await waitFor(() => expect(screen.getByText("Offener Vorschlag: 5")).toBeTruthy());
    expect(input().value).toBe("11");
  });

  it("Übernehmen sendet PUT mit der Menge an den Artikel und meldet Erfolg", async () => {
    const onSaved = vi.fn();
    renderWithIntl(<ArticleOrderCard article={article} stockTotal={120} onSaved={onSaved} />);
    fireEvent.click(submit());
    await screen.findByText("Bestellvorschlag gespeichert: 8 KARTON");
    const [url, init] = putCalls()[0] as [string, RequestInit];
    expect(url).toBe("/api/v1/articles/cart1/pending-suggestion");
    expect(JSON.parse(String(init.body))).toEqual({ qtyOrderUnit: 8 });
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it("zeigt den Kapazitätshinweis aus der Antwort", async () => {
    mockFetch({ put: { status: 201, body: { data: { qtyOrderUnit: 8, status: "PENDING" }, capacityWarning: true } } });
    renderWithIntl(<ArticleOrderCard article={{ ...article, maxStock: null }} stockTotal={120} />);
    fireEvent.click(submit());
    await screen.findByText(/Kapazitätshinweis/);
  });

  it("Menge 0 ohne offenen Vorschlag (204) meldet, dass nichts bestellt wird", async () => {
    mockFetch({ put: { status: 204 } });
    const onSaved = vi.fn();
    renderWithIntl(<ArticleOrderCard article={article} stockTotal={400} onSaved={onSaved} />);
    expect(input().value).toBe("0");
    fireEvent.click(submit());
    await screen.findByText("Nichts zu bestellen – es gibt keinen offenen Vorschlag.");
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("Fehler 500: Meldung, Menge bleibt, kein onSaved", async () => {
    mockFetch({ put: { status: 500, body: { title: "Boom" } } });
    const onSaved = vi.fn();
    renderWithIntl(<ArticleOrderCard article={article} stockTotal={120} onSaved={onSaved} />);
    fireEvent.change(input(), { target: { value: "9" } });
    fireEvent.click(submit());
    await screen.findByText(/konnte nicht gespeichert werden/);
    expect(input().value).toBe("9");
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("Netzfehler (fetch reject): Meldung, Menge bleibt", async () => {
    mockFetch({ put: new TypeError("offline") });
    renderWithIntl(<ArticleOrderCard article={article} stockTotal={120} />);
    fireEvent.click(submit());
    await screen.findByText(/konnte nicht gespeichert werden/);
    expect(input().value).toBe("8");
    expect(submit().hasAttribute("disabled")).toBe(false);
  });

  it("deaktiviert Stepper und Übernehmen bei disabled", () => {
    renderWithIntl(<ArticleOrderCard article={article} stockTotal={120} disabled />);
    expect(submit().hasAttribute("disabled")).toBe(true);
    expect(input().disabled).toBe(true);
  });

  it("submitLabel ersetzt die Beschriftung; onSaved liefert dismissed", async () => {
    mockFetch({ put: { status: 200, body: { data: { status: "DISMISSED" } } } });
    const onSaved = vi.fn();
    renderWithIntl(<ArticleOrderCard article={article} stockTotal={120} onSaved={onSaved} submitLabel="Weiter" />);
    fireEvent.click(screen.getByRole("button", { name: "Weiter" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(onSaved.mock.calls[0][0]).toMatchObject({ dismissed: true, capacityWarning: false });
  });

  it("onNothingToOrder wird bei 204 aufgerufen", async () => {
    mockFetch({ put: { status: 204 } });
    const onNothing = vi.fn();
    renderWithIntl(<ArticleOrderCard article={article} stockTotal={400} onNothingToOrder={onNothing} />);
    fireEvent.click(submit());
    await waitFor(() => expect(onNothing).toHaveBeenCalledTimes(1));
  });
});

describe("ArticleOrderCard — Hauptknopf über der Tab-Leiste", () => {
  it("bleibt unter 992 px sticky knapp über der schwebenden Tab-Leiste (nie verdeckt)", async () => {
    const { ArticleOrderCard } = await import("@/components/warehouse/article-order-card");
    const { renderWithIntl } = await import("../helpers/intl");
    const { screen } = await import("@testing-library/react");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 })));
    renderWithIntl(
      <ArticleOrderCard
        article={{ id: "a1", sku: "S", name: "N", baseUnit: "KG", orderUnit: "SACK", packFactor: 25, minStock: 0, targetStock: null, maxStock: null }}
        stockTotal={0}
        submitLabel="Übernehmen & weiter"
      />,
    );
    const wrap = screen.getByRole("button", { name: "Übernehmen & weiter" }).parentElement!;
    expect(wrap).toHaveClass("max-nav:sticky", "max-nav:bottom-[calc(env(safe-area-inset-bottom)+5rem)]", "max-nav:z-10");
    vi.unstubAllGlobals();
  });
});
