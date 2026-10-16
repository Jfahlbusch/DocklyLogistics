import type { UserRole } from "@/lib/auth/role";
import "next-auth";

declare module "next-auth" {
  interface Session {
    role?: UserRole;
    /** Wirksamer Mandant — bei GLOBAL_ADMIN ggf. der betrachtete (Cookie `admin_view_tenant`). */
    tenant?: string;
    /** Echter, unveränderlicher Mandant der Sitzung. */
    homeTenant?: string;
    error?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    /** Keycloak-id_token für `id_token_hint` beim Logout — nur im JWT, nie in der Session. */
    idToken?: string;
    claims?: Record<string, unknown>;
  }
}
