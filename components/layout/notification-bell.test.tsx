// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { NotificationBell } from "./notification-bell";

type Item = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

function item(over: Partial<Item> & { id: string }): Item {
  return {
    type: "import",
    title: `Titel ${over.id}`,
    body: null,
    link: null,
    readAt: null,
    createdAt: "2026-10-16T08:30:00.000Z",
    ...over,
  };
}

/** Fake-API: GET liefert den Zustand, POST /read quittiert und passt den Zustand an. */
function mockApi(initial: Item[]) {
  let items = initial;
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "POST") {
      const { id } = init.body ? (JSON.parse(String(init.body)) as { id?: string }) : { id: undefined };
      items = items.map((n) => (!id || n.id === id ? { ...n, readAt: n.readAt ?? "2026-10-16T09:00:00.000Z" } : n));
      return { ok: true, status: 200, json: async () => ({ data: { ok: true } }) };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ data: { items, unread: items.filter((n) => !n.readAt).length } }),
    };
  });
  vi.stubGlobal("fetch", fetchMock);
  const gets = () => fetchMock.mock.calls.filter(([, init]) => !init?.method).length;
  const posts = () => fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");
  return { fetchMock, gets, posts, setItems: (next: Item[]) => (items = next) };
}

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
}

// hidden: true — bei offenem Menü blendet Radix den Rest der Seite aus (aria-hidden).
const trigger = () => screen.getByRole("button", { name: /^Benachrichtigungen/, hidden: true });

beforeEach(() => {
  push.mockReset();
  setVisibility("visible");
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("NotificationBell: Badge", () => {
  it("zeigt die Ungelesen-Zahl im Badge und im aria-label des Auslösers", async () => {
    mockApi([item({ id: "1" }), item({ id: "2" }), item({ id: "3", readAt: "2026-10-15T10:00:00.000Z" })]);
    render(<NotificationBell />);
    await waitFor(() => expect(trigger().getAttribute("aria-label")).toBe("Benachrichtigungen, 2 ungelesen"));
    expect(trigger().textContent).toContain("2");
  });

  it("zeigt kein Badge ohne Ungelesene und höchstens „9+“", async () => {
    const api = mockApi([item({ id: "1", readAt: "2026-10-15T10:00:00.000Z" })]);
    render(<NotificationBell />);
    await waitFor(() => expect(api.gets()).toBe(1));
    expect(trigger().getAttribute("aria-label")).toBe("Benachrichtigungen");
    expect(trigger().textContent).toBe("");

    api.setItems(Array.from({ length: 12 }, (_, i) => item({ id: `n${i}` })));
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await waitFor(() => expect(trigger().textContent).toBe("9+"));
    expect(trigger().getAttribute("aria-label")).toBe("Benachrichtigungen, 12 ungelesen");
  });

  it("hat ein Touch-Ziel von mindestens 44 px (h-11 w-11) auf Mobilgeräten", async () => {
    mockApi([]);
    render(<NotificationBell />);
    expect(trigger().className).toMatch(/\bh-11\b/);
    expect(trigger().className).toMatch(/\bw-11\b/);
  });
});

describe("NotificationBell: Panel", () => {
  it("ist ein Menü: aria-haspopup, Einträge als menuitem, Kopf mit Titel", async () => {
    mockApi([item({ id: "1", title: "Import fehlgeschlagen", body: "3 Zeilen fehlgeschlagen." })]);
    const ev = userEvent.setup();
    render(<NotificationBell />);
    expect(trigger().getAttribute("aria-haspopup")).toBe("menu");
    await waitFor(() => expect(trigger().getAttribute("aria-label")).toContain("1 ungelesen"));

    await ev.click(trigger());
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByText("Benachrichtigungen")).toBeTruthy();
    const entry = within(menu).getByRole("menuitem", { name: /Import fehlgeschlagen/ });
    expect(entry.textContent).toContain("3 Zeilen fehlgeschlagen.");
    // Text höchstens zweizeilig
    expect(within(entry).getByText("3 Zeilen fehlgeschlagen.").className).toContain("line-clamp-2");
    // Datum in de-DE
    expect(entry.textContent).toMatch(/16\.10\.26/);
  });

  it("markiert Ungelesene getönt mit Punkt, Gelesene nicht", async () => {
    mockApi([item({ id: "1", title: "neu" }), item({ id: "2", title: "alt", readAt: "2026-10-15T10:00:00.000Z" })]);
    const ev = userEvent.setup();
    render(<NotificationBell />);
    await ev.click(trigger());
    const unread = await screen.findByRole("menuitem", { name: /neu/ });
    const readItem = screen.getByRole("menuitem", { name: /alt/ });
    expect(unread.className).toContain("bg-accent/5");
    expect(unread.querySelector("[data-unread-dot]")).not.toBeNull();
    expect(readItem.className).not.toContain("bg-accent/5");
    expect(readItem.querySelector("[data-unread-dot]")).toBeNull();
  });

  it("zeigt den leeren Zustand „Keine Benachrichtigungen“ ohne „Alle als gelesen“", async () => {
    const api = mockApi([]);
    const ev = userEvent.setup();
    render(<NotificationBell />);
    await waitFor(() => expect(api.gets()).toBe(1));
    await ev.click(trigger());
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByText("Keine Benachrichtigungen")).toBeTruthy();
    expect(within(menu).queryByRole("menuitem")).toBeNull();
    expect(within(menu).queryByText("Alle als gelesen")).toBeNull();
  });

  it("lädt beim Mount und bei jedem Öffnen neu", async () => {
    const api = mockApi([item({ id: "1" })]);
    const ev = userEvent.setup();
    render(<NotificationBell />);
    await waitFor(() => expect(api.gets()).toBe(1));
    await ev.click(trigger());
    await waitFor(() => expect(api.gets()).toBe(2));
    await ev.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    await ev.click(trigger());
    await waitFor(() => expect(api.gets()).toBe(3));
  });

  it("Tastatur: Enter öffnet, Pfeil runter fokussiert den ersten Eintrag, Escape schließt und gibt den Fokus zurück", async () => {
    mockApi([item({ id: "1", title: "Eins" }), item({ id: "2", title: "Zwei" })]);
    const ev = userEvent.setup();
    render(<NotificationBell />);
    await waitFor(() => expect(trigger().getAttribute("aria-label")).toContain("2 ungelesen"));
    trigger().focus();
    await ev.keyboard("{Enter}");
    await screen.findByRole("menu");
    await ev.keyboard("{ArrowDown}");
    const focused = document.activeElement as HTMLElement;
    expect(focused.getAttribute("role")).toBe("menuitem");
    await ev.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(document.activeElement).toBe(trigger());
  });
});

