import { useMemo, type ReactNode } from 'react';

import { SessionProvider } from '@/account/session';
import { ReminderRuntime } from '@/reminders/runtime';
import { SettingsSync } from '@/settings/client';
import { NotesProvider } from '@/notes/context';
import type { KeyValueStore } from '@/persist/document';
import { ProgressProvider } from '@/progress/context';
import { createRuntime, SyncRuntimeProvider } from '@/sync/react';
import type { RemoteAccount } from '@/sync/remote';
import { VersesProvider } from '@/verses/context';

export function ReadingProviders({
  children,
  notesStorage,
  versesStorage,
  progressStorage,
  remoteFor,
}: {
  children: ReactNode;
  notesStorage?: KeyValueStore;
  versesStorage?: KeyValueStore;
  progressStorage?: KeyValueStore;
  remoteFor?: (userId: string) => RemoteAccount | null | undefined;
}) {
  const runtime = useMemo(() => createRuntime(remoteFor ? { remoteFor } : undefined), [remoteFor]);

  return (
    <SyncRuntimeProvider runtime={runtime}>
      <SessionProvider>
        <SettingsSync />
        <NotesProvider storage={notesStorage}>
          <VersesProvider storage={versesStorage}>
            <ProgressProvider storage={progressStorage}>
              <ReminderRuntime />
              {children}
            </ProgressProvider>
          </VersesProvider>
        </NotesProvider>
      </SessionProvider>
    </SyncRuntimeProvider>
  );
}
