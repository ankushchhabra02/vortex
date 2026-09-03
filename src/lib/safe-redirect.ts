/**
 * Auth callbacks carry a `next` destination in the query string, which is
 * attacker-controllable: a crafted link could otherwise bounce a freshly
 * authenticated user off to another origin. Only same-origin, path-shaped
 * values survive this filter.
 */
export function safeNextPath(value: unknown, fallback = '/'): string {
  if (typeof value !== 'string' || value.length === 0) return fallback;

  // Must be a bare path. Reject protocol-relative ("//evil.com"), absolute
  // URLs, and backslash variants that some parsers treat as slashes.
  if (!value.startsWith('/')) return fallback;
  if (value.startsWith('//') || value.startsWith('/\\')) return fallback;
  if (value.includes('\\')) return fallback;

  return value;
}
