/**
 * Gemeinsame Stile für native Formularelemente (`<select>`, `<textarea>`, Checkbox, Filter-Chips), damit sie
 * mobil wie `components/ui/input.tsx` aussehen: 16 px Schrift (kein iOS-Eingabezoom), ≥ 44 px Touch-Ziel,
 * ab `md` kompakt. Seiten ergänzen nur Layout (`w-full`, Breite) — Schrift nie mit `text-sm`, sondern `md:text-sm`.
 */
const FIELD_BASE =
  "rounded-lg border border-input bg-transparent px-2.5 text-base text-foreground transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40";

/** Natives `<select>`. */
export const NATIVE_SELECT_CLASS = `${FIELD_BASE} min-h-11 py-1 md:min-h-9 md:text-sm`;

/** Natives `<textarea>`. */
export const NATIVE_TEXTAREA_CLASS = `${FIELD_BASE} min-h-11 py-2 md:text-sm`;

/** `<textarea>` für Code/JSON/Schlüssel (Monospace). */
export const NATIVE_TEXTAREA_MONO_CLASS = `${FIELD_BASE} min-h-11 py-2 font-mono md:text-xs`;

/** Natives `<input type="checkbox">`. */
export const CHECKBOX_CLASS = "size-5 md:size-4";

/** `<label>` um Checkbox/Radio: ganze Zeile ist Touch-Ziel. */
export const CHECK_LABEL_CLASS = "flex min-h-11 items-center gap-3 md:min-h-0";

/** Basis für Filter-Chips (Button/Link); Farbe/Aktiv-Zustand ergänzt die Seite. */
export const CHIP_CLASS =
  "inline-flex min-h-11 items-center justify-center rounded-full border border-border px-3 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:min-h-0 md:px-2.5 md:py-1 md:text-xs";
