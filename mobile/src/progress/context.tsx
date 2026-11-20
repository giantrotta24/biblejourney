import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

import { useDurableValue } from '@/persist/durable';
import { StorageBlank, StorageRetry } from '@/persist/retry';
import { DAY_COUNT } from '../../../supabase/functions/_shared/content/plan';

import { loadProgress, saveProgress, type KeyValueStore } from './store';

type ProgressApi = {
  days: ReadonlySet<number>;
  mark: (index: number) => void;
};

const ProgressContext = createContext<ProgressApi | null>(null);

function emptyDays(): Set<number> {
  return new Set();
}

async function loadDays(storage: KeyValueStore) {
  const result = await loadProgress(storage);
  if (result.status === 'ready') return { status: 'ready' as const, value: result.days };
  return result;
}

function saveDays(days: ReadonlySet<number>, storage: KeyValueStore, backupRaw?: string | null) {
  return saveProgress(days, storage, backupRaw);
}

export function ProgressProvider({
  children,
  storage = AsyncStorage,
}: {
  children: ReactNode;
  storage?: KeyValueStore;
}) {
  const [attempt, setAttempt] = useState(0);
  const { value, unavailable, read, isReady, commit } = useDurableValue({
    storage,
    load: loadDays,
    save: saveDays,
    empty: emptyDays,
    attempt,
  });

  const mark = useCallback(
    (index: number) => {
      if (!isReady()) return;
      if (!Number.isInteger(index) || index < 0 || index >= DAY_COUNT) return;
      const current = read();
      if (current.has(index)) return;
      const next = new Set(current);
      next.add(index);
      commit(next);
    },
    [commit, isReady, read],
  );

  function retry() {
    setAttempt((next) => next + 1);
  }

  if (unavailable) return <StorageRetry message="Couldn’t load your reading." onRetry={retry} />;
  if (!value) return <StorageBlank />;

  return <ProgressContext.Provider value={{ days: value, mark }}>{children}</ProgressContext.Provider>;
}

export function useProgress(): ProgressApi {
  const api = useContext(ProgressContext);
  if (!api) throw new Error('useProgress must be used inside ProgressProvider');
  return api;
}
