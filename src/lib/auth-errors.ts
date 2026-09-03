/**
 * Supabase reports auth-link failures by appending parameters to the redirect
 * target — usually as a URL *fragment*, which never reaches the server. Left
 * unread, a user who clicks a stale recovery link just lands back on the login
 * page with a wall of query string and no explanation.
 *
 * This maps what comes back to something a person can act on.
 */

export interface AuthErrorParams {
  error?: string | null;
  error_code?: string | null;
  error_description?: string | null;
}

const MAX_DESCRIPTION_LENGTH = 200;

export function describeAuthError(params: AuthErrorParams): string | null {
  const code = params.error_code || '';
  const error = params.error || '';

  if (!code && !error && !params.error_description) return null;

  // Recovery and confirmation links are single use and time limited. This is
  // also what a link consumed by an email scanner or a second click looks like.
  if (code === 'otp_expired' || code === 'email_link_invalid') {
    return 'That link has expired or was already used. Request a new one.';
  }

  // The PKCE verifier lives in the browser that asked for the link, so opening
  // the email somewhere else cannot complete the exchange.
  if (code.includes('pkce') || /code.?verifier/i.test(params.error_description || '')) {
    return 'Open the link in the same browser you requested it from, then try again.';
  }

  if (error === 'access_denied') {
    return 'That link is no longer valid. Request a new one.';
  }

  const description = (params.error_description || '').replace(/\+/g, ' ').trim();
  if (description) return description.slice(0, MAX_DESCRIPTION_LENGTH);

  return 'Something went wrong with that link. Request a new one.';
}

/**
 * Reads the error Supabase left behind, from the fragment first and then the
 * query string, and clears it so a refresh doesn't resurrect a stale message.
 */
export function consumeAuthError(location: Location, history: History): string | null {
  const fromHash = new URLSearchParams(location.hash.replace(/^#/, ''));
  const fromQuery = new URLSearchParams(location.search);
  const pick = (key: string) => fromHash.get(key) ?? fromQuery.get(key);

  const message = describeAuthError({
    error: pick('error'),
    error_code: pick('error_code'),
    error_description: pick('error_description'),
  });

  if (message) history.replaceState(null, '', location.pathname);
  return message;
}
