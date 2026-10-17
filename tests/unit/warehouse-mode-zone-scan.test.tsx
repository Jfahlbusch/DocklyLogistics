// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "../helpers/intl";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}));

import { WarehouseModeView } from "@/app/(app)/warehouse-mode/warehouse-mode-view";

function json(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 });
}

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  push.mockClear();
  fetchMock = vi.fn(async () => json({ data: [] }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function submit(value: string) {
  const input = screen.getByPlaceholderText(/SKU \/ EAN/);
  fireEvent.change(input, { target: { value } });
  fireEvent.submit(input.closest("form")!);
}

const articleLookups = () => fetchMock.mock.calls.filter(([u]) => String(u).startsWith("/api/v1/articles?q="));

describe("Lagermodus: Zonen-QR", () => {
  it("startet bei einer gescannten Rundgang-URL des eigenen Hosts den Rundgang per router.push", async () => {
    renderWithIntl(<WarehouseModeView role="USER" tenant="t" />);
    submit(`${window.location.origin}/warehouse-mode?zone=z1`);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/warehouse-mode?zone=z1"));
    expect(articleLookups()).toHaveLength(0);
  });

  it("schickt keine Artikelsuche und kein push für eine Rundgang-URL eines fremden Hosts (wird als Code gesucht)", async () => {
    renderWithIntl(<WarehouseModeView role="USER" tenant="t" />);
    submit("https://evil.example/warehouse-mode?zone=z1");
    await waitFor(() => expect(articleLookups()).toHaveLength(1));
    expect(push).not.toHaveBeenCalled();
  });

  it("behandelt einen Artikelcode wie bisher", async () => {
    renderWithIntl(<WarehouseModeView role="USER" tenant="t" />);
    submit("VP-BTUE-1000");
    await waitFor(() => expect(articleLookups()).toHaveLength(1));
    expect(String(articleLookups()[0][0])).toContain("q=VP-BTUE-1000");
    expect(push).not.toHaveBeenCalled();
  });

  it("zeigt mit zoneId den Rundgang statt des Scanners", () => {
    renderWithIntl(<WarehouseModeView role="USER" tenant="t" zoneId="z-42" />);
    expect(screen.getByTestId("zone-walk")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/SKU \/ EAN/)).toBeNull();
    expect(screen.getByRole("link", { name: /Rundgang beenden/ })).toHaveAttribute("href", "/warehouse-mode");
  });

  it("zeigt ohne zoneId keinen Rundgang", () => {
    renderWithIntl(<WarehouseModeView role="USER" tenant="t" />);
    expect(screen.queryByTestId("zone-walk")).toBeNull();
  });
});
