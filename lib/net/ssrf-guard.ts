/**
 * SSRF defense for outbound, user-configured URLs (webhook + API channel targets).
 * Blocks obvious internal destinations: loopback, link-local incl. the cloud
 * metadata IP (169.254.169.254), and RFC-1918 ranges. Only http(s) is allowed.
 *
 * Note: this is a hostname/literal-IP filter — it does not resolve DNS, so a
 * hostname that resolves to an internal IP (DNS rebinding) is not caught here.
 * A resolve-and-check-at-connect layer is a deeper follow-up; this closes the
 * common cases (direct internal IPs / metadata / localhost).
 */
const BLOCKED = [
  /^localhost$/i,
  /^0\./,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./, // link-local incl. 169.254.169.254 (cloud metadata)
  /^172\.(1[6-9]|2\d|3[01])\./, // 172.16.0.0/12
  /^::1$/,
  /^\[?::1\]?$/,
  /^f[cd][0-9a-f]{2}:/i, // fc00::/7 unique-local IPv6
  /^fe80:/i, // link-local IPv6
];

/** True if the URL must not be fetched (internal/invalid/non-http). */
export function isBlockedUrl(raw: string | undefined | null): boolean {
  if (!raw) return true;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return true;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return true;
  const host = u.hostname.replace(/^\[|\]$/g, "");
  return BLOCKED.some((re) => re.test(host));
}
