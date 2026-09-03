import { describe, it, expect } from 'vitest';
import { isStorableSourceUrl, resolveDocumentTitle } from '../ingest-source';

describe('isStorableSourceUrl', () => {
  it('accepts http and https URLs', () => {
    expect(isStorableSourceUrl('https://example.com/a/b?c=1')).toBe(true);
    expect(isStorableSourceUrl('http://localhost:3000/notes')).toBe(true);
  });

  it('rejects protocols that are unsafe to render as a link', () => {
    expect(isStorableSourceUrl('javascript:alert(1)')).toBe(false);
    expect(isStorableSourceUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isStorableSourceUrl('file:///etc/passwd')).toBe(false);
  });

  it('rejects values that are not URLs at all', () => {
    expect(isStorableSourceUrl('')).toBe(false);
    expect(isStorableSourceUrl('not a url')).toBe(false);
    expect(isStorableSourceUrl(undefined)).toBe(false);
    expect(isStorableSourceUrl(null)).toBe(false);
    expect(isStorableSourceUrl(42)).toBe(false);
  });

  it('rejects absurdly long URLs', () => {
    expect(isStorableSourceUrl('https://example.com/' + 'a'.repeat(2048))).toBe(false);
  });
});

describe('resolveDocumentTitle', () => {
  it('prefers the first non-empty candidate', () => {
    expect(resolveDocumentTitle('Clipped page', 'fallback.txt')).toBe('Clipped page');
  });

  it('skips empty and whitespace-only candidates', () => {
    expect(resolveDocumentTitle('', '   ', 'fallback.txt')).toBe('fallback.txt');
  });

  it('ignores non-string candidates', () => {
    expect(resolveDocumentTitle(undefined, null, 42, 'fallback.txt')).toBe('fallback.txt');
  });

  it('trims and truncates long titles', () => {
    expect(resolveDocumentTitle('  spaced  ')).toBe('spaced');
    expect(resolveDocumentTitle('t'.repeat(400))).toHaveLength(300);
  });

  it('never returns an empty title', () => {
    expect(resolveDocumentTitle(undefined, '')).toBe('Untitled document');
  });
});
