import { describe, it, expect } from 'vitest';
import { describeAuthError, consumeAuthError } from '../auth-errors';

describe('describeAuthError', () => {
  it('returns null when there is no error', () => {
    expect(describeAuthError({})).toBeNull();
    expect(describeAuthError({ error: null, error_code: null, error_description: null })).toBeNull();
  });

  it('explains an expired or reused link', () => {
    expect(describeAuthError({ error_code: 'otp_expired' })).toMatch(/expired or was already used/);
    expect(describeAuthError({ error_code: 'email_link_invalid' })).toMatch(/expired or was already used/);
  });

  it('explains a PKCE verifier mismatch as a wrong-browser problem', () => {
    expect(describeAuthError({ error_code: 'flow_state_not_found_pkce' })).toMatch(/same browser/);
    expect(describeAuthError({ error_description: 'invalid code_verifier' })).toMatch(/same browser/);
  });

  it('handles access_denied without a specific code', () => {
    expect(describeAuthError({ error: 'access_denied' })).toMatch(/no longer valid/);
  });

  it('falls back to the provider description, decoded and capped', () => {
    expect(describeAuthError({ error_description: 'Email+link+is+invalid' })).toBe('Email link is invalid');
    expect(describeAuthError({ error_description: 'x'.repeat(500) })).toHaveLength(200);
  });

  it('degrades to a generic message when only an unknown error is present', () => {
    expect(describeAuthError({ error: 'server_error' })).toMatch(/Something went wrong/);
  });
});

describe('consumeAuthError', () => {
  const fakeHistory = () => {
    const calls: string[] = [];
    const history = {
      replaceState: (_s: unknown, _t: string, url: string) => {
        calls.push(url);
      },
    } as unknown as History;
    return { calls, history };
  };

  it('reads the fragment Supabase redirects with, and clears it', () => {
    const { calls, history } = fakeHistory();
    const location = {
      hash: '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
      search: '',
      pathname: '/login',
    } as Location;

    expect(consumeAuthError(location, history)).toMatch(/expired or was already used/);
    expect(calls).toEqual(['/login']);
  });

  it('falls back to the query string', () => {
    const { history } = fakeHistory();
    const location = { hash: '', search: '?error_code=otp_expired', pathname: '/login' } as Location;
    expect(consumeAuthError(location, history)).toMatch(/expired or was already used/);
  });

  it('leaves a clean URL alone', () => {
    const { calls, history } = fakeHistory();
    const location = { hash: '', search: '', pathname: '/login' } as Location;
    expect(consumeAuthError(location, history)).toBeNull();
    expect(calls).toEqual([]);
  });
});
