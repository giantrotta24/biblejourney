import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { useDurableValue } from '@/persist/durable';
import { useRecord, useRuntime } from '@/sync/react';

import { loadNotes, saveNotes, withNote, type KeyValueStore, type NoteRow } from './store';

export type StoreStatus = 'loading' | 'ready' | 'unavailable';

type NotesApi = {
  rows: readonly NoteRow[];
  status: StoreStatus;
  retry: () => void;
  saving: boolean;
  failed: boolean;
  setBody: (dayIndex: number, body: string) => void;
  remove: (dayIndex: number) => void;
  clearNotes: () => void;
};

const NotesContext = createContext<NotesApi | null>(null);

function emptyNotes(): NoteRow[] {
  return [];
}

export function NotesProvider({
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
  const { value, unavailable, saving, failed, read, isReady, isUnavailable, isUnreadable, commit, beginRetry } =
    useDurableValue({
    storage,
    load: loadNotes,
    save: saveNotes,
    empty: emptyNotes,
    attempt,
  });

  const setBody = useCallback(
    (dayIndex: number, body: string) => {
      if (!isReady()) return;
      const updatedAt = nowRef.current().toISOString();
      const next = withNote(read(), dayIndex, body, updatedAt);
      if (next === read()) return;
      commit(next);
      const row = next.find((item) => item.day_index === dayIndex);
      if (row) record({ kind: 'put-note', row });
      else record({ kind: 'delete-note', day_index: dayIndex, deleted_at: updatedAt });
    },
    [commit, isReady, read, record],
  );

  const clearNotes = useCallback(() => {
    if (!isReady()) return;
    if (read().length === 0) return;
    commit([]);
  }, [commit, isReady, read]);

  const replaceNotes = useCallback(
    (rows: readonly NoteRow[]) => {
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
      replace: replaceNotes,
    }),
    [isReady, isUnavailable, isUnreadable, read, replaceNotes],
  );
  useEffect(() => {
    if (!runtime) return;
    return runtime.register('notes', book);
  }, [book, runtime, value, unavailable]);

  const remove = useCallback((dayIndex: number) => setBody(dayIndex, ''), [setBody]);
  const retry = useCallback(() => {
    beginRetry();
    setAttempt((next) => next + 1);
  }, [beginRetry]);
  const status: StoreStatus = unavailable ? 'unavailable' : value ? 'ready' : 'loading';

  return (
    <NotesContext.Provider value={{ rows: value ?? [], status, retry, saving, failed, setBody, remove, clearNotes }}>
      {children}
    </NotesContext.Provider>
  );
}

export function useNotes(): NotesApi {
  const api = useContext(NotesContext);
  if (!api) throw new Error('useNotes must be used inside NotesProvider');
  return api;
}
