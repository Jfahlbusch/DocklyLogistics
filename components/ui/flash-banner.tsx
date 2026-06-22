/** Inline success/error flash message (green = ok, red = error). Renders nothing when null. */
export function FlashBanner({ flash }: { flash: { ok: boolean; text: string } | null }) {
  if (!flash) return null;
  return (
    <div
      className={
        "text-sm px-3 py-2 rounded-lg border " +
        (flash.ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-rose-200 bg-rose-50 text-rose-700")
      }
    >
      {flash.text}
    </div>
  );
}
