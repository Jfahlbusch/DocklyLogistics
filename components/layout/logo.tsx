import Image from "next/image";
import { cn } from "@/lib/utils";
import markLight from "../../public/brand/dockly-mark.png";
import markDark from "../../public/brand/dockly-mark-neg.png";

const SIZES = {
  sm: { markHeight: 28, textClass: "text-[1.35rem]" },
  lg: { markHeight: 48, textClass: "text-2xl" },
} as const;

/** Höhe der Marke im Menükopf des Portals. */
export const INLINE_MARK_PX = 30;
/**
 * Schriftzug im einzeiligen Menükopf: 16 px statt 21,6 px — „LOGISTICS“ ist länger als das „BASE“ der Vorlage und passte sonst weder
 * in die 268-px-Leiste (223 px Innenbreite) noch in den Drawer (neben dem Schließen-Knopf).
 */
const INLINE_TEXT_CLASS = "text-base";
const BRAND_NAME = "DocklyLogistics";
type Variant = "dark" | "light" | "auto";

type Props = {
  size?: "sm" | "lg";
  /** Dunkle Fläche wie die Navy-Sidebar, helle Fläche oder Theme-Wechsel. */
  variant?: Variant;
  /** Eingeklappte Sidebar: nur die Schmetterlingsmarke. */
  markOnly?: boolean;
  /** Marke und Wortmarke nebeneinander, Marke 30 px hoch (Portal: `.sidebar-logo img`); sonst übereinander. */
  inline?: boolean;
};

/**
 * DocklyLogistics-Logo (Dockly-Familie) mit der Originalmarke aus DocklyBI. Auf einer fest
 * dunklen oder hellen Fläche wird nur die passende Bilddatei gerendert; bei
 * `auto` übernimmt CSS den Theme-Wechsel (mark-on-light/mark-on-dark).
 */
export function Logo({ size = "lg", variant = "auto", markOnly = false, inline = false }: Props) {
  const { markHeight: stackedHeight, textClass } = SIZES[size];
  const markHeight = inline ? INLINE_MARK_PX : stackedHeight;
  const markSize = `${Math.round(markHeight * (359 / 300))}px`;
  const markAlt = markOnly ? BRAND_NAME : "";
  return (
    <div
      className={cn(
        "flex select-none items-center",
        inline ? "flex-row gap-2" : "flex-col gap-1.5",
        variant === "dark" ? "text-sidebar-foreground" : variant === "light" ? "text-navy-900" : "text-foreground",
      )}
    >
      <span className="relative" style={{ height: markHeight, width: markHeight * (359 / 300) }}>
        {variant !== "dark" ? (
          <Image src={markLight} alt={markAlt} fill priority className={cn("object-contain", variant === "auto" && "mark-on-light")} sizes={markSize} />
        ) : null}
        {variant !== "light" ? (
          <Image src={markDark} alt={markAlt} fill priority className={cn("object-contain", variant === "auto" && "mark-on-dark")} sizes={markSize} />
        ) : null}
      </span>
      {!markOnly ? (
        <span
          style={{ fontFamily: "var(--font-poppins)", fontWeight: 800 }}
          className={cn("leading-none whitespace-nowrap", inline ? INLINE_TEXT_CLASS : textClass)}
        >
          <span className="italic">dockly</span>
          <span className="ml-1 uppercase tracking-[0.01em]">LOGISTICS</span>
        </span>
      ) : null}
    </div>
  );
}
