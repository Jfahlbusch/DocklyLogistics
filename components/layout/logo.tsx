import Image from "next/image";
import { cn } from "@/lib/utils";

type Variant = "dark" | "light" | "auto";

type Props = {
  /**
   * "dark"  = on a permanently dark surface → white logo (e.g. the teal sidebar).
   * "light" = on a permanently light surface → teal logo.
   * "auto"  = adapt to the color theme (teal in light mode, white in dark mode).
   */
  variant?: Variant;
  className?: string;
};

const MARK_TEAL = "/brand/dockly-mark.png";
const MARK_WHITE = "/brand/dockly-mark-neg.png";
const MARK_CLS = "h-7 w-auto shrink-0";

function Mark({ variant }: { variant: Variant }) {
  if (variant === "dark") {
    return <Image src={MARK_WHITE} alt="DocklyLogistics" width={359} height={300} priority className={MARK_CLS} />;
  }
  if (variant === "light") {
    return <Image src={MARK_TEAL} alt="DocklyLogistics" width={359} height={300} priority className={MARK_CLS} />;
  }
  // auto: swap the mark with the theme
  return (
    <>
      <Image src={MARK_TEAL} alt="DocklyLogistics" width={359} height={300} priority className={cn(MARK_CLS, "dark:hidden")} />
      <Image src={MARK_WHITE} alt="" aria-hidden width={359} height={300} className={cn(MARK_CLS, "hidden dark:block")} />
    </>
  );
}

/**
 * DocklyLogistics brand logo — the Dockly butterfly mark + "dockly LOGISTICS"
 * wordmark, rebuilt in the DocklyProtect style (Poppins ExtraBold: italic
 * lowercase "dockly" + upright caps second word). Single colour via the parent
 * text colour; the mark ships in teal + white variants.
 */
export function Logo({ variant = "dark", className }: Props) {
  const textColor =
    variant === "dark"
      ? "text-white"
      : variant === "light"
        ? "text-navy-900"
        : "text-navy-900 dark:text-white";
  return (
    <span className={cn("inline-flex items-center gap-2 select-none", textColor, className)}>
      <Mark variant={variant} />
      <span
        style={{ fontFamily: "var(--font-poppins)", fontWeight: 800 }}
        className="text-[1.35rem] leading-none whitespace-nowrap"
      >
        <span className="italic">dockly</span>
        <span className="ml-1 uppercase tracking-[0.01em]">Logistics</span>
      </span>
    </span>
  );
}
