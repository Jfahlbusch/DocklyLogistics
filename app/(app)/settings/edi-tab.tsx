"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FlashBanner } from "@/components/ui/flash-banner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

type EdiSettings = {
  inboundToken: string;
  inboundActive: boolean;
  autoConfirm: boolean;
  inboundPath: string;
};

type PartnerRow = {
  id: string;
  name: string;
  partnerGln: string | null;
  supplierId: string | null;
  supplierName: string | null;
  token: string;
  inboundPath: string;
  active: boolean;
  lastUsedAt: string | null;
  as2Id: string | null;
  as2Url: string | null;
  as2CertPresent: boolean;
};

type As2Identity = {
  as2Id: string;
  certificatePem: string;
  fingerprintSha256: string;
  endpointPath: string;
};

type SupplierOption = { id: string; name: string };

function fmt(d: string | null) {
  return d ? new Date(d).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }) : "nie";
}

/**
 * Einstellungen → EDI: per-partner mailboxes (individually revocable tokens,
 * sender-GLN pinning, supplier binding) plus the legacy tenant-wide mailbox
 * and processing flags. The tenant's own identity (GLN) lives in the EDI
 * Versandprofil on the Versand tab.
 */
export function EdiTab({ canManage }: { canManage: boolean }) {
  const [settings, setSettings] = useState<EdiSettings | null>(null);
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [origin, setOrigin] = useState("");
  const [as2, setAs2] = useState<As2Identity | null>(null);
  const [draft, setDraft] = useState<null | { id?: string; hadCert?: boolean; name: string; partnerGln: string; supplierId: string; as2Id: string; as2Url: string; as2Cert: string }>(null);

  async function refreshPartners() {
    const r = await fetch("/api/v1/settings/edi/partners");
    if (r.ok) setPartners((await r.json()).data as PartnerRow[]);
  }

  useEffect(() => {
    setOrigin(window.location.origin);
    Promise.all([
      fetch("/api/v1/settings/edi").then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))),
      fetch("/api/v1/settings/edi/partners").then((r) => (r.ok ? r.json() : { data: [] })),
      fetch("/api/v1/suppliers?pageSize=200").then((r) => (r.ok ? r.json() : { data: [] })),
      fetch("/api/v1/settings/edi/as2-identity").then((r) => (r.ok ? r.json() : { data: null })),
    ])
      .then(([s, p, su, a2]) => {
        setSettings(s.data as EdiSettings);
        setPartners((p.data ?? []) as PartnerRow[]);
        setSuppliers(((su.data ?? []) as Array<{ id: string; name: string }>).map(({ id, name }) => ({ id, name })));
        setAs2((a2.data ?? null) as As2Identity | null);
      })
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

  async function rotateTenantToken() {
    if (!confirm("Allgemeines Postfach rotieren? Der alte Endpunkt ist sofort ungültig — alle Partner, die ihn nutzen, brauchen die neue URL.")) return;
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

  async function copy(text: string, label: string) {
    await navigator.clipboard.writeText(text);
    setFlash({ ok: true, text: `${label} kopiert` });
  }

  async function generateAs2() {
    if (as2 && !confirm("AS2-Identität erneuern? Das alte Zertifikat wird ungültig — alle AS2-Partner brauchen das neue.")) return;
    setBusy(true);
    try {
      const r = await fetch("/api/v1/settings/edi/as2-identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const b = await r.json().catch(() => ({}));
      if (r.ok) {
        setAs2(b.data as As2Identity);
        setFlash({ ok: true, text: "AS2-Identität erzeugt — Zertifikat an Partner verteilen" });
      } else {
        setFlash({ ok: false, text: b.detail ?? b.title ?? "Erzeugen fehlgeschlagen" });
      }
    } finally {
      setBusy(false);
    }
  }

  /* ---------- partner mailboxes ---------- */

  async function savePartner() {
    if (!draft) return;
    setBusy(true);
    try {
      const isEdit = !!draft.id;
      const payload: {
        name: string; partnerGln: string | null; supplierId: string | null;
        as2Id: string | null; as2Url: string | null; as2CertificatePem?: string | null;
      } = {
        name: draft.name,
        partnerGln: draft.partnerGln.trim() || null,
        supplierId: draft.supplierId || null,
        as2Id: draft.as2Id.trim() || null,
        as2Url: draft.as2Url.trim() || null,
      };
      // On edit, an empty certificate field keeps the stored one; on create send it (or null).
      if (!isEdit || draft.as2Cert.trim()) {
        payload.as2CertificatePem = draft.as2Cert.trim() || null;
      }
      const r = await fetch(
        isEdit ? `/api/v1/settings/edi/partners/${draft.id}` : "/api/v1/settings/edi/partners",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const b = await r.json().catch(() => ({}));
      if (isEdit ? r.ok : r.status === 201) {
        setFlash({ ok: true, text: isEdit ? `„${draft.name}“ gespeichert` : `Partner-Postfach „${draft.name}“ angelegt` });
        setDraft(null);
        refreshPartners();
      } else {
        setFlash({ ok: false, text: b.detail ?? b.title ?? "Speichern fehlgeschlagen" });
      }
    } finally {
      setBusy(false);
    }
  }

  async function togglePartner(p: PartnerRow) {
    const r = await fetch(`/api/v1/settings/edi/partners/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !p.active }),
    });
    if (r.ok) {
      setFlash({ ok: true, text: !p.active ? `„${p.name}“ aktiviert` : `„${p.name}“ gesperrt` });
      refreshPartners();
    }
  }

  async function rotatePartner(p: PartnerRow) {
    if (!confirm(`Token für „${p.name}“ rotieren? Der alte Endpunkt ist sofort ungültig — nur dieser Partner braucht die neue URL.`)) return;
    const r = await fetch(`/api/v1/settings/edi/partners/${p.id}/rotate-token`, { method: "POST" });
    if (r.ok) {
      setFlash({ ok: true, text: `Neuer Token für „${p.name}“` });
      refreshPartners();
    }
  }

  async function deletePartner(p: PartnerRow) {
    if (!confirm(`Partner-Postfach „${p.name}“ löschen? Der Token ist sofort ungültig.`)) return;
    const r = await fetch(`/api/v1/settings/edi/partners/${p.id}`, { method: "DELETE" });
    if (r.status === 204) {
      setFlash({ ok: true, text: `„${p.name}“ gelöscht` });
      refreshPartners();
    }
  }

  if (error) {
    return <Card className="shadow-soft"><CardContent className="py-8 text-center text-muted-foreground">{error}</CardContent></Card>;
  }
  if (!settings) {
    return <Card className="shadow-soft"><CardContent className="py-8 text-center text-muted-foreground">Lade EDI-Einstellungen…</CardContent></Card>;
  }

  return (
    <div className="space-y-4">
      <FlashBanner flash={flash} />

      {/* Partner-Postfächer — der empfohlene Weg */}
      <Card className="shadow-soft">
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="font-display text-lg text-foreground">Partner-Postfächer</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Empfohlen: eine eigene Postfach-Adresse je Partner — einzeln sperr- und rotierbar.
                Optional wird der Absender (GLN) geprüft und Bestätigungen auf die Bestellungen
                des verknüpften Lieferanten beschränkt.
              </p>
            </div>
            {canManage && (
              <Button
                onClick={() => setDraft({ name: "", partnerGln: "", supplierId: "", as2Id: "", as2Url: "", as2Cert: "" })}
                className="bg-navy-900 hover:bg-navy-700 text-white dark:bg-gold-500 dark:hover:bg-gold-400 dark:text-navy-900"
              >
                + Partner-Postfach
              </Button>
            )}
          </div>

          <div className="divide-y divide-border rounded-lg border border-border">
            {partners.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                Noch keine Partner-Postfächer.
              </div>
            )}
            {partners.map((p) => (
              <div key={p.id} className="flex flex-col gap-2 px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-medium text-foreground">{p.name}</span>
                    <span
                      className={
                        "ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium " +
                        (p.active ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")
                      }
                    >
                      {p.active ? "aktiv" : "gesperrt"}
                    </span>
                  </div>
                  {canManage && (
                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        variant="outline"
                        className="px-2 py-1 text-xs"
                        onClick={() =>
                          setDraft({
                            id: p.id,
                            hadCert: p.as2CertPresent,
                            name: p.name,
                            partnerGln: p.partnerGln ?? "",
                            supplierId: p.supplierId ?? "",
                            as2Id: p.as2Id ?? "",
                            as2Url: p.as2Url ?? "",
                            as2Cert: "",
                          })
                        }
                      >
                        Bearbeiten
                      </Button>
                      <Button variant="outline" className="px-2 py-1 text-xs" onClick={() => copy(`${origin}${p.inboundPath}`, `URL für „${p.name}“`)}>
                        URL kopieren
                      </Button>
                      <Button variant="outline" className="px-2 py-1 text-xs" onClick={() => rotatePartner(p)}>
                        Rotieren
                      </Button>
                      <Button variant="outline" className="px-2 py-1 text-xs" onClick={() => togglePartner(p)}>
                        {p.active ? "Sperren" : "Aktivieren"}
                      </Button>
                      <Button variant="outline" className="px-2 py-1 text-xs text-danger" onClick={() => deletePartner(p)}>
                        Löschen
                      </Button>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  {p.partnerGln ? <span>GLN <span className="font-mono">{p.partnerGln}</span></span> : <span>keine GLN-Prüfung</span>}
                  <span>· {p.supplierName ? `Lieferant: ${p.supplierName}` : "kein Lieferant verknüpft"}</span>
                  {p.as2Id && (
                    <span className="inline-flex items-center rounded-full bg-navy-100 px-2 py-0.5 text-[10px] font-medium text-navy-700">
                      AS2{p.as2CertPresent ? " ✓" : " (Zertifikat fehlt)"}
                    </span>
                  )}
                  <span>· zuletzt genutzt: {fmt(p.lastUsedAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* AS2-Identität (Zertifikate + MDN) */}
      <Card className="shadow-soft">
        <CardContent className="space-y-4 p-5">
          <div>
            <h3 className="font-display text-lg text-foreground">AS2 (Zertifikate & MDN)</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Für Partner, die AS2 verlangen: Nachrichten werden S/MIME-verschlüsselt und
              signiert, der Empfang mit einer signierten Quittung (MDN) bestätigt.
              AS2-Endpunkt: <code className="font-mono text-xs">{origin}/api/edi/as2</code>
            </p>
          </div>

          {!as2 ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3">
              <span className="text-sm text-muted-foreground">Noch keine AS2-Identität erzeugt.</span>
              {canManage && (
                <Button disabled={busy} onClick={generateAs2} className="bg-navy-900 hover:bg-navy-700 text-white dark:bg-gold-500 dark:hover:bg-gold-400 dark:text-navy-900 text-xs">
                  {busy ? "Erzeuge…" : "AS2-Identität erzeugen"}
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                <div>
                  <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">AS2-ID</span>
                  <div className="font-mono text-xs">{as2.as2Id}</div>
                </div>
                <div className="min-w-0">
                  <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Zertifikat-Fingerprint (SHA-256)</span>
                  <div className="truncate font-mono text-[11px]">{as2.fingerprintSha256}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button variant="outline" className="text-xs" onClick={() => copy(as2.certificatePem, "Zertifikat (PEM)")}>
                  Zertifikat kopieren
                </Button>
                <Button variant="outline" className="text-xs" onClick={() => copy(as2.as2Id, "AS2-ID")}>
                  AS2-ID kopieren
                </Button>
                {canManage && (
                  <Button variant="outline" className="text-xs text-danger" disabled={busy} onClick={generateAs2}>
                    Identität erneuern
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Zertifikat + AS2-ID an den Partner geben; dessen Zertifikat, AS2-ID und URL im
                Partner-Postfach hinterlegen — der Versand nutzt AS2 dann automatisch.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Allgemeines Tenant-Postfach (Fallback) */}
      <Card className="shadow-soft">
        <CardContent className="space-y-4 p-5">
          <div>
            <h3 className="font-display text-lg text-foreground">Allgemeines Postfach (Fallback)</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Gemeinsame Adresse ohne Partner-Bindung — der Token ist ein geteiltes Geheimnis
              aller Nutzer. Für neue Anbindungen besser ein Partner-Postfach oben anlegen.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 truncate rounded-lg border border-border bg-muted/30 px-3 py-2 font-mono text-xs">
              {origin}{settings.inboundPath}
            </code>
            <div className="flex gap-2">
              <Button variant="outline" className="text-xs" onClick={() => copy(`${origin}${settings.inboundPath}`, "Postfach-URL")}>Kopieren</Button>
              {canManage && (
                <Button variant="outline" className="text-xs text-danger" disabled={busy} onClick={rotateTenantToken}>
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
                <span className="block text-sm font-medium text-foreground">Allgemeines Postfach aktiv</span>
                <span className="block text-xs text-muted-foreground">
                  Betrifft nur diese gemeinsame Adresse — Partner-Postfächer werden einzeln gesperrt.
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
                  (Audit + Webhook inklusive). Gilt für alle Postfächer dieses Tenants.
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
              <span className="text-foreground">Empfang:</span> Jeder Partner sendet EDIFACT per
              HTTP-POST (text/plain) an sein Partner-Postfach. ORDRSP bestätigt die referenzierte
              Bestellung (bei Lieferanten-Bindung nur dessen eigene), eingehende ORDERS werden
              geparst und den Artikeln (EAN/SKU) zugeordnet.
            </li>
            <li>
              <span className="text-foreground">Ausgang an Lieferanten:</span> beim Lieferanten
              (Kanal EDI) im Feld channelConfig als JSON, z. B.{" "}
              <code className="font-mono text-xs">{'{ "partnerId": "4012345000009", "url": "https://edi.partner.de/inbox" }'}</code>
              {" "}— ohne url wird die Datei im Abholverzeichnis bereitgestellt.
            </li>
            <li>
              <span className="text-foreground">Monitor:</span> Jede Nachricht (ein- und ausgehend)
              ist im Bereich „EDI“ einsehbar — inkl. Payload, Zuordnung und Fehlergrund.
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Anlege-Dialog */}
      <Dialog open={draft !== null} onOpenChange={(o) => { if (!o) setDraft(null); }}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">{draft?.id ? "Partner-Postfach bearbeiten" : "Neues Partner-Postfach"}</DialogTitle>
            <DialogDescription>
              {draft?.id
                ? "Änderungen wirken sofort. Der Postfach-Token bleibt unverändert (zum Rotieren den Button in der Liste nutzen)."
                : "Der Partner erhält eine eigene Empfangs-URL. GLN und Lieferant sind optional, erhöhen aber die Sicherheit (Absender-Prüfung, Bestätigungs-Bindung)."}
            </DialogDescription>
          </DialogHeader>
          {draft && (
            <div className="space-y-3 text-sm">
              <div>
                <label className="mb-1 block text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Name *</label>
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="z. B. Großmühle Weizenkamp"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Partner-GLN (Absender-Prüfung)</label>
                <Input
                  value={draft.partnerGln}
                  onChange={(e) => setDraft({ ...draft, partnerGln: e.target.value })}
                  placeholder="optional, z. B. 4012345000009"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Lieferant verknüpfen</label>
                <select
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                  value={draft.supplierId}
                  onChange={(e) => setDraft({ ...draft, supplierId: e.target.value })}
                >
                  <option value="">— kein Lieferant (z. B. Kunde) —</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-muted-foreground">
                  Verknüpft darf dieses Postfach nur Bestellungen dieses Lieferanten bestätigen.
                </p>
              </div>
              <div className="space-y-3 border-t border-border pt-3">
                <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">AS2 (optional)</div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[11px] uppercase tracking-[0.16em] text-muted-foreground">AS2-ID des Partners</label>
                    <Input
                      value={draft.as2Id}
                      onChange={(e) => setDraft({ ...draft, as2Id: e.target.value })}
                      placeholder="z. B. PARTNER-AS2"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] uppercase tracking-[0.16em] text-muted-foreground">AS2-URL des Partners</label>
                    <Input
                      value={draft.as2Url}
                      onChange={(e) => setDraft({ ...draft, as2Url: e.target.value })}
                      placeholder="https://as2.partner.de/receive"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Partner-Zertifikat (PEM)</label>
                  <textarea
                    value={draft.as2Cert}
                    onChange={(e) => setDraft({ ...draft, as2Cert: e.target.value })}
                    placeholder={
                      draft.id && draft.hadCert
                        ? "Zertifikat vorhanden — leer lassen zum Behalten, neues PEM einfügen zum Ersetzen"
                        : "-----BEGIN CERTIFICATE-----"
                    }
                    rows={4}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 font-mono text-xs"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {draft.id && draft.hadCert
                      ? "Ein Zertifikat ist hinterlegt — leer lassen behält es, ein neues PEM ersetzt es. "
                      : ""}
                    Mit AS2-ID + Zertifikat + URL läuft der Versand an diesen Partner automatisch
                    verschlüsselt/signiert über AS2 (statt einfachem HTTPS).
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="outline" onClick={() => setDraft(null)}>Abbrechen</Button>
                <Button
                  disabled={busy || draft.name.trim().length === 0}
                  onClick={savePartner}
                  className="bg-navy-900 hover:bg-navy-700 text-white dark:bg-gold-500 dark:hover:bg-gold-400 dark:text-navy-900"
                >
                  {busy ? "Speichere…" : draft.id ? "Speichern" : "Anlegen"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
