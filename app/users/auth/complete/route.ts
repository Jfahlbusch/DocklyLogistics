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
/**
 * Relative redirect. In a route handler `req.url` is the container-internal
 * http://0.0.0.0:3000 address (behind Caddy) — building an absolute URL from it
 * leaks that host into the browser. A relative `Location` is resolved by the
 * browser against the public origin it actually requested.
 */
function redirectTo(path: string): NextResponse {
  return new NextResponse(null, { status: 303, headers: { Location: path } });
}

export async function GET() {
  const session = await auth();
  const tenant = session?.tenant;

  if (!session?.role || !tenant) {
    return redirectTo("/login?error=unauthorized");
  }

  // Auto-provision the tenant on first login (idempotent).
  await prisma.tenant.upsert({
    where: { id: tenant },
    update: {},
    create: { id: tenant, name: tenant },
  });

  return redirectTo("/dashboard");
}
