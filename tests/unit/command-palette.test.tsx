// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/dashboard",
}));
vi.mock("@/lib/search/use-global-search", () => ({
  useGlobalSearch: () => ({ groups: [], isFetching: false, enabled: false }),
}));

import { CommandPalette } from "@/components/search/command-palette";
import { SEARCH_OPEN_EVENT } from "@/components/search/open-search";

function open() {
  render(<CommandPalette />);
  act(() => {
    window.dispatchEvent(new CustomEvent(SEARCH_OPEN_EVENT));
  });
  return screen.getByRole("dialog", { name: "Globale Suche" });
}

beforeEach(() => push.mockClear());
afterEach(cleanup);

describe("CommandPalette mobil (T17d)", () => {
  it("Suchfeld: 16 px mobil (kein iOS-Zoom) und Such-Attribute", () => {
    open();
    const input = screen.getByRole("searchbox", { name: "Suchbegriff" });
    expect(input.className).toMatch(/(^|\s)text-base(\s|$)/);
    expect(input.className).toMatch(/md:text-sm/);
    expect(input.getAttribute("type")).toBe("search");
    expect(input.getAttribute("enterkeyhint")).toBe("search");
    expect(input.getAttribute("autocomplete")).toBe("off");
    expect(input.getAttribute("autocapitalize")).toBe("none");
  });

  it("verwendet dvh statt vh und füllt mobil den Bildschirm", () => {
    const dialog = open();
    expect(dialog.innerHTML).not.toMatch(/\d+vh\]/);
    expect(dialog.innerHTML).toMatch(/dvh/);
    expect(dialog.firstElementChild!.className).toMatch(/max-md:h-dvh|h-dvh/);
  });

  it("Ergebniszeilen haben mindestens 44 px Höhe", () => {
    open();
    const rows = document.querySelectorAll<HTMLElement>("button[data-index]");
    expect(rows.length).toBeGreaterThan(0);
    rows.forEach((r) => expect(r.className).toMatch(/(^|\s)min-h-11(\s|$)/));
  });

  it("hat mobil einen Schließen-Knopf (kein Hintergrund zum Antippen)", () => {
    const dialog = open();
    const close = screen.getByRole("button", { name: "Schließen" });
    expect(close.className).toMatch(/size-11/);
    fireEvent.click(close);
    expect(dialog.isConnected).toBe(false);
  });
});

describe("CommandPalette Tastatur", () => {
  it("Pfeil runter + Enter öffnet den Eintrag, Escape schließt", () => {
    open();
    const input = screen.getByRole("searchbox", { name: "Suchbegriff" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(push).toHaveBeenCalledTimes(1);

    act(() => {
      window.dispatchEvent(new CustomEvent(SEARCH_OPEN_EVENT));
    });
    fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Globale Suche" })).toBeNull();
  });

  it("⌘K schaltet um", () => {
    render(<CommandPalette />);
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(screen.getByRole("dialog", { name: "Globale Suche" })).toBeTruthy();
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(screen.queryByRole("dialog", { name: "Globale Suche" })).toBeNull();
  });
});
