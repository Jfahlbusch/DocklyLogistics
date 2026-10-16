/**
 * Polyfills für Radix-UI-Komponenten unter jsdom. Greift nur, wenn ein DOM da ist
 * (Komponententests mit `// @vitest-environment jsdom`); in `node`-Tests ein No-op.
 */
if (typeof window !== "undefined" && typeof Element !== "undefined") {
  const proto = Element.prototype as unknown as Record<string, unknown>;

  // Pointer-Capture (Radix Menu/Select prüfen es bei pointerdown/-move)
  proto.hasPointerCapture ??= () => false;
  proto.setPointerCapture ??= () => {};
  proto.releasePointerCapture ??= () => {};

  // Fokus-/Highlight-Navigation scrollt Einträge in den Blick
  proto.scrollIntoView ??= () => {};

  // Popper (Positionierung) beobachtet Größen
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  // Popper liest Ankergeometrie über DOMRect
  globalThis.DOMRect ??= class {
    x = 0;
    y = 0;
    width = 0;
    height = 0;
    top = 0;
    right = 0;
    bottom = 0;
    left = 0;
    toJSON() {
      return this;
    }
  } as unknown as typeof DOMRect;

  // useMediaQuery (Menü: Drawer-Breakpoint, Touch, niedrige Displays) — jsdom kennt keine Media-Queries: nie zutreffend.
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}
