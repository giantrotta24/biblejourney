import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';
import { AppState, Pressable, Text, View } from 'react-native';

import { ProgressProvider, useProgress } from './context';
import { PROGRESS_KEY, PROGRESS_V2_KEY, PROGRESS_V2_UNREADABLE_KEY, type KeyValueStore } from './store';

const ORIGINAL = JSON.stringify({ version: 1, days: [0, 1, 2, 3, 4, 5] });

function savedDays(raw: string | undefined): number[] {
  const parsed = JSON.parse(raw ?? '') as { rows: { day_index: number }[] };
  return parsed.rows.map((row) => row.day_index);
}

function memory(initial?: string): KeyValueStore & { raw: Map<string, string> } {
  const raw = new Map<string, string>();
  if (initial !== undefined) raw.set(PROGRESS_KEY, initial);
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

function MarkOnce() {
  const { mark } = useProgress();
  useEffect(() => {
    mark(0);
  }, [mark]);
  return <Text>marked</Text>;
}

function Marker() {
  const { days, mark } = useProgress();
  const listed = [...days].sort((a, b) => a - b).join(',');
  return (
    <View>
      <Text>Days: {listed}</Text>
      <Pressable onPress={() => mark(0)}>
        <Text>Mark 0</Text>
      </Pressable>
      <Pressable onPress={() => mark(1)}>
        <Text>Mark 1</Text>
      </Pressable>
      <Pressable onPress={() => mark(2)}>
        <Text>Mark 2</Text>
      </Pressable>
      <Pressable onPress={() => mark(312)}>
        <Text>Mark 312</Text>
      </Pressable>
    </View>
  );
}

describe('ProgressProvider', () => {
  const listeners = new Set<(state: string) => void>();

  beforeEach(() => {
    listeners.clear();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      listeners.add(listener as (state: string) => void);
      return { remove: () => listeners.delete(listener as (state: string) => void) };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not write when a progress read fails and a day is marked', async () => {
    const writes: string[] = [];
    const raw = new Map<string, string>([[PROGRESS_KEY, ORIGINAL]]);
    const storage: KeyValueStore = {
      async getItem(key) {
        if (key === PROGRESS_KEY) throw new Error('read');
        return raw.get(key) ?? null;
      },
      async setItem(key, value) {
        writes.push(`${key}:${value}`);
        raw.set(key, value);
      },
    };

    await render(
      <ProgressProvider storage={storage}>
        <MarkOnce />
      </ProgressProvider>,
    );

    await waitFor(() => {
      expect(screen.queryByText('marked') ?? screen.queryByRole('button', { name: 'Try again' })).toBeTruthy();
    });
    expect(writes).toEqual([]);
    expect(raw.get(PROGRESS_KEY)).toBe(ORIGINAL);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeOnTheScreen();
    expect(screen.getByText('Couldn’t load your reading.')).toBeOnTheScreen();
    expect(screen.queryByText('marked')).toBeNull();
  });

  it('reloads the stored year from Try again', async () => {
    let fail = true;
    const raw = new Map<string, string>([[PROGRESS_KEY, ORIGINAL]]);
    const storage: KeyValueStore = {
      async getItem(key) {
        if (fail && key === PROGRESS_KEY) throw new Error('read');
        return raw.get(key) ?? null;
      },
      async setItem(key, value) {
        raw.set(key, value);
      },
    };

    await render(
      <ProgressProvider storage={storage}>
        <Marker />
      </ProgressProvider>,
    );

    expect(await screen.findByRole('button', { name: 'Try again' })).toBeOnTheScreen();
    fail = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Days: 0,1,2,3,4,5')).toBeOnTheScreen();
    expect(raw.get(PROGRESS_KEY)).toBe(ORIGINAL);
  });

  it('shows a blank page while Try again reloads', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let fail = true;
    const raw = new Map<string, string>([[PROGRESS_KEY, ORIGINAL]]);
    const storage: KeyValueStore = {
      async getItem(key) {
        if (key !== PROGRESS_KEY) return raw.get(key) ?? null;
        if (fail) throw new Error('read');
        await gate;
        return raw.get(key) ?? null;
      },
      async setItem(key, value) {
        raw.set(key, value);
      },
    };

    await render(
      <ProgressProvider storage={storage}>
        <Marker />
      </ProgressProvider>,
    );

    expect(await screen.findByRole('button', { name: 'Try again' })).toBeOnTheScreen();
    fail = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(screen.queryByText(/Days:/)).toBeNull();
    release();
    expect(await screen.findByText('Days: 0,1,2,3,4,5')).toBeOnTheScreen();
  });

  it('copies unreadable progress aside before the first save', async () => {
    const corrupt = '{"version":1';
    const storage = memory(corrupt);

    await render(
      <ProgressProvider storage={storage}>
        <Marker />
      </ProgressProvider>,
    );

    await fireEvent.press(await screen.findByText('Mark 0'));
    await waitFor(() => {
      expect(storage.raw.get(PROGRESS_V2_UNREADABLE_KEY)).toBe(corrupt);
    });
    expect(savedDays(storage.raw.get(PROGRESS_V2_KEY))).toEqual([0]);
    expect(storage.raw.get(PROGRESS_KEY)).toBe(corrupt);
  });

  it('saves the full set after a failed save starts working', async () => {
    let fail = true;
    const storage = memory();
    storage.setItem = async (key, value) => {
      if (fail) throw new Error('disk');
      storage.raw.set(key, value);
    };

    await render(
      <ProgressProvider storage={storage}>
        <Marker />
      </ProgressProvider>,
    );

    expect(await screen.findByText('Mark 0')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Mark 0'));
    await fireEvent.press(screen.getByText('Mark 1'));
    expect(await screen.findByText('Days: 0,1')).toBeOnTheScreen();
    expect(storage.raw.has(PROGRESS_V2_KEY)).toBe(false);

    fail = false;
    await fireEvent.press(screen.getByText('Mark 2'));
    await waitFor(() => {
      expect(savedDays(storage.raw.get(PROGRESS_V2_KEY))).toEqual([0, 1, 2]);
    });
  });

  it('retries the unsaved set when the app returns to the foreground', async () => {
    let fail = true;
    const storage = memory();
    storage.setItem = async (key, value) => {
      if (fail) throw new Error('disk');
      storage.raw.set(key, value);
    };

    await render(
      <ProgressProvider storage={storage}>
        <Marker />
      </ProgressProvider>,
    );

    expect(await screen.findByText('Mark 0')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Mark 0'));
    await fireEvent.press(screen.getByText('Mark 1'));
    expect(await screen.findByText('Days: 0,1')).toBeOnTheScreen();
    expect(storage.raw.has(PROGRESS_V2_KEY)).toBe(false);

    fail = false;
    for (const listener of listeners) listener('active');
    await waitFor(() => {
      expect(savedDays(storage.raw.get(PROGRESS_V2_KEY))).toEqual([0, 1]);
    });
  });

  it('marks a day, reloads, and ignores an index outside the plan', async () => {
    const storage = memory();
    const view = await render(
      <ProgressProvider storage={storage}>
        <Marker />
      </ProgressProvider>,
    );

    expect(await screen.findByText('Mark 0')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Mark 312'));
    await fireEvent.press(screen.getByText('Mark 0'));
    await waitFor(() => {
      expect(savedDays(storage.raw.get(PROGRESS_V2_KEY))).toEqual([0]);
    });

    await view.unmount();
    await render(
      <ProgressProvider storage={storage}>
        <Marker />
      </ProgressProvider>,
    );
    expect(await screen.findByText('Days: 0')).toBeOnTheScreen();
  });
});
