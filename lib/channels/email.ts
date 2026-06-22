import fs from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";
import type { DispatchInput, DispatchResult } from "./types";
import { getScalewayTemConfig, sendViaScalewayTem } from "./scaleway-mail";

const MOCK_DIR = "/tmp/docklylogistics-mail";

type EmailTenantCfg = {
  fromEmail: string;
  fromName: string;
  replyTo?: string;
  smtp?: { host: string; port: number; user: string; pass: string; secure?: boolean };
  signature?: string;
};

type EmailSupplierCfg = {
  to?: string;
  cc?: string[];
  subject?: string;
};

export async function dispatchEmail(input: DispatchInput): Promise<DispatchResult> {
  const tenant = (input.tenantCfg?.config ?? {}) as EmailTenantCfg;
  const supplier = (input.order.supplier.channelConfig ?? {}) as EmailSupplierCfg;

  const to = supplier.to ?? input.order.supplier.email;
  if (!to) {
    return { channel: "EMAIL", ok: false, message: "Empfänger-Mailadresse fehlt (Supplier.channelConfig.to oder Supplier.email)." };
  }
  if (!tenant.fromEmail) {
    return { channel: "EMAIL", ok: false, message: "Absender-Mailadresse fehlt (TenantChannelConfig EMAIL fromEmail)." };
  }

  const subject = supplier.subject ?? `Bestellung ${input.order.orderNo}`;
  const text =
    `Sehr geehrte Damen und Herren,\n\n` +
    `anbei unsere Bestellung ${input.order.orderNo} (siehe PDF-Anhang).\n` +
    (input.order.notes ? `\nNotiz: ${input.order.notes}\n` : "") +
    `\n${tenant.signature ?? "Mit freundlichen Grüßen\nIhr DocklyLogistics-Team"}\n`;

  // Preferred provider: Scaleway Transactional Email (global env config).
  // Falls back to SMTP, then to the local mock writer.
  const temCfg = getScalewayTemConfig();
  if (temCfg) {
    try {
      const { messageId } = await sendViaScalewayTem(temCfg, {
        from: { email: tenant.fromEmail, name: tenant.fromName },
        to,
        cc: supplier.cc,
        replyTo: tenant.replyTo,
        subject,
        text,
        attachments: [
          { name: `${input.order.orderNo}.pdf`, type: "application/pdf", content: input.pdfBuffer },
        ],
      });
      return {
        channel: "EMAIL",
        ok: true,
        message: `Mail an ${to} versendet (Scaleway TEM).`,
        details: { to, subject, messageId, provider: "scaleway-tem" },
      };
    } catch (e) {
      return {
        channel: "EMAIL",
        ok: false,
        message: `Scaleway-TEM-Versand fehlgeschlagen: ${(e as Error).message}`,
      };
    }
  }

  // If real SMTP creds present, send. Otherwise mock to /tmp.
  if (tenant.smtp?.host && tenant.smtp.user && tenant.smtp.pass) {
    try {
      const transport = nodemailer.createTransport({
        host: tenant.smtp.host,
        port: tenant.smtp.port,
        secure: tenant.smtp.secure ?? true,
        auth: { user: tenant.smtp.user, pass: tenant.smtp.pass },
      });
      await transport.sendMail({
        from: `"${tenant.fromName}" <${tenant.fromEmail}>`,
        to,
        cc: supplier.cc,
        replyTo: tenant.replyTo,
        subject,
        text,
        attachments: [{ filename: `${input.order.orderNo}.pdf`, content: input.pdfBuffer, contentType: "application/pdf" }],
      });
      return { channel: "EMAIL", ok: true, message: `Mail an ${to} versendet (SMTP).`, details: { to, subject } };
    } catch (e) {
      return { channel: "EMAIL", ok: false, message: `SMTP-Versand fehlgeschlagen: ${(e as Error).message}` };
    }
  }

  // Mock mode — write a representative .eml file
  await fs.mkdir(MOCK_DIR, { recursive: true });
  const filePath = path.join(MOCK_DIR, `${input.order.orderNo}.eml`);
  const eml =
    `From: ${tenant.fromName} <${tenant.fromEmail}>\n` +
    `To: ${to}\n` +
    (supplier.cc?.length ? `Cc: ${supplier.cc.join(", ")}\n` : "") +
    (tenant.replyTo ? `Reply-To: ${tenant.replyTo}\n` : "") +
    `Subject: ${subject}\n` +
    `Date: ${new Date().toUTCString()}\n` +
    `Content-Type: multipart/mixed; boundary="DEMOBOUNDARY"\n\n` +
    `--DEMOBOUNDARY\n` +
    `Content-Type: text/plain; charset=utf-8\n\n` +
    `${text}\n\n` +
    `--DEMOBOUNDARY\n` +
    `Content-Type: application/pdf\n` +
    `Content-Disposition: attachment; filename="${input.order.orderNo}.pdf"\n` +
    `Content-Length: ${input.pdfBuffer.length}\n\n` +
    `[PDF binary — see ${MOCK_DIR}/${input.order.orderNo}.pdf]\n` +
    `--DEMOBOUNDARY--\n`;
  await fs.writeFile(filePath, eml);
  await fs.writeFile(path.join(MOCK_DIR, `${input.order.orderNo}.pdf`), input.pdfBuffer);
  return { channel: "EMAIL", ok: true, message: `Mock-Mail nach ${filePath} geschrieben (kein SMTP konfiguriert).`, details: { mockPath: filePath, to, subject } };
}

