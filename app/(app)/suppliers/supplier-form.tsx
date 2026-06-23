"use client";

import { FormField as Field } from "@/components/ui/form-field";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const CHANNELS = ["EMAIL", "API", "EDI"] as const;

export type SupplierFormValues = {
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  street?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  channel: (typeof CHANNELS)[number];
  channelConfig: Record<string, unknown>;
  active: boolean;
};

export const defaultSupplierValues: SupplierFormValues = {
  name: "",
  channel: "EMAIL",
  channelConfig: {},
  active: true,
};

type Props = {
  initial: SupplierFormValues;
  isCreate: boolean;
  busy: boolean;
  errorMessage?: string | null;
  onSubmit: (values: SupplierFormValues) => Promise<void>;
  onCancel: () => void;
};

export function SupplierForm({ initial, isCreate, busy, errorMessage, onSubmit, onCancel }: Props) {
  const [v, setV] = useState<SupplierFormValues>(initial);
  const [configText, setConfigText] = useState(
    JSON.stringify(initial.channelConfig ?? {}, null, 2),
  );
  const [configError, setConfigError] = useState<string | null>(null);

  function set<K extends keyof SupplierFormValues>(k: K, val: SupplierFormValues[K]) {
    setV((cur) => ({ ...cur, [k]: val }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    let parsed: Record<string, unknown> = {};
    if (configText.trim()) {
      try {
        parsed = JSON.parse(configText);
      } catch {
        setConfigError("channelConfig muss valides JSON sein");
        return;
      }
    }
    setConfigError(null);
    const clean: SupplierFormValues = {
      ...v,
      contactName: v.contactName?.trim() || undefined,
      email: v.email?.trim() || undefined,
      phone: v.phone?.trim() || undefined,
      street: v.street?.trim() || undefined,
      city: v.city?.trim() || undefined,
      postalCode: v.postalCode?.trim() || undefined,
      country: v.country?.trim() || undefined,
      channelConfig: parsed,
    };
    onSubmit(clean);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Name" required>
        <Input
          value={v.name}
          onChange={(e) => set("name", e.target.value)}
          required
          maxLength={200}
        />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Kontaktperson">
          <Input
            value={v.contactName ?? ""}
            onChange={(e) => set("contactName", e.target.value)}
            maxLength={200}
          />
        </Field>
        <Field label="E-Mail">
          <Input
            type="email"
            value={v.email ?? ""}
            onChange={(e) => set("email", e.target.value)}
            className="font-mono"
          />
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Telefon">
          <Input
            value={v.phone ?? ""}
            onChange={(e) => set("phone", e.target.value)}
            maxLength={60}
          />
        </Field>
        <Field label="Land">
          <Input
            value={v.country ?? ""}
            onChange={(e) => set("country", e.target.value)}
            maxLength={80}
          />
        </Field>
      </div>
      <div className="grid grid-cols-[2fr_1fr_1fr] gap-3">
        <Field label="Straße">
          <Input
            value={v.street ?? ""}
            onChange={(e) => set("street", e.target.value)}
            maxLength={200}
          />
        </Field>
        <Field label="PLZ">
          <Input
            value={v.postalCode ?? ""}
            onChange={(e) => set("postalCode", e.target.value)}
            maxLength={20}
          />
        </Field>
        <Field label="Ort">
          <Input
            value={v.city ?? ""}
            onChange={(e) => set("city", e.target.value)}
            maxLength={100}
          />
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Kanal" required>
          <select
            value={v.channel}
            onChange={(e) => set("channel", e.target.value as SupplierFormValues["channel"])}
            className="w-full px-3 py-2 border border-border rounded-lg bg-card text-sm"
          >
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Aktiv">
          <label className="flex items-center gap-2 mt-2 text-sm">
            <input
              type="checkbox"
              checked={v.active}
              onChange={(e) => set("active", e.target.checked)}
            />
            Lieferant ist aktiv
          </label>
        </Field>
      </div>
      <Field label="Empfänger-Konfiguration (JSON)">
        <textarea
          value={configText}
          onChange={(e) => setConfigText(e.target.value)}
          rows={5}
          className="w-full px-3 py-2 border border-border rounded-lg bg-card text-xs font-mono"
          placeholder='{"to": "orders@example.com"}'
        />
        {configError && <p className="text-xs text-rose-700 mt-1">{configError}</p>}
        <p className="text-[10px] text-muted-foreground mt-1">
          Kanal-spezifisch: EMAIL → {`{ to, subject? }`}, API → {`{ url, auth: { type, token } }`},
          EDI → {`{ partnerId }`}
        </p>
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

