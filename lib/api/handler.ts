import { ZodError } from "zod";
import { ForbiddenError, UnauthenticatedError } from "./guard";
import { fail } from "./respond";
import type { NextResponse } from "next/server";

/**
 * Wraps an async route handler and maps known errors to RFC-9457 responses.
 * Anything unexpected becomes a 500.
 */
export function handler<TArgs extends unknown[]>(
  fn: (...args: TArgs) => Promise<NextResponse>,
): (...args: TArgs) => Promise<NextResponse> {
  return async (...args: TArgs) => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof UnauthenticatedError) return fail(401, "Unauthenticated", err.message);
      if (err instanceof ForbiddenError) return fail(403, "Forbidden", err.message);
      if (err instanceof ZodError) {
        return fail(422, "Validation failed", err.message, {
          errors: err.flatten().fieldErrors,
        });
      }
      console.error("[api/handler] unhandled error:", err);
      return fail(500, "Internal Server Error");
    }
  };
}
