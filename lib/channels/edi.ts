import fs from "node:fs/promises";
import path from "node:path";
import type { DispatchInput, DispatchResult } from "./types";

const MOCK_DIR = "/tmp/docklylogistics-edi";

type EdiTenantCfg = { senderId: string; senderQualifier: string; edifactVersion: string };
type EdiSupplierCfg = { partnerId?: string };

/**
 * Build a minimal EDIFACT D.96A ORDERS message. Real production EDI would use
 * a proper EDIFACT library — for M4 we emit a representative envelope.
 */
function buildEdifact(input: DispatchInput, tenant: EdiTenantCfg, supplier: EdiSupplierCfg): string {
  const o = input.order;
  const lines: string[] = [];
  const now = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const nowTime = new Date().toISOString().slice(11, 16).replace(":", "");
  const interchangeRef = `IC${o.orderNo}`.replace(/[^A-Z0-9]/g, "").slice(0, 14);
  const messageRef = `MSG${o.orderNo}`.replace(/[^A-Z0-9]/g, "").slice(0, 14);

  lines.push(`UNB+UNOC:3+${tenant.senderId}:${tenant.senderQualifier}+${supplier.partnerId ?? "PARTNER"}:14+${now}:${nowTime}+${interchangeRef}'`);
  lines.push(`UNH+${messageRef}+ORDERS:D:96A:UN'`);
  lines.push(`BGM+220+${o.orderNo}+9'`);
  lines.push(`DTM+137:${now}:102'`);
  lines.push(`NAD+BY+${tenant.senderId}::9'`);
  lines.push(`NAD+SU+${supplier.partnerId ?? tenant.senderId}::9'`);
  lines.push(`CUX+2:${o.currency}:9'`);
  let lineCount = 0;
  for (let i = 0; i < o.items.length; i++) {
    const it = o.items[i];
    lineCount++;
    lines.push(`LIN+${lineCount}++${it.article.sku}:SA'`);
    lines.push(`IMD+F++:::${it.article.name}'`);
    lines.push(`QTY+21:${it.qtyOrderUnit}'`);
    lines.push(`PRI+AAA:${Number(it.unitPrice).toFixed(4)}'`);
  }
  lines.push(`UNS+S'`);
  lines.push(`CNT+2:${lineCount}'`);
  lines.push(`UNT+${lines.length - 1}+${messageRef}'`);
  lines.push(`UNZ+1+${interchangeRef}'`);
  return lines.join("\n");
}

export async function dispatchEdi(input: DispatchInput): Promise<DispatchResult> {
  const tenant = (input.tenantCfg?.config ?? {}) as EdiTenantCfg;
  if (!tenant.senderId || !tenant.senderQualifier || !tenant.edifactVersion) {
    return { channel: "EDI", ok: false, message: "TenantChannelConfig EDI unvollständig (senderId/senderQualifier/edifactVersion fehlen)." };
  }
  const supplier = (input.order.supplier.channelConfig ?? {}) as EdiSupplierCfg;
  const edifact = buildEdifact(input, tenant, supplier);

  await fs.mkdir(MOCK_DIR, { recursive: true });
  const filePath = path.join(MOCK_DIR, `${input.order.orderNo}.edi`);
  await fs.writeFile(filePath, edifact);
  return { channel: "EDI", ok: true, message: `EDIFACT D.96A-Datei geschrieben (Mock-SFTP).`, details: { mockPath: filePath, bytes: edifact.length } };
}
