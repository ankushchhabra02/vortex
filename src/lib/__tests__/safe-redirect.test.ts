import { describe, it, expect } from 'vitest';
import { safeNextPath } from '../safe-redirect';

describe('safeNextPath', () => {
  it('allows same-origin paths', () => {
    expect(safeNextPath('/reset-password')).toBe('/reset-password');
    expect(safeNextPath('/settings?tab=providers')).toBe('/settings?tab=providers');
  });

  it('rejects other origins', () => {
    expect(safeNextPath('https://evil.com')).toBe('/');
    expect(safeNextPath('//evil.com')).toBe('/');
    expect(safeNextPath('/\\evil.com')).toBe('/');
    expect(safeNextPath('/path\\..\\evil')).toBe('/');
  });

  it('falls back for missing or non-string values', () => {
    expect(safeNextPath(undefined)).toBe('/');
    expect(safeNextPath(null)).toBe('/');
    expect(safeNextPath('')).toBe('/');
    expect(safeNextPath(42)).toBe('/');
  });

  it('honours a custom fallback', () => {
    expect(safeNextPath(null, '/login')).toBe('/login');
  });
});
