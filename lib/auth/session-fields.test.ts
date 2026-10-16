import { describe, it, expect } from "vitest";
import { buildSessionFields } from "./session-fields";

const ADMIN_CLAIMS = { realm_access: { roles: ["global_admin"] } };
const MANAGER_CLAIMS = { manage_docklylogistic: ["home"] };

describe("buildSessionFields (Read-Point 1: Seiten/Server Components)", () => {
  it("GLOBAL_ADMIN mit Ansicht: tenant = Ansicht, homeTenant bleibt der echte", () => {
    const f = buildSessionFields({ tenant: "home", claims: ADMIN_CLAIMS }, "fremd");
    expect(f).toMatchObject({ role: "GLOBAL_ADMIN", tenant: "fremd", homeTenant: "home" });
  });

  it("GLOBAL_ADMIN ohne Ansicht: tenant = homeTenant", () => {
    const f = buildSessionFields({ tenant: "home", claims: ADMIN_CLAIMS }, null);
    expect(f).toMatchObject({ role: "GLOBAL_ADMIN", tenant: "home", homeTenant: "home" });
  });

  it("Nicht-Admin mit gesetztem Cookie sieht NIE einen fremden Mandanten", () => {
    const f = buildSessionFields({ tenant: "home", claims: MANAGER_CLAIMS }, "fremd");
    expect(f).toMatchObject({ role: "MANAGER", tenant: "home", homeTenant: "home" });
  });

  it("die Rolle bleibt aus den Claims des HEIM-Mandanten abgeleitet (Cookie ändert sie nicht)", () => {
    // Manager nur in "home": Cookie auf einen Mandanten, in dem er Manager wäre, ändert nichts.
    const f = buildSessionFields(
      { tenant: "home", claims: { manage_docklylogistic: ["home", "fremd"] } },
      "fremd",
    );
    expect(f.tenant).toBe("home");
    // Admin ohne Cookie behält GLOBAL_ADMIN auch bei Ansicht eines Mandanten, in dem er nichts hat.
    expect(buildSessionFields({ tenant: "home", claims: ADMIN_CLAIMS }, "fremd").role).toBe("GLOBAL_ADMIN");
  });

  it("enthält weder claims noch accessToken", () => {
    const f = buildSessionFields({ tenant: "home", claims: ADMIN_CLAIMS, accessToken: "geheim" }, "fremd");
    expect(Object.keys(f)).not.toContain("claims");
    expect(Object.keys(f)).not.toContain("accessToken");
    expect(JSON.stringify(f)).not.toContain("geheim");
  });

  it("ohne Berechtigung im Heim-Mandanten: Unauthorized, keine Rolle, Cookie wirkungslos", () => {
    const f = buildSessionFields({ tenant: "home", claims: { use_docklylogistic: ["anderer"] } }, "fremd");
    expect(f).toEqual({ role: undefined, tenant: "home", homeTenant: "home", error: "Unauthorized" });
  });
});
