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
    claims?: Record<string, unknown>;
  }
}
