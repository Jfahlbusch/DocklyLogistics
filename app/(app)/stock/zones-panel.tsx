"use client";

import { useConfirm } from "@/components/ui/confirm-dialog";
import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FlashBanner } from "@/components/ui/flash-banner";
import {
  ResponsiveDialog,
  ResponsiveDialogBody,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { ZoneForm, defaultZoneValues } from "./zone-form";

export type ZoneRow = {
  id: string;
  name: string;
  sortOrder: number;
  active: boolean;
  locationCount: number;
  articleCount: number;
};

type FormState = { mode: "create" } | { mode: "edit"; zone: ZoneRow } | null;

const btnPrimary =
  "bg-navy-900 hover:bg-navy-700 text-white dark:bg-gold-500 dark:hover:bg-gold-400 dark:text-navy-900";

function ActiveSwitch({
  checked,
  label,
  disabled,
  onToggle,
}: {
  checked: boolean;
  label: string;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className="inline-flex min-h-11 min-w-11 items-center justify-center md:min-h-8 md:min-w-8 disabled:opacity-50"
    >
      <span
        className={
          "relative inline-block h-6 w-10 rounded-full transition-colors " +
          (checked ? "bg-navy-900 dark:bg-gold-500" : "bg-muted border border-border")
        }
      >
        <span
          className={
            "absolute top-0.5 size-5 rounded-full bg-white shadow transition-all " +
            (checked ? "left-[18px]" : "left-0.5")
          }
        />
      </span>
    </button>
  );
}

export function ZonesPanel({
  initialZones,
  canManage,
  openId,
  rowActions,
}: {
  initialZones: ZoneRow[];
  canManage: boolean;
  /** Zone, die beim Öffnen direkt zum Bearbeiten angezeigt wird (`?open=<id>`). */
  openId?: string;
  /** Slot für zusätzliche Zeilen-/Kartenaktionen (z. B. „QR drucken“); wird in Tabelle und Karte gerendert. */
  rowActions?: (zone: ZoneRow) => ReactNode;
}) {
  const t = useTranslations("zones");
  const confirm = useConfirm();
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [zones, setZones] = useState<ZoneRow[]>(initialZones);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [form, setForm] = useState<FormState>(() => {
    const z = canManage && openId ? initialZones.find((x) => x.id === openId) : undefined;
    return z ? { mode: "edit", zone: z } : null;
  });
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const showActionsColumn = canManage || Boolean(rowActions);

  async function reload() {
    try {
      const r = await fetch("/api/v1/zones");
      if (r.ok) {
        const body = await r.json();
        if (Array.isArray(body?.data)) setZones(body.data);
      }
    } catch {
      setFlash({ ok: false, text: t("errors.loadFailed") });
    }
    startTransition(() => router.refresh());
  }

  async function errorText(r: Response): Promise<string> {
    if (r.status === 409) {
      const body = await r.json().catch(() => ({}));
      return body?.title === "Zone in use" ? t("errors.inUse") : t("errors.nameExists");
    }
    return t("errors.generic");
  }

  function closeForm() {
    setForm(null);
    setFormError(null);
  }

  async function submitForm(values: { name: string; active: boolean }) {
    if (!form) return;
    setFormBusy(true);
    setFormError(null);
    try {
      const create = form.mode === "create";
      const r = await fetch(create ? "/api/v1/zones" : `/api/v1/zones/${form.zone.id}`, {
        method: create ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (r.ok) {
        setFlash({ ok: true, text: t(create ? "flash.created" : "flash.updated", { name: values.name }) });
        closeForm();
        await reload();
      } else {
        setFormError(await errorText(r));
      }
    } catch {
      setFormError(t("errors.generic"));
    } finally {
      setFormBusy(false);
    }
  }

  async function toggleActive(z: ZoneRow) {
    setBusyId(z.id);
    try {
      const r = await fetch(`/api/v1/zones/${z.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !z.active }),
      });
      if (r.ok) await reload();
      else setFlash({ ok: false, text: await errorText(r) });
    } catch {
      setFlash({ ok: false, text: t("errors.generic") });
    } finally {
      setBusyId(null);
    }
  }

  async function remove(z: ZoneRow) {
    if (!(await confirm({ title: t("confirmDelete", { name: z.name }), confirmLabel: "Löschen", destructive: true }))) return;
    setBusyId(z.id);
    try {
      const r = await fetch(`/api/v1/zones/${z.id}`, { method: "DELETE" });
      if (r.status === 204) {
        setFlash({ ok: true, text: t("flash.deleted", { name: z.name }) });
        await reload();
      } else {
        setFlash({ ok: false, text: await errorText(r) });
      }
    } catch {
      setFlash({ ok: false, text: t("errors.generic") });
    } finally {
      setBusyId(null);
    }
  }

  const isCreate = form?.mode === "create";
  const title = isCreate ? t("form.createTitle") : t("form.editTitle");
  const formNode = form && (
    <ZoneForm
      key={form.mode === "edit" ? form.zone.id : "new"}
      initial={form.mode === "edit" ? { name: form.zone.name, active: form.zone.active } : defaultZoneValues}
      isCreate={isCreate}
      busy={formBusy}
      errorMessage={formError}
      onCancel={closeForm}
      onSubmit={submitForm}
    />
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t("subtitle", { count: zones.length })}</p>
        {canManage && zones.length > 0 && (
          <Button
            variant="outline"
            className="h-11 text-sm md:h-8"
            onClick={() => {
              setForm({ mode: "create" });
              setFormError(null);
            }}
          >
            {t("actions.create")}
          </Button>
        )}
      </div>

      <FlashBanner flash={flash} />

      <Card className="shadow-soft">
        {zones.length === 0 ? (
          <div className="flex flex-col items-center gap-4 px-4 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              {canManage ? t("empty.text") : t("empty.readOnly")}
            </p>
            {canManage && (
              <Button
                className={"h-11 md:h-8 " + btnPrimary}
                onClick={() => {
                  setForm({ mode: "create" });
                  setFormError(null);
                }}
              >
                {t("actions.createFirst")}
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 text-[11px] tracking-[0.16em] uppercase text-muted-foreground">
                    <th className="text-left font-medium px-4 py-3">{t("columns.name")}</th>
                    <th className="text-left font-medium px-4 py-3">{t("columns.locations")}</th>
                    <th className="text-left font-medium px-4 py-3">{t("columns.articles")}</th>
                    <th className="text-left font-medium px-4 py-3">{t("columns.active")}</th>
                    {showActionsColumn && (
                      <th className="text-right font-medium px-4 py-3">{t("columns.actions")}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {zones.map((z) => (
                    <tr key={z.id} className="border-t border-border">
                      <td className="px-4 py-3 font-medium text-foreground">{z.name}</td>
                      <td className="px-4 py-3 tabular-nums">{z.locationCount}</td>
                      <td className="px-4 py-3 tabular-nums">{z.articleCount}</td>
                      <td className="px-4 py-1">
                        {canManage ? (
                          <ActiveSwitch
                            checked={z.active}
                            label={t("actions.toggleActive", { name: z.name })}
                            disabled={busyId === z.id}
                            onToggle={() => toggleActive(z)}
                          />
                        ) : (
                          <span className="text-muted-foreground">
                            {z.active ? t("status.active") : t("status.inactive")}
                          </span>
                        )}
                      </td>
                      {showActionsColumn && (
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-3">
                            {rowActions?.(z)}
                            {canManage && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setForm({ mode: "edit", zone: z });
                                    setFormError(null);
                                  }}
                                  className="text-xs text-foreground underline hover:text-navy-700"
                                >
                                  {t("actions.rename")}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => remove(z)}
                                  disabled={busyId === z.id}
                                  className="text-xs text-rose-700 underline hover:text-rose-900"
                                >
                                  {t("actions.delete")}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-border md:hidden">
              {zones.map((z) => (
                <li key={z.id} className="flex flex-col gap-2 px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground">{z.name}</span>
                    {canManage ? (
                      <ActiveSwitch
                        checked={z.active}
                        label={t("actions.toggleActive", { name: z.name })}
                        disabled={busyId === z.id}
                        onToggle={() => toggleActive(z)}
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {z.active ? t("status.active") : t("status.inactive")}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t("cardCounts", { locations: z.locationCount, articles: z.articleCount })}
                  </div>
                  {(canManage || rowActions) && (
                    <div className="flex flex-wrap items-center gap-2">
                      {rowActions?.(z)}
                      {canManage && (
                        <>
                          <Button
                            variant="outline"
                            className="h-11 text-sm"
                            onClick={() => {
                              setForm({ mode: "edit", zone: z });
                              setFormError(null);
                            }}
                          >
                            {t("actions.rename")}
                          </Button>
                          <Button
                            variant="outline"
                            className="h-11 text-sm text-rose-700"
                            disabled={busyId === z.id}
                            onClick={() => remove(z)}
                          >
                            {t("actions.delete")}
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <ResponsiveDialog open={form !== null} onOpenChange={(o) => !o && closeForm()}>
        <ResponsiveDialogContent size="md">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="font-display text-2xl text-foreground">{title}</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>{t("form.description")}</ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <ResponsiveDialogBody className="pb-4">{formNode}</ResponsiveDialogBody>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  );
}