describe("NotificationBell: Interaktion", () => {
  it("Klick auf einen ungelesenen Eintrag: erst quittieren, dann schließen, dann zum Link navigieren", async () => {
    const api = mockApi([item({ id: "abc", title: "Import fehlgeschlagen", link: "/import?batch=7" })]);
    const ev = userEvent.setup();
    render(<NotificationBell />);
    await ev.click(trigger());
    await ev.click(await screen.findByRole("menuitem", { name: /Import fehlgeschlagen/ }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/import?batch=7"));
    const [url, init] = api.posts()[0] as [string, RequestInit];
    expect(url).toBe("/api/v1/me/notifications/read");
    expect(JSON.parse(String(init.body))).toEqual({ id: "abc" });
    // Reihenfolge: zuerst die Quittung, dann die Navigation
    const postOrder = api.fetchMock.mock.invocationCallOrder[api.fetchMock.mock.calls.findIndex(([, i]) => i?.method === "POST")];
    expect(postOrder).toBeLessThan(push.mock.invocationCallOrder[0]);
    expect(screen.queryByRole("menu")).toBeNull();
    // Badge ist nach der Quittung weg
    await waitFor(() => expect(trigger().getAttribute("aria-label")).toBe("Benachrichtigungen"));
  });

  it("Klick auf einen bereits gelesenen Eintrag sendet keine Quittung", async () => {
    const api = mockApi([item({ id: "1", title: "alt", link: "/dashboard", readAt: "2026-10-15T10:00:00.000Z" })]);
    const ev = userEvent.setup();
    render(<NotificationBell />);
    await ev.click(trigger());
    await ev.click(await screen.findByRole("menuitem", { name: /alt/ }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
    expect(api.posts()).toHaveLength(0);
  });

  it("ohne Link: quittiert, schließt und lädt neu, ohne zu navigieren", async () => {
    const api = mockApi([item({ id: "1", title: "ohne Link" })]);
    const ev = userEvent.setup();
    render(<NotificationBell />);
    await waitFor(() => expect(api.gets()).toBe(1));
    await ev.click(trigger());
    await waitFor(() => expect(api.gets()).toBe(2));
    await ev.click(await screen.findByRole("menuitem", { name: /ohne Link/ }));
    await waitFor(() => expect(api.posts()).toHaveLength(1));
    await waitFor(() => expect(api.gets()).toBe(3));
    expect(push).not.toHaveBeenCalled();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("ignoriert Links, die nicht app-intern sind (kein Open Redirect)", async () => {
    mockApi([item({ id: "1", title: "extern", link: "https://evil.example/x" }), item({ id: "2", title: "proto", link: "//evil.example" })]);
    const ev = userEvent.setup();
    render(<NotificationBell />);
    await ev.click(trigger());
    await ev.click(await screen.findByRole("menuitem", { name: /extern/ }));
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    await ev.click(trigger());
    await ev.click(await screen.findByRole("menuitem", { name: /proto/ }));
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(push).not.toHaveBeenCalled();
  });

  it("„Alle als gelesen“ quittiert alle, lädt neu und lässt das Panel offen", async () => {
    const api = mockApi([item({ id: "1" }), item({ id: "2" })]);
    const ev = userEvent.setup();
    render(<NotificationBell />);
    await ev.click(trigger());
    await ev.click(await screen.findByRole("menuitem", { name: "Alle als gelesen" }));

    await waitFor(() => expect(api.posts()).toHaveLength(1));
    const [, init] = api.posts()[0] as [string, RequestInit];
    expect(init.body === undefined || init.body === null || init.body === "{}").toBe(true);
    await waitFor(() => expect(trigger().getAttribute("aria-label")).toBe("Benachrichtigungen"));
    expect(screen.getByRole("menu")).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Alle als gelesen" })).toBeNull();
  });
});

describe("NotificationBell: Aktualisierung", () => {
  it("fragt alle 60 Sekunden neu ab, solange der Tab sichtbar ist", async () => {
    vi.useFakeTimers();
    const api = mockApi([item({ id: "1" })]);
    render(<NotificationBell />);
    await vi.advanceTimersByTimeAsync(0);
    expect(api.gets()).toBe(1);

    await vi.advanceTimersByTimeAsync(59_000);
    expect(api.gets()).toBe(1);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(api.gets()).toBe(2);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(api.gets()).toBe(3);
  });

  it("pausiert im verdeckten Tab und lädt beim Sichtbarwerden sofort neu", async () => {
    vi.useFakeTimers();
    const api = mockApi([item({ id: "1" })]);
    render(<NotificationBell />);
    await vi.advanceTimersByTimeAsync(0);
    expect(api.gets()).toBe(1);

    setVisibility("hidden");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await vi.advanceTimersByTimeAsync(180_000);
    expect(api.gets()).toBe(1); // keine Abfragen im Hintergrund

    setVisibility("visible");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(api.gets()).toBe(2);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(api.gets()).toBe(3); // Takt läuft wieder
  });

  it("lädt bei visibilitychange (sichtbar) und beim Fokus des Fensters neu", async () => {
    const api = mockApi([item({ id: "1" })]);
    render(<NotificationBell />);
    await waitFor(() => expect(api.gets()).toBe(1));

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await waitFor(() => expect(api.gets()).toBe(2));

    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    await waitFor(() => expect(api.gets()).toBe(3));
  });

  it("räumt Timer und Listener beim Unmount auf", async () => {
    vi.useFakeTimers();
    const api = mockApi([item({ id: "1" })]);
    const { unmount } = render(<NotificationBell />);
    await vi.advanceTimersByTimeAsync(0);
    unmount();
    await vi.advanceTimersByTimeAsync(120_000);
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("focus"));
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(api.gets()).toBe(1);
  });

  it("ein fehlgeschlagener Abruf lässt den letzten Stand stehen", async () => {
    const api = mockApi([item({ id: "1" })]);
    render(<NotificationBell />);
    await waitFor(() => expect(trigger().getAttribute("aria-label")).toContain("1 ungelesen"));
    api.fetchMock.mockImplementation(async () => {
      throw new Error("offline");
    });
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    await new Promise((r) => setTimeout(r, 10));
    expect(trigger().getAttribute("aria-label")).toContain("1 ungelesen");
  });
});
