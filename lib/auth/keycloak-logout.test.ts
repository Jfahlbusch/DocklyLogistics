import { describe, it, expect } from "vitest";
import { keycloakLogoutUrl, resolvePostLogoutRedirectUri } from "./keycloak-logout";

const BASE = {
  issuer: "https://sso.dockly.de/realms/dockly",
  idToken: "eyJhbGciOi.payload.sig",
  postLogoutRedirectUri: "https://logistics.dockly.de/login",
  clientId: "docklylogistics",
};

describe("keycloakLogoutUrl", () => {
  it("baut die end_session-URL mit id_token_hint, post_logout_redirect_uri und client_id", () => {
    const url = new URL(keycloakLogoutUrl(BASE)!);
    expect(url.origin + url.pathname).toBe("https://sso.dockly.de/realms/dockly/protocol/openid-connect/logout");
    expect(url.searchParams.get("id_token_hint")).toBe(BASE.idToken);
    expect(url.searchParams.get("post_logout_redirect_uri")).toBe(BASE.postLogoutRedirectUri);
    expect(url.searchParams.get("client_id")).toBe("docklylogistics");
  });

  it("kodiert die Parameter URL-sicher (kein rohes ://, &, ? aus den Werten)", () => {
    const s = keycloakLogoutUrl({ ...BASE, postLogoutRedirectUri: "https://x.de/login?a=1&b=2" })!;
    expect(s).toContain("post_logout_redirect_uri=https%3A%2F%2Fx.de%2Flogin%3Fa%3D1%26b%3D2");
    expect(new URL(s).searchParams.get("post_logout_redirect_uri")).toBe("https://x.de/login?a=1&b=2");
  });

  it("verträgt einen Issuer mit Slash am Ende (kein //protocol)", () => {
    const s = keycloakLogoutUrl({ ...BASE, issuer: `${BASE.issuer}/` })!;
    expect(s.startsWith("https://sso.dockly.de/realms/dockly/protocol/openid-connect/logout?")).toBe(true);
    expect(s).not.toContain("dockly//protocol");
  });

  it("liefert null ohne idToken (lokale Abmeldung)", () => {
    expect(keycloakLogoutUrl({ ...BASE, idToken: undefined })).toBeNull();
    expect(keycloakLogoutUrl({ ...BASE, idToken: null })).toBeNull();
    expect(keycloakLogoutUrl({ ...BASE, idToken: "" })).toBeNull();
  });

  it("liefert null ohne Issuer", () => {
    expect(keycloakLogoutUrl({ ...BASE, issuer: undefined })).toBeNull();
  });
});

describe("resolvePostLogoutRedirectUri (Host-Header-Schutz)", () => {
  const allowed = ["https://logistics.dockly.de", "https://logistics.dockly.de/"];

  it("übernimmt den Request-Host, wenn er zur erlaubten Basisadresse passt", () => {
    expect(resolvePostLogoutRedirectUri({ requestHost: "logistics.dockly.de", allowedBaseUrls: allowed })).toBe(
      "https://logistics.dockly.de/login",
    );
  });

  it("vergleicht Groß-/Kleinschreibung unabhängig", () => {
    expect(resolvePostLogoutRedirectUri({ requestHost: "Logistics.Dockly.DE", allowedBaseUrls: allowed })).toBe(
      "https://logistics.dockly.de/login",
    );
  });

  it("nimmt bei x-forwarded-host-Listen nur den ersten Eintrag", () => {
    expect(
      resolvePostLogoutRedirectUri({ requestHost: "logistics.dockly.de, evil.example", allowedBaseUrls: allowed }),
    ).toBe("https://logistics.dockly.de/login");
  });

  it("fremder Host -> Standardadresse (erste erlaubte Basis), nie der Header", () => {
    expect(resolvePostLogoutRedirectUri({ requestHost: "evil.example", allowedBaseUrls: allowed })).toBe(
      "https://logistics.dockly.de/login",
    );
    expect(
      resolvePostLogoutRedirectUri({ requestHost: "logistics.dockly.de.evil.example", allowedBaseUrls: allowed }),
    ).toBe("https://logistics.dockly.de/login");
    expect(
      resolvePostLogoutRedirectUri({ requestHost: "evil.example/@logistics.dockly.de", allowedBaseUrls: allowed }),
    ).toBe("https://logistics.dockly.de/login");
  });

  it("0.0.0.0 wird nie übernommen", () => {
    expect(resolvePostLogoutRedirectUri({ requestHost: "0.0.0.0:3000", allowedBaseUrls: allowed })).toBe(
      "https://logistics.dockly.de/login",
    );
    expect(
      resolvePostLogoutRedirectUri({ requestHost: "0.0.0.0:3000", allowedBaseUrls: ["http://0.0.0.0:3000"] }),
    ).toBeNull();
  });

  it("ohne Host-Header -> Standardadresse", () => {
    expect(resolvePostLogoutRedirectUri({ requestHost: null, allowedBaseUrls: allowed })).toBe(
      "https://logistics.dockly.de/login",
    );
  });

  it("Host mit Port muss samt Port passen; Protokoll kommt aus der erlaubten Basis", () => {
    expect(
      resolvePostLogoutRedirectUri({ requestHost: "localhost:3000", allowedBaseUrls: ["http://localhost:3000"] }),
    ).toBe("http://localhost:3000/login");
    expect(
      resolvePostLogoutRedirectUri({ requestHost: "localhost:4000", allowedBaseUrls: ["http://localhost:3000"] }),
    ).toBe("http://localhost:3000/login");
  });

  it("mehrere erlaubte Basen (NEXTAUTH_URL / NEXT_PUBLIC_APP_URL): passender Host gewinnt", () => {
    const two = ["https://logistics.dockly.de", "https://www.logistics.dockly.de"];
    expect(resolvePostLogoutRedirectUri({ requestHost: "www.logistics.dockly.de", allowedBaseUrls: two })).toBe(
      "https://www.logistics.dockly.de/login",
    );
  });

  it("ignoriert leere/ungültige Basen; ohne gültige Basis -> null", () => {
    expect(resolvePostLogoutRedirectUri({ requestHost: "x", allowedBaseUrls: [undefined, "", "kein-url"] })).toBeNull();
    expect(
      resolvePostLogoutRedirectUri({
        requestHost: "logistics.dockly.de",
        allowedBaseUrls: [undefined, "https://logistics.dockly.de"],
      }),
    ).toBe("https://logistics.dockly.de/login");
  });
});
