import { describe, expect, it } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ReadingProviders } from '@/app/providers';
import type { KeyValueStore } from '@/persist/document';

describe('ReadingProviders', () => {
  it('starts notes, verses, and progress together, and still waits on progress', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const started: string[] = [];
    function storage(name: string, wait?: Promise<void>): KeyValueStore {
      return {
        async getItem() {
          started.push(name);
          if (wait) await wait;
          return null;
        },
        async setItem() {},
      };
    }

    await render(
      <ReadingProviders
        notesStorage={storage('notes')}
        versesStorage={storage('verses')}
        progressStorage={storage('progress', gate)}>
        <Text>app</Text>
      </ReadingProviders>,
    );

    await waitFor(() => {
      expect(started).toEqual(expect.arrayContaining(['notes', 'verses', 'progress']));
    });
    expect(screen.queryByText('app')).toBeNull();
    release();
    expect(await screen.findByText('app')).toBeOnTheScreen();
  });
});
