import { describe, it, expect } from "vitest";
import { signUserHeaders, verifyUserHeaders, forwardUserHeaders, USER_HEADERS } from "./user-headers";

describe("Signatur der x-user-*-Header", () => {
  it("verifiziert eine selbst erzeugte Signatur", async () => {
    const sig = await signUserHeaders("MANAGER", "daube");
    expect(await verifyUserHeaders("MANAGER", "daube", sig)).toBe(true);
  });

  it("lehnt eine Signatur ab, sobald Rolle oder Mandant verändert werden", async () => {
    const sig = await signUserHeaders("VIEWER", "daube");
    expect(await verifyUserHeaders("GLOBAL_ADMIN", "daube", sig)).toBe(false);
    expect(await verifyUserHeaders("VIEWER", "brotmanufaktur-schmidt", sig)).toBe(false);
  });

  it("lehnt fehlende, leere und erfundene Signaturen ab", async () => {
    expect(await verifyUserHeaders("VIEWER", "daube", null)).toBe(false);
    expect(await verifyUserHeaders("VIEWER", "daube", "")).toBe(false);
    expect(await verifyUserHeaders("VIEWER", "daube", "a".repeat(64))).toBe(false);
  });

  it("lehnt eine mit anderem Schlüssel erzeugte Signatur ab", async () => {
    const fremd = await signUserHeaders("VIEWER", "daube", "anderer-schluessel");
    expect(await verifyUserHeaders("VIEWER", "daube", fremd)).toBe(false);
  });

  it("lässt sich nicht durch Verschieben des Trennzeichens austricksen", async () => {
    const sig = await signUserHeaders("VIEWER", "x\ny");
    expect(await verifyUserHeaders("VIEWER\nx", "y", sig)).toBe(false);
  });
});

describe("forwardUserHeaders (Middleware)", () => {
  const angriff = () =>
    new Headers({
      "x-api-key": "frei-erfunden",
      "X-User-Role": "GLOBAL_ADMIN",
      "x-user-tenant": "demo",
      "x-user-signature": "f".repeat(64),
      accept: "application/json",
    });

  it("entfernt vom Client mitgeschickte x-user-*-Header, wenn keine Sitzung besteht", async () => {
    const h = await forwardUserHeaders(angriff(), null);
    for (const name of USER_HEADERS) expect(h.get(name)).toBeNull();
    expect(h.get("x-api-key")).toBe("frei-erfunden"); // Schlüsselweg bleibt möglich
    expect(h.get("accept")).toBe("application/json"); // andere Header unberührt
  });

  it("überschreibt gefälschte Werte mit denen der echten Sitzung und signiert sie", async () => {
    const h = await forwardUserHeaders(angriff(), { role: "VIEWER", tenant: "daube" });
    expect(h.get("x-user-role")).toBe("VIEWER");
    expect(h.get("x-user-tenant")).toBe("daube");
    expect(await verifyUserHeaders("VIEWER", "daube", h.get("x-user-signature"))).toBe(true);
  });

  it("setzt nichts, wenn der Sitzung Rolle oder Mandant fehlt", async () => {
    const h = await forwardUserHeaders(angriff(), { role: undefined, tenant: "daube" });
    for (const name of USER_HEADERS) expect(h.get(name)).toBeNull();
  });
});
