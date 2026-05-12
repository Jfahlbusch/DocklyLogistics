import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/api/auth", "/api/public", "/_next", "/favicon.ico"];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (!req.auth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = req.auth.role;
  const tenant = req.auth.tenant;

  if (!role) {
    return NextResponse.redirect(new URL("/login?error=unauthorized", req.url));
  }

  const res = NextResponse.next();
  res.headers.set("x-user-role", role);
  if (tenant) res.headers.set("x-user-tenant", tenant);
  return res;
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
