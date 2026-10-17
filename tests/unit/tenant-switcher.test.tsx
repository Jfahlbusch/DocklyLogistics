// @vitest-environment jsdom
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithIntl } from "../helpers/intl";
import { TenantSwitcher } from "@/components/layout/tenant-switcher";
import type { TenantNavigation } from "@/lib/schemas/tenant-view";

// Wechsel über die gehärtete Route /api/v1/me/tenant-view, danach genau EINE volle Navigation (kein Client-Cache des alten Mandanten).

const assign = vi.fn();
const fetchMock = vi.fn();

const ADMIN: TenantNavigation = {
  currentTenant: "home",
  homeTenant: "home",
  currentName: "Eigene Bäckerei",
  tenants: [
    { id: "home", name: "Eigene Bäckerei" },
    { id: "daube", name: "Bäckerei Daube" },
  ],
};

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(window, "location", { configurable: true, value: { ...window.location, assign } });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  assign.mockReset();
});

describe("TenantSwitcher", () => {
  it("wechselt per PUT und lädt danach /dashboard vollständig neu", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    renderWithIntl(<TenantSwitcher navigation={ADMIN} />);
    fireEvent.click(screen.getByRole("button", { name: "Unternehmen wechseln" }));
    fireEvent.click(screen.getByRole("button", { name: /Bäckerei Daube/ }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/dashboard"));
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/me/tenant-view", expect.objectContaining({ method: "PUT", body: JSON.stringify({ tenantId: "daube" }) }));
  });

  it("bietet bei Fremdansicht die Rückkehr (DELETE) an und tönt die Karte Gold", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    renderWithIntl(<TenantSwitcher navigation={{ ...ADMIN, currentTenant: "daube", currentName: "Bäckerei Daube" }} />);
    const trigger = screen.getByRole("button", { name: "Unternehmen wechseln" });
    expect(trigger.className).toContain("bg-gold-400/10");
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Zu Ihrem Unternehmen zurück" }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/dashboard"));
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/me/tenant-view", expect.objectContaining({ method: "DELETE" }));
  });

  it("zeigt bei abgelehntem Wechsel einen Hinweis und navigiert nicht", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 403 }));
    renderWithIntl(<TenantSwitcher navigation={ADMIN} />);
    fireEvent.click(screen.getByRole("button", { name: "Unternehmen wechseln" }));
    fireEvent.click(screen.getByRole("button", { name: /Bäckerei Daube/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Das Unternehmen konnte nicht gewechselt werden.");
    expect(assign).not.toHaveBeenCalled();
  });

  it("filtert die Liste über die Suche", () => {
    renderWithIntl(<TenantSwitcher navigation={ADMIN} />);
    fireEvent.click(screen.getByRole("button", { name: "Unternehmen wechseln" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Unternehmen suchen" }), { target: { value: "daube" } });
    expect(screen.getByRole("button", { name: /Bäckerei Daube/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Eigene Bäckerei/ })).not.toBeInTheDocument();
  });

  it("ist ohne Mandantenliste (Nicht-Admin) eine statische Anzeige ohne Wechsel-Auslöser", () => {
    renderWithIntl(<TenantSwitcher navigation={{ currentTenant: "home", homeTenant: "home", currentName: "Eigene Bäckerei" }} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("Eigene Bäckerei")).toBeInTheDocument();
  });
  it("hat Pager-Knöpfe mit 44-px-Touch-Ziel unterhalb der Desktop-Navigation (T17d)", () => {
    const many: TenantNavigation = {
      ...ADMIN,
      tenants: Array.from({ length: 7 }, (_, i) => ({ id: `t${i}`, name: `Bäckerei ${i}` })),
    };
    renderWithIntl(<TenantSwitcher navigation={many} />);
    fireEvent.click(screen.getByRole("button", { name: "Unternehmen wechseln" }));
    for (const name of ["Vorherige Unternehmen", "Weitere Unternehmen"]) {
      const btn = screen.getByRole("button", { name });
      expect(btn.className).toMatch(/(^|\s)size-11(\s|$)/);
    }
  });
});
