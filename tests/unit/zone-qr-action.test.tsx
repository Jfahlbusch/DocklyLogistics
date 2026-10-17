// @vitest-environment jsdom
import { cleanup, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "../helpers/intl";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

import { StockView } from "@/app/(app)/stock/stock-view";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: true, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});
afterEach(cleanup);

describe("Zonenliste: QR drucken", () => {
  it("verlinkt je Zone auf die Druckansicht in neuem Tab, auch für VIEWER", async () => {
    renderWithIntl(<StockView locations={[]} articles={[]} totalUnits={0} role="VIEWER" initialTab="zones" zones={[{ id: "z1", name: "Trocken", sortOrder: 0, active: true, locationCount: 0, articleCount: 0 }]} />);
    const links = await screen.findAllByRole("link", { name: /QR-Code der Zone „Trocken“ drucken/ });
    expect(links.length).toBeGreaterThan(0);
    for (const a of links) {
      expect(a).toHaveAttribute("href", "/zones/z1/label");
      expect(a).toHaveAttribute("target", "_blank");
      expect(a).toHaveTextContent("QR drucken");
    }
  });
});
