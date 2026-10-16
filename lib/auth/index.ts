import NextAuth from "next-auth";
import Keycloak from "next-auth/providers/keycloak";
import { ADMIN_VIEW_TENANT_COOKIE } from "./admin-view-tenant";
import { buildSessionFields } from "./session-fields";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const json = Buffer.from(parts[1], "base64url").toString("utf-8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Keycloak({
      clientId: process.env.KEYCLOAK_CLIENT_ID!,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET!,
      issuer: process.env.KEYCLOAK_ISSUER!,
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account?.access_token) {
        token.accessToken = account.access_token;
        const accessTokenClaims = decodeJwtPayload(account.access_token) ?? {};
        const profileClaims = (profile ?? {}) as Record<string, unknown>;
        token.claims = { ...profileClaims, ...accessTokenClaims };

        // Resolve the target tenant from the SSO origin cookie (set by
        // /users/auth/sso), falling back to the deployment's default tenant.
        // Dynamic import keeps next/headers out of the edge middleware bundle.
        try {
          const { cookies } = await import("next/headers");
          const originTenant = (await cookies()).get("dl_tenant")?.value;
          if (originTenant) token.tenant = originTenant;
        } catch {
          // cookies() not available in this context — fall back below.
        }
        if (!token.tenant) token.tenant = process.env.NEXT_PUBLIC_APP_TENANT;

        if (process.env.NODE_ENV === "development") {
          console.log("[auth/jwt] tenant:", token.tenant, "claims:", JSON.stringify(token.claims, null, 2));
        }
      }
      return token;
    },
    async session({ session, token }) {
      // Read-Point 1 (Seiten/Server Components). Read-Point 2 ist middleware.ts — beide
      // lösen den wirksamen Mandanten über dieselbe Regel `resolveSessionTenant` auf.
      let ansicht: string | null = null;
      try {
        // Dynamic import: next/headers bleibt aus dem Edge-Middleware-Bundle.
        const { cookies } = await import("next/headers");
        ansicht = (await cookies()).get(ADMIN_VIEW_TENANT_COOKIE)?.value ?? null;
      } catch {
        // Kein Request-Kontext (z. B. Middleware/Edge) — keine Fremdansicht hier.
      }
      // Die Session enthält bewusst KEINE Claims und kein Access-Token.
      return { ...session, ...buildSessionFields(token, ansicht) } as typeof session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
