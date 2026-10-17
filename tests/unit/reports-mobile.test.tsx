// @vitest-environment jsdom
import { cleanup, screen, within } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let desktop = true;
vi.mock("@/hooks/use-media-query", () => ({
  MD_QUERY: "(min-width: 768px)",
  useMediaQuery: () => desktop,
}));

const captured: { pie?: Record<string, unknown>; bar?: Record<string, unknown>; xAxis?: Record<string, unknown> } = {};
vi.mock("recharts", async (orig) => {
  const actual = await orig<typeof import("recharts")>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    PieChart: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    Pie: (p: Record<string, unknown>) => { captured.pie = p; return null; },
    BarChart: (p: Record<string, unknown> & { children?: React.ReactNode }) => { captured.bar = p; return null; },
  };
});

import { ReportsView } from "@/app/(app)/reports/reports-view";
import { renderWithIntl } from "../helpers/intl";

afterEach(cleanup);
beforeEach(() => {
  desktop = true;
  captured.pie = undefined;
  captured.bar = undefined;
});

const summary = {
  total: 5, totalVolume: 100,
  byStatus: {
    SENT: { count: 3, total: 60 },
    CANCELLED: { count: 2, total: 40 },
    PARTIALLY_RECEIVED: { count: 3, total: 10 },
    RECEIVED: { count: 7, total: 10 },
    CLOSED: { count: 2, total: 10 },
  },
};
const bySupplier = [
  { supplierId: "s1", supplierName: "Mühle Müller", channel: "EMAIL", orderCount: 3, volume: 60 },
  { supplierId: "s2", supplierName: "Dohle", channel: "EDI", orderCount: 2, volume: 40 },
];

function setup() {
  return renderWithIntl(<ReportsView summary={summary} bySupplier={bySupplier} yearStart="2026-01-01" />);
}

describe("ReportsView mobil", () => {
  it("Lieferanten als Karten mobil, Tabelle ab md (F-M47)", () => {
    const { container } = setup();
    expect(container.querySelector("table")!.parentElement).toHaveClass("hidden", "md:block");
    const cards = container.querySelector("[data-slot='supplier-cards']") as HTMLElement;
    expect(cards).toHaveClass("md:hidden");
    expect(within(cards).getByText("Mühle Müller")).toBeInTheDocument();
    expect(within(cards).getByText(/60,00/)).toBeInTheDocument();
  });
  it("Pie: mobil Legende statt Außen-Labels, kleinerer Radius (F-M48/50)", () => {
    desktop = false;
    setup();
    expect(captured.pie!.label).toBeFalsy();
    expect(captured.pie!.outerRadius as number).toBeLessThan(100);
    const legend = document.querySelector("[data-slot='status-legend']") as HTMLElement;
    expect(legend).toBeInTheDocument();
    expect(within(legend).getByText("Versendet")).toBeInTheDocument();
    expect(within(legend).getByText("Wareneingang")).toBeInTheDocument();
    expect(within(legend).getByText("12")).toBeInTheDocument();
    expect(within(legend).getByText(/davon Teilweise 3, Erhalten 7, Abgeschlossen 2/)).toBeInTheDocument();
  });
  it("Pie: 5 Gruppen-Farben nur aus Diagramm-Tokens, leere Gruppen ausgeblendet", () => {
    setup();
    const data = captured.pie!.data as { key: string; fill: string; count: number }[];
    expect(data.map((d) => d.key)).toEqual(["sent", "received", "cancelled"]);
    expect(data.map((d) => d.fill)).toEqual(["var(--chart-1)", "var(--chart-5)", "var(--chart-4)"]);
    expect(data.find((d) => d.key === "received")!.count).toBe(12);
  });
  it("Balken und Gitter nutzen Tokens", () => {
    setup();
    const kids = React.Children.toArray(captured.bar!.children as React.ReactNode) as React.ReactElement<Record<string, unknown>>[];
    const grid = kids.find((k) => (k.type as { displayName?: string }).displayName === "CartesianGrid" || k.props.strokeDasharray);
    expect(grid!.props.stroke).toBe("var(--border)");
    const bar = kids.find((k) => k.props.dataKey === "volume");
    expect(bar!.props.fill).toBe("var(--chart-1)");
  });
  it("Pie Desktop unverändert: Außen-Labels, Radius 100", () => {
    setup();
    expect(captured.pie!.label).toBeTruthy();
    expect(captured.pie!.outerRadius).toBe(100);
  });
  it("Bar: mobil horizontale Balken statt überlappender Labels (F-M49)", () => {
    desktop = false;
    setup();
    expect(captured.bar!.layout).toBe("vertical");
  });
  it("Bar Desktop unverändert (vertikale Balken)", () => {
    setup();
    expect(captured.bar!.layout).toBeUndefined();
  });
  it("CSV-Knopf bleibt erreichbar", () => {
    setup();
    expect(screen.getByRole("button", { name: /CSV-Export/ })).toBeInTheDocument();
  });
});
