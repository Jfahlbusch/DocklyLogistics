import type { NextRequest } from "next/server";
import { z } from "zod";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders, UnauthenticatedError } from "@/lib/api/guard";
import { ok, created } from "@/lib/api/respond";
import { auth } from "@/lib/auth";
import { generateApiKey } from "@/lib/services/api-key";
import { userApiKeyRepo } from "@/lib/db/repos/user-api-key";

const CreateSchema = z.object({
  label: z.string().max(80).optional(),
  expiresInDays: z.coerce.number().int().min(1).max(365).optional(),
});

/** Session user identifier — id when present, else the email (stable per tenant). */
async function requireSessionUser() {
  const session = await auth();
  if (!session?.user) throw new UnauthenticatedError();
  const email = session.user.email ?? "unknown";
  const id = (session.user as { id?: string }).id ?? email;
  return { id, email };
}

export const GET = handler(async (req: NextRequest) => {
  const ctx = await requireRoleFromHeaders(req.headers, "VIEWER");
  const user = await requireSessionUser();
  const keys = await userApiKeyRepo.listForUser(ctx.tenantId, user.id);
  return ok(
    keys.map((k) => ({
      id: k.id,
      label: k.label,
      prefix: k.prefix,
      role: k.role,
      lastUsedAt: k.lastUsedAt,
      expiresAt: k.expiresAt,
      createdAt: k.createdAt,
    })),
  );
});

export const POST = handler(async (req: NextRequest) => {
  const ctx = await requireRoleFromHeaders(req.headers, "VIEWER");
  const user = await requireSessionUser();
  const body = CreateSchema.parse(await req.json().catch(() => ({})));

  const gen = generateApiKey();
  const expiresAt = body.expiresInDays
    ? new Date(Date.now() + body.expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const key = await userApiKeyRepo.create({
    tenantId: ctx.tenantId,
    userId: user.id,
    userEmail: user.email,
    label: body.label ?? null,
    prefix: gen.prefix,
    hash: gen.hash,
    role: ctx.role, // snapshot of the user's current permissions
    expiresAt,
  });

  // The full key is returned exactly ONCE — only its hash is stored.
  return created({
    id: key.id,
    label: key.label,
    prefix: key.prefix,
    role: key.role,
    expiresAt: key.expiresAt,
    createdAt: key.createdAt,
    key: gen.fullKey,
  });
});
