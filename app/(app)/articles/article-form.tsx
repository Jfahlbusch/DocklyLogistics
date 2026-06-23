"use client";

import { FormField as Field } from "@/components/ui/form-field";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const UNIT_KINDS = ["PIECE", "KG", "G", "L", "ML", "PACK", "SACK", "BOX", "PALLET", "OTHER"] as const;
const BARCODE_SOURCES = ["SKU", "EAN"] as const;

export type ArticleFormValues = {
  sku: string;
  name: string;
  shortDesc?: string;
  longDesc?: string;
  category?: string;
  eanGtin?: string;
  baseUnit: typeof UNIT_KINDS[number];
  orderUnit: typeof UNIT_KINDS[number];
  packFactor: number;
  barcodeSource: typeof BARCODE_SOURCES[number];
  minStock: number;
  defaultLocationId?: string | null;
  vatRate?: number | null;
};

type Location = { id: string; code: string; name: string };

export const defaultArticleValues: ArticleFormValues = {
  sku: "",
  name: "",
  baseUnit: "PIECE",
  orderUnit: "BOX",
  packFactor: 1,
  barcodeSource: "SKU",
  minStock: 0,
};

type Props = {
  initial: ArticleFormValues;
  isCreate: boolean;
  busy: boolean;
  errorMessage?: string | null;
  onSubmit: (values: ArticleFormValues) => Promise<void>;
  onCancel: () => void;
};

export function ArticleForm({ initial, isCreate, busy, errorMessage, onSubmit, onCancel }: Props) {
  const [v, setV] = useState<ArticleFormValues>(initial);
  const [locations, setLocations] = useState<Location[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/v1/locations?pageSize=200")
      .then((r) => r.json())
      .then((body) => {
        if (cancelled) return;
        setLocations(
          (body.data ?? []).map((l: { id: string; code: string; name: string }) => ({
            id: l.id,
            code: l.code,
            name: l.name,
          })),
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function set<K extends keyof ArticleFormValues>(k: K, val: ArticleFormValues[K]) {
    setV((cur) => ({ ...cur, [k]: val }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Strip empty optional strings before submitting (so backend Zod doesn't reject "" with min(1))
    const clean: ArticleFormValues = {
      ...v,
      shortDesc: v.shortDesc?.trim() ? v.shortDesc.trim() : undefined,
      longDesc: v.longDesc?.trim() ? v.longDesc.trim() : undefined,
      category: v.category?.trim() ? v.category.trim() : undefined,
      eanGtin: v.eanGtin?.trim() ? v.eanGtin.trim() : undefined,
      defaultLocationId: v.defaultLocationId ? v.defaultLocationId : undefined,
      vatRate:
        v.vatRate === null || v.vatRate === undefined || Number.isNaN(v.vatRate)
          ? undefined
          : Number(v.vatRate),
      packFactor: Number(v.packFactor) || 1,
      minStock: Number(v.minStock) || 0,
    };
    onSubmit(clean);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="SKU" required>
          <Input
            value={v.sku}
            onChange={(e) => set("sku", e.target.value)}
            required
            maxLength={64}
            disabled={!isCreate}
            className="font-mono"
          />
          {!isCreate && (
            <p className="text-[10px] text-muted-foreground mt-1">SKU ist nicht änderbar</p>
          )}
        </Field>
        <Field label="Name" required>
          <Input
            value={v.name}
            onChange={(e) => set("name", e.target.value)}
            required
            maxLength={200}
          />
        </Field>
      </div>

      <Field label="Kurzbeschreibung">
        <Input
          value={v.shortDesc ?? ""}
          onChange={(e) => set("shortDesc", e.target.value)}
          maxLength={500}
        />
      </Field>

      <Field label="Beschreibung">
        <textarea
          value={v.longDesc ?? ""}
          onChange={(e) => set("longDesc", e.target.value)}
          rows={2}
          maxLength={5000}
          className="w-full px-3 py-2 border border-border rounded-lg bg-card text-sm"
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Kategorie">
          <Input
            value={v.category ?? ""}
            onChange={(e) => set("category", e.target.value)}
            maxLength={100}
            placeholder="z.B. Mehl, Zucker"
          />
        </Field>
        <Field label="EAN / GTIN (8–14 Ziffern)">
          <Input
            value={v.eanGtin ?? ""}
            onChange={(e) => set("eanGtin", e.target.value.replace(/\D/g, ""))}
            pattern="\d{8,14}"
            maxLength={14}
            inputMode="numeric"
            className="font-mono"
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Basiseinheit" required>
          <Select
            value={v.baseUnit}
            onChange={(val) => set("baseUnit", val as ArticleFormValues["baseUnit"])}
            options={UNIT_KINDS}
          />
        </Field>
        <Field label="Bestelleinheit" required>
          <Select
            value={v.orderUnit}
            onChange={(val) => set("orderUnit", val as ArticleFormValues["orderUnit"])}
            options={UNIT_KINDS}
          />
        </Field>
        <Field label="Verpackungsfaktor" required>
          <Input
            type="number"
            min={1}
            step={1}
            value={v.packFactor}
            onChange={(e) => set("packFactor", Math.max(1, Number(e.target.value)))}
            required
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Barcode-Quelle">
          <Select
            value={v.barcodeSource}
            onChange={(val) => set("barcodeSource", val as ArticleFormValues["barcodeSource"])}
            options={BARCODE_SOURCES}
          />
        </Field>
        <Field label="Mindestbestand">
          <Input
            type="number"
            min={0}
            step={1}
            value={v.minStock}
            onChange={(e) => set("minStock", Math.max(0, Number(e.target.value)))}
          />
        </Field>
        <Field label="MwSt %">
          <Input
            type="number"
            min={0}
            max={100}
            step={0.01}
            value={v.vatRate ?? ""}
            onChange={(e) => set("vatRate", e.target.value === "" ? null : Number(e.target.value))}
          />
        </Field>
      </div>

      <Field label="Standard-Lagerplatz">
        <Select
          value={v.defaultLocationId ?? ""}
          onChange={(val) => set("defaultLocationId", val || null)}
          options={["", ...locations.map((l) => l.id)]}
          labels={["— kein —", ...locations.map((l) => `${l.code} · ${l.name}`)]}
        />
      </Field>

      {errorMessage && (
        <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
          {errorMessage}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
          Abbrechen
        </Button>
        <Button type="submit" disabled={busy} className="bg-navy-900 hover:bg-navy-700 text-white dark:bg-gold-500 dark:hover:bg-gold-400 dark:text-navy-900">
          {busy ? "Speichere…" : isCreate ? "Anlegen" : "Speichern"}
        </Button>
      </div>
    </form>
  );
}


function Select({
  value,
  onChange,
  options,
  labels,
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  labels?: readonly string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 border border-border rounded-lg bg-card text-sm"
    >
      {options.map((opt, i) => (
        <option key={`${opt}-${i}`} value={opt}>
          {labels ? labels[i] : opt}
        </option>
      ))}
    </select>
  );
}
