type FakeUser = { id: string; email?: string | null };
export type FakeSession = { access_token: string; user: FakeUser };
type Listener = (event: string, session: FakeSession | null) => void;
type FakeError = { message?: string; status?: number; code?: string; name?: string };

export const fakeAuth = {
  configured: true,
  session: null as FakeSession | null,
  listeners: [] as Listener[],
  calls: [] as { method: string; args: unknown[] }[],
  errors: {} as Partial<Record<string, FakeError>>,
  oauthUrl: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=test',
  hold: null as Promise<void> | null,
};

export function resetFakeAuth() {
  fakeAuth.configured = true;
  fakeAuth.session = null;
  fakeAuth.listeners = [];
  fakeAuth.calls = [];
  fakeAuth.errors = {};
  fakeAuth.oauthUrl = 'https://accounts.google.com/o/oauth2/v2/auth?client_id=test';
  fakeAuth.hold = null;
}

export function accountsConfigured(): boolean {
  return fakeAuth.configured;
}

function take(method: string, args: unknown[]): FakeError | null {
  fakeAuth.calls.push({ method, args });
  return fakeAuth.errors[method] ?? null;
}

function notify(event: string, session: FakeSession | null) {
  for (const listener of [...fakeAuth.listeners]) listener(event, session);
}

function signedIn(email: string | null): FakeSession {
  const session = { access_token: 'token', user: { id: 'user-1', email } };
  fakeAuth.session = session;
  notify('SIGNED_IN', session);
  return session;
}

export const supabase = {
  auth: {
    async getSession() {
      if (fakeAuth.hold) await fakeAuth.hold;
      take('getSession', []);
      return { data: { session: fakeAuth.session }, error: null };
    },
    onAuthStateChange(callback: Listener) {
      fakeAuth.listeners.push(callback);
      return {
        data: {
          subscription: {
            unsubscribe() {
              fakeAuth.listeners = fakeAuth.listeners.filter((listener) => listener !== callback);
            },
          },
        },
      };
    },
    async signOut(options?: unknown) {
      const error = take('signOut', [options]);
      if (!error) {
        fakeAuth.session = null;
        notify('SIGNED_OUT', null);
      }
      return { error };
    },
    async signInWithOtp(credentials: unknown) {
      const error = take('signInWithOtp', [credentials]);
      return { data: { user: null, session: null }, error };
    },
    async verifyOtp(params: unknown) {
      const error = take('verifyOtp', [params]);
      if (error) return { data: { user: null, session: null }, error };
      const email =
        params && typeof params === 'object' && 'email' in params ? String((params as { email: unknown }).email) : null;
      const session = signedIn(email);
      return { data: { user: session.user, session }, error: null };
    },
    async signInWithOAuth(credentials: unknown) {
      const error = take('signInWithOAuth', [credentials]);
      if (error || !fakeAuth.oauthUrl) {
        return { data: { provider: 'google', url: null }, error: error ?? { message: 'missing url' } };
      }
      return { data: { provider: 'google', url: fakeAuth.oauthUrl }, error: null };
    },
    async exchangeCodeForSession(code: string) {
      const error = take('exchangeCodeForSession', [code]);
      if (error) return { data: { user: null, session: null }, error };
      const session = signedIn('reader@example.com');
      return { data: { user: session.user, session }, error: null };
    },
    async signInWithIdToken(credentials: unknown) {
      const error = take('signInWithIdToken', [credentials]);
      if (error) return { data: { user: null, session: null }, error };
      const session = signedIn('reader@example.com');
      return { data: { user: session.user, session }, error: null };
    },
    startAutoRefresh() {
      take('startAutoRefresh', []);
    },
    stopAutoRefresh() {
      take('stopAutoRefresh', []);
    },
  },
};
