import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/client";

export const dynamic = "force-dynamic";

/**
 * GET /users/auth/complete
 *
 * Post-Login-Hop nach dem Keycloak-Callback. Liest die Session (Tenant stammt aus
 * dem SSO-`origin`-Cookie, Rolle aus den Keycloak-Claims) und legt den Tenant-
 * Datensatz an, falls er noch nicht existiert — dann weiter ins Dashboard.
 *
 * Nur autorisierte Nutzer (Rolle gesetzt = Claims enthalten den Tenant) provisionieren
 * einen Tenant. Wer keinen Zugriff hat, landet wieder beim Login.
 */
export async function GET(req: Request) {
  const session = await auth();
  const tenant = session?.tenant;

  if (!session?.role || !tenant) {
    return NextResponse.redirect(new URL("/login?error=unauthorized", req.url));
  }

  // Auto-provision the tenant on first login (idempotent).
  await prisma.tenant.upsert({
    where: { id: tenant },
    update: {},
    create: { id: tenant, name: tenant },
  });

  return NextResponse.redirect(new URL("/dashboard", req.url));
}
