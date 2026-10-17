"use client";

import { FormField as Field } from "@/components/ui/form-field";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type LocationFormValues = {
  code: string;
  name: string;
  /** Zone (ID) oder null = keine. */
  zoneId?: string | null;
  bin?: string;
  capacity?: number | null;
  active: boolean;
};

export const defaultLocationValues: LocationFormValues = {
  code: "",
  name: "",
  active: true,
};

type Props = {
  initial: LocationFormValues;
  isCreate: boolean;
  busy: boolean;
  /** Aktive Zonen für das Dropdown. */
  zones: { id: string; name: string }[];
  errorMessage?: string | null;
  onSubmit: (values: LocationFormValues) => Promise<void>;
  onCancel: () => void;
};

export function LocationForm({ initial, isCreate, busy, zones, errorMessage, onSubmit, onCancel }: Props) {
  const t = useTranslations("zones.locationForm");
  const [v, setV] = useState<LocationFormValues>(initial);

  function set<K extends keyof LocationFormValues>(k: K, val: LocationFormValues[K]) {
    setV((cur) => ({ ...cur, [k]: val }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      ...v,
      zoneId: v.zoneId || null,
      bin: v.bin?.trim() || undefined,
      capacity:
        v.capacity === null || v.capacity === undefined || Number.isNaN(v.capacity)
          ? undefined
          : Number(v.capacity),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Code" required>
          <Input
            value={v.code}
            onChange={(e) => set("code", e.target.value)}
            required
            maxLength={60}
            disabled={!isCreate}
            className="font-mono"
          />
          {!isCreate && (
            <p className="text-[10px] text-muted-foreground mt-1">Code ist nicht änderbar</p>
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label={t("label")}>
          <select
            value={v.zoneId ?? ""}
            onChange={(e) => set("zoneId", e.target.value || null)}
            className="h-11 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:h-8 md:text-sm dark:bg-input/30"
          >
            <option value="">{t("none")}</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Bin">
          <Input
            value={v.bin ?? ""}
            onChange={(e) => set("bin", e.target.value)}
            maxLength={40}
          />
        </Field>
        <Field label="Kapazität">
          <Input
            type="number"
            min={0}
            step={1}
            value={v.capacity ?? ""}
            onChange={(e) =>
              set("capacity", e.target.value === "" ? null : Number(e.target.value))
            }
          />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={v.active}
          onChange={(e) => set("active", e.target.checked)}
        />
        Lagerplatz ist aktiv
      </label>

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

