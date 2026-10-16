// @vitest-environment jsdom
import { runInNewContext } from "node:vm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  readLegacySidebarPreference,
  readSidebarPreference,
  SIDEBAR_COOKIE,
  SIDEBAR_PREPAINT_SCRIPT,
  SIDEBAR_STORAGE_KEY,
  writeSidebarPreference,
} from "@/lib/sidebar-preference";

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.cookie = `${SIDEBAR_COOKIE}=; Path=/; Max-Age=0`;
});

describe("Sidebar-Präferenz", () => {
  it.each([
    ["1", true, true],
    ["0", false, true],
    [undefined, false, false],
    ["true", false, false],
  ] as const)("Serverwert %s", (value, collapsed, hasPreference) => {
    expect(readSidebarPreference(() => value)).toEqual({ collapsed, hasPreference });
  });

  it.each([
    ["ui_sidebar=1", "0", "76px"],
    ["other=1; ui_sidebar=0", "1", "268px"],
    ["", "1", "76px"],
    ["ui_sidebar=invalid", "1", "76px"],
    ["ui_sidebar=%E0%A4%A", "1", "76px"],
    ["ui_sidebar=anything", "anything", "268px"],
  ])("Breite vor Paint mit Cookie %s und Altwert %s", (cookie, legacy, expected) => {
    const setProperty = vi.fn();
    runInNewContext(SIDEBAR_PREPAINT_SCRIPT, {
      document: { cookie, documentElement: { style: { setProperty } } },
      localStorage: { getItem: () => legacy },
    });
    expect(setProperty).toHaveBeenCalledWith("--app-sidebar-width", expected);
  });

  it("gesperrter Speicher fällt auf die Standardbreite zurück", () => {
    const setProperty = vi.fn();
    const blocked = () => {
      throw new Error("blocked");
    };
    runInNewContext(SIDEBAR_PREPAINT_SCRIPT, {
      document: {
        get cookie() {
          return blocked();
        },
        documentElement: { style: { setProperty } },
      },
      localStorage: { getItem: blocked },
    });
    expect(setProperty).toHaveBeenCalledWith("--app-sidebar-width", "268px");
    vi.mocked(localStorage.getItem).mockImplementation(blocked);
    expect(readLegacySidebarPreference()).toBeUndefined();
  });

  it("Umschalten hält Cookie und alten Speicherwert konsistent", () => {
    writeSidebarPreference(true);
    expect(document.cookie).toContain(`${SIDEBAR_COOKIE}=1`);
    expect(readLegacySidebarPreference()).toBe(true);
    writeSidebarPreference(false);
    expect(document.cookie).toContain(`${SIDEBAR_COOKIE}=0`);
    expect(localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe("0");
  });

  it("Cookies werden auch geschrieben, wenn LocalStorage gesperrt ist", () => {
    vi.mocked(localStorage.setItem).mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => writeSidebarPreference(true)).not.toThrow();
    expect(document.cookie).toContain(`${SIDEBAR_COOKIE}=1`);
  });
});
