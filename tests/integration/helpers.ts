import { NextRequest } from "next/server";

/** Build a NextRequest for calling a route handler directly in a test. */
export function makeRequest(
  url: string,
  opts: { headers?: Record<string, string>; method?: string; body?: unknown } = {},
): NextRequest {
  const headers = new Headers(opts.headers ?? {});
  const method = opts.method ?? "GET";
  if (opts.body !== undefined) {
    headers.set("content-type", "application/json");
    return new NextRequest(url, { method, headers, body: JSON.stringify(opts.body) });
  }
  return new NextRequest(url, { method, headers });
}

/** Headers the middleware would set for an authenticated session. */
export function sessionHeaders(role: string, tenant: string): Record<string, string> {
  return { "x-user-role": role, "x-user-tenant": tenant };
}

export async function readJson<T = unknown>(res: Response): Promise<T> {
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}
