import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { useDurableValue } from '@/persist/durable';
import { useRecord, useRuntime } from '@/sync/react';

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
  const runtime = useRuntime();
  const record = useRecord();
  const { value, unavailable, read, isReady, isUnavailable, isUnreadable, commit, beginRetry } = useDurableValue({
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
      const row = next.find((item) => item.week === week);
      if (row) record({ kind: 'put-verse', row });
      else record({ kind: 'delete-verse', week });
    },
    [commit, isReady, read, record],
  );

  const replaceVerses = useCallback(
    (rows: readonly VerseRow[]) => {
      if (!isReady()) return;
      commit([...rows]);
    },
    [commit, isReady],
  );
  const book = useMemo(
    () => ({
      read,
      ready: isReady,
      unavailable: isUnavailable,
      unreadable: isUnreadable,
      replace: replaceVerses,
    }),
    [isReady, isUnavailable, isUnreadable, read, replaceVerses],
  );
  useEffect(() => {
    if (!runtime) return;
    return runtime.register('verses', book);
  }, [book, runtime]);

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
