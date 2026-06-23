"use client";

import { Fragment, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Row = {
  id: string;
  entity: string;
  entityId: string;
  action: string;
  actorEmail: string;
  ip: string;
  before: unknown;
  after: unknown;
  hash: string;
  prevHash: string;
  createdAt: string;
};

type VerifyResult = {
  ok: boolean;
  entryCount: number;
  rootHash: string | null;
  storedSealRoot: string | null;
  reason?: string;
  firstMismatchAt?: { id: string; createdAt: string } | null;
};

const ACTION_STYLES: Record<string, string> = {
  CREATE: "bg-emerald-50 text-emerald-700",
  UPDATE: "bg-gold-50 text-gold-700",
  DELETE: "bg-rose-50 text-rose-700",
  STATUS_CHANGE: "bg-navy-100 text-navy-700",
  SEND: "bg-navy-100 text-navy-700",
  CANCEL: "bg-rose-50 text-rose-700",
  RECEIVE: "bg-emerald-50 text-emerald-700",
  LOGIN: "bg-muted text-foreground",
  EXPORT: "bg-muted text-foreground",
};

export function AuditView({
  rows,
  total,
  entities,
  filters,
}: {
  rows: Row[];
  total: number;
  entities: string[];
  filters: { entity: string; from: string; to: string };
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [verifyDate, setVerifyDate] = useState(new Date().toISOString().slice(0, 10));
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [verifying, setVerifying] = useState(false);

  function applyFilter(key: string, value: string) {
    const p = new URLSearchParams(sp.toString());
    if (value) p.set(key, value);
    else p.delete(key);
    p.delete("page");
    router.push(`/audit?${p.toString()}`);
  }

  async function runVerify() {
    setVerifying(true);
    setVerifyResult(null);
    const r = await fetch(`/api/v1/audit/verify?date=${verifyDate}`);
    const body = await r.json();
    setVerifying(false);
    if (r.ok) setVerifyResult(body.data);
    else
      setVerifyResult({
        ok: false,
        entryCount: 0,
        rootHash: null,
        storedSealRoot: null,
        reason: body.detail ?? body.title,
      });
  }

  function toggleExpand(id: string) {
    setExpanded((cur) => {
      const n = new Set(cur);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  return (
    <div className="space-y-4 max-w-app">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-foreground">Audit-Journal</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {total} Einträge · Hash-Chain mit SHA-256 + Tages-Sealing
          </p>
        </div>
      </div>

      <Card className="shadow-soft">
        <div className="px-5 py-4 border-b border-border flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm">
              <div className="text-[11px] tracking-[0.18em] uppercase text-muted-foreground mb-1">
                Tag verifizieren
              </div>
              <Input
                type="date"
                value={verifyDate}
                onChange={(e) => setVerifyDate(e.target.value)}
                className="w-44"
              />
            </label>
            <Button
              onClick={runVerify}
              disabled={verifying}
              className="bg-navy-900 hover:bg-navy-700 text-white dark:bg-gold-500 dark:hover:bg-gold-400 dark:text-navy-900 text-sm"
            >
              {verifying ? "Prüfe…" : "Verifizieren"}
            </Button>
          </div>
          {verifyResult && (
            <div
              className={
                "flex-1 min-w-[280px] rounded-lg border p-3 text-sm " +
                (verifyResult.ok
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-rose-200 bg-rose-50 text-rose-700")
              }
            >
              {verifyResult.ok ? (
                <>
                  <strong>✓ Chain intakt.</strong> {verifyResult.entryCount} Einträge geprüft.
                  {verifyResult.rootHash && (
                    <span className="font-mono text-xs ml-2 opacity-70">
                      root={verifyResult.rootHash.slice(0, 12)}…
                    </span>
                  )}
                  {verifyResult.storedSealRoot ? (
                    <span className="ml-2 opacity-70">· Seal vorhanden</span>
                  ) : (
                    <span className="ml-2 opacity-70">· kein Seal</span>
                  )}
                </>
              ) : (
                <>
                  <strong>✗ {verifyResult.reason ?? "Chain-Bruch"}.</strong>
                  {verifyResult.firstMismatchAt && (
                    <span className="ml-2">
                      Erster Fehler bei{" "}
                      {new Date(verifyResult.firstMismatchAt.createdAt).toLocaleString("de-DE")}.
                    </span>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-b border-border flex flex-wrap gap-2 items-center text-sm">
          <select
            className="px-3 py-2 rounded-lg border border-border bg-card"
            value={filters.entity}
            onChange={(e) => applyFilter("entity", e.target.value)}
          >
            <option value="">Alle Entitäten</option>
            {entities.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
          <label className="text-xs text-muted-foreground">
            Von:
            <Input
              type="datetime-local"
              value={filters.from ? filters.from.slice(0, 16) : ""}
              onChange={(e) =>
                applyFilter("from", e.target.value ? new Date(e.target.value).toISOString() : "")
              }
              className="inline-block ml-1 w-48"
            />
          </label>
          <label className="text-xs text-muted-foreground">
            Bis:
            <Input
              type="datetime-local"
              value={filters.to ? filters.to.slice(0, 16) : ""}
              onChange={(e) =>
                applyFilter("to", e.target.value ? new Date(e.target.value).toISOString() : "")
              }
              className="inline-block ml-1 w-48"
            />
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 text-[11px] tracking-[0.16em] uppercase text-muted-foreground">
                <th className="text-left font-medium px-4 py-3">Zeit</th>
                <th className="text-left font-medium px-4 py-3">Aktion</th>
                <th className="text-left font-medium px-4 py-3">Entität</th>
                <th className="text-left font-medium px-4 py-3">Aktor</th>
                <th className="text-left font-medium px-4 py-3">Hash</th>
                <th className="text-right font-medium px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-muted-foreground py-10">
                    Keine Einträge.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <Fragment key={r.id}>
                  <tr className="border-t border-border hover:bg-muted/40">
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleString("de-DE", {
                        dateStyle: "short",
                        timeStyle: "medium",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={ACTION_STYLES[r.action] ?? "bg-muted text-foreground"}>
                        {r.action}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{r.entity}</div>
                      <div className="text-muted-foreground font-mono text-xs truncate max-w-[180px]">
                        {r.entityId}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">{r.actorEmail}</td>
                    <td className="px-4 py-3 font-mono text-[10px]" title={r.hash}>
                      {r.hash.slice(0, 12)}…
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => toggleExpand(r.id)}
                        className="text-xs text-foreground underline hover:text-navy-700"
                      >
                        {expanded.has(r.id) ? "ausblenden" : "anzeigen"}
                      </button>
                    </td>
                  </tr>
                  {expanded.has(r.id) && (
                    <tr className="border-t border-border bg-muted/40">
                      <td colSpan={6} className="px-4 py-3 text-xs">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <div className="text-[10px] tracking-[0.16em] uppercase text-muted-foreground mb-1">
                              Vorher
                            </div>
                            <pre className="font-mono text-xs whitespace-pre-wrap bg-card border border-border rounded p-2">
                              {r.before ? JSON.stringify(r.before, null, 2) : "—"}
                            </pre>
                          </div>
                          <div>
                            <div className="text-[10px] tracking-[0.16em] uppercase text-muted-foreground mb-1">
                              Nachher
                            </div>
                            <pre className="font-mono text-xs whitespace-pre-wrap bg-card border border-border rounded p-2">
                              {r.after ? JSON.stringify(r.after, null, 2) : "—"}
                            </pre>
                          </div>
                        </div>
                        <div className="mt-2 text-[10px] text-muted-foreground font-mono">
                          hash:     {r.hash}
                          <br />
                          prevHash: {r.prevHash}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
