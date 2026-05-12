import type { UserRole } from "@/lib/auth/role";
import "next-auth";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    claims?: Record<string, unknown>;
    role?: UserRole;
    tenant?: string;
    error?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    claims?: Record<string, unknown>;
  }
}
