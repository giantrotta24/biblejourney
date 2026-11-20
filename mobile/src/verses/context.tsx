import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { useDurableValue } from '@/persist/durable';

import { loadVerses, saveVerses, withLearned, type KeyValueStore, type VerseRow } from './store';

type StoreStatus = 'loading' | 'ready' | 'unavailable';

type VersesApi = {
  rows: readonly VerseRow[];
  status: StoreStatus;
  retry: () => void;
  setLearned: (week: number, learned: boolean) => void;
};

const VersesContext = createContext<VersesApi | null>(null);

function emptyVerses(): VerseRow[] {
  return [];
}

export function VersesProvider({
  children,
  storage = AsyncStorage,
  now = () => new Date(),
}: {
  children: ReactNode;
  storage?: KeyValueStore;
  now?: () => Date;
}) {
  const [attempt, setAttempt] = useState(0);
  const nowRef = useRef(now);
  useEffect(() => {
    nowRef.current = now;
  }, [now]);
  const { value, unavailable, read, isReady, commit, beginRetry } = useDurableValue({
    storage,
    load: loadVerses,
    save: saveVerses,
    empty: emptyVerses,
    attempt,
  });

  const setLearned = useCallback(
    (week: number, learned: boolean) => {
      if (!isReady()) return;
      const next = withLearned(read(), week, learned, nowRef.current().toISOString());
      if (next === read()) return;
      commit(next);
    },
    [commit, isReady, read],
  );

  const retry = useCallback(() => {
    beginRetry();
    setAttempt((next) => next + 1);
  }, [beginRetry]);
  const status: StoreStatus = unavailable ? 'unavailable' : value ? 'ready' : 'loading';

  return (
    <VersesContext.Provider value={{ rows: value ?? [], status, retry, setLearned }}>{children}</VersesContext.Provider>
  );
}

export function useVerses(): VersesApi {
  const api = useContext(VersesContext);
  if (!api) throw new Error('useVerses must be used inside VersesProvider');
  return api;
}
