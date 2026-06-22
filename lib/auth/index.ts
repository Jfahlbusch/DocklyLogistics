import NextAuth from "next-auth";
import Keycloak from "next-auth/providers/keycloak";
import { deriveRole, UnauthorizedError, type UserRole } from "./role";

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
      const tenant =
        (typeof token.tenant === "string" && token.tenant) || process.env.NEXT_PUBLIC_APP_TENANT!;
      const claims = (token.claims ?? {}) as Parameters<typeof deriveRole>[0];
      try {
        const role: UserRole = deriveRole(claims, tenant);
        return {
          ...session,
          accessToken: token.accessToken as string | undefined,
          claims,
          role,
          tenant,
        };
      } catch (e) {
        if (e instanceof UnauthorizedError) {
          if (process.env.NODE_ENV === "development") {
            console.warn(
              `[auth/session] deriveRole failed for tenant="${tenant}". Claims keys: ${Object.keys(claims).join(", ")}`,
            );
          }
          return { ...session, role: undefined, tenant, error: "Unauthorized" } as typeof session;
        }
        throw e;
      }
    },
  },
  pages: {
    signIn: "/login",
  },
});
