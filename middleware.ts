import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { forwardUserHeaders } from "@/lib/api/user-headers";
import { ADMIN_VIEW_TENANT_COOKIE } from "@/lib/auth/admin-view-tenant";
import { headerSessionFor } from "@/lib/auth/session-tenant";

// "/api-docs" (Scalar viewer) and "/api/v1/openapi.json" (the generated spec) are
// intentionally public so external developers can read the API reference without a
// login. This exposes only the API *shape* — every data endpoint still requires a
// session or a personal X-API-Key. Both entries are exact leaf paths under
// startsWith(), so they do NOT open the rest of /api/v1.
const PUBLIC_PATHS = ["/login", "/api/auth", "/api/public", "/api/edi", "/api/internal", "/users/auth", "/api-docs", "/api/v1/openapi.json", "/_next", "/favicon.ico", "/icon", "/brand"];

// PWA-related static files that must be reachable without authentication.
const PUBLIC_FILES = ["/manifest.webmanifest", "/sw.js", "/icon-192.svg", "/icon-512.svg"];

export default auth(async (req) => {
  const { pathname } = req.nextUrl;

  // SICHERHEIT: Rolle/Mandant setzt ausschließlich diese Middleware. Vom Client
  // mitgeschickte x-user-*-Header werden auf JEDEM Pfad verworfen und — bei
  // gültiger Sitzung — durch signierte Werte ersetzt. Weitergereicht wird über
  // `request: { headers }`; `res.headers.set` würde nur Antwort-Header setzen.
  // Read-Point 2 der Mandanten-Ansicht (GLOBAL_ADMIN): der wirksame Mandant kommt über
  // dieselbe Regel wie in der Session (`resolveSessionTenant`) und wird mitsigniert.
  // Das Cookie zählt nur für GLOBAL_ADMIN; die Rolle stammt immer aus der Sitzung.
  const headers = await forwardUserHeaders(
    req.headers,
    headerSessionFor(req.auth, req.cookies.get(ADMIN_VIEW_TENANT_COOKIE)?.value),
  );
  const next = () => NextResponse.next({ request: { headers } });

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return next();
  }
  if (PUBLIC_FILES.includes(pathname)) {
    return next();
  }

  if (!req.auth) {
    // Personal API-key requests (X-API-Key / Authorization: Bearer) authenticate at
    // the route guard — middleware runs on the edge and can't do the DB lookup, so
    // let them through instead of redirecting to /login.
    if (
      pathname.startsWith("/api/v1") &&
      (req.headers.get("x-api-key") || req.headers.get("authorization"))
    ) {
      return next();
    }
    const loginUrl = new URL("/login", req.url);
    // Query mitnehmen (z. B. /warehouse-mode?zone=<id> aus dem Zonen-QR), sonst geht der Deep-Link verloren.
    loginUrl.searchParams.set("callbackUrl", `${pathname}${req.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (!req.auth.role) {
    return NextResponse.redirect(new URL("/login?error=unauthorized", req.url));
  }

  return next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
