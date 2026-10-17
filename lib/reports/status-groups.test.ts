import { describe, expect, it } from "vitest";
import { groupStatuses, STATUS_GROUPS } from "@/lib/reports/status-groups";

const ALL = ["DRAFT", "REVIEW", "APPROVED", "SENT", "CONFIRMED", "PARTIALLY_RECEIVED", "RECEIVED", "CLOSED", "CANCELLED"];

describe("groupStatuses", () => {
  it("jeder der 9 Status gehört genau einer von 5 Gruppen an", () => {
    expect(STATUS_GROUPS).toHaveLength(5);
    const flat = STATUS_GROUPS.flatMap((g) => g.statuses);
    expect([...flat].sort()).toEqual([...ALL].sort());
  });

  it("ordnet Farben aus den Diagramm-Tokens zu", () => {
    const colors = Object.fromEntries(STATUS_GROUPS.map((g) => [g.key, g.color]));
    expect(colors).toEqual({
      draft: "var(--chart-3)",
      sent: "var(--chart-1)",
      confirmed: "var(--chart-2)",
      received: "var(--chart-5)",
      cancelled: "var(--chart-4)",
    });
  });

  it("fasst zusammen und behält die Detailwerte je Status", () => {
    const r = groupStatuses({
      DRAFT: { count: 1, total: 10 },
      REVIEW: { count: 2, total: 20 },
      PARTIALLY_RECEIVED: { count: 3, total: 30 },
      RECEIVED: { count: 7, total: 70 },
      CLOSED: { count: 2, total: 5 },
    });
    expect(r.map((g) => g.key)).toEqual(["draft", "received"]);
    const draft = r[0];
    expect(draft.count).toBe(3);
    expect(draft.details).toEqual([
      { status: "DRAFT", count: 1 },
      { status: "REVIEW", count: 2 },
    ]);
    const rec = r[1];
    expect(rec.count).toBe(12);
    expect(rec.details).toEqual([
      { status: "PARTIALLY_RECEIVED", count: 3 },
      { status: "RECEIVED", count: 7 },
      { status: "CLOSED", count: 2 },
    ]);
  });

  it("blendet leere Gruppen und Status mit Anzahl 0 aus", () => {
    expect(groupStatuses({})).toEqual([]);
    const r = groupStatuses({ SENT: { count: 0, total: 0 }, CANCELLED: { count: 2, total: 1 } });
    expect(r.map((g) => g.key)).toEqual(["cancelled"]);
  });

  it("ignoriert unbekannte Status", () => {
    expect(groupStatuses({ WHATEVER: { count: 4, total: 1 } })).toEqual([]);
  });
});
