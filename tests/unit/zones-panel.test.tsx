// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "../helpers/intl";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
}));

import { ZonesPanel, type ZoneRow } from "@/app/(app)/stock/zones-panel";
import { StockView } from "@/app/(app)/stock/stock-view";
import { LocationForm, defaultLocationValues } from "@/app/(app)/stock/location-form";

const trocken: ZoneRow = { id: "z1", name: "Trocken", sortOrder: 0, active: true, locationCount: 3, articleCount: 12 };
const kuehl: ZoneRow = { id: "z2", name: "Kühl", sortOrder: 1, active: false, locationCount: 0, articleCount: 0 };

function json(body: unknown, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(body), { status });
}

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response>;
function stubFetch(handler: Handler) {
  const fn = vi.fn(async (url: string, init?: RequestInit) => handler(url, init));
  vi.stubGlobal("fetch", fn);
  return fn;
}

beforeEach(() => {
  // Desktop-Darstellung (Dialog statt Bottom-Sheet)
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: true,
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  refresh.mockClear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ZonesPanel", () => {
  it("rendert Zonen mit Zählern und aktiv-Status (Tabelle und Karten)", () => {
    renderWithIntl(<ZonesPanel initialZones={[trocken, kuehl]} canManage />);
    // Tabelle + Karte: je einmal pro Zone
    expect(screen.getAllByText("Trocken")).toHaveLength(2);
    expect(screen.getAllByText("Kühl")).toHaveLength(2);
    const table = screen.getByRole("table");
    const row = within(table).getByText("Trocken").closest("tr")!;
    expect(within(row).getByText("3")).toBeTruthy();
    expect(within(row).getByText("12")).toBeTruthy();
    const sw = within(row).getByRole("switch");
    expect(sw.getAttribute("aria-checked")).toBe("true");
    const row2 = within(table).getByText("Kühl").closest("tr")!;
    expect(within(row2).getByRole("switch").getAttribute("aria-checked")).toBe("false");
  });

  it("hat eine Karten-Variante (md:hidden) neben der Tabelle (hidden md:block)", () => {
    const { container } = renderWithIntl(<ZonesPanel initialZones={[trocken]} canManage />);
    expect(container.querySelector(".md\\:hidden")).toBeTruthy();
    expect(container.querySelector(".hidden.md\\:block")).toBeTruthy();
  });

  it("Anlegen sendet POST und zeigt die neue Zone", async () => {
    const neu: ZoneRow = { id: "z9", name: "Tiefkühl", sortOrder: 0, active: true, locationCount: 0, articleCount: 0 };
    let created = false;
    const fetchFn = stubFetch((url, init) => {
      if (init?.method === "POST") {
        created = true;
        return json({ data: neu }, 201);
      }
      return json({ data: created ? [trocken, neu] : [trocken] });
    });
    renderWithIntl(<ZonesPanel initialZones={[trocken]} canManage />);
    fireEvent.click(screen.getByRole("button", { name: "+ Zone" }));
    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: "Tiefkühl" } });
    fireEvent.click(screen.getByRole("button", { name: "Anlegen" }));

    await waitFor(() => expect(screen.getAllByText("Tiefkühl").length).toBeGreaterThan(0));
    const post = fetchFn.mock.calls.find(([, i]) => (i as RequestInit | undefined)?.method === "POST")!;
    expect(post[0]).toBe("/api/v1/zones");
    expect(JSON.parse((post[1] as RequestInit).body as string)).toEqual({ name: "Tiefkühl", active: true });
    expect(refresh).toHaveBeenCalled();
  });

  it("409 beim Anlegen zeigt „Name existiert bereits“", async () => {
    stubFetch((url, init) =>
      init?.method === "POST"
        ? json({ title: "Zone name already exists", status: 409 }, 409)
        : json({ data: [trocken] }),
    );
    renderWithIntl(<ZonesPanel initialZones={[trocken]} canManage />);
    fireEvent.click(screen.getByRole("button", { name: "+ Zone" }));
    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: "Trocken" } });
    fireEvent.click(screen.getByRole("button", { name: "Anlegen" }));
    expect(await screen.findByText("Name existiert bereits.")).toBeTruthy();
  });

  it("409 beim Löschen zeigt „noch zugeordnet“", async () => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    stubFetch((url, init) =>
      init?.method === "DELETE"
        ? json({ title: "Zone in use", status: 409 }, 409)
        : json({ data: [trocken] }),
    );
    renderWithIntl(<ZonesPanel initialZones={[trocken]} canManage />);
    const row = within(screen.getByRole("table")).getByText("Trocken").closest("tr")!;
    fireEvent.click(within(row).getByRole("button", { name: "Löschen" }));
    expect(await screen.findByText("Zone ist noch Lagerplätzen oder Artikeln zugeordnet.")).toBeTruthy();
  });

  it("Löschen fragt nach und sendet DELETE", async () => {
    const confirmFn = vi.fn(() => true);
    vi.stubGlobal("confirm", confirmFn);
    const fetchFn = stubFetch((url, init) => (init?.method === "DELETE" ? json(null, 204) : json({ data: [] })));
    renderWithIntl(<ZonesPanel initialZones={[kuehl]} canManage />);
    const row = within(screen.getByRole("table")).getByText("Kühl").closest("tr")!;
    fireEvent.click(within(row).getByRole("button", { name: "Löschen" }));
    await waitFor(() => expect(screen.queryAllByText("Kühl")).toHaveLength(0));
    expect(confirmFn).toHaveBeenCalled();
    expect(fetchFn.mock.calls.some(([u, i]) => u === "/api/v1/zones/z2" && (i as RequestInit).method === "DELETE")).toBe(true);
  });

  it("Aktiv-Schalter sendet PATCH mit active", async () => {
    const fetchFn = stubFetch((url, init) =>
      init?.method === "PATCH" ? json({ data: { ...trocken, active: false } }) : json({ data: [{ ...trocken, active: false }] }),
    );
    renderWithIntl(<ZonesPanel initialZones={[trocken]} canManage />);
    const row = within(screen.getByRole("table")).getByText("Trocken").closest("tr")!;
    fireEvent.click(within(row).getByRole("switch"));
    await waitFor(() => expect(fetchFn.mock.calls.some(([, i]) => (i as RequestInit | undefined)?.method === "PATCH")).toBe(true));
    const patch = fetchFn.mock.calls.find(([, i]) => (i as RequestInit | undefined)?.method === "PATCH")!;
    expect(patch[0]).toBe("/api/v1/zones/z1");
    expect(JSON.parse((patch[1] as RequestInit).body as string)).toEqual({ active: false });
  });

  it("Umbenennen sendet PATCH mit name", async () => {
    const fetchFn = stubFetch((url, init) =>
      init?.method === "PATCH" ? json({ data: { ...trocken, name: "Trockenlager" } }) : json({ data: [{ ...trocken, name: "Trockenlager" }] }),
    );
    renderWithIntl(<ZonesPanel initialZones={[trocken]} canManage />);
    const row = within(screen.getByRole("table")).getByText("Trocken").closest("tr")!;
    fireEvent.click(within(row).getByRole("button", { name: "Umbenennen" }));
    const input = screen.getByLabelText(/Name/) as HTMLInputElement;
    expect(input.value).toBe("Trocken");
    fireEvent.change(input, { target: { value: "Trockenlager" } });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    await waitFor(() => expect(screen.getAllByText("Trockenlager").length).toBeGreaterThan(0));
    const patch = fetchFn.mock.calls.find(([, i]) => (i as RequestInit | undefined)?.method === "PATCH")!;
    expect(JSON.parse((patch[1] as RequestInit).body as string)).toMatchObject({ name: "Trockenlager" });
  });

  it("open=<id> öffnet die Zone zum Bearbeiten", () => {
    renderWithIntl(<ZonesPanel initialZones={[trocken, kuehl]} canManage openId="z2" />);
    expect(screen.getByText("Zone bearbeiten")).toBeTruthy();
    expect((screen.getByLabelText(/Name/) as HTMLInputElement).value).toBe("Kühl");
  });

  it("ohne Recht keine Bearbeiten-Aktionen", () => {
    renderWithIntl(<ZonesPanel initialZones={[trocken]} canManage={false} />);
    expect(screen.queryByRole("button", { name: "+ Zone" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Umbenennen" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Löschen" })).toBeNull();
    expect(screen.queryByRole("switch")).toBeNull();
    expect(screen.getAllByText("Trocken").length).toBeGreaterThan(0);
  });

  it("leerer Zustand: Hinweis und „Erste Zone anlegen“ nur für Manager", () => {
    const { unmount } = renderWithIntl(<ZonesPanel initialZones={[]} canManage />);
    expect(screen.getByText(/Noch keine Zonen/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Erste Zone anlegen" })).toBeTruthy();
    unmount();
    renderWithIntl(<ZonesPanel initialZones={[]} canManage={false} />);
    expect(screen.getByText(/Noch keine Zonen/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Erste Zone anlegen" })).toBeNull();
  });

  it("bietet einen Slot für Zeilen-/Kartenaktionen", () => {
    renderWithIntl(
      <ZonesPanel initialZones={[trocken]} canManage={false} rowActions={(z) => <span>Extra {z.name}</span>} />,
    );
    expect(screen.getAllByText("Extra Trocken")).toHaveLength(2);
  });
});

describe("StockView: Tab Zonen", () => {
  const props = { locations: [], articles: [], totalUnits: 0, zones: [trocken] };

  it("tab=zones öffnet Zonen; USER sieht keine Bearbeiten-Aktionen", () => {
    renderWithIntl(<StockView {...props} role="USER" initialTab="zones" />);
    expect(screen.getAllByText("Trocken").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Umbenennen" })).toBeNull();
    expect(screen.queryByRole("button", { name: "+ Zone" })).toBeNull();
  });

  it("MANAGER sieht die Aktionen", () => {
    renderWithIntl(<StockView {...props} role="MANAGER" initialTab="zones" />);
    expect(screen.getAllByRole("button", { name: "Umbenennen" }).length).toBeGreaterThan(0);
  });
});

describe("LocationForm: Zone", () => {
  it("zeigt aktive Zonen im Dropdown und sendet zoneId", () => {
    const onSubmit = vi.fn(async () => {});
    renderWithIntl(
      <LocationForm
        initial={{ ...defaultLocationValues, code: "A-1", name: "Regal A" }}
        isCreate
        busy={false}
        zones={[{ id: "z1", name: "Trocken" }, { id: "z2", name: "Kühl" }]}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );
    const select = screen.getByLabelText("Zone") as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.text)).toEqual(["— keine —", "Trocken", "Kühl"]);
    fireEvent.change(select, { target: { value: "z2" } });
    fireEvent.click(screen.getByRole("button", { name: "Anlegen" }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ zoneId: "z2" }));
  });

  it("„— keine —“ sendet zoneId null", () => {
    const onSubmit = vi.fn(async () => {});
    renderWithIntl(
      <LocationForm
        initial={{ ...defaultLocationValues, code: "A-1", name: "Regal A", zoneId: "z1" }}
        isCreate={false}
        busy={false}
        zones={[{ id: "z1", name: "Trocken" }]}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Zone"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ zoneId: null }));
  });
});
