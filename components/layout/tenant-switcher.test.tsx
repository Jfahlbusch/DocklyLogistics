// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { TenantSwitcher } from "./tenant-switcher";

const TENANTS = [
  { id: "daube", name: "Daube Backwaren" },
  { id: "demo", name: "Demo Bakery" },
  { id: "hylab", name: "Plattform Hylab" },
  { id: "t-42", name: "Müller Mühle" },
];

const assign = vi.fn();
const fetchMock = vi.fn();

beforeEach(() => {
  assign.mockReset();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: {} }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("location", { ...window.location, assign });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function setup(props: Partial<React.ComponentProps<typeof TenantSwitcher>> = {}) {
  const ev = userEvent.setup();
  render(<TenantSwitcher currentTenant="hylab" homeTenant="hylab" tenants={TENANTS} {...props} />);
  return ev;
}
const trigger = () => screen.getByRole("button", { name: /Mandant wechseln/ });
const item = (name: RegExp) => within(screen.getByRole("list")).getByRole("button", { name });
const queryItem = (name: RegExp) => within(screen.getByRole("list")).queryByRole("button", { name });
const searchInput = () => screen.getByRole("textbox", { name: "Mandant suchen" });

describe("TenantSwitcher: Auslöser", () => {
  it("zeigt Initialen-Kachel, aktuellen Mandanten-Namen (nicht die ID) und ist standardmäßig nicht warnfarben", () => {
    setup();
    expect(within(trigger()).getByText("PH")).toBeTruthy();
    expect(within(trigger()).getByText("Plattform Hylab")).toBeTruthy();
    expect(trigger().getAttribute("data-foreign")).toBeNull();
  });

  it("eingeklappt: nur die Initialen-Kachel, Name nur im title", () => {
    setup({ collapsed: true });
    expect(within(trigger()).getByText("PH")).toBeTruthy();
    expect(screen.queryByText("Plattform Hylab")).toBeNull();
    expect(trigger().getAttribute("title")).toBe("Plattform Hylab");
  });

  it("Fremdansicht: Auslöser ist als Warnung markiert (auch ohne geöffnetes Popover)", () => {
    setup({ currentTenant: "daube" });
    expect(trigger().getAttribute("data-foreign")).toBe("true");
    expect(trigger().className).toContain("var(--color-warning)");
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});

describe("TenantSwitcher: Popover", () => {
  it("öffnet mit autofokussiertem Suchfeld und listet alle Mandanten, aktueller mit Häkchen, eigener mit Label", async () => {
    const ev = setup();
    await ev.click(trigger());
    expect(document.activeElement).toBe(searchInput());
    for (const t of TENANTS) expect(item(new RegExp(t.name))).toBeTruthy();
    const aktuell = item(/Plattform Hylab/);
    expect(aktuell.getAttribute("aria-current")).toBe("true");
    expect(within(aktuell).getByText("eigener")).toBeTruthy();
    expect(screen.getAllByText("eigener")).toHaveLength(1);
    expect(item(/Daube Backwaren/).getAttribute("aria-current")).toBeNull();
  });

  it("filtert nach Name", async () => {
    const ev = setup();
    await ev.click(trigger());
    await ev.type(searchInput(), "dau");
    expect(item(/Daube Backwaren/)).toBeTruthy();
    expect(queryItem(/Demo Bakery/)).toBeNull();
  });

  it("filtert auch nach ID (Slug), unabhängig von Groß-/Kleinschreibung", async () => {
    const ev = setup();
    await ev.click(trigger());
    await ev.type(searchInput(), "T-42");
    expect(item(/Müller Mühle/)).toBeTruthy();
    expect(queryItem(/Daube Backwaren/)).toBeNull();
  });

  it("zeigt „Kein Treffer“, wenn nichts passt", async () => {
    const ev = setup();
    await ev.click(trigger());
    await ev.type(searchInput(), "xyz");
    expect(screen.getByText("Kein Treffer")).toBeTruthy();
  });

  it("Enter wählt den ersten Treffer", async () => {
    const ev = setup();
    await ev.click(trigger());
    await ev.type(searchInput(), "dem{Enter}");
    await waitFor(() => expect(assign).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/me/tenant-view",
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ tenantId: "demo" }) }),
    );
  });

  it("öffnet bei ausgeklappter Sidebar unter dem Auslöser, eingeklappt seitlich", async () => {
    const ev = setup();
    await ev.click(trigger());
    expect(document.querySelector('[data-slot="popover-content"]')?.getAttribute("data-side")).toBe("bottom");
    cleanup();
    const ev2 = setup({ collapsed: true });
    await ev2.click(trigger());
    expect(document.querySelector('[data-slot="popover-content"]')?.getAttribute("data-side")).toBe("right");
  });
});

