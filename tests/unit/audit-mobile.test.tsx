// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { AuditView } from "@/app/(app)/audit/audit-view";

afterEach(cleanup);

const HASH = "a".repeat(64);
const rows = [{
  id: "a1", entity: "Order", entityId: "e1", action: "UPDATE", actorEmail: "x@y.de", ip: "1.1.1.1",
  before: { s: 1 }, after: { s: 2 }, hash: HASH, prevHash: "b".repeat(64), createdAt: "2026-10-01T10:00:00Z",
}];

function setup() {
  return render(<AuditView rows={rows} total={1} entities={["Order"]} filters={{ entity: "", from: "", to: "" }} />);
}

describe("AuditView mobil/tablet", () => {
  it("Tabelle ab xl, Karten darunter (F-M21/B10)", () => {
    const { container } = setup();
    expect(container.querySelector("table")!.parentElement).toHaveClass("hidden", "xl:block");
    expect(container.querySelector("[data-slot='audit-cards']")).toHaveClass("xl:hidden");
  });
  it("Karte zeigt Hash sichtbar und klappt Detail mit break-all auf (F-M23–25)", async () => {
    setup();
    const card = document.querySelector("[data-slot='audit-cards']") as HTMLElement;
    expect(within(card).getByText(/^aaaaaaaaaaaa…$/)).toBeVisible();
    const toggle = within(card).getByRole("button", { name: /anzeigen/ });
    expect(toggle.className).toContain("min-h-11");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(toggle);
    expect(within(card).getByRole("button", { name: /ausblenden/ })).toHaveAttribute("aria-expanded", "true");
    const hashLine = within(card).getByText(new RegExp(HASH));
    expect(hashLine.className).toContain("break-all");
    expect(within(card).getByText(/"s": 2/)).toBeInTheDocument();
  });
  it("Entitäten-Select ist 16px/44px (F-M22)", () => {
    setup();
    const sel = screen.getByRole("combobox");
    expect(sel.className).toContain("min-h-11");
    expect(sel.className).toContain("md:pointer-fine:text-sm");
  });
});
