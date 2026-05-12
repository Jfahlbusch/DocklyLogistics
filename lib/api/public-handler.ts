import { ZodError } from "zod";
import { PublicAuthError } from "./public-auth";
import { fail } from "./respond";
import type { NextResponse } from "next/server";

/**
 * Wraps a public-API route handler and maps known errors to RFC-9457 responses.
 * Auth errors → 401/403, Zod validation errors → 422, everything else → 500.
 */
export function publicHandler<TArgs extends unknown[]>(
  fn: (...args: TArgs) => Promise<NextResponse>,
): (...args: TArgs) => Promise<NextResponse> {
  return async (...args: TArgs) => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof PublicAuthError) {
        return fail(err.status, err.title, err.detail);
      }
      if (err instanceof ZodError) {
        return fail(422, "Validation failed", err.message, {
          errors: err.flatten().fieldErrors,
        });
      }
      console.error("[public-api] unhandled:", err);
      return fail(500, "Internal Server Error");
    }
  };
}
