import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomBytes } from 'crypto';
import { encrypt, decrypt } from '../crypto';

describe('crypto', () => {
  const testKey = randomBytes(32).toString('hex');

  beforeAll(() => {
    process.env.ENCRYPTION_KEY = testKey;
  });

  afterAll(() => {
    delete process.env.ENCRYPTION_KEY;
  });

  it('encrypts and decrypts correctly (roundtrip)', () => {
    const plaintext = 'sk-my-super-secret-api-key-12345';
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('produces different ciphertexts for the same input (random IV)', () => {
    const plaintext = 'same-input-twice';
    const encrypted1 = encrypt(plaintext);
    const encrypted2 = encrypt(plaintext);
    expect(encrypted1).not.toBe(encrypted2);

    // But both should decrypt to the same value
    expect(decrypt(encrypted1)).toBe(plaintext);
    expect(decrypt(encrypted2)).toBe(plaintext);
  });

  it('throws on invalid format', () => {
    expect(() => decrypt('not-valid-format')).toThrow('Invalid encrypted text format');
    expect(() => decrypt('a:b')).toThrow('Invalid encrypted text format');
    expect(() => decrypt('')).toThrow('Invalid encrypted text format');
  });

  it('throws when ENCRYPTION_KEY is missing', () => {
    const savedKey = process.env.ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;

    expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY environment variable is required');

    process.env.ENCRYPTION_KEY = savedKey;
  });

  it('handles empty string', () => {
    const encrypted = encrypt('');
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe('');
  });

  it('handles unicode characters', () => {
    const text = 'Hello, world! Keychain password';
    const encrypted = encrypt(text);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(text);
  });
});
