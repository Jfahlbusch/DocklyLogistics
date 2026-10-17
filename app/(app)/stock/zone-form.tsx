"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormField as Field } from "@/components/ui/form-field";

export type ZoneFormValues = { name: string; active: boolean };

export const defaultZoneValues: ZoneFormValues = { name: "", active: true };

type Props = {
  initial: ZoneFormValues;
  isCreate: boolean;
  busy: boolean;
  errorMessage?: string | null;
  onSubmit: (values: ZoneFormValues) => Promise<void>;
  onCancel: () => void;
};

export function ZoneForm({ initial, isCreate, busy, errorMessage, onSubmit, onCancel }: Props) {
  const t = useTranslations("zones.form");
  const [v, setV] = useState<ZoneFormValues>(initial);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void onSubmit({ ...v, name: v.name.trim() });
      }}
      className="space-y-4"
    >
      <Field label={t("name")} required>
        <Input
          value={v.name}
          onChange={(e) => setV((cur) => ({ ...cur, name: e.target.value }))}
          required
          maxLength={80}
          autoFocus
          className="h-11 md:h-9"
        />
      </Field>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-5 md:size-4"
          checked={v.active}
          onChange={(e) => setV((cur) => ({ ...cur, active: e.target.checked }))}
        />
        {t("active")}
      </label>

      {errorMessage && (
        <div role="alert" className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
          {errorMessage}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy} className="h-11 md:h-8">
          {t("cancel")}
        </Button>
        <Button
          type="submit"
          disabled={busy}
          className="h-11 md:h-8 bg-navy-900 hover:bg-navy-700 text-white dark:bg-gold-500 dark:hover:bg-gold-400 dark:text-navy-900"
        >
          {busy ? t("saving") : isCreate ? t("create") : t("save")}
        </Button>
      </div>
    </form>
  );
}
