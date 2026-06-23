"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { FlashBanner } from "@/components/ui/flash-banner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Settings = { logoDataUri: string | null; headerText: string | null; footerText: string | null };

const LABEL = "text-[11px] tracking-[0.18em] uppercase text-muted-foreground mb-1";
const FIELD = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";

export function PdfTab({ canManage }: { canManage: boolean }) {
  const [logo, setLogo] = useState<string | null>(null);
  const [headerText, setHeaderText] = useState("");
  const [footerText, setFooterText] = useState("");
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/v1/settings/pdf")
      .then((r) => r.json())
      .then((b) => {
        const s = (b.data ?? {}) as Settings;
        setLogo(s.logoDataUri);
        setHeaderText(s.headerText ?? "");
        setFooterText(s.footerText ?? "");
      })
      .finally(() => setLoaded(true));
  }, []);

  function onPickLogo(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return setFlash({ ok: false, text: "Bitte eine Bilddatei wählen." });
    if (file.size > 300_000) return setFlash({ ok: false, text: "Logo ist zu groß (max. 300 KB)." });
    const reader = new FileReader();
    reader.onload = () => setLogo(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function save() {
    setSaving(true);
    try {
      const r = await fetch("/api/v1/settings/pdf", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoDataUri: logo ?? "", headerText, footerText }),
      });
      if (r.ok) setFlash({ ok: true, text: "Gespeichert. Nutze die Vorschau zum Prüfen." });
      else {
        const b = await r.json().catch(() => ({}));
        setFlash({ ok: false, text: b?.error?.message ?? "Speichern fehlgeschlagen." });
      }
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return <div className="text-sm text-muted-foreground">Lädt…</div>;

  return (
    <div className="space-y-4">
      <FlashBanner flash={flash} />
      <Card>
        <CardContent className="space-y-5 pt-5">
          <div>
            <div className={LABEL}>Briefkopf-Logo</div>
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-40 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/30">
                {logo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Daten-URI-Vorschau, kein optimierbares Asset
                  <img src={logo} alt="Logo-Vorschau" className="max-h-14 max-w-[150px] object-contain" />
                ) : (
                  <span className="text-xs text-muted-foreground">kein Logo</span>
                )}
              </div>
              {canManage && (
                <div className="flex flex-col items-start gap-2">
                  <label className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-border bg-background px-3 py-1.5 text-sm transition-colors hover:bg-muted">
                    Bild wählen
                    <input type="file" accept="image/*" className="hidden" onChange={onPickLogo} />
                  </label>
                  {logo && (
                    <button onClick={() => setLogo(null)} className="text-xs text-muted-foreground hover:text-foreground">
                      entfernen
                    </button>
                  )}
                </div>
              )}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              PNG/JPG, max. 300 KB. Ersetzt die Standard-Marke im Kopf des Bestellscheins.
            </p>
          </div>

          <label className="block text-sm">
            <div className={LABEL}>Briefkopf-Zusatz</div>
            <textarea
              value={headerText}
              onChange={(e) => setHeaderText(e.target.value)}
              rows={2}
              disabled={!canManage}
              placeholder="z.B. Adresse oder Slogan – eine Zeile je Zeilenumbruch"
              className={FIELD}
            />
          </label>

          <label className="block text-sm">
            <div className={LABEL}>Brieffuß</div>
            <textarea
              value={footerText}
              onChange={(e) => setFooterText(e.target.value)}
              rows={3}
              disabled={!canManage}
              placeholder="z.B. Bankverbindung, USt-IdNr., Kontakt – eine Zeile je Zeilenumbruch"
              className={FIELD}
            />
          </label>

          <div className="flex items-center gap-4 pt-1">
            {canManage && (
              <Button onClick={save} disabled={saving}>
                {saving ? "Speichert…" : "Speichern"}
              </Button>
            )}
            <a
              href="/api/v1/settings/pdf/preview"
              target="_blank"
              rel="noreferrer"
              className="text-sm text-navy-700 hover:underline dark:text-gold-400"
            >
              Vorschau öffnen ↗
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
