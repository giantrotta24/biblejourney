import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, Pressable, Text, View } from 'react-native';

import { DAY_COUNT } from '../../../supabase/functions/_shared/content/plan';
import { useColors } from '@/theme/colors';
import { hitSize } from '@/theme/fonts';

import { loadProgress, saveProgress, type KeyValueStore } from './store';

type ProgressApi = {
  days: ReadonlySet<number>;
  mark: (index: number) => void;
};

const ProgressContext = createContext<ProgressApi | null>(null);

export function ProgressProvider({
  children,
  storage = AsyncStorage,
}: {
  children: ReactNode;
  storage?: KeyValueStore;
}) {
  const colors = useColors();
  const [days, setDays] = useState<ReadonlySet<number> | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const daysRef = useRef<ReadonlySet<number>>(new Set());
  const backupRef = useRef<string | null>(null);
  const pendingRef = useRef<ReadonlySet<number> | null>(null);
  const writingRef = useRef(false);
  const readyRef = useRef(false);
  const storageRef = useRef(storage);
  useEffect(() => {
    storageRef.current = storage;
  }, [storage]);

  const flush = useCallback(async () => {
    if (writingRef.current) return;
    writingRef.current = true;
    try {
      while (pendingRef.current) {
        const snapshot = pendingRef.current;
        pendingRef.current = null;
        const backup = backupRef.current;
        try {
          await saveProgress(snapshot, storageRef.current, backup);
          if (backupRef.current === backup) backupRef.current = null;
        } catch {
          pendingRef.current = pendingRef.current ?? snapshot;
          break;
        }
      }
    } finally {
      writingRef.current = false;
    }
  }, []);

  useEffect(() => {
    let live = true;
    readyRef.current = false;
    loadProgress(storage).then((result) => {
      if (!live) return;
      if (result.status === 'unavailable') {
        backupRef.current = null;
        pendingRef.current = null;
        daysRef.current = new Set();
        setDays(null);
        setUnavailable(true);
        return;
      }
      const loaded = result.status === 'ready' ? result.days : new Set<number>();
      backupRef.current = result.status === 'unreadable' ? result.raw : null;
      daysRef.current = loaded;
      readyRef.current = true;
      setUnavailable(false);
      setDays(loaded);
    });
    return () => {
      live = false;
    };
  }, [storage, attempt]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && pendingRef.current) void flush();
    });
    return () => subscription.remove();
  }, [flush]);

  const mark = useCallback(
    (index: number) => {
      if (!readyRef.current) return;
      if (!Number.isInteger(index) || index < 0 || index >= DAY_COUNT) return;
      const next = new Set(daysRef.current);
      next.add(index);
      if (next.size === daysRef.current.size) return;
      daysRef.current = next;
      setDays(next);
      pendingRef.current = next;
      void flush();
    },
    [flush],
  );

  function retry() {
    readyRef.current = false;
    setDays(null);
    setUnavailable(false);
    setAttempt((value) => value + 1);
  }

  if (unavailable) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.paper,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 22,
        }}>
        <Text style={{ fontSize: 17, lineHeight: 24, color: colors.ink, textAlign: 'center' }}>
          Couldn’t load your reading.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Try again"
          onPress={retry}
          style={{ minHeight: hitSize(), justifyContent: 'center' }}>
          <Text
            style={{
              fontSize: 17,
              color: colors.ink,
              textDecorationLine: 'underline',
              textDecorationColor: colors.ink3,
            }}>
            Try again
          </Text>
        </Pressable>
      </View>
    );
  }

  if (!days) {
    return <View style={{ flex: 1, backgroundColor: colors.paper }} />;
  }

  return <ProgressContext.Provider value={{ days, mark }}>{children}</ProgressContext.Provider>;
}

export function useProgress(): ProgressApi {
  const value = useContext(ProgressContext);
  if (!value) throw new Error('useProgress must be used inside ProgressProvider');
  return value;
}
