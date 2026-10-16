"use server";

import { cookies } from "next/headers";
import { signOut } from "@/lib/auth";
import { ADMIN_VIEW_TENANT_COOKIE } from "@/lib/auth/admin-view-tenant";

export async function logoutAction() {
  // Eine Mandanten-Ansicht (GLOBAL_ADMIN) endet mit der Abmeldung — sonst landet der
  // nächste Einstieg im zuletzt betrachteten statt im eigenen Mandanten.
  (await cookies()).delete(ADMIN_VIEW_TENANT_COOKIE);
  await signOut({ redirectTo: "/login" });
}
