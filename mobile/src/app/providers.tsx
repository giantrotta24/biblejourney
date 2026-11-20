import type { ReactNode } from 'react';

import { SessionProvider } from '@/account/session';
import { NotesProvider } from '@/notes/context';
import type { KeyValueStore } from '@/persist/document';
import { ProgressProvider } from '@/progress/context';
import { VersesProvider } from '@/verses/context';

export function ReadingProviders({
  children,
  notesStorage,
  versesStorage,
  progressStorage,
}: {
  children: ReactNode;
  notesStorage?: KeyValueStore;
  versesStorage?: KeyValueStore;
  progressStorage?: KeyValueStore;
}) {
  return (
    <SessionProvider>
      <NotesProvider storage={notesStorage}>
        <VersesProvider storage={versesStorage}>
          <ProgressProvider storage={progressStorage}>{children}</ProgressProvider>
        </VersesProvider>
      </NotesProvider>
    </SessionProvider>
  );
}
