import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { useDurableValue } from '@/persist/durable';
import { StorageBlank, StorageRetry } from '@/persist/retry';

import { loadVerses, saveVerses, withLearned, type KeyValueStore, type VerseRow } from './store';

type VersesApi = {
  rows: readonly VerseRow[];
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
  const { value, unavailable, read, isReady, commit } = useDurableValue({
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

  if (unavailable) {
    return <StorageRetry message="Couldn’t load your verses." onRetry={() => setAttempt((next) => next + 1)} />;
  }
  if (!value) return <StorageBlank />;

  return <VersesContext.Provider value={{ rows: value, setLearned }}>{children}</VersesContext.Provider>;
}

export function useVerses(): VersesApi {
  const api = useContext(VersesContext);
  if (!api) throw new Error('useVerses must be used inside VersesProvider');
  return api;
}
