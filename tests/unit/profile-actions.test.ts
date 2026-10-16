import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { calls, store, hdrs, signOut, redirect, readIdToken } = vi.hoisted(() => {
  const calls: string[] = [];
  return {
    calls,
    store: { delete: vi.fn((name: string) => void calls.push(`delete:${name}`)) },
    hdrs: new Map<string, string>(),
    signOut: vi.fn(async () => void calls.push("signOut")),
    redirect: vi.fn((to: string) => {
      calls.push(`redirect:${to}`);
      throw new Error("NEXT_REDIRECT");
    }),
    readIdToken: vi.fn(async (): Promise<string | null> => {
      calls.push("readIdToken");
      return null;
    }),
  };
});

vi.mock("next/headers", () => ({
  cookies: async () => store,
  headers: async () => ({ get: (n: string) => hdrs.get(n.toLowerCase()) ?? null }),
}));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/auth", () => ({ signOut }));
vi.mock("@/lib/auth/id-token", () => ({ readIdTokenFromCookies: readIdToken }));

import { logoutAction } from "@/components/layout/profile-actions";

const ENV = { ...process.env };

beforeEach(() => {
  process.env.KEYCLOAK_ISSUER = "https://sso.dockly.de/realms/dockly";
  process.env.KEYCLOAK_CLIENT_ID = "docklylogistics";
  process.env.NEXTAUTH_URL = "https://logistics.dockly.de";
  process.env.NEXT_PUBLIC_APP_URL = "https://logistics.dockly.de";
  process.env.NEXTAUTH_SECRET = "s3cret";
  delete process.env.AUTH_SECRET;
  hdrs.clear();
});

afterEach(() => {
  calls.length = 0;
  vi.clearAllMocks();
  process.env = { ...ENV };
});

async function run() {
  await expect(logoutAction()).rejects.toThrow("NEXT_REDIRECT");
}

describe("logoutAction", () => {
  it("Reihenfolge: Ansichts-Cookie löschen -> Token lesen -> signOut(redirect:false) -> redirect auf Keycloak", async () => {
    readIdToken.mockImplementationOnce(async () => {
      calls.push("readIdToken");
      return "ID.TOKEN";
    });
    hdrs.set("x-forwarded-host", "logistics.dockly.de");
    await run();
    expect(calls).toEqual([
      "delete:admin_view_tenant",
      "readIdToken",
      "signOut",
      expect.stringMatching(/^redirect:https:\/\/sso\.dockly\.de\/realms\/dockly\/protocol\/openid-connect\/logout\?/),
    ]);
    expect(signOut).toHaveBeenCalledWith({ redirect: false });
    const url = new URL(redirect.mock.calls[0][0]);
    expect(url.searchParams.get("id_token_hint")).toBe("ID.TOKEN");
    expect(url.searchParams.get("client_id")).toBe("docklylogistics");
    expect(url.searchParams.get("post_logout_redirect_uri")).toBe("https://logistics.dockly.de/login");
    expect(readIdToken).toHaveBeenCalledWith(store, "s3cret");
  });

  it("Alt-Sitzung / kein idToken: lokale Abmeldung, redirect /login", async () => {
    await run();
    expect(calls).toEqual(["delete:admin_view_tenant", "readIdToken", "signOut", "redirect:/login"]);
  });

  it("Fehler beim Lesen/Entschlüsseln: kein Absturz, lokale Abmeldung", async () => {
    readIdToken.mockRejectedValueOnce(new Error("boom"));
    await run();
    expect(signOut).toHaveBeenCalledWith({ redirect: false });
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("Host-Header-Schutz: fremder x-forwarded-host landet nie in der Rücksprungadresse", async () => {
    readIdToken.mockResolvedValueOnce("ID.TOKEN");
    hdrs.set("x-forwarded-host", "evil.example");
    hdrs.set("host", "0.0.0.0:3000");
    await run();
    const url = new URL(redirect.mock.calls[0][0]);
    expect(url.searchParams.get("post_logout_redirect_uri")).toBe("https://logistics.dockly.de/login");
  });

  it("ohne Issuer: lokale Abmeldung", async () => {
    readIdToken.mockResolvedValueOnce("ID.TOKEN");
    delete process.env.KEYCLOAK_ISSUER;
    await run();
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("nutzt AUTH_SECRET, wenn gesetzt, sonst NEXTAUTH_SECRET", async () => {
    process.env.AUTH_SECRET = "auth-secret";
    await run();
    expect(readIdToken).toHaveBeenCalledWith(store, "auth-secret");
  });
});
