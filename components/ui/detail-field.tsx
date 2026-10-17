/** Read-only label/value row used in detail modals. Mobil Label über Wert, ab `sm` nebeneinander; lange Werte umbrechen. */
export function DetailField({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
      <div className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground sm:w-44 sm:flex-shrink-0">
        {label}
      </div>
      <div className={mono ? "min-w-0 font-mono break-all" : "min-w-0 break-words"}>{value}</div>
    </div>
  );
}
