import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { PixelRatio, StyleSheet, Text } from 'react-native';

import { WelcomeGate, WELCOMED_KEY } from '@/account/welcome';
import { NotesProvider } from '@/notes/context';
import { NOTES_KEY } from '@/notes/store';
import type { KeyValueStore } from '@/persist/document';
import { ProgressProvider } from '@/progress/context';
import { PROGRESS_KEY } from '@/progress/store';
import { VersesProvider } from '@/verses/context';
import { VERSES_KEY } from '@/verses/store';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

function memory(seed: Record<string, string> = {}): KeyValueStore {
  const raw = new Map(Object.entries(seed));
  return {
    async getItem(key) {
      return raw.get(key) ?? null;
    },
    async setItem(key, value) {
      raw.set(key, value);
    },
  };
}

async function show(storage: KeyValueStore, onAccount = jest.fn()) {
  await render(
    <NotesProvider storage={storage}>
      <VersesProvider storage={storage}>
        <ProgressProvider storage={storage}>
          <WelcomeGate onAccount={onAccount}>
            <Text>Today</Text>
          </WelcomeGate>
        </ProgressProvider>
      </VersesProvider>
    </NotesProvider>,
  );
  return onAccount;
}

describe('first run', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('shows the welcome once on a fresh phone, and each button leaves it', async () => {
    const onAccount = await show(memory());
    expect(await screen.findByText('Read the whole Bible in a year, in the order it happened.')).toBeOnTheScreen();
    expect(screen.getByText(/no streaks/)).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Start with day 1' }));
    expect(screen.getByText('Today')).toBeOnTheScreen();
    expect(onAccount).not.toHaveBeenCalled();
    expect(await AsyncStorage.getItem(WELCOMED_KEY)).toBe('1');

    await screen.unmount();
    await show(memory());
    expect(await screen.findByText('Today')).toBeOnTheScreen();
    expect(screen.queryByText(/Read the whole Bible/)).toBeNull();
  });

  it('opens sign in from the welcome and does not show it again', async () => {
    await AsyncStorage.clear();
    const onAccount = await show(memory());
    await screen.findByRole('button', { name: 'I already have an account' });
    await fireEvent.press(screen.getByRole('button', { name: 'I already have an account' }));
    expect(onAccount).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Today')).toBeOnTheScreen();
    expect(await AsyncStorage.getItem(WELCOMED_KEY)).toBe('1');
  });

  it('never shows the welcome when progress, a note, or a known verse is already stored', async () => {
    const progress = JSON.stringify({ version: 1, days: [0] });
    const note = JSON.stringify({
      version: 1,
      rows: [{ day_index: 0, body: 'Already written', updated_at: '2026-11-18T12:00:00.000Z' }],
    });
    const verse = JSON.stringify({
      version: 1,
      rows: [{ week: 1, learned_at: '2026-11-18T12:00:00.000Z' }],
    });
    const seeds: Record<string, string>[] = [
      { [PROGRESS_KEY]: progress },
      { [NOTES_KEY]: note },
      { [VERSES_KEY]: verse },
    ];
    for (const seed of seeds) {
      await show(memory(seed));
      expect(await screen.findByText('Today')).toBeOnTheScreen();
      expect(screen.queryByText(/Read the whole Bible/)).toBeNull();
      await screen.unmount();
    }
  });

  it('uses the same day numeral as Today', async () => {
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(1);
    try {
      await show(memory());
      const numeral = await screen.findByLabelText('Day 1');
      const style = StyleSheet.flatten(numeral.props.style);
      expect(numeral.props.allowFontScaling).toBe(false);
      expect(style.fontSize).toBe(128);
      expect(style.letterSpacing).toBeCloseTo(128 * -0.02);
      expect(style.marginTop).toBe(-Math.round(128 * 0.17));
      expect(style.marginBottom).toBe(-Math.round(128 * 0.08));
    } finally {
      jest.restoreAllMocks();
    }
  });

  it('steps the welcome numeral down at large text', async () => {
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(2);
    try {
      await show(memory());
      const style = StyleSheet.flatten((await screen.findByLabelText('Day 1')).props.style);
      expect(style.fontSize).toBe(112);
    } finally {
      jest.restoreAllMocks();
    }
  });

  it('leaves the welcome when the flag cannot be saved', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('full'));
    const onAccount = await show(memory());
    await screen.findByRole('button', { name: 'I already have an account' });
    await fireEvent.press(screen.getByRole('button', { name: 'I already have an account' }));
    expect(screen.getByText('Today')).toBeOnTheScreen();
    expect(onAccount).toHaveBeenCalledTimes(1);
  });

  it('waits while notes are still loading', async () => {
    let notesRead = false;
    const storage: KeyValueStore = {
      async getItem(key) {
        if (key === NOTES_KEY) {
          notesRead = true;
          return new Promise(() => {});
        }
        return null;
      },
      async setItem() {},
    };
    await show(storage);
    await waitFor(() => expect(notesRead).toBe(true));
    expect(screen.queryByText(/Read the whole Bible/)).toBeNull();
    expect(screen.queryByText('Today')).toBeNull();
  });
});
