import type { NextRequest } from "next/server";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders } from "@/lib/api/guard";
import { ok } from "@/lib/api/respond";
import { tenantSftpSettingsRepo } from "@/lib/db/repos/tenant-sftp-settings";
import { SftpSettingsUpdateSchema } from "@/lib/schemas/edi";
import type { TenantSftpSettings } from "@prisma/client";

/** Public view — never leaks the stored key/password. */
function view(s: TenantSftpSettings | null) {
  if (!s) return null;
  return {
    host: s.host, port: s.port, username: s.username, authType: s.authType,
    hasPrivateKey: !!s.privateKeyEncrypted, hasPassword: !!s.passwordEncrypted,
    hostKeyFingerprint: s.hostKeyFingerprint,
    outboxDir: s.outboxDir, inboxDir: s.inboxDir, inboxFormat: s.inboxFormat,
    routing: s.routing, active: s.active, autoSend: s.autoSend,
    lastPolledAt: s.lastPolledAt, lastPollError: s.lastPollError,
  };
}

/** GET /api/v1/settings/edi/sftp — current SFTP bridge config (no secrets). */
export const GET = handler(async (req: NextRequest) => {
  const ctx = await requireRoleFromHeaders(req.headers, "MANAGER");
  return ok(view(await tenantSftpSettingsRepo.get(ctx.tenantId)));
});

/** PUT /api/v1/settings/edi/sftp — create/update; empty key/password keeps the stored one. */
export const PUT = handler(async (req: NextRequest) => {
  const ctx = await requireRoleFromHeaders(req.headers, "MANAGER");
  const body = SftpSettingsUpdateSchema.parse(await req.json());
  const saved = await tenantSftpSettingsRepo.upsert(ctx.tenantId, {
    host: body.host, port: body.port, username: body.username, authType: body.authType,
    privateKey: body.privateKey || null, password: body.password || null,
    hostKeyFingerprint: body.hostKeyFingerprint ?? null,
    outboxDir: body.outboxDir, inboxDir: body.inboxDir, inboxFormat: body.inboxFormat,
    routing: body.routing, active: body.active, autoSend: body.autoSend,
  });
  return ok(view(saved));
});
