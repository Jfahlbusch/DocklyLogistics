"use client";

import { Printer } from "lucide-react";
import { useTranslations } from "next-intl";

const btn =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-medium";

export function PrintActions() {
  const t = useTranslations("zones.qr");
  return (
    <div className="print:hidden mx-auto flex max-w-sm justify-center gap-3 p-4">
      <button
        type="button"
        onClick={() => window.history.length > 1 ? window.history.back() : window.close()}
        className={btn}
        style={{ background: "#fff", color: "#000", borderColor: "#000" }}
      >
        {t("back")}
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className={btn}
        style={{ background: "#041E24", color: "#fff", borderColor: "#041E24" }}
      >
        <Printer aria-hidden className="size-4" />
        {t("print")}
      </button>
    </div>
  );
}
