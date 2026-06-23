"use client";

import { FormField as Field } from "@/components/ui/form-field";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type LocationFormValues = {
  code: string;
  name: string;
  zone?: string;
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
  errorMessage?: string | null;
  onSubmit: (values: LocationFormValues) => Promise<void>;
  onCancel: () => void;
};

export function LocationForm({ initial, isCreate, busy, errorMessage, onSubmit, onCancel }: Props) {
  const [v, setV] = useState<LocationFormValues>(initial);

  function set<K extends keyof LocationFormValues>(k: K, val: LocationFormValues[K]) {
    setV((cur) => ({ ...cur, [k]: val }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      ...v,
      zone: v.zone?.trim() || undefined,
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
        <Field label="Zone">
          <Input
            value={v.zone ?? ""}
            onChange={(e) => set("zone", e.target.value)}
            maxLength={80}
            placeholder="z.B. Trocken, Kühl"
          />
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

