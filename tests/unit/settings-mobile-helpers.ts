import { vi } from "vitest";

/** Simuliert Viewport: `desktop` = ab md (Dialog), sonst Handy (Bottom-Sheet). */
export function stubViewport(desktop: boolean) {
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: desktop,
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

export function json(body: unknown, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(body), { status });
}

export function stubFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const fn = vi.fn(async (url: string, init?: RequestInit) => handler(url, init));
  vi.stubGlobal("fetch", fn);
  return fn;
}

/** Klassen-Prüfung: Token (z. B. `min-h-11`) ist vorhanden. */
export function hasClass(el: Element, token: string) {
  return el.className.split(/\s+/).includes(token);
}
