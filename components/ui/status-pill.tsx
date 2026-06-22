import { cn } from "@/lib/utils";

/**
 * Shared pill chrome (rounded badge + leading dot). The colour `style` (a Tailwind
 * class string) stays domain-specific per feature — order status, channel, zone,
 * delivery status all differ — only the chrome is centralized here.
 */
export function StatusPill({
  style,
  className,
  children,
}: {
  style?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium",
        style ?? "bg-muted text-foreground",
        className,
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {children}
    </span>
  );
}
