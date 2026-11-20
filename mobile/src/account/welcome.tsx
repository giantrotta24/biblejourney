import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';

import { WelcomeView } from '@/components/welcome-view';
import { useNotes } from '@/notes/context';
import { StorageBlank } from '@/persist/retry';
import { useProgress } from '@/progress/context';
import { useVerses } from '@/verses/context';

export const WELCOMED_KEY = 'biblejourney.welcomed';

type Decision = 'loading' | 'show' | 'hide';

let welcomeEpoch = 0;
const welcomeListeners = new Set<() => void>();

function subscribeWelcome(listener: () => void) {
  welcomeListeners.add(listener);
  return () => welcomeListeners.delete(listener);
}

function currentWelcomeEpoch() {
  return welcomeEpoch;
}

export async function clearWelcomed(): Promise<void> {
  await AsyncStorage.removeItem(WELCOMED_KEY);
  welcomeEpoch += 1;
  for (const listener of welcomeListeners) listener();
}

function useFirstRun(): { decision: Decision; epoch: number } {
  const progress = useProgress();
  const notes = useNotes();
  const verses = useVerses();
  const epoch = useSyncExternalStore(subscribeWelcome, currentWelcomeEpoch, currentWelcomeEpoch);
  const [welcomed, setWelcomed] = useState<boolean | null>(null);
  const [seenEpoch, setSeenEpoch] = useState(epoch);
  const welcomedNow = seenEpoch === epoch ? welcomed : null;
  if (seenEpoch !== epoch) {
    setSeenEpoch(epoch);
    setWelcomed(null);
  }

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(WELCOMED_KEY).then(
      (value) => {
        if (active) setWelcomed(value === '1');
      },
      () => {
        if (active) setWelcomed(true);
      },
    );
    return () => {
      active = false;
    };
  }, [epoch]);

  let decision: Decision;
  if (welcomedNow == null || notes.status === 'loading' || verses.status === 'loading') decision = 'loading';
  else if (welcomedNow) decision = 'hide';
  else if (notes.status !== 'ready' || verses.status !== 'ready') decision = 'hide';
  else if (progress.days.size > 0 || notes.rows.length > 0 || verses.rows.length > 0) decision = 'hide';
  else decision = 'show';
  return { decision, epoch };
}

export function WelcomeGate({ children, onAccount }: { children: ReactNode; onAccount: () => void }) {
  const { decision, epoch } = useFirstRun();
  const [dismissedEpoch, setDismissedEpoch] = useState<number | null>(null);

  async function leave(then?: () => void) {
    try {
      await AsyncStorage.setItem(WELCOMED_KEY, '1');
    } catch {
      // A failed write must not keep the reader on the welcome.
    }
    setDismissedEpoch(epoch);
    then?.();
  }

  if (dismissedEpoch === epoch || decision === 'hide') return children;
  if (decision === 'loading') return <StorageBlank />;
  return <WelcomeView onStart={() => void leave()} onAccount={() => void leave(onAccount)} />;
}
