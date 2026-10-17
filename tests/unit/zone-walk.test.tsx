// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "../helpers/intl";

const replace = vi.fn();
const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push, refresh: vi.fn() }),
}));

import { ZoneWalk } from "@/components/warehouse/zone-walk";

function item(n: number) {
  return {
    article: {
      id: `a${n}`,
      sku: `SKU-${n}`,
      name: `Artikel ${n}`,
      baseUnit: "STUECK",
      orderUnit: "KARTON",
      packFactor: 25,
      minStock: 100,
      targetStock: 300,
      maxStock: 1000,
    },
    location: { id: `l${n}`, code: `A-0${n}`, name: `Regal ${n}` },
    stockTotal: 120,
    suggestedQty: 8,
    pendingSuggestion: null,
  };
}

type Put = { status: number; body?: unknown } | Error;
let fetchMock: ReturnType<typeof vi.fn>;
let putReplies: Put[];

function setup(opts: { walk?: { status: number; body?: unknown }; items?: number } = {}) {
  putReplies = [];
  const items = Array.from({ length: opts.items ?? 3 }, (_, i) => item(i + 1));
  fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "PUT") {
      const r = putReplies.shift() ?? { status: 200, body: { data: { status: "PENDING" }, capacityWarning: false } };
      if (r instanceof Error) throw r;
      return new Response(r.body === undefined ? null : JSON.stringify(r.body), { status: r.status });
    }
    if (String(url).includes("/walk")) {
      const w = opts.walk ?? { status: 200, body: { data: { zone: { id: "z1", name: "Trockenlager" }, items } } };
      return new Response(JSON.stringify(w.body ?? {}), { status: w.status });
    }
    return new Response(JSON.stringify({ data: [] }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
}

const putCalls = () => fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === "PUT");
const next = () => screen.getByRole("button", { name: "Übernehmen & weiter" });
const skip = () => screen.getByRole("button", { name: "Überspringen" });

beforeEach(() => {
  replace.mockClear();
  push.mockClear();
  setup();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ZoneWalk", () => {
  it("zeigt Kopf 1 / 3, Fortschrittsbalken und den Lagerplatz", async () => {
    renderWithIntl(<ZoneWalk zoneId="z1" />);
    expect(await screen.findByText(/Zone Trockenlager · 1 \/ 3/)).toBeInTheDocument();
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "1");
    expect(bar).toHaveAttribute("aria-valuemax", "3");
    expect(screen.getByTestId("walk-location")).toHaveTextContent("A-01");
    expect(screen.getByText("Artikel 1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Zurück" })).toBeNull();
  });

  it("Übernehmen & weiter ruft PUT und springt erst nach Erfolg auf 2", async () => {
    renderWithIntl(<ZoneWalk zoneId="z1" />);
    await screen.findByText("Artikel 1");
    fireEvent.click(next());
    await screen.findByText("Artikel 2");
    expect(putCalls()).toHaveLength(1);
    expect(String(putCalls()[0][0])).toContain("/articles/a1/pending-suggestion");
    expect(replace).toHaveBeenLastCalledWith("/warehouse-mode?zone=z1&i=1");
    expect(screen.getByText(/· 2 \/ 3/)).toBeInTheDocument();
  });

  it("PUT-Fehler: bleibt auf 1 mit Meldung", async () => {
    renderWithIntl(<ZoneWalk zoneId="z1" />);
    await screen.findByText("Artikel 1");
    putReplies.push({ status: 500 });
    fireEvent.click(next());
    expect(await screen.findByText(/konnte nicht gespeichert werden/)).toBeInTheDocument();
    expect(screen.getByText("Artikel 1")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("Überspringen springt ohne PUT, Zurück geht zurück", async () => {
    renderWithIntl(<ZoneWalk zoneId="z1" />);
    await screen.findByText("Artikel 1");
    fireEvent.click(skip());
    await screen.findByText("Artikel 2");
    expect(putCalls()).toHaveLength(0);
    expect(replace).toHaveBeenLastCalledWith("/warehouse-mode?zone=z1&i=1");
    fireEvent.click(screen.getByRole("button", { name: "Zurück" }));
    await screen.findByText("Artikel 1");
    expect(replace).toHaveBeenLastCalledWith("/warehouse-mode?zone=z1&i=0");
  });

  it("Abschluss zeigt korrekte Zähler, Doppelübernahme nach Zurück zählt nicht doppelt", async () => {
    renderWithIntl(<ZoneWalk zoneId="z1" />);
    await screen.findByText("Artikel 1");
    fireEvent.click(next()); // 1 übernommen
    await screen.findByText("Artikel 2");
    fireEvent.click(screen.getByRole("button", { name: "Zurück" }));
    await screen.findByText("Artikel 1");
    fireEvent.click(next()); // 1 erneut übernommen, nicht doppelt
    await screen.findByText("Artikel 2");
    fireEvent.click(skip()); // 2 übersprungen
    await screen.findByText("Artikel 3");
    putReplies.push({ status: 200, body: { data: { status: "PENDING" }, capacityWarning: true } });
    fireEvent.click(next()); // 3 übernommen mit Warnung
    const done = await screen.findByTestId("walk-summary");
    expect(done).toHaveTextContent("Rundgang abgeschlossen");
    expect(screen.getByTestId("walk-count-accepted")).toHaveTextContent("2");
    expect(screen.getByTestId("walk-count-skipped")).toHaveTextContent("1");
    expect(screen.getByTestId("walk-count-warning")).toHaveTextContent("1");
    expect(screen.getByRole("link", { name: "Zu den Bestellvorschlägen" })).toHaveAttribute("href", "/order-suggestions");
    fireEvent.click(screen.getByRole("button", { name: "Rundgang neu starten" }));
    await screen.findByText("Artikel 1");
    expect(replace).toHaveBeenLastCalledWith("/warehouse-mode?zone=z1&i=0");
  });

  it("startet mit initialIndex 1 bei Artikel 2, ungültiger Index bei Artikel 1", async () => {
    renderWithIntl(<ZoneWalk zoneId="z1" initialIndex={1} />);
    expect(await screen.findByText("Artikel 2")).toBeInTheDocument();
    cleanup();
    renderWithIntl(<ZoneWalk zoneId="z1" initialIndex={99} />);
    expect(await screen.findByText("Artikel 1")).toBeInTheDocument();
  });

  it("leere Zone: Hinweis mit Link zur Zonenverwaltung", async () => {
    setup({ items: 0 });
    renderWithIntl(<ZoneWalk zoneId="z1" />);
    expect(await screen.findByText("Keine Artikel in dieser Zone")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Zur Zonenverwaltung" })).toHaveAttribute("href", "/stock?tab=zones&open=z1");
  });

  it("404: Zone nicht gefunden mit Link zurück", async () => {
    setup({ walk: { status: 404, body: {} } });
    renderWithIntl(<ZoneWalk zoneId="zx" />);
    expect(await screen.findByText("Zone nicht gefunden")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Zurück zum Lagermodus" })).toHaveAttribute("href", "/warehouse-mode");
  });

  it("anderer Fehler: Meldung und Erneut versuchen lädt neu", async () => {
    setup({ walk: { status: 500, body: {} } });
    renderWithIntl(<ZoneWalk zoneId="z1" />);
    const retry = await screen.findByRole("button", { name: "Erneut versuchen" });
    const before = fetchMock.mock.calls.length;
    fireEvent.click(retry);
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(before));
  });
});
