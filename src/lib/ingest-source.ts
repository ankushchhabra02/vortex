/**
 * Helpers for recording where an ingested document came from.
 *
 * Uploads are not always anonymous blobs: a browser extension or a scripted
 * client often already has the page text *and* knows the URL it came from,
 * which the server itself may be unable to fetch (login walls, localhost,
 * client-rendered pages). These helpers let the ingest route trust that
 * caller-supplied provenance without letting it smuggle in anything unsafe.
 */

const MAX_TITLE_LENGTH = 300;

/**
 * A source URL is only ever stored and rendered as a link — never fetched —
 * so the check here is about what is safe to hand back to a browser, not SSRF.
 * Anything outside http/https (`javascript:`, `data:`, `file:`) is rejected.
 */
export function isStorableSourceUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048) {
    return false;
  }

  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Picks the best available title, preferring one the caller supplied.
 * Falls back through the loader's own metadata to a caller-independent value
 * so a document is never stored untitled.
 */
export function resolveDocumentTitle(
  ...candidates: Array<unknown>
): string {
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const trimmed = candidate.trim();
    if (trimmed.length > 0) return trimmed.slice(0, MAX_TITLE_LENGTH);
  }
  return 'Untitled document';
}
