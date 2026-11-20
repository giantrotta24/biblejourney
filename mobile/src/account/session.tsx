import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { listenForAuthRefresh } from './refresh';
import { accountsConfigured, supabase } from './supabase';

export type SessionSnapshot = {
  status: 'loading' | 'signed-out' | 'signed-in' | 'unavailable';
  user: User | null;
  email: string | null;
};

const SIGNED_OUT: SessionSnapshot = { status: 'signed-out', user: null, email: null };

const SessionContext = createContext<SessionSnapshot | null>(null);

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

  useEffect(() => {
    if (!accountsConfigured() || !supabase) return;
    let active = true;
    let seen = false;
    const stopRefresh = listenForAuthRefresh(supabase);
    void supabase.auth.getSession().then(
      ({ data, error }) => {
        if (!active || seen) return;
        setState(error ? SIGNED_OUT : toState(data.session));
      },
      () => {
        if (!active || seen) return;
        setState(SIGNED_OUT);
      },
    );
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      seen = true;
      setState(toState(session));
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
      stopRefresh();
    };
  }, []);

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
}
