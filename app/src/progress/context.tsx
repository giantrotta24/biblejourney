import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { DAY_COUNT } from '../../../supabase/functions/_shared/content/plan';
import { useColors } from '@/theme/colors';

import { loadProgress, saveProgress } from './store';

type ProgressApi = {
  days: ReadonlySet<number>;
  mark: (index: number) => void;
};

const ProgressContext = createContext<ProgressApi | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const colors = useColors();
  const [days, setDays] = useState<ReadonlySet<number> | null>(null);
  const daysRef = useRef<ReadonlySet<number>>(new Set());

  useEffect(() => {
    let live = true;
    loadProgress().then((loaded) => {
      if (!live) return;
      daysRef.current = loaded;
      setDays(loaded);
    });
    return () => {
      live = false;
    };
  }, []);

  const mark = useCallback((index: number) => {
    if (!Number.isInteger(index) || index < 0 || index >= DAY_COUNT) return;
    const next = new Set(daysRef.current);
    next.add(index);
    if (next.size === daysRef.current.size) return;
    daysRef.current = next;
    setDays(next);
    void saveProgress(next);
  }, []);

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
