"use client";

import { FormField as Field } from "@/components/ui/form-field";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { validateStockLevels } from "@/lib/domain/article-quantities";
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
  targetStock?: number | null;
  maxStock?: number | null;
  defaultLocationId?: string | null;
  zoneId?: string | null;
  vatRate?: number | null;
};

type Location = { id: string; code: string; name: string; zoneId: string | null };
type ZoneOption = { id: string; name: string };

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
  /** Feldfehler aus einer 422-Antwort (`errors: { feld: [meldung] }`). */
  fieldErrors?: Record<string, string[]> | null;
  onSubmit: (values: ArticleFormValues) => Promise<void>;
  onCancel: () => void;
};

export function ArticleForm({ initial, isCreate, busy, errorMessage, fieldErrors, onSubmit, onCancel }: Props) {
  const t = useTranslations("articles.quantities");
  const tz = useTranslations("articles.zone");
  const [v, setV] = useState<ArticleFormValues>(initial);
  const [minText, setMinText] = useState(String(initial.minStock ?? 0));
  const [targetText, setTargetText] = useState(initial.targetStock == null ? "" : String(initial.targetStock));
  const [maxText, setMaxText] = useState(initial.maxStock == null ? "" : String(initial.maxStock));
  const [locations, setLocations] = useState<Location[]>([]);
  const [zones, setZones] = useState<ZoneOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/v1/locations?pageSize=200")
      .then((r) => r.json())
      .then((body) => {
        if (cancelled) return;
        setLocations(
          (Array.isArray(body.data) ? body.data : []).map((l: { id: string; code: string; name: string; zoneId?: string | null }) => ({
            id: l.id,
            code: l.code,
            name: l.name,
            zoneId: l.zoneId ?? null,
          })),
        );
      });
    fetch("/api/v1/zones")
      .then((r) => r.json())
      .then((body) => {
        if (cancelled) return;
        setZones(
          (Array.isArray(body.data) ? body.data : [])
            .filter((z: { active?: boolean }) => z.active !== false)
            .map((z: { id: string; name: string }) => ({ id: z.id, name: z.name })),
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Zonenwechsel leert einen Lagerplatz, der nicht zur neuen Zone passt. */
  function changeZone(zoneId: string) {
    setV((cur) => {
      const loc = locations.find((l) => l.id === cur.defaultLocationId);
      const keep = !zoneId || !loc || loc.zoneId === zoneId;
      return { ...cur, zoneId: zoneId || null, defaultLocationId: keep ? cur.defaultLocationId : null };
    });
  }

  /** Wahl eines Lagerplatzes mit Zone setzt dessen Zone. */
  function changeLocation(locationId: string) {
    setV((cur) => {
      const loc = locations.find((l) => l.id === locationId);
      return { ...cur, defaultLocationId: locationId || null, zoneId: loc?.zoneId ?? cur.zoneId ?? null };
    });
  }

  const visibleLocations = v.zoneId ? locations.filter((l) => l.zoneId === v.zoneId) : locations;

  function set<K extends keyof ArticleFormValues>(k: K, val: ArticleFormValues[K]) {
    setV((cur) => ({ ...cur, [k]: val }));
  }

  const minStock = parseQty(minText) ?? 0;
  const targetStock = parseQty(targetText);
  const maxStock = parseQty(maxText);
  const liveErrors: Record<string, string[]> = {};
  for (const err of validateStockLevels({ minStock, targetStock, maxStock })) {
    (liveErrors[err.field] ??= []).push(err.message);
  }
  const qtyErrors = (field: string) => [...(fieldErrors?.[field] ?? []), ...(liveErrors[field] ?? [])]
    .filter((m, i, all) => all.indexOf(m) === i);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Strip empty optional strings before submitting (so backend Zod doesn't reject "" with min(1))
    const clean: ArticleFormValues = {
      ...v,
      shortDesc: v.shortDesc?.trim() ? v.shortDesc.trim() : undefined,
      longDesc: v.longDesc?.trim() ? v.longDesc.trim() : undefined,
      category: v.category?.trim() ? v.category.trim() : undefined,
      eanGtin: v.eanGtin?.trim() ? v.eanGtin.trim() : undefined,
      defaultLocationId: v.defaultLocationId ? v.defaultLocationId : null,
      zoneId: v.zoneId ? v.zoneId : null,
      vatRate:
        v.vatRate === null || v.vatRate === undefined || Number.isNaN(v.vatRate)
          ? undefined
          : Number(v.vatRate),
      packFactor: Number(v.packFactor) || 1,
      minStock,
      targetStock,
      maxStock,
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <QtyField
          name="minStock"
          label={t("minStock")}
          unit={v.baseUnit}
          value={minText}
          onChange={setMinText}
          errors={qtyErrors("minStock")}
        />
        <QtyField
          name="targetStock"
          label={t("targetStock")}
          unit={v.baseUnit}
          value={targetText}
          onChange={setTargetText}
          errors={qtyErrors("targetStock")}
        />
        <QtyField
          name="maxStock"
          label={t("maxStock")}
          unit={v.baseUnit}
          value={maxText}
          onChange={setMaxText}
          errors={qtyErrors("maxStock")}
        />
      </div>
      <p className="text-xs text-muted-foreground -mt-2">{t("optionalHint")}</p>

      <Field label={tz("label")}>
        <Select
          testId="field-zone"
          value={v.zoneId ?? ""}
          onChange={changeZone}
          options={["", ...zones.map((z) => z.id)]}
          labels={[tz("none"), ...zones.map((z) => z.name)]}
          errors={qtyErrors("zoneId")}
        />
        <FieldErrors id="zone-error" errors={qtyErrors("zoneId")} />
      </Field>

      <Field label="Standard-Lagerplatz">
        <Select
          testId="field-location"
          value={v.defaultLocationId ?? ""}
          onChange={changeLocation}
          options={["", ...visibleLocations.map((l) => l.id)]}
          labels={["— kein —", ...visibleLocations.map((l) => `${l.code} · ${l.name}`)]}
          errors={qtyErrors("defaultLocationId")}
        />
        <FieldErrors id="location-error" errors={qtyErrors("defaultLocationId")} />
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


/** Leer oder ungültig = null, sonst ganze Zahl ≥ 0. */
function parseQty(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

function QtyField({
  name,
  label,
  unit,
  value,
  onChange,
  errors,
}: {
  name: string;
  label: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
  errors: string[];
}) {
  const invalid = errors.length > 0;
  const errId = `qty-${name}-error`;
  return (
    <Field label={label}>
      <div className="relative">
        <Input
          name={name}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={invalid ? errId : undefined}
          className="pr-12 text-base"
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
          {unit}
        </span>
      </div>
      {invalid && (
        <div id={errId} role="alert" className="mt-1 text-xs text-destructive">
          {errors.map((m) => (
            <p key={m}>{m}</p>
          ))}
        </div>
      )}
    </Field>
  );
}

function FieldErrors({ id, errors }: { id: string; errors: string[] }) {
  if (errors.length === 0) return null;
  return (
    <div id={id} role="alert" className="mt-1 text-xs text-destructive">
      {errors.map((m) => (
        <p key={m}>{m}</p>
      ))}
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
  labels,
  testId,
  errors,
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  labels?: readonly string[];
  testId?: string;
  errors?: string[];
}) {
  return (
    <select
      data-testid={testId}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-invalid={errors && errors.length > 0 ? true : undefined}
      className="w-full min-h-11 px-3 py-2 border border-border rounded-lg bg-card text-base md:min-h-0 md:text-sm"
    >
      {options.map((opt, i) => (
        <option key={`${opt}-${i}`} value={opt}>
          {labels ? labels[i] : opt}
        </option>
      ))}
    </select>
  );
}
