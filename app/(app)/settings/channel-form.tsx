"use client";

import { FormField as Field } from "@/components/ui/form-field";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const CHANNELS = ["EMAIL", "API", "EDI"] as const;

const EXAMPLES: Record<(typeof CHANNELS)[number], Record<string, unknown>> = {
  EMAIL: {
    fromEmail: "orders@meinkunde.de",
    fromName: "Bäckerei Mustermann",
    replyTo: "einkauf@meinkunde.de",
    signature: "Mit freundlichen Grüßen\nIhr Team",
  },
  API: {
    defaultClientId: "demo-tenant",
    defaultHeaders: { "X-Tenant-Id": "demo" },
    callbackUrl: "https://example.com/api/public/v1/webhooks/inbound",
  },
  EDI: {
    senderId: "4012345000019",
    senderQualifier: "14",
    edifactVersion: "D.96A",
  },
};

export type ChannelFormValues = {
  channel: (typeof CHANNELS)[number];
  label?: string;
  isDefault: boolean;
  active: boolean;
  config: Record<string, unknown>;
};

export const defaultChannelValues: ChannelFormValues = {
  channel: "EMAIL",
  isDefault: false,
  active: true,
  config: EXAMPLES.EMAIL,
};

type Props = {
  initial: ChannelFormValues;
  isCreate: boolean;
  busy: boolean;
  errorMessage?: string | null;
  onSubmit: (values: ChannelFormValues) => Promise<void>;
  onCancel: () => void;
};

export function ChannelForm({ initial, isCreate, busy, errorMessage, onSubmit, onCancel }: Props) {
  const [v, setV] = useState<ChannelFormValues>(initial);
  const [configText, setConfigText] = useState(JSON.stringify(initial.config ?? {}, null, 2));
  const [configError, setConfigError] = useState<string | null>(null);

  function set<K extends keyof ChannelFormValues>(k: K, val: ChannelFormValues[K]) {
    setV((cur) => ({ ...cur, [k]: val }));
  }

  function onChannelChange(c: (typeof CHANNELS)[number]) {
    setV((cur) => ({ ...cur, channel: c }));
    if (isCreate) {
      const example = EXAMPLES[c];
      setConfigText(JSON.stringify(example, null, 2));
      setV((cur) => ({ ...cur, config: example }));
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    let parsed: Record<string, unknown> = {};
    try {
      parsed = configText.trim() ? JSON.parse(configText) : {};
    } catch {
      setConfigError("config muss valides JSON sein");
      return;
    }
    setConfigError(null);
    onSubmit({
      ...v,
      label: v.label?.trim() || undefined,
      config: parsed,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Kanal" required>
          <select
            value={v.channel}
            onChange={(e) => onChannelChange(e.target.value as (typeof CHANNELS)[number])}
            className="w-full px-3 py-2 border border-border rounded-lg bg-card text-sm"
            disabled={!isCreate}
          >
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {!isCreate && (
            <p className="text-[10px] text-muted-foreground mt-1">Kanal ist nicht änderbar</p>
          )}
        </Field>
        <Field label="Label">
          <Input
            value={v.label ?? ""}
            onChange={(e) => set("label", e.target.value)}
            maxLength={120}
            placeholder="z.B. Hauptmailbox"
          />
        </Field>
      </div>

      <div className="flex gap-6 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={v.isDefault}
            onChange={(e) => set("isDefault", e.target.checked)}
          />
          Als Standard verwenden
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={v.active}
            onChange={(e) => set("active", e.target.checked)}
          />
          Aktiv
        </label>
      </div>

      <Field label={`Konfiguration (${v.channel}) als JSON`}>
        <textarea
          value={configText}
          onChange={(e) => setConfigText(e.target.value)}
          rows={10}
          className="w-full px-3 py-2 border border-border rounded-lg bg-card text-xs font-mono"
        />
        {configError && <p className="text-xs text-rose-700 mt-1">{configError}</p>}
        <p className="text-[10px] text-muted-foreground mt-1">
          {v.channel === "EMAIL" &&
            "Erforderlich: fromEmail, fromName. Optional: replyTo, smtp, signature, pdfLogo."}
          {v.channel === "API" && "Optional: defaultClientId, defaultHeaders, callbackUrl."}
          {v.channel === "EDI" &&
            "Erforderlich: senderId (eigene GLN), senderQualifier (14 = GLN), edifactVersion D.96A. Transport wird je Lieferant konfiguriert (channelConfig.url)."}
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

