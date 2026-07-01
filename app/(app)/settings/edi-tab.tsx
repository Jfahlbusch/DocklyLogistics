"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FlashBanner } from "@/components/ui/flash-banner";

type EdiSettings = {
  inboundToken: string;
  inboundActive: boolean;
  autoConfirm: boolean;
  inboundPath: string;
};

/**
 * Einstellungen → EDI: the tenant's inbound mailbox (partners POST raw EDIFACT
 * here) and processing flags. The tenant's own identity (GLN/qualifier) lives
 * in the EDI Versandprofil on the Versand tab; the partner's GLN lives on the
 * supplier (channelConfig.partnerId).
 */
export function EdiTab({ canManage }: { canManage: boolean }) {
  const [settings, setSettings] = useState<EdiSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    fetch("/api/v1/settings/edi")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((b) => setSettings(b.data as EdiSettings))
      .catch(() => setError("EDI-Einstellungen konnten nicht geladen werden."));
  }, []);

  async function patch(update: { inboundActive?: boolean; autoConfirm?: boolean }) {
    setBusy(true);
    try {
      const r = await fetch("/api/v1/settings/edi", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      });
      const b = await r.json().catch(() => ({}));
      if (r.ok) {
        setSettings(b.data as EdiSettings);
        setFlash({ ok: true, text: "EDI-Einstellungen gespeichert" });
      } else {
        setFlash({ ok: false, text: b.detail ?? b.title ?? "Speichern fehlgeschlagen" });
      }
    } finally {
      setBusy(false);
    }
  }

  async function rotate() {
    if (!confirm("Postfach-Token wirklich rotieren? Der alte Endpunkt ist sofort ungültig — Partner müssen die neue URL erhalten.")) return;
    setBusy(true);
    try {
      const r = await fetch("/api/v1/settings/edi/rotate-token", { method: "POST" });
      const b = await r.json().catch(() => ({}));
      if (r.ok) {
        setSettings(b.data as EdiSettings);
        setFlash({ ok: true, text: "Neuer Postfach-Token erzeugt" });
      } else {
        setFlash({ ok: false, text: b.detail ?? b.title ?? "Rotation fehlgeschlagen" });
      }
    } finally {
      setBusy(false);
    }
  }

  async function copyUrl() {
    if (!settings) return;
    await navigator.clipboard.writeText(`${origin}${settings.inboundPath}`);
    setFlash({ ok: true, text: "Postfach-URL kopiert" });
  }

  if (error) {
    return <Card className="shadow-soft"><CardContent className="py-8 text-center text-muted-foreground">{error}</CardContent></Card>;
  }
  if (!settings) {
    return <Card className="shadow-soft"><CardContent className="py-8 text-center text-muted-foreground">Lade EDI-Einstellungen…</CardContent></Card>;
  }

  const inboundUrl = `${origin}${settings.inboundPath}`;

  return (
    <div className="space-y-4">
      <FlashBanner flash={flash} />

      <Card className="shadow-soft">
        <CardContent className="space-y-4 p-5">
          <div>
            <h3 className="font-display text-lg text-foreground">EDI-Postfach (Eingang)</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Partner senden EDIFACT-Nachrichten (ORDRSP-Bestellbestätigungen, ORDERS) als
              HTTP-POST mit dem Roh-Inhalt (text/plain) an diese URL. Der Token in der URL
              ist die Zugangsberechtigung — vertraulich behandeln.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 truncate rounded-lg border border-border bg-muted/30 px-3 py-2 font-mono text-xs">
              {inboundUrl}
            </code>
            <div className="flex gap-2">
              <Button variant="outline" className="text-xs" onClick={copyUrl}>Kopieren</Button>
              {canManage && (
                <Button variant="outline" className="text-xs text-danger" disabled={busy} onClick={rotate}>
                  Token rotieren
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-3 border-t border-border pt-4">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4"
                checked={settings.inboundActive}
                disabled={!canManage || busy}
                onChange={(e) => patch({ inboundActive: e.target.checked })}
              />
              <span>
                <span className="block text-sm font-medium text-foreground">Postfach aktiv</span>
                <span className="block text-xs text-muted-foreground">
                  Deaktiviert lehnt der Endpunkt alle eingehenden Nachrichten mit 401 ab.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4"
                checked={settings.autoConfirm}
                disabled={!canManage || busy}
                onChange={(e) => patch({ autoConfirm: e.target.checked })}
              />
              <span>
                <span className="block text-sm font-medium text-foreground">Bestellbestätigungen automatisch verbuchen</span>
                <span className="block text-xs text-muted-foreground">
                  Eine eingehende ORDRSP setzt die referenzierte Bestellung automatisch auf CONFIRMED
                  (Audit + Webhook inklusive). Deaktiviert wird nur archiviert und benachrichtigt.
                </span>
              </span>
            </label>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardContent className="space-y-2 p-5 text-sm">
          <h3 className="font-display text-lg text-foreground">So ist EDI verdrahtet</h3>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>
              <span className="text-foreground">Eigene Identität (GLN):</span> im Tab „Versand“ als
              EDI-Versandprofil pflegen (senderId/senderQualifier).
            </li>
            <li>
              <span className="text-foreground">Partner-GLN & Transport:</span> beim Lieferanten
              (Kanal EDI) im Feld channelConfig als JSON, z. B.{" "}
              <code className="font-mono text-xs">{'{ "partnerId": "4012345000009", "url": "https://edi.partner.de/inbox" }'}</code>
              {" "}— ohne url wird die Datei im Abholverzeichnis bereitgestellt.
            </li>
            <li>
              <span className="text-foreground">Ausgang:</span> Bestellung senden (Kanal EDI) erzeugt
              eine EDIFACT ORDERS D.96A — einsehbar im Bereich „EDI“.
            </li>
            <li>
              <span className="text-foreground">Eingang:</span> ORDRSP bestätigt die referenzierte
              Bestellung, eingehende ORDERS werden geparst und den Artikeln (EAN/SKU) zugeordnet.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