/**
 * Sends a lightweight test email (no order/PDF) using the same provider cascade
 * as dispatchEmail: Scaleway TEM → SMTP → "kein Provider". Used by the settings
 * "Test-Versand" so a tenant can verify their mail setup.
 */
export async function sendTestEmail(
  tenantConfig: Record<string, unknown>,
  to?: string,
): Promise<DispatchResult> {
  const tenant = (tenantConfig ?? {}) as EmailTenantCfg;
  if (!tenant.fromEmail) {
    return { channel: "EMAIL", ok: false, message: "Absender-Mailadresse fehlt (fromEmail)." };
  }
  const recipient = to?.trim() || tenant.replyTo || tenant.fromEmail;
  if (!recipient) {
    return { channel: "EMAIL", ok: false, message: "Keine Empfänger-Adresse (Feld 'to' übergeben oder fromEmail/replyTo setzen)." };
  }

  const subject = "DocklyLogistics — Test-Versand";
  const text =
    `Dies ist eine Test-E-Mail von DocklyLogistics.\n\n` +
    `Kanal: EMAIL\nZeitpunkt: ${new Date().toISOString()}\n\n` +
    `${tenant.signature ?? "Mit freundlichen Grüßen\nIhr DocklyLogistics-Team"}\n`;

  const temCfg = getScalewayTemConfig();
  if (temCfg) {
    try {
      const { messageId } = await sendViaScalewayTem(temCfg, {
        from: { email: tenant.fromEmail, name: tenant.fromName },
        to: recipient,
        replyTo: tenant.replyTo,
        subject,
        text,
      });
      return { channel: "EMAIL", ok: true, message: `Test-Mail an ${recipient} versendet (Scaleway TEM).`, details: { to: recipient, messageId, provider: "scaleway-tem" } };
    } catch (e) {
      return { channel: "EMAIL", ok: false, message: `Scaleway-TEM-Test fehlgeschlagen: ${(e as Error).message}` };
    }
  }

  if (tenant.smtp?.host && tenant.smtp.user && tenant.smtp.pass) {
    try {
      const transport = nodemailer.createTransport({
        host: tenant.smtp.host,
        port: tenant.smtp.port,
        secure: tenant.smtp.secure ?? true,
        auth: { user: tenant.smtp.user, pass: tenant.smtp.pass },
      });
      await transport.sendMail({
        from: `"${tenant.fromName}" <${tenant.fromEmail}>`,
        to: recipient,
        replyTo: tenant.replyTo,
        subject,
        text,
      });
      return { channel: "EMAIL", ok: true, message: `Test-Mail an ${recipient} versendet (SMTP).`, details: { to: recipient, provider: "smtp" } };
    } catch (e) {
      return { channel: "EMAIL", ok: false, message: `SMTP-Test fehlgeschlagen: ${(e as Error).message}` };
    }
  }

  return { channel: "EMAIL", ok: false, message: "Kein Mail-Provider konfiguriert (Scaleway TEM oder SMTP). Test nicht möglich.", details: { provider: "none" } };
}
