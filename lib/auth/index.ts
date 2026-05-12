import NextAuth from "next-auth";
import Keycloak from "next-auth/providers/keycloak";
import { deriveRole, UnauthorizedError, type UserRole } from "./role";

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
      if (account?.access_token) token.accessToken = account.access_token;
      if (profile) token.claims = profile as Record<string, unknown>;
      return token;
    },
    async session({ session, token }) {
      const tenant = process.env.NEXT_PUBLIC_APP_TENANT!;
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
