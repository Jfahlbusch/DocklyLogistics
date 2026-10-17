"use client";

import { useEffect, useState } from "react";
import { Minus, Plus, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { exceedsCapacity } from "@/lib/domain/article-quantities";

export type QuantityStepperProps = {
  /** Bestellmenge in Bestelleinheiten. */
  value: number;
  onChange: (n: number) => void;
  orderUnitLabel: string;
  baseUnitLabel: string;
  /** Basiseinheiten je Bestelleinheit. */
  packFactor: number;
  stockTotal: number;
  /** Maximalmenge in Basiseinheiten, null = keine Grenze. */
  maxStock: number | null;
  disabled?: boolean;
};

const btn =
  "size-16 shrink-0 inline-flex items-center justify-center rounded-xl border border-border bg-card text-foreground " +
  "shadow-soft transition-colors hover:bg-muted active:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-ring disabled:opacity-40 disabled:pointer-events-none";

/** Mengen-Stepper mit großen Plus/Minus-Knöpfen (Lagermodus). Rein clientseitig, blockiert nichts. */
export function QuantityStepper({
  value,
  onChange,
  orderUnitLabel,
  baseUnitLabel,
  packFactor,
  stockTotal,
  maxStock,
  disabled = false,
}: QuantityStepperProps) {
  const t = useTranslations("warehouse.stepper");
  const [text, setText] = useState(String(value));

  useEffect(() => {
    setText((cur) => (cur === "" && value === 0 ? cur : String(value)));
  }, [value]);

  const free = maxStock != null ? Math.max(0, maxStock - stockTotal) : null;
  const warn = exceedsCapacity({ maxStock, packFactor }, stockTotal, value);

  function step(delta: number) {
    onChange(Math.max(0, value + delta));
  }

  function onInput(raw: string) {
    const digits = raw.replace(/\D/g, "");
    setText(digits);
    onChange(digits === "" ? 0 : parseInt(digits, 10));
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          className={btn}
          aria-label={t("decrease")}
          disabled={disabled || value <= 0}
          onClick={() => step(-1)}
        >
          <Minus className="size-8" aria-hidden="true" />
        </button>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          aria-label={t("quantityLabel")}
          title={orderUnitLabel}
          value={text}
          disabled={disabled}
          onChange={(e) => onInput(e.target.value)}
          onBlur={() => setText(text === "" ? "0" : String(value))}
          onFocus={(e) => e.currentTarget.select()}
          className="h-16 w-28 rounded-xl border border-border bg-card text-center text-4xl font-semibold tabular-nums text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-40"
        />
        <button type="button" className={btn} aria-label={t("increase")} disabled={disabled} onClick={() => step(1)}>
          <Plus className="size-8" aria-hidden="true" />
        </button>
      </div>
      <p className="text-sm text-muted-foreground">{orderUnitLabel}</p>
      <p className="text-base font-medium text-foreground">
        {t("inBaseUnit", { amount: value * packFactor, unit: baseUnitLabel })}
      </p>
      {free != null && (
        <p className="text-sm text-muted-foreground">{t("freeCapacity", { amount: free, unit: baseUnitLabel })}</p>
      )}
      {warn && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-lg border border-warning/50 bg-warning/10 px-3 py-2 text-sm text-foreground"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
          <span>{t("capacityWarning", { amount: free ?? 0, unit: baseUnitLabel })}</span>
        </p>
      )}
    </div>
  );
}