describe("TenantSwitcher: Wechsel", () => {
  it("Klick auf einen Mandanten: PUT mit { tenantId }, danach genau EINE volle Navigation", async () => {
    const ev = setup();
    await ev.click(trigger());
    await ev.click(item(/Daube Backwaren/));
    await waitFor(() => expect(assign).toHaveBeenCalledTimes(1));
    expect(assign).toHaveBeenCalledWith("/dashboard");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/me/tenant-view", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenantId: "daube" }),
    });
  });

  it("zeigt nach dem Klick den Zustand „leaving“ (Auslöser gesperrt, Statusanzeige)", async () => {
    const ev = setup();
    await ev.click(trigger());
    await ev.click(item(/Daube Backwaren/));
    await waitFor(() => expect(assign).toHaveBeenCalled());
    expect(trigger().hasAttribute("disabled")).toBe(true);
    expect(trigger().getAttribute("aria-busy")).toBe("true");
  });

  it("Klick auf den bereits aktuellen Mandanten: kein Request, keine Navigation", async () => {
    const ev = setup();
    await ev.click(trigger());
    await ev.click(item(/Plattform Hylab/));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });

  it("Serverfehler: keine Navigation, Fehlermeldung, Bedienung weiter möglich", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 500 }));
    const ev = setup();
    await ev.click(trigger());
    await ev.click(item(/Daube Backwaren/));
    expect((await screen.findByRole("alert")).textContent).toContain("Wechsel fehlgeschlagen");
    expect(assign).not.toHaveBeenCalled();
    expect(trigger().hasAttribute("disabled")).toBe(false);
  });

  it("Netzwerkfehler: keine Navigation, Fehlermeldung", async () => {
    fetchMock.mockRejectedValue(new TypeError("offline"));
    const ev = setup();
    await ev.click(trigger());
    await ev.click(item(/Daube Backwaren/));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(assign).not.toHaveBeenCalled();
  });
});

describe("TenantSwitcher: Fremdansicht", () => {
  it("zeigt Warnhinweis und „Zurück zum eigenen Mandanten“, der per DELETE zurücksetzt und einmal navigiert", async () => {
    const ev = setup({ currentTenant: "daube" });
    await ev.click(trigger());
    expect(screen.getByRole("status").textContent).toContain("Daube Backwaren");
    await ev.click(screen.getByRole("button", { name: "Zurück zum eigenen Mandanten" }));
    await waitFor(() => expect(assign).toHaveBeenCalledTimes(1));
    expect(assign).toHaveBeenCalledWith("/dashboard");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/me/tenant-view", { method: "DELETE" });
  });

  it("Klick auf den eigenen Mandanten in der Liste beendet die Ansicht (DELETE statt PUT)", async () => {
    const ev = setup({ currentTenant: "daube" });
    await ev.click(trigger());
    await ev.click(item(/Plattform Hylab/));
    await waitFor(() => expect(assign).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/me/tenant-view", { method: "DELETE" });
  });

  it("Fehler beim Zurücksetzen: keine Navigation, Fehlermeldung", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));
    const ev = setup({ currentTenant: "daube" });
    await ev.click(trigger());
    await ev.click(screen.getByRole("button", { name: "Zurück zum eigenen Mandanten" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(assign).not.toHaveBeenCalled();
  });

  it("ohne Fremdansicht gibt es weder Warnhinweis noch Zurück-Knopf", async () => {
    const ev = setup();
    await ev.click(trigger());
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("button", { name: "Zurück zum eigenen Mandanten" })).toBeNull();
  });
});
