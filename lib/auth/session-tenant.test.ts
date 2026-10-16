import { describe, it, expect } from "vitest";
import { resolveSessionTenant, headerSessionFor } from "./session-tenant";
import { forwardUserHeaders, verifyUserHeaders } from "@/lib/api/user-headers";

describe("resolveSessionTenant", () => {
  it("GLOBAL_ADMIN mit Ansicht → Ansicht", () => {
    expect(resolveSessionTenant("GLOBAL_ADMIN", "home", "fremd")).toBe("fremd");
  });

  it("GLOBAL_ADMIN ohne/mit leerer Ansicht → Heim-Mandant", () => {
    expect(resolveSessionTenant("GLOBAL_ADMIN", "home", undefined)).toBe("home");
    expect(resolveSessionTenant("GLOBAL_ADMIN", "home", null)).toBe("home");
    expect(resolveSessionTenant("GLOBAL_ADMIN", "home", "")).toBe("home");
  });

  it.each(["MANAGER", "USER", "VIEWER"] as const)("%s ignoriert die Ansicht (Cookie nie vertrauen)", (role) => {
    expect(resolveSessionTenant(role, "home", "fremd")).toBe("home");
  });

  it("unbekannte/fehlende Rolle ignoriert die Ansicht ebenfalls", () => {
    expect(resolveSessionTenant(undefined, "home", "fremd")).toBe("home");
  });

  it("ohne Heim-Mandant bleibt es undefined (Nicht-Admin), Admin darf trotzdem betrachten", () => {
    expect(resolveSessionTenant("VIEWER", undefined, "fremd")).toBeUndefined();
    expect(resolveSessionTenant("GLOBAL_ADMIN", undefined, "fremd")).toBe("fremd");
  });
});

describe("headerSessionFor (Read-Point 2: Middleware)", () => {
  it("ohne Sitzung → null (es werden keine Header gesetzt)", () => {
    expect(headerSessionFor(null, "fremd")).toBeNull();
    expect(headerSessionFor(undefined, "fremd")).toBeNull();
  });

  it("ohne Rolle (Unauthorized-Sitzung) → null", () => {
    expect(headerSessionFor({ role: undefined, homeTenant: "home" }, "fremd")).toBeNull();
  });

  it("GLOBAL_ADMIN mit Cookie → wirksamer Mandant ist der betrachtete", () => {
    expect(headerSessionFor({ role: "GLOBAL_ADMIN", homeTenant: "home" }, "fremd")).toEqual({
      role: "GLOBAL_ADMIN",
      tenant: "fremd",
    });
  });

  it("GLOBAL_ADMIN ohne Cookie → Heim-Mandant", () => {
    expect(headerSessionFor({ role: "GLOBAL_ADMIN", homeTenant: "home" }, undefined)).toEqual({
      role: "GLOBAL_ADMIN",
      tenant: "home",
    });
  });

  it.each(["MANAGER", "USER", "VIEWER"] as const)("%s mit gesetztem Cookie → bleibt im Heim-Mandanten", (role) => {
    expect(headerSessionFor({ role, homeTenant: "home" }, "fremd")).toEqual({ role, tenant: "home" });
  });

  it("verlässt sich auf homeTenant, nicht auf ein evtl. schon überschriebenes tenant", () => {
    expect(
      headerSessionFor({ role: "MANAGER", homeTenant: "home", tenant: "fremd" }, undefined),
    ).toEqual({ role: "MANAGER", tenant: "home" });
  });
});

describe("Middleware-Kette: headerSessionFor → forwardUserHeaders → Guard-Verifikation", () => {
  const eingang = () =>
    new Headers({ "x-user-role": "GLOBAL_ADMIN", "x-user-tenant": "fremd", "x-user-signature": "f".repeat(64) });

  it("Nicht-Admin mit Cookie: signierter Header trägt den HEIM-Mandanten, Client-Header sind verworfen", async () => {
    const out = await forwardUserHeaders(eingang(), headerSessionFor({ role: "MANAGER", homeTenant: "home" }, "fremd"));
    expect(out.get("x-user-role")).toBe("MANAGER");
    expect(out.get("x-user-tenant")).toBe("home");
    expect(await verifyUserHeaders("MANAGER", "home", out.get("x-user-signature"))).toBe(true);
    expect(await verifyUserHeaders("MANAGER", "fremd", out.get("x-user-signature"))).toBe(false);
  });

  it("GLOBAL_ADMIN mit Cookie: signierter Header trägt den betrachteten Mandanten", async () => {
    const out = await forwardUserHeaders(
      eingang(),
      headerSessionFor({ role: "GLOBAL_ADMIN", homeTenant: "home" }, "fremd"),
    );
    expect(out.get("x-user-tenant")).toBe("fremd");
    expect(await verifyUserHeaders("GLOBAL_ADMIN", "fremd", out.get("x-user-signature"))).toBe(true);
  });

  it("ohne Sitzung: auch mit Cookie keine x-user-Header (Client-Header verworfen)", async () => {
    const out = await forwardUserHeaders(eingang(), headerSessionFor(null, "fremd"));
    expect(out.get("x-user-role")).toBeNull();
    expect(out.get("x-user-tenant")).toBeNull();
    expect(out.get("x-user-signature")).toBeNull();
  });
});
