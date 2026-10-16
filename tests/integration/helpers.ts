import { signUserHeaders } from "@/lib/api/user-headers";
import { NextRequest } from "next/server";

/**
 * Build a NextRequest for calling a route handler directly in a test.
 *
 * `body` wird als JSON gesendet. Für Routen, die den Body per `req.text()`
 * roh lesen (EDI-Eingang, AS2), stattdessen `rawBody` verwenden — sonst käme
 * der Inhalt JSON-escaped und in Anführungszeichen beim Handler an.
 */
export function makeRequest(
  url: string,
  opts: {
    headers?: Record<string, string>;
    method?: string;
    body?: unknown;
    rawBody?: string;
  } = {},
): NextRequest {
  const headers = new Headers(opts.headers ?? {});
  const method = opts.method ?? "GET";
  if (opts.rawBody !== undefined) {
    if (!headers.has("content-type")) headers.set("content-type", "text/plain");
    return new NextRequest(url, { method, headers, body: opts.rawBody });
  }
  if (opts.body !== undefined) {
    headers.set("content-type", "application/json");
    return new NextRequest(url, { method, headers, body: JSON.stringify(opts.body) });
  }
  return new NextRequest(url, { method, headers });
}

/**
 * Header, wie die Middleware sie nach der Anmeldung setzt — inklusive Signatur
 * (lib/api/user-headers.ts). Unsignierte x-user-*-Header lehnt der Guard ab.
 */
export async function sessionHeaders(role: string, tenant: string): Promise<Record<string, string>> {
  return {
    "x-user-role": role,
    "x-user-tenant": tenant,
    "x-user-signature": await signUserHeaders(role, tenant),
  };
}

/**
 * Zweites Argument für dynamische Routen (`app/api/**\/[id]/route.ts`).
 * Next.js 15 übergibt die Pfadparameter als Promise — die Handler awaiten sie,
 * also muss der Test sie genauso liefern.
 */
export function routeParams<T extends Record<string, string>>(params: T): { params: Promise<T> } {
  return { params: Promise.resolve(params) };
}

export async function readJson<T = unknown>(res: Response): Promise<T> {
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}
