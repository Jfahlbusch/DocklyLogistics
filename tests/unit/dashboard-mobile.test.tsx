// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: async () => ({ role: "USER", tenant: "demo" }) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/services/dashboard", () => ({
  getDashboardData: async () => ({
    kpis: { belowMin: 1, openOrders: 2, receiptsToday: 0, webhookErrors24h: 0 },
    belowMinItems: [{ id: "a1", name: "Mehl", sku: "M-1", stock: 1, minStock: 5 }],
    recentActivity: [],
  }),
}));

import DashboardPage from "@/app/(app)/dashboard/page";

afterEach(cleanup);

describe("Dashboard mobil (F-M26)", () => {
  it("Link „Alle Artikel“ hat unter md ein 44-px-Ziel", async () => {
    render(await DashboardPage());
    const link = screen.getByRole("link", { name: "Alle Artikel" });
    expect(link.className).toMatch(/inline-flex/);
    expect(link.className).toMatch(/min-h-11/);
    expect(link.className).toMatch(/md:min-h-0/);
  });
});
