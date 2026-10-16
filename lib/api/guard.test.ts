import { describe, it, expect } from "vitest";
import { hasMinRole, requireRoleFromHeaders, ForbiddenError, UnauthenticatedError } from "./guard";
import { signUserHeaders } from "./user-headers";

describe("hasMinRole", () => {
  it("VIEWER passes VIEWER", () => {
    expect(hasMinRole("VIEWER", "VIEWER")).toBe(true);
  });
  it("USER passes VIEWER", () => {
    expect(hasMinRole("USER", "VIEWER")).toBe(true);
  });
  it("MANAGER passes USER", () => {
    expect(hasMinRole("MANAGER", "USER")).toBe(true);
  });
  it("GLOBAL_ADMIN passes MANAGER", () => {
    expect(hasMinRole("GLOBAL_ADMIN", "MANAGER")).toBe(true);
  });
  it("GLOBAL_ADMIN passes GLOBAL_ADMIN", () => {
    expect(hasMinRole("GLOBAL_ADMIN", "GLOBAL_ADMIN")).toBe(true);
  });
  it("VIEWER fails USER", () => {
    expect(hasMinRole("VIEWER", "USER")).toBe(false);
  });
  it("USER fails MANAGER", () => {
    expect(hasMinRole("USER", "MANAGER")).toBe(false);
  });
  it("MANAGER fails GLOBAL_ADMIN", () => {
    expect(hasMinRole("MANAGER", "GLOBAL_ADMIN")).toBe(false);
  });
});

describe("requireRoleFromHeaders", () => {
  /** Header so, wie die Middleware sie nach der Anmeldung setzt — signiert. */
  async function makeHeaders(role?: string, tenant?: string): Promise<Headers> {
    const h = new Headers();
    if (role) h.set("x-user-role", role);
    if (tenant) h.set("x-user-tenant", tenant);
    if (role && tenant) h.set("x-user-signature", await signUserHeaders(role, tenant));
    return h;
  }

  it("SICHERHEIT: lehnt den Angriff vom 16.10. ab (erfundener Key + gefälschte Rolle)", async () => {
    const h = new Headers({
      "x-api-key": "frei-erfunden",
      "x-user-role": "GLOBAL_ADMIN",
      "x-user-tenant": "demo",
    });
    await expect(requireRoleFromHeaders(h, "GLOBAL_ADMIN")).rejects.toThrow(UnauthenticatedError);
  });

  it("SICHERHEIT: lehnt unsignierte Sitzungs-Header ab", async () => {
    const h = new Headers({ "x-user-role": "MANAGER", "x-user-tenant": "Demo" });
    await expect(requireRoleFromHeaders(h, "VIEWER")).rejects.toThrow(UnauthenticatedError);
  });

  it("SICHERHEIT: lehnt Header ab, deren Rolle nach dem Signieren hochgesetzt wurde", async () => {
    const h = await makeHeaders("VIEWER", "Demo");
    h.set("x-user-role", "GLOBAL_ADMIN");
    await expect(requireRoleFromHeaders(h, "VIEWER")).rejects.toThrow(UnauthenticatedError);
  });

  it("returns ctx when role >= required", async () => {
    const ctx = await requireRoleFromHeaders(await makeHeaders("MANAGER", "Demo"), "USER");
    expect(ctx).toEqual({ role: "MANAGER", tenantId: "Demo" });
  });

  it("throws UnauthenticatedError when no role header (and no API key)", async () => {
    await expect(requireRoleFromHeaders(await makeHeaders(undefined, "Demo"), "VIEWER"))
      .rejects.toThrow(UnauthenticatedError);
  });

  it("throws ForbiddenError when role too low", async () => {
    await expect(requireRoleFromHeaders(await makeHeaders("VIEWER", "Demo"), "MANAGER"))
      .rejects.toThrow(ForbiddenError);
  });

  it("throws UnauthenticatedError when tenant header missing (and no API key)", async () => {
    await expect(requireRoleFromHeaders(await makeHeaders("USER", undefined), "USER"))
      .rejects.toThrow(UnauthenticatedError);
  });
});
