import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import type { Sync } from '@/sync/engine';
import { useRuntime } from '@/sync/react';

import { syncAction } from './follow';
import { listenForAuthRefresh } from './refresh';
import { accountsConfigured, supabase } from './supabase';

export type SessionSnapshot = {
  status: 'loading' | 'signed-out' | 'signed-in' | 'unavailable';
  user: User | null;
  email: string | null;
};

const SIGNED_OUT: SessionSnapshot = { status: 'signed-out', user: null, email: null };

const SessionContext = createContext<SessionSnapshot | null>(null);
let boundSync: Sync | null = null;

export function bindSync(sync: Sync | null) {
  boundSync = sync;
}

function toState(session: Session | null): SessionSnapshot {
  if (!session?.user) return SIGNED_OUT;
  return { status: 'signed-in', user: session.user, email: session.user.email ?? null };
}

function initialState(): SessionSnapshot {
  if (!accountsConfigured() || !supabase) return { status: 'unavailable', user: null, email: null };
  return { status: 'loading', user: null, email: null };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionSnapshot>(initialState);
  const runtime = useRuntime();

  useEffect(() => {
    if (!accountsConfigured() || !supabase) return;
    let active = true;
    let seen = false;
    const stopRefresh = listenForAuthRefresh(supabase);
    const sync = runtime?.sync ?? null;
    if (sync) bindSync(sync);
    const follow = (event: string, session: Session | null) => {
      const userId = session?.user.id ?? null;
      if (!runtime || !sync) return;
      const action = syncAction(event, userId, sync.userId());
      if (action === 'stop') {
        void sync.stop();
        return;
      }
      if (action !== 'start' || !userId) return;
      const remote = runtime.resolveRemote(userId);
      if (remote) void sync.start(userId, remote);
    };
    void supabase.auth.getSession().then(
      ({ data, error }) => {
        if (!active || seen) return;
        const session = error ? null : data.session;
        setState(session ? toState(session) : SIGNED_OUT);
        const userId = session?.user.id ?? null;
        if (!userId || !runtime) return;
        const remote = runtime.resolveRemote(userId);
        if (remote) void runtime.sync.start(userId, remote);
      },
      () => {
        if (!active || seen) return;
        setState(SIGNED_OUT);
      },
    );
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      seen = true;
      setState(toState(session));
      follow(event, session);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
      stopRefresh();
      if (sync && boundSync === sync) bindSync(null);
      sync?.pause();
    };
  }, [runtime]);

  return <SessionContext.Provider value={state}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionSnapshot {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}

export async function signOut(): Promise<void> {
  if (!accountsConfigured() || !supabase) return;
  await supabase.auth.signOut({ scope: 'local' });
  await boundSync?.stop();
}
