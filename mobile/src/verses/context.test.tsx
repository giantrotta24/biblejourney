import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';
import { AppState, Pressable, Text, View } from 'react-native';

import { VersesProvider, useVerses } from './context';
import { VERSES_KEY, type KeyValueStore } from './store';

const UNREADABLE_KEY = 'biblejourney.verses.v1.unreadable';

function memory(initial?: string): KeyValueStore & { raw: Map<string, string> } {
  const raw = new Map<string, string>();
  if (initial !== undefined) raw.set(VERSES_KEY, initial);
  return {
    raw,
    async getItem(key) {
      return raw.get(key) ?? null;
    },
    async setItem(key, value) {
      raw.set(key, value);
    },
  };
}

function LearnOnce() {
  const { setLearned } = useVerses();
  useEffect(() => {
    setLearned(1, true);
  }, [setLearned]);
  return <Text>learned</Text>;
}

function Marker() {
  const { rows, setLearned } = useVerses();
  const listed = [...rows]
    .sort((a, b) => a.week - b.week)
    .map((row) => `${row.week}@${row.learned_at}`)
    .join('|');
  return (
    <View>
      <Text>{listed ? `Verses: ${listed}` : 'Verses:'}</Text>
      <Pressable onPress={() => setLearned(1, true)}>
        <Text>Know 1</Text>
      </Pressable>
      <Pressable onPress={() => setLearned(2, true)}>
        <Text>Know 2</Text>
      </Pressable>
      <Pressable onPress={() => setLearned(1, false)}>
        <Text>Forget 1</Text>
      </Pressable>
      <Pressable onPress={() => setLearned(99, true)}>
        <Text>Know 99</Text>
      </Pressable>
    </View>
  );
}

describe('VersesProvider', () => {
  const listeners = new Set<(state: string) => void>();
  let now = new Date('2026-11-20T12:00:00.000Z');

  beforeEach(() => {
    now = new Date('2026-11-20T12:00:00.000Z');
    listeners.clear();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      listeners.add(listener as (state: string) => void);
      return { remove: () => listeners.delete(listener as (state: string) => void) };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function clock() {
    return now;
  }

  it('does not write when a verses read fails', async () => {
    const writes: string[] = [];
    const raw = new Map<string, string>([[VERSES_KEY, '{"version":1,"rows":[]}']]);
    const storage: KeyValueStore = {
      async getItem(key) {
        if (key === VERSES_KEY) throw new Error('read');
        return raw.get(key) ?? null;
      },
      async setItem(key, value) {
        writes.push(key);
        raw.set(key, value);
      },
    };

    await render(
      <VersesProvider storage={storage} now={clock}>
        <LearnOnce />
      </VersesProvider>,
    );

    await waitFor(() => {
      expect(screen.queryByText('learned') ?? screen.queryByRole('button', { name: 'Try again' })).toBeTruthy();
    });
    expect(writes).toEqual([]);
    expect(screen.getByText('Couldn’t load your verses.')).toBeOnTheScreen();
    expect(screen.queryByText('learned')).toBeNull();
  });

  it('copies unreadable verses aside before the first save', async () => {
    const corrupt = '{"version":1';
    const storage = memory(corrupt);
    await render(
      <VersesProvider storage={storage} now={clock}>
        <Marker />
      </VersesProvider>,
    );

    await fireEvent.press(await screen.findByText('Know 1'));
    await waitFor(() => {
      expect(storage.raw.get(UNREADABLE_KEY)).toBe(corrupt);
    });
    expect(JSON.parse(storage.raw.get(VERSES_KEY) ?? '').rows).toEqual([
      { week: 1, learned_at: '2026-11-20T12:00:00.000Z' },
    ]);
  });

  it('keeps the first learned time and removes a verse that is unmarked', async () => {
    const storage = memory();
    await render(
      <VersesProvider storage={storage} now={clock}>
        <Marker />
      </VersesProvider>,
    );

    await fireEvent.press(await screen.findByText('Know 1'));
    await waitFor(() => {
      expect(screen.getByText('Verses: 1@2026-11-20T12:00:00.000Z')).toBeOnTheScreen();
    });
    now = new Date('2026-11-21T12:00:00.000Z');
    await fireEvent.press(screen.getByText('Know 1'));
    expect(screen.getByText('Verses: 1@2026-11-20T12:00:00.000Z')).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('Forget 1'));
    await waitFor(() => {
      expect(screen.getByText('Verses:')).toBeOnTheScreen();
      expect(JSON.parse(storage.raw.get(VERSES_KEY) ?? '')).toEqual({ version: 1, rows: [] });
    });
  });

  it('retries a failed save when the app returns to the foreground', async () => {
    let fail = true;
    const storage = memory();
    storage.setItem = async (key, value) => {
      if (fail) throw new Error('disk');
      storage.raw.set(key, value);
    };

    await render(
      <VersesProvider storage={storage} now={clock}>
        <Marker />
      </VersesProvider>,
    );

    expect(await screen.findByText('Know 1')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Know 1'));
    expect(await screen.findByText('Verses: 1@2026-11-20T12:00:00.000Z')).toBeOnTheScreen();
    expect(storage.raw.has(VERSES_KEY)).toBe(false);

    fail = false;
    for (const listener of listeners) listener('active');
    await waitFor(() => {
      expect(JSON.parse(storage.raw.get(VERSES_KEY) ?? '').rows).toEqual([
        { week: 1, learned_at: '2026-11-20T12:00:00.000Z' },
      ]);
    });
  });
});
