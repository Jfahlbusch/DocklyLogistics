"use server";

import { signIn } from "@/lib/auth";
import { safeCallbackUrl } from "@/lib/auth/callback-url";

export async function loginWithKeycloak(formData: FormData) {
  const callbackUrl = safeCallbackUrl(formData.get("callbackUrl") as string | null);
  await signIn("keycloak", { redirectTo: callbackUrl });
}
