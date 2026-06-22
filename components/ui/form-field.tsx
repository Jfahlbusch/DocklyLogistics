/** Labeled form-field wrapper (label + optional required marker + the input). */
export function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm">
      <div className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground mb-1">
        {label}
        {required && <span className="text-rose-600 ml-1">*</span>}
      </div>
      {children}
    </label>
  );
}
