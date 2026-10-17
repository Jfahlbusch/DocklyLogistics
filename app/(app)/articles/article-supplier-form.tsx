"use client";

import { FormField as Field } from "@/components/ui/form-field";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ResponsiveDialogBody, ResponsiveDialogFooter } from "@/components/ui/responsive-dialog";
import { CHECKBOX_CLASS, CHECK_LABEL_CLASS, NATIVE_SELECT_CLASS } from "@/components/ui/native-field";

export type LinkFormValues = {
  supplierId: string;
  purchasePrice: number;
  currency: string;
  isPrimary: boolean;
  leadTimeDays: number;
  minOrderQty: number;
  supplierSku?: string;
};

export const defaultLinkValues: LinkFormValues = {
  supplierId: "",
  purchasePrice: 0,
  currency: "EUR",
  isPrimary: false,
  leadTimeDays: 3,
  minOrderQty: 1,
};

type SupplierOption = { id: string; name: string; channel: string };

type Props = {
  initial: LinkFormValues;
  isCreate: boolean;
  excludeSupplierIds?: string[];
  busy: boolean;
  errorMessage?: string | null;
  onSubmit: (values: LinkFormValues) => Promise<void>;
  onCancel: () => void;
};

export function ArticleSupplierForm({
  initial,
  isCreate,
  excludeSupplierIds = [],
  busy,
  errorMessage,
  onSubmit,
  onCancel,
}: Props) {
  const [v, setV] = useState<LinkFormValues>(initial);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/v1/suppliers?pageSize=200")
      .then((r) => r.json())
      .then((body) => {
        if (cancelled) return;
        setSuppliers(
          (body.data ?? []).map((s: { id: string; name: string; channel: string }) => ({
            id: s.id,
            name: s.name,
            channel: s.channel,
          })),
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function set<K extends keyof LinkFormValues>(k: K, val: LinkFormValues[K]) {
    setV((cur) => ({ ...cur, [k]: val }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      ...v,
      purchasePrice: Math.max(0, Number(v.purchasePrice)),
      leadTimeDays: Math.max(0, Number(v.leadTimeDays)),
      minOrderQty: Math.max(1, Number(v.minOrderQty)),
      supplierSku: v.supplierSku?.trim() || undefined,
    });
  }

  const selectableSuppliers = suppliers.filter((s) =>
    isCreate ? !excludeSupplierIds.includes(s.id) : true,
  );

  return (
    <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
      <ResponsiveDialogBody className="space-y-4">
      <Field label="Lieferant" required>
        <select
          value={v.supplierId}
          onChange={(e) => set("supplierId", e.target.value)}
          disabled={!isCreate}
          required
          className={`w-full ${NATIVE_SELECT_CLASS}`}
        >
          {isCreate && <option value="">— bitte wählen —</option>}
          {selectableSuppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.channel})
            </option>
          ))}
        </select>
        {!isCreate && (
          <p className="text-[10px] text-muted-foreground mt-1">
            Lieferant ist nicht änderbar — Zuordnung löschen und neu anlegen
          </p>
        )}
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Einkaufspreis" required>
          <Input
            type="number"
            min={0}
            step={0.01}
            inputMode="decimal"
            value={v.purchasePrice}
            onChange={(e) => set("purchasePrice", Number(e.target.value))}
            required
          />
        </Field>
        <Field label="Währung">
          <Input
            value={v.currency}
            onChange={(e) => set("currency", e.target.value.toUpperCase())}
            maxLength={3}
            className="uppercase"
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Lieferzeit (Tage)">
          <Input
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={v.leadTimeDays}
            onChange={(e) => set("leadTimeDays", Number(e.target.value))}
          />
        </Field>
        <Field label="Mindestmenge">
          <Input
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={v.minOrderQty}
            onChange={(e) => set("minOrderQty", Number(e.target.value))}
          />
        </Field>
        <Field label="Lieferanten-SKU">
          <Input
            value={v.supplierSku ?? ""}
            onChange={(e) => set("supplierSku", e.target.value)}
            maxLength={64}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="font-mono"
          />
        </Field>
      </div>

      <label className={`${CHECK_LABEL_CLASS} text-sm`}>
        <input
          type="checkbox"
          className={CHECKBOX_CLASS}
          checked={v.isPrimary}
          onChange={(e) => set("isPrimary", e.target.checked)}
        />
        Primärlieferant für diesen Artikel
      </label>

      {errorMessage && (
        <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
          {errorMessage}
        </div>
      )}
      </ResponsiveDialogBody>

      <ResponsiveDialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
          Abbrechen
        </Button>
        <Button
          type="submit"
          disabled={busy || !v.supplierId}
          className="bg-navy-900 hover:bg-navy-700 text-white dark:bg-gold-500 dark:hover:bg-gold-400 dark:text-navy-900"
        >
          {busy ? "Speichere…" : isCreate ? "Zuordnen" : "Speichern"}
        </Button>
      </ResponsiveDialogFooter>
    </form>
  );
}

