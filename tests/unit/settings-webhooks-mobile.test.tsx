// @vitest-environment jsdom
import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "../helpers/intl";
import { hasClass, json, stubFetch, stubViewport } from "./settings-mobile-helpers";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

import { WebhooksTab, type WebhookRow } from "@/app/(app)/settings/webhooks-tab";

const hook: WebhookRow = {
  id: "w1", url: "https://example.com/hook", events: ["order.sent"], active: true, description: null,
  lastDeliveredAt: null, createdAt: "2026-01-01T00:00:00Z",
};

beforeEach(() => {
  stubViewport(false);
  stubFetch((url) => {
    if (url.endsWith("/deliveries")) {
      return json({
        data: [{
          id: "d1", event: "order.sent", status: "FAILED", attempts: 3, lastStatusCode: 500, lastError: "x",
          nextAttemptAt: "2026-01-01T00:00:00Z", succeededAt: null, givenUpAt: null, createdAt: "2026-01-01T00:00:00Z",
        }],
      });
    }
    return json({});
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Webhooks mobil", () => {
  it("Zeilen-Knöpfe sind mobil 44 px (F-M74)", () => {
    renderWithIntl(<WebhooksTab webhooks={[hook]} canManage />);
    for (const name of ["Deliveries", "Deaktivieren", "Secret rotieren", "Löschen", "+ Neuer Webhook"]) {
      expect(screen.getByRole("button", { name }).className).toMatch(/max-md:min-h-11/);
    }
  });

  it("Neuer Webhook ist ein echter Dialog/Bottom-Sheet, Escape schließt (F-M75)", async () => {
    const user = userEvent.setup();
    renderWithIntl(<WebhooksTab webhooks={[hook]} canManage />);
    await user.click(screen.getByRole("button", { name: "+ Neuer Webhook" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.querySelector('[data-slot="responsive-dialog-handle"]')).toBeTruthy();
    expect(dialog.className).not.toMatch(/fixed inset-0/);
    const footer = dialog.querySelector('[data-slot="responsive-dialog-footer"]') as HTMLElement;
    expect(within(footer).getByRole("button", { name: "Anlegen" })).toBeTruthy();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Eingaben: URL, Event-Chips, Checkbox (F-M76/77)", async () => {
    const user = userEvent.setup();
    renderWithIntl(<WebhooksTab webhooks={[]} canManage />);
    await user.click(screen.getByRole("button", { name: "+ Neuer Webhook" }));
    const dialog = await screen.findByRole("dialog");
    const url = within(dialog).getByPlaceholderText("https://example.com/hooks/dockly");
    expect(url.getAttribute("type")).toBe("url");
    expect(url.getAttribute("inputmode")).toBe("url");
    expect(url.getAttribute("autocapitalize")).toBe("none");
    expect(url.getAttribute("spellcheck")).toBe("false");
    const chip = within(dialog).getByText("order.cancelled").closest("label")!;
    expect(chip.className).toMatch(/min-h-11/);
    expect(chip.className).toMatch(/rounded-full/);
    const cb = within(dialog).getByRole("checkbox", { name: /Webhook aktivieren/ });
    expect(hasClass(cb, "size-5")).toBe(true);
    expect(cb.closest("label")!.className).toMatch(/min-h-11/);
  });

  it("Auslieferungen: Dialog ohne vh-Limit, Erneut-senden 44 px (F-M78/79)", async () => {
    const user = userEvent.setup();
    renderWithIntl(<WebhooksTab webhooks={[hook]} canManage />);
    await user.click(screen.getByRole("button", { name: "Deliveries" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.querySelector('[data-slot="responsive-dialog-handle"]')).toBeTruthy();
    expect(dialog.innerHTML).not.toMatch(/max-h-\[8\dvh\]/);
    expect(dialog.innerHTML).not.toMatch(/\[8\dvh\]/);
    const retries = within(dialog).getAllByRole("button", { name: "Erneut senden" });
    expect(retries.length).toBe(2); // Tabelle + Karte
    for (const b of retries) expect(b.className).toMatch(/max-md:min-h-11/);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
