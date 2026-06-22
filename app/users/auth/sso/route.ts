import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { signIn } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Cookie that carries the desired tenant from the portal link through the
 *  Keycloak round-trip into the NextAuth jwt callback. */
export const ORIGIN_TENANT_COOKIE = "dl_tenant";

/** Sanitize defensively (strip anything but slug chars) so the value is safe as a
 *  DB key — but PRESERVE case: the tenant must match the Keycloak claim exactly,
 *  and `deriveRole` compares case-sensitively. */
function sanitizeTenant(raw: string | null): string {
  return (raw ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 64);
}

/**
 * GET /users/auth/sso?origin=<tenant>
 *
 * SSO-Einstieg aus dem BackofficeDigital-Portal. Merkt sich den Ziel-Tenant aus
 * `origin` (Cookie) und startet den Keycloak-Login. Nach erfolgreichem Login wird
 * zu /users/auth/complete weitergeleitet (legt den Tenant an, falls neu).
 *
 * Die Autorisierung bleibt bei Keycloak: `origin` WÄHLT nur den Tenant; ob der
 * Nutzer ihn betreten darf, entscheiden die Claims (deriveRole).
 */
export async function GET(req: NextRequest) {
  const origin = sanitizeTenant(req.nextUrl.searchParams.get("origin"));

  if (origin) {
    const store = await cookies();
    store.set(ORIGIN_TENANT_COOKIE, origin, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      secure: process.env.NODE_ENV === "production",
    });
  }

  // signIn performs the redirect to Keycloak (and sets its own state/PKCE cookies).
  return signIn("keycloak", { redirectTo: "/users/auth/complete" });
}
