import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { useDurableValue } from '@/persist/durable';
import { StorageBlank, StorageRetry } from '@/persist/retry';
import { useRecord, useRuntime } from '@/sync/react';
import { DAY_COUNT } from '../../../supabase/functions/_shared/content/plan';

import { loadProgress, saveProgress, type DayRow, type KeyValueStore } from './store';

type ProgressApi = {
  days: ReadonlySet<number>;
  rows: readonly DayRow[];
  mark: (index: number) => void;
  unmark: (index: number) => void;
  clearDays: () => Promise<boolean>;
  replaceDays: (rows: readonly DayRow[]) => void;
};

const ProgressContext = createContext<ProgressApi | null>(null);

function emptyDays(): DayRow[] {
  return [];
}

async function loadRows(storage: KeyValueStore) {
  const result = await loadProgress(storage);
  if (result.status === 'ready') return { status: 'ready' as const, value: result.rows };
  return result;
}

function saveRows(rows: readonly DayRow[], storage: KeyValueStore, backupRaw?: string | null) {
  return saveProgress(rows, storage, backupRaw);
}

export function ProgressProvider({
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
    load: loadRows,
    save: saveRows,
    empty: emptyDays,
    attempt,
  });

  const mark = useCallback(
    (index: number) => {
      if (!isReady()) return;
      if (!Number.isInteger(index) || index < 0 || index >= DAY_COUNT) return;
      const current = read();
      if (current.some((row) => row.day_index === index)) return;
      const row = { day_index: index, completed_at: nowRef.current().toISOString() };
      const next = [...current, row].sort((a, b) => a.day_index - b.day_index);
      commit(next);
      record({ kind: 'put-day', row });
    },
    [commit, isReady, read, record],
  );

  const unmark = useCallback(
    (index: number) => {
      if (!isReady()) return;
      const current = read();
      if (!current.some((row) => row.day_index === index)) return;
      commit(current.filter((row) => row.day_index !== index));
      record({ kind: 'delete-day', day_index: index });
    },
    [commit, isReady, read, record],
  );

  const clearDays = useCallback(() => {
    if (!isReady()) return Promise.resolve(false);
    if (read().length === 0) return Promise.resolve(true);
    return commit([]).then(() => true);
  }, [commit, isReady, read]);

  const replaceDays = useCallback(
    (rows: readonly DayRow[]) => {
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
      replace: replaceDays,
    }),
    [isReady, isUnavailable, isUnreadable, read, replaceDays],
  );
  useEffect(() => {
    if (!runtime) return;
    return runtime.register('days', book);
  }, [book, runtime, value, unavailable]);

  function retry() {
    beginRetry();
    setAttempt((next) => next + 1);
  }

  const days = useMemo(() => new Set((value ?? []).map((row) => row.day_index)), [value]);
  const api = useMemo(
    () => ({ days, rows: value ?? [], mark, unmark, clearDays, replaceDays }),
    [clearDays, days, mark, replaceDays, unmark, value],
  );

  if (unavailable) return <StorageRetry message="Couldn’t load your reading." onRetry={retry} />;
  if (!value) return <StorageBlank />;

  return <ProgressContext.Provider value={api}>{children}</ProgressContext.Provider>;
}

export function useProgress(): ProgressApi {
  const api = useContext(ProgressContext);
  if (!api) throw new Error('useProgress must be used inside ProgressProvider');
  return api;
}
