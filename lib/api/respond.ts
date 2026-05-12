import { NextResponse } from "next/server";

type Meta = {
  page?: number;
  pageSize?: number;
  total?: number;
};

export function ok<T>(data: T, meta?: Meta, init?: ResponseInit): NextResponse {
  return NextResponse.json({ data, ...(meta ? { meta } : {}) }, { status: 200, ...init });
}

export function created<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ data }, { status: 201, ...init });
}

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

/**
 * RFC-9457 Problem Details for HTTP APIs.
 * https://datatracker.ietf.org/doc/html/rfc9457
 */
export function fail(
  status: number,
  title: string,
  detail?: string,
  extras?: Record<string, unknown>,
): NextResponse {
  return NextResponse.json(
    {
      type: "about:blank",
      title,
      status,
      ...(detail ? { detail } : {}),
      ...extras,
    },
    {
      status,
      headers: { "Content-Type": "application/problem+json" },
    },
  );
}
