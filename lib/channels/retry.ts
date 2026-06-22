/**
 * Retry an async operation on transient failures with exponential backoff.
 * Only retries when `isRetryable(error)` is true; rethrows the last error otherwise
 * or after the final attempt.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { attempts: number; baseMs: number; isRetryable: (e: unknown) => boolean },
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < opts.attempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const isLast = attempt === opts.attempts - 1;
      if (isLast || !opts.isRetryable(e)) throw e;
      await new Promise((r) => setTimeout(r, opts.baseMs * 2 ** attempt));
    }
  }
  throw lastErr;
}
