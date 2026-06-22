import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { apiKeyRepo } from "@/lib/db/repos/api-key";
import { supplierRepo } from "@/lib/db/repos/supplier";
import { generateApiKey } from "@/lib/services/api-key";
import { appendAudit } from "@/lib/audit/append";
import { auth } from "@/lib/auth";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders, UnauthenticatedError } from "@/lib/api/guard";
import { ok, created, fail } from "@/lib/api/respond";
import { ApiKeyCreateSchema } from "@/lib/schemas/api-key";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (req: NextRequest, { params }: Ctx) => {
  const ctx = await requireRoleFromHeaders(req.headers, "VIEWER");
  const { id } = await params;
  const supplier = await supplierRepo.findById(ctx.tenantId, id);
  if (!supplier) return fail(404, "Supplier not found");
  const keys = await apiKeyRepo.list(ctx.tenantId, id);
  // Never return secrets / hashes
  return ok(keys.map((k) => ({
    id: k.id, label: k.label, prefix: k.prefix, scopes: k.scopes,
    lastUsedAt: k.lastUsedAt, revokedAt: k.revokedAt, expiresAt: k.expiresAt,
    createdAt: k.createdAt, createdBy: k.createdBy,
  })));
});

export const POST = handler(async (req: NextRequest, { params }: Ctx) => {
  const ctx = await requireRoleFromHeaders(req.headers, "MANAGER");
  const { id } = await params;
  const body = ApiKeyCreateSchema.parse(await req.json());

  const supplier = await supplierRepo.findById(ctx.tenantId, id);
  if (!supplier) return fail(404, "Supplier not found");

  const session = await auth();
  if (!session?.user) throw new UnauthenticatedError();
  const actorEmail = session.user.email ?? "unknown";
  const actorId = (session.user as { id?: string }).id ?? actorEmail;

  const generated = generateApiKey();
  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

  const saved = await prisma.$transaction(async (tx) => {
    const k = await apiKeyRepo.create(tx, {
      tenantId: ctx.tenantId, supplierId: id, label: body.label ?? null,
      prefix: generated.prefix, hash: generated.hash, scopes: body.scopes,
      expiresAt, createdBy: actorEmail,
    });
    await appendAudit(tx, {
      tenantId: ctx.tenantId, entity: "SupplierApiKey", entityId: k.id, action: "CREATE",
      actorId, actorEmail,
      after: { supplierId: id, prefix: generated.prefix, scopes: body.scopes, label: body.label ?? null },
    });
    return k;
  });

  // fullKey is included ONCE in the response and never again
  return created({
    id: saved.id, label: saved.label, prefix: saved.prefix, scopes: saved.scopes,
    expiresAt: saved.expiresAt, createdAt: saved.createdAt,
    fullKey: generated.fullKey,
    warning: "Speichere den fullKey jetzt — er wird nie wieder angezeigt.",
  });
});
