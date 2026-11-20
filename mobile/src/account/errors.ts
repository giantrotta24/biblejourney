export const SIGN_IN_UNAVAILABLE = 'Sign in isn’t set up on this copy of the app.';
export const RATE_LIMITED = 'Too many tries. Wait a minute and try again.';
export const NETWORK_UNREACHABLE = 'Couldn’t reach the server. Check your connection.';
export const SIGN_IN_FAILED = 'Something went wrong. Try again.';
export const WRONG_CODE = 'Enter the 6–10 digit code from your email.';

const WRONG_CODES = new Set(['otp_expired', 'invalid_credentials']);

export type AuthResult = { ok: true } | { ok: false; line: string | null };

export function isWrongCode(error: unknown): boolean {
  return WRONG_CODES.has(readCode(error));
}

export function authErrorLine(error: unknown): string {
  const code = readCode(error);
  if (readStatus(error) === 429 || code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') {
    return RATE_LIMITED;
  }
  if (isNetwork(error)) return NETWORK_UNREACHABLE;
  return SIGN_IN_FAILED;
}

function readCode(error: unknown): string {
  if (!error || typeof error !== 'object' || !('code' in error)) return '';
  const code = (error as { code: unknown }).code;
  return typeof code === 'string' ? code : '';
}

function readStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object' || !('status' in error)) return null;
  const status = (error as { status: unknown }).status;
  return typeof status === 'number' ? status : null;
}

function readString(error: object, key: 'name' | 'message'): string {
  if (!(key in error)) return '';
  const value = (error as { name?: unknown; message?: unknown })[key];
  return typeof value === 'string' ? value : '';
}

function isNetwork(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  if (!error || typeof error !== 'object') return false;
  if (readString(error, 'name') === 'AuthRetryableFetchError' || readStatus(error) === 0) return true;
  return /network request failed|failed to fetch|network error/i.test(readString(error, 'message'));
}
