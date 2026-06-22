import { describe, it, expect } from "vitest";
import { deriveRole, UnauthorizedError } from "./role";

const TENANT = "Demo";

describe("deriveRole", () => {
  it("GLOBAL_ADMIN bei realm-rolle global_admin", () => {
    const claims = { realm_access: { roles: ["default", "global_admin"] } };
    expect(deriveRole(claims, TENANT)).toBe("GLOBAL_ADMIN");
  });

  it("MANAGER bei manage_docklylogistic (ohne s) enthält tenant", () => {
    const claims = { manage_docklylogistic: ["Demo", "Other"] };
    expect(deriveRole(claims, TENANT)).toBe("MANAGER");
  });

  it("MANAGER bei manage_docklylogistics (mit s) enthält tenant", () => {
    const claims = { manage_docklylogistics: ["Demo"] };
    expect(deriveRole(claims, TENANT)).toBe("MANAGER");
  });

  it("USER bei internal_user_docklylogistic (ohne s) enthält tenant", () => {
    const claims = { internal_user_docklylogistic: ["Demo"] };
    expect(deriveRole(claims, TENANT)).toBe("USER");
  });

  it("USER bei internal_user_docklylogistics (mit s) enthält tenant", () => {
    const claims = { internal_user_docklylogistics: ["Demo"] };
    expect(deriveRole(claims, TENANT)).toBe("USER");
  });

  it("VIEWER bei use_docklylogistic (ohne s) enthält tenant", () => {
    const claims = { use_docklylogistic: ["Demo"] };
    expect(deriveRole(claims, TENANT)).toBe("VIEWER");
  });

  it("VIEWER bei use_docklylogistics (mit s) enthält tenant", () => {
    const claims = { use_docklylogistics: ["Demo"] };
    expect(deriveRole(claims, TENANT)).toBe("VIEWER");
  });

  it("akzeptiert String- statt Array-Claim", () => {
    const claims = { use_docklylogistics: "Demo" };
    expect(deriveRole(claims, TENANT)).toBe("VIEWER");
  });

  it("wirft UnauthorizedError ohne Berechtigung", () => {
    expect(() => deriveRole({}, TENANT)).toThrow(UnauthorizedError);
  });

  it("wirft UnauthorizedError wenn Tenant nicht im Array", () => {
    const claims = { use_docklylogistics: ["Other"] };
    expect(() => deriveRole(claims, TENANT)).toThrow(UnauthorizedError);
  });

  it("Priorität: ADMIN > MANAGER > USER > VIEWER", () => {
    const claims = {
      realm_access: { roles: ["global_admin"] },
      manage_docklylogistics: ["Demo"],
      internal_user_docklylogistics: ["Demo"],
      use_docklylogistics: ["Demo"],
    };
    expect(deriveRole(claims, TENANT)).toBe("GLOBAL_ADMIN");
  });
});
