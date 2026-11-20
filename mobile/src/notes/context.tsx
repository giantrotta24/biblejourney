import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { useDurableValue } from '@/persist/durable';
import { StorageBlank, StorageRetry } from '@/persist/retry';

import { loadNotes, saveNotes, withNote, type KeyValueStore, type NoteRow } from './store';

type NotesApi = {
  rows: readonly NoteRow[];
  setBody: (dayIndex: number, body: string) => void;
  remove: (dayIndex: number) => void;
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
  const { value, unavailable, read, isReady, commit } = useDurableValue({
    storage,
    load: loadNotes,
    save: saveNotes,
    empty: emptyNotes,
    attempt,
  });

  const setBody = useCallback(
    (dayIndex: number, body: string) => {
      if (!isReady()) return;
      const next = withNote(read(), dayIndex, body, nowRef.current().toISOString());
      if (next === read()) return;
      commit(next);
    },
    [commit, isReady, read],
  );

  const remove = useCallback((dayIndex: number) => setBody(dayIndex, ''), [setBody]);

  if (unavailable) {
    return <StorageRetry message="Couldn’t load your notes." onRetry={() => setAttempt((next) => next + 1)} />;
  }
  if (!value) return <StorageBlank />;

  return <NotesContext.Provider value={{ rows: value, setBody, remove }}>{children}</NotesContext.Provider>;
}

export function useNotes(): NotesApi {
  const api = useContext(NotesContext);
  if (!api) throw new Error('useNotes must be used inside NotesProvider');
  return api;
}
