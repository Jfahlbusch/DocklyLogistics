import { describe, it, expect } from "vitest";
import { encode } from "next-auth/jwt";
import { storeIdToken, readIdTokenFromCookies, sessionCookieNames } from "./id-token";
import { buildSessionFields } from "./session-fields";

const SECRET = "test-secret-test-secret-test-secret-1234";

describe("storeIdToken (jwt-Callback)", () => {
  it("legt account.id_token beim Login als token.idToken ab", () => {
    const t = storeIdToken({ tenant: "home" }, { id_token: "ID.TOKEN.X" });
    expect(t.idToken).toBe("ID.TOKEN.X");
  });

  it("lässt das JWT ohne account (Folge-Requests) unverändert", () => {
    const t = { tenant: "home", idToken: "alt" };
    expect(storeIdToken(t, null)).toEqual(t);
    expect(storeIdToken(t, undefined)).toEqual(t);
  });

  it("überschreibt nicht, wenn der Account kein id_token liefert", () => {
    expect(storeIdToken({ idToken: "alt" }, { access_token: "a" }).idToken).toBe("alt");
  });
});

describe("Session enthält nie das idToken", () => {
  it("buildSessionFields gibt kein idToken (und keine Tokens/Claims) heraus", () => {
    const f = buildSessionFields(
      { tenant: "home", idToken: "ID.TOKEN.X", accessToken: "acc", claims: { manage_docklylogistic: ["home"] } },
      null,
    );
    expect(JSON.stringify(f)).not.toContain("ID.TOKEN.X");
    expect(Object.keys(f)).not.toContain("idToken");
  });
});

describe("sessionCookieNames", () => {
  it("kennt secure- und Klartext-Name von Auth.js v5", () => {
    expect(sessionCookieNames()).toEqual(["__Secure-authjs.session-token", "authjs.session-token"]);
  });
});

describe("readIdTokenFromCookies", () => {
  const mk = (list: Array<[string, string]>) => ({
    getAll: () => list.map(([name, value]) => ({ name, value })),
  });

  async function jwe(name: string, payload: Record<string, unknown>) {
    return encode({ token: payload, secret: SECRET, salt: name });
  }

  it("entschlüsselt das unzerlegte Secure-Cookie", async () => {
    const name = "__Secure-authjs.session-token";
    const token = await jwe(name, { idToken: "ID.A" });
    expect(await readIdTokenFromCookies(mk([[name, token]]), SECRET)).toBe("ID.A");
  });

  it("entschlüsselt das Klartext-Cookie (lokal, http)", async () => {
    const name = "authjs.session-token";
    const token = await jwe(name, { idToken: "ID.B" });
    expect(await readIdTokenFromCookies(mk([[name, token]]), SECRET)).toBe("ID.B");
  });

  it("setzt zerlegte Chunks .0 .1 … in Reihenfolge zusammen (auch .10 nach .2)", async () => {
    const name = "__Secure-authjs.session-token";
    const token = await jwe(name, { idToken: "ID.C", pad: "x".repeat(6000) });
    const parts: string[] = [];
    const size = Math.ceil(token.length / 12);
    for (let i = 0; i < token.length; i += size) parts.push(token.slice(i, i + size));
    expect(parts.length).toBeGreaterThan(10);
    const list = parts.map((p, i) => [`${name}.${i}`, p] as [string, string]).reverse();
    expect(await readIdTokenFromCookies(mk(list), SECRET)).toBe("ID.C");
  });

  it("liefert null ohne Session-Cookie", async () => {
    expect(await readIdTokenFromCookies(mk([["foo", "bar"]]), SECRET)).toBeNull();
  });

  it("liefert null für Alt-Sitzungen ohne idToken", async () => {
    const name = "__Secure-authjs.session-token";
    const token = await jwe(name, { tenant: "home" });
    expect(await readIdTokenFromCookies(mk([[name, token]]), SECRET)).toBeNull();
  });

  it("liefert null (kein Wurf) bei falschem Secret oder kaputtem Cookie", async () => {
    const name = "authjs.session-token";
    const token = await jwe(name, { idToken: "ID.D" });
    expect(await readIdTokenFromCookies(mk([[name, token]]), "anderes-secret-anderes-secret-12345")).toBeNull();
    expect(await readIdTokenFromCookies(mk([[name, "kein-jwe"]]), SECRET)).toBeNull();
  });

  it("liefert null ohne Secret", async () => {
    expect(await readIdTokenFromCookies(mk([["authjs.session-token", "x"]]), undefined)).toBeNull();
  });

  it("Salt = Cookie-Name: ein Token des Klartext-Namens unter Secure-Namen ist ungültig", async () => {
    const token = await jwe("authjs.session-token", { idToken: "ID.E" });
    expect(await readIdTokenFromCookies(mk([["__Secure-authjs.session-token", token]]), SECRET)).toBeNull();
  });
});
