import { describe, it, expect } from "vitest";
import { hasMinRole, requireRoleFromHeaders, ForbiddenError, UnauthenticatedError } from "./guard";

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
  function makeHeaders(role?: string, tenant?: string): Headers {
    const h = new Headers();
    if (role) h.set("x-user-role", role);
    if (tenant) h.set("x-user-tenant", tenant);
    return h;
  }

  it("returns ctx when role >= required", () => {
    const ctx = requireRoleFromHeaders(makeHeaders("MANAGER", "Demo"), "USER");
    expect(ctx).toEqual({ role: "MANAGER", tenantId: "Demo" });
  });

  it("throws UnauthenticatedError when no role header", () => {
    expect(() => requireRoleFromHeaders(makeHeaders(undefined, "Demo"), "VIEWER"))
      .toThrow(UnauthenticatedError);
  });

  it("throws ForbiddenError when role too low", () => {
    expect(() => requireRoleFromHeaders(makeHeaders("VIEWER", "Demo"), "MANAGER"))
      .toThrow(ForbiddenError);
  });

  it("throws UnauthenticatedError when tenant header missing", () => {
    expect(() => requireRoleFromHeaders(makeHeaders("USER", undefined), "USER"))
      .toThrow(UnauthenticatedError);
  });
});
