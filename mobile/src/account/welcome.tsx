import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState, type ReactNode } from 'react';

import { WelcomeView } from '@/components/welcome-view';
import { useNotes } from '@/notes/context';
import { StorageBlank } from '@/persist/retry';
import { useProgress } from '@/progress/context';
import { useVerses } from '@/verses/context';

export const WELCOMED_KEY = 'biblejourney.welcomed';

type Decision = 'loading' | 'show' | 'hide';

function useFirstRun(): Decision {
  const progress = useProgress();
  const notes = useNotes();
  const verses = useVerses();
  const [welcomed, setWelcomed] = useState<boolean | null>(null);

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
  }, []);

  if (welcomed == null || notes.status === 'loading' || verses.status === 'loading') return 'loading';
  if (welcomed) return 'hide';
  if (notes.status !== 'ready' || verses.status !== 'ready') return 'hide';
  if (progress.days.size > 0 || notes.rows.length > 0 || verses.rows.length > 0) return 'hide';
  return 'show';
}

export function WelcomeGate({ children, onAccount }: { children: ReactNode; onAccount: () => void }) {
  const decision = useFirstRun();
  const [dismissed, setDismissed] = useState(false);

  async function leave(then?: () => void) {
    try {
      await AsyncStorage.setItem(WELCOMED_KEY, '1');
    } catch {
      // A failed write must not keep the reader on the welcome.
    }
    setDismissed(true);
    then?.();
  }

  if (dismissed || decision === 'hide') return children;
  if (decision === 'loading') return <StorageBlank />;
  return <WelcomeView onStart={() => void leave()} onAccount={() => void leave(onAccount)} />;
}
