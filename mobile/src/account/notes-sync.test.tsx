import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { SessionProvider } from '@/account/session';
import { NotesView } from '@/components/notes-view';
import { NotesProvider } from '@/notes/context';
import type { KeyValueStore } from '@/notes/store';
import { ProgressProvider } from '@/progress/context';

import { fakeAuth, resetFakeAuth } from './fake-supabase';

/* eslint-disable @typescript-eslint/no-require-imports -- the mock factory cannot close over an import */
jest.mock('@/account/supabase', () => require('@/account/fake-supabase'));
/* eslint-enable @typescript-eslint/no-require-imports */

const SYNC = 'Notes are kept on this phone. Sign in to keep them on your other devices too.';

function memory(): KeyValueStore {
  return {
    async getItem() {
      return null;
    },
    async setItem() {},
  };
}

describe('Notes sync line', () => {
  beforeEach(() => {
    resetFakeAuth();
  });

  it('hides the sync line once the reader is signed in', async () => {
    fakeAuth.session = { access_token: 'token', user: { id: 'user-1', email: 'reader@example.com' } };
    await render(
      <GestureHandlerRootView>
        <SessionProvider>
          <ProgressProvider>
            <NotesProvider storage={memory()}>
              <NotesView onOpen={jest.fn()} />
            </NotesProvider>
          </ProgressProvider>
        </SessionProvider>
      </GestureHandlerRootView>,
    );
    expect(await screen.findByText('No notes yet')).toBeOnTheScreen();
    await waitFor(() => {
      expect(screen.queryByText(SYNC)).toBeNull();
    });
  });
});
