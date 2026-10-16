import type { NextRequest } from "next/server";
import { handler } from "@/lib/api/handler";
import { requireRoleFromHeaders, UnauthenticatedError } from "@/lib/api/guard";
import { ok, noContent, fail } from "@/lib/api/respond";
import { auth } from "@/lib/auth";
import { ADMIN_VIEW_TENANT_COOKIE } from "@/lib/auth/admin-view-tenant";
import { tenantRepo } from "@/lib/db/repos/tenant";
import { tenantViewService, type TenantViewActor } from "@/lib/services/tenant-view";
import { TenantViewSetSchema } from "@/lib/schemas/tenant-view";

/** Akteur aus der Sitzung (nicht aus den x-user-Headern, die tragen nur Rolle/Mandant). */
async function sessionActor(): Promise<TenantViewActor> {
  const session = await auth();
  if (!session?.user) throw new UnauthenticatedError();
  const email = session.user.email ?? "unknown";
  return { id: (session.user as { id?: string }).id ?? email, email };
}

function requestMeta(req: NextRequest) {
  return {
    ip: req.headers.get("x-forwarded-for") ?? undefined,
    userAgent: req.headers.get("user-agent") ?? undefined,
  };
}

/**
 * PUT /api/v1/me/tenant-view { tenantId } — GLOBAL_ADMIN betrachtet einen fremden
 * Mandanten (Cookie `admin_view_tenant`). Geprüft wird nur die ROLLE des Aufrufers; der
 * Ziel-Mandant kommt aus dem Body und wird gegen die Mandanten-Tabelle validiert
 * (404 statt stillem Fehlschlag, dann wird KEIN Cookie gesetzt). Das Cookie ist ein
 * Session-Cookie (kein maxAge) — es läuft mit dem Browser-Fenster ab.
 */
export const PUT = handler(async (req: NextRequest) => {
  await requireRoleFromHeaders(req.headers, "GLOBAL_ADMIN");
  const body = TenantViewSetSchema.parse(await req.json().catch(() => ({})));

  const tenant = await tenantRepo.findById(body.tenantId);
  if (!tenant) return fail(404, "Not Found", "Mandant nicht gefunden");

  // Erst auditieren, dann Cookie setzen: scheitert das Audit, gibt es keine unprotokollierte Ansicht.
  await tenantViewService.recordStarted(tenant.id, await sessionActor(), requestMeta(req));

  const res = ok({ tenant });
  res.cookies.set(ADMIN_VIEW_TENANT_COOKIE, tenant.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    // Kein maxAge: Session-Cookie.
  });
  return res;
});

/** DELETE /api/v1/me/tenant-view — Ansicht beenden; Audit im bisher betrachteten Mandanten. */
export const DELETE = handler(async (req: NextRequest) => {
  await requireRoleFromHeaders(req.headers, "GLOBAL_ADMIN");
  const bisher = req.cookies.get(ADMIN_VIEW_TENANT_COOKIE)?.value;

  // Das Cookie ist clientseitig manipulierbar — nur einen existierenden Mandanten auditieren.
  if (bisher && (await tenantRepo.findById(bisher))) {
    await tenantViewService.recordEnded(bisher, await sessionActor(), requestMeta(req));
  }

  const res = noContent();
  res.cookies.delete(ADMIN_VIEW_TENANT_COOKIE);
  return res;
});
