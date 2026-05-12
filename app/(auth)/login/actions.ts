"use server";

import { signIn } from "@/lib/auth";

export async function loginWithKeycloak(formData: FormData) {
  const callbackUrl = (formData.get("callbackUrl") as string | null) ?? "/dashboard";
  await signIn("keycloak", { redirectTo: callbackUrl });
}
