"use client";

import * as React from "react";

const STEP: Readonly<Record<string, 1 | -1>> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

/**
 * Tastaturbedienung einer `radiogroup` nach dem WAI-ARIA-Muster (Lane 5, F11): Nur die gewählte Option ist per Tab
 * erreichbar (roving tabindex); Pfeil rechts/unten wählt die nächste, Pfeil links/oben die vorherige Option (mit
 * Umlauf) und setzt den Fokus dorthin, Home/End springen an Anfang und Ende. Tasten mit Strg/Alt/Befehl/Umschalt
 * bleiben unberührt (Kürzel von Browser und Bedienhilfen).
 *
 * `onKeyDown` gehört an die Gruppe, `optionProps(value)` auf jede Option (`tabIndex` und `ref`).
 */
export function useRadioGroupKeys<T extends string>(values: readonly T[], current: T, select: (value: T) => void) {
  const refs = React.useRef(new Map<T, HTMLElement>());
  // Ohne Treffer (unbekannter Wert) bleibt die erste Option erreichbar.
  const anchor = values.includes(current) ? current : values[0];

  function onKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || values.length === 0) return;
    const focused = values.find((value) => refs.current.get(value) === document.activeElement) ?? anchor;
    const from = Math.max(0, values.indexOf(focused as T));
    const step = STEP[event.key];
    let target: T | undefined;
    if (step !== undefined) target = values[(from + step + values.length) % values.length];
    else if (event.key === "Home") target = values[0];
    else if (event.key === "End") target = values[values.length - 1];
    if (target === undefined) return;
    event.preventDefault();
    if (target !== current) select(target);
    refs.current.get(target)?.focus();
  }

  return {
    onKeyDown,
    optionProps: (value: T) => ({
      tabIndex: value === anchor ? 0 : -1,
      ref: (element: HTMLElement | null) => {
        if (element) refs.current.set(value, element);
        else refs.current.delete(value);
      },
    }),
  };
}
