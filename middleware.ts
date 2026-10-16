import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { forwardUserHeaders } from "@/lib/api/user-headers";

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
  const headers = await forwardUserHeaders(
    req.headers,
    req.auth ? { role: req.auth.role, tenant: req.auth.tenant } : null,
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
    loginUrl.searchParams.set("callbackUrl", pathname);
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
