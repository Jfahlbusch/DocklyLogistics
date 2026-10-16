// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { logoutAction } = vi.hoisted(() => ({ logoutAction: vi.fn() }));
vi.mock("./profile-actions", () => ({ logoutAction }));

import { ProfileMenu } from "./profile-menu";
import type { ProfilUser } from "./profile-menu-content";

const user = {
  name: "Max Mustermann",
  email: "max@example.com",
  role: "MANAGER",
  tenant: "demo-bakery",
};

function setup(u: ProfilUser = user) {
  const ev = userEvent.setup();
  render(<ProfileMenu user={u} />);
  const trigger = screen.getByRole("button", { name: "Profil & Einstellungen" });
  return { ev, trigger };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  logoutAction.mockReset();
});

describe("ProfileMenu (Topbar-Auslöser)", () => {
  it("zeigt initials() im Avatar und ist geschlossen", () => {
    const { trigger } = setup();
    expect(trigger.textContent).toBe("MM");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("öffnet per Klick: Name, E-Mail, übersetzte Rolle, Mandant", async () => {
    const { ev, trigger } = setup();
    await ev.click(trigger);

    const menu = await screen.findByRole("menu");
    expect(menu.textContent).toContain("Max Mustermann");
    expect(menu.textContent).toContain("max@example.com");
    expect(screen.getByText("Manager")).toBeTruthy();
    expect(screen.queryByText("MANAGER")).toBeNull();
    const pill = screen.getByText("demo-bakery");
    expect(pill.className).toContain("font-mono");
  });

  it("lässt die E-Mail weg, wenn keine vorhanden ist", async () => {
    const { ev, trigger } = setup({ ...user, email: undefined });
    await ev.click(trigger);
    const menu = await screen.findByRole("menu");
    expect(menu.textContent).not.toContain("@");
  });

  it("Reihenfolge: Kopf → Farbschema → Abmelden", async () => {
    const { ev, trigger } = setup();
    await ev.click(trigger);
    await screen.findByRole("menu");

    const head = screen.getByText("Max Mustermann");
    const scheme = screen.getByText("Farbschema", { selector: "div" });
    const logout = screen.getByRole("menuitem", { name: "Abmelden" });
    const follows = (a: Node, b: Node) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(follows(head, scheme)).toBe(true);
    expect(follows(scheme, logout)).toBe(true);
    expect(screen.getAllByRole("separator").length).toBe(2);
  });

  it("Escape schließt das Menü und gibt den Fokus an den Auslöser zurück", async () => {
    const { ev, trigger } = setup();
    await ev.click(trigger);
    await screen.findByRole("menu");

    await ev.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it("Tastatur: Fokus auf Auslöser + Enter öffnet, Pfeil runter erreicht Abmelden", async () => {
    const { ev, trigger } = setup();
    await ev.tab();
    expect(document.activeElement).toBe(trigger);

    await ev.keyboard("{Enter}");
    await screen.findByRole("menu");

    await ev.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Abmelden" }));
  });

  it("Klick im Farbschema-Umschalter schließt das Menü nicht", async () => {
    const { ev, trigger } = setup();
    await ev.click(trigger);
    await screen.findByRole("menu");

    await ev.click(screen.getByRole("radio", { name: "Dunkel" }));
    expect(screen.queryByRole("menu")).not.toBeNull();
  });

  it("Pfeiltasten im Umschalter bleiben im Umschalter (keine Menüauswahl, kein Schließen)", async () => {
    const { ev, trigger } = setup();
    await ev.click(trigger);
    await screen.findByRole("menu");

    const radio = screen.getByRole("radio", { name: "Hell" });
    radio.focus();
    await ev.keyboard("{ArrowDown}{ArrowRight}");
    expect(screen.queryByRole("menu")).not.toBeNull();
    expect(document.activeElement).toBe(radio);
    expect(logoutAction).not.toHaveBeenCalled();
  });

  it("Abmelden leert alle Service-Worker-Caches und ruft danach logoutAction", async () => {
    const order: string[] = [];
    const del = vi.fn(async (k: string) => {
      order.push(`delete:${k}`);
      return true;
    });
    vi.stubGlobal("caches", { keys: vi.fn(async () => ["app-v1", "pages-v2"]), delete: del });
    logoutAction.mockImplementation(async () => {
      order.push("logout");
    });

    const { ev, trigger } = setup();
    await ev.click(trigger);
    await ev.click(await screen.findByRole("menuitem", { name: "Abmelden" }));

    await waitFor(() => expect(logoutAction).toHaveBeenCalledTimes(1));
    expect(del).toHaveBeenCalledTimes(2);
    expect(del).toHaveBeenCalledWith("app-v1");
    expect(del).toHaveBeenCalledWith("pages-v2");
    expect(order.at(-1)).toBe("logout");
  });

  it("Abmelden funktioniert auch ohne Cache-API und bei Cache-Fehlern", async () => {
    vi.stubGlobal("caches", {
      keys: vi.fn(async () => {
        throw new Error("boom");
      }),
      delete: vi.fn(),
    });
    const { ev, trigger } = setup();
    await ev.click(trigger);
    await ev.click(await screen.findByRole("menuitem", { name: "Abmelden" }));
    await waitFor(() => expect(logoutAction).toHaveBeenCalledTimes(1));
  });
});

beforeEach(() => {
  logoutAction.mockReset();
});
