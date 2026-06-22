/** Read-only label/value row used in detail modals. */
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
    <div className="flex gap-2 items-baseline">
      <div className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground w-44 flex-shrink-0">
        {label}
      </div>
      <div className={mono ? "font-mono" : ""}>{value}</div>
    </div>
  );
}
