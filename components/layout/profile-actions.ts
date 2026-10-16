"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { signOut } from "@/lib/auth";
import { ADMIN_VIEW_TENANT_COOKIE } from "@/lib/auth/admin-view-tenant";
import { readIdTokenFromCookies } from "@/lib/auth/id-token";
import { keycloakLogoutUrl, resolvePostLogoutRedirectUri } from "@/lib/auth/keycloak-logout";

/**
 * Abmelden beendet auch die Keycloak-Sitzung (sonst loggt der nächste „Login" kommentarlos
 * wieder ein). Alt-Sitzungen ohne `idToken` im JWT (vor dem Deploy angemeldet) und jeder
 * Fehler beim Entschlüsseln fallen auf die rein lokale Abmeldung zurück.
 */
export async function logoutAction() {
  const jar = await cookies();
  // Eine Mandanten-Ansicht (GLOBAL_ADMIN) endet mit der Abmeldung — sonst landet der
  // nächste Einstieg im zuletzt betrachteten statt im eigenen Mandanten.
  jar.delete(ADMIN_VIEW_TENANT_COOKIE);

  // Das idToken muss VOR signOut gelesen werden — signOut löscht das Session-Cookie.
  let zielUrl: string | null = null;
  try {
    const idToken = await readIdTokenFromCookies(jar, process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET);
    if (idToken) {
      const h = await headers();
      const postLogoutRedirectUri = resolvePostLogoutRedirectUri({
        requestHost: h.get("x-forwarded-host") ?? h.get("host"),
        allowedBaseUrls: [process.env.NEXTAUTH_URL, process.env.NEXT_PUBLIC_APP_URL],
      });
      if (postLogoutRedirectUri) {
        zielUrl = keycloakLogoutUrl({
          issuer: process.env.KEYCLOAK_ISSUER,
          idToken,
          postLogoutRedirectUri,
          clientId: process.env.KEYCLOAK_CLIENT_ID,
        });
      }
    }
  } catch {
    // Nicht entschlüsselbar → lokale Abmeldung.
  }

  await signOut({ redirect: false });
  // redirect() wirft intern — bewusst außerhalb des try/catch.
  redirect(zielUrl ?? "/login");
}
