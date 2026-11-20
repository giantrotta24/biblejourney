import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useEffect } from 'react';
import { AppState, Pressable, Text, View } from 'react-native';

import { NotesProvider, useNotes } from './context';
import { NOTES_KEY, type KeyValueStore } from './store';

const UNREADABLE_KEY = 'biblejourney.notes.v1.unreadable';

function memory(initial?: string): KeyValueStore & { raw: Map<string, string> } {
  const raw = new Map<string, string>();
  if (initial !== undefined) raw.set(NOTES_KEY, initial);
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

function WriteOnce() {
  const { setBody } = useNotes();
  useEffect(() => {
    setBody(0, 'Hello');
  }, [setBody]);
  return <Text>wrote</Text>;
}

function Editor() {
  const { rows, setBody } = useNotes();
  const listed = [...rows]
    .sort((a, b) => a.day_index - b.day_index)
    .map((row) => `${row.day_index}:${row.body}@${row.updated_at}`)
    .join('|');
  return (
    <View>
      <Text>{listed ? `Notes: ${listed}` : 'Notes:'}</Text>
      <Pressable onPress={() => setBody(0, 'Hello')}>
        <Text>Write 0</Text>
      </Pressable>
      <Pressable onPress={() => setBody(0, 'Hello again')}>
        <Text>Revise 0</Text>
      </Pressable>
      <Pressable onPress={() => setBody(0, '')}>
        <Text>Clear 0</Text>
      </Pressable>
      <Pressable onPress={() => setBody(1, 'Other')}>
        <Text>Write 1</Text>
      </Pressable>
      <Pressable onPress={() => setBody(312, 'nope')}>
        <Text>Write 312</Text>
      </Pressable>
    </View>
  );
}

describe('NotesProvider', () => {
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

  function advance(iso: string) {
    now = new Date(iso);
  }

  it('does not write when a notes read fails', async () => {
    const writes: string[] = [];
    const raw = new Map<string, string>([[NOTES_KEY, '{"version":1,"rows":[]}']]);
    const storage: KeyValueStore = {
      async getItem(key) {
        if (key === NOTES_KEY) throw new Error('read');
        return raw.get(key) ?? null;
      },
      async setItem(key, value) {
        writes.push(`${key}:${value}`);
        raw.set(key, value);
      },
    };

    await render(
      <NotesProvider storage={storage} now={clock}>
        <WriteOnce />
      </NotesProvider>,
    );

    await waitFor(() => {
      expect(screen.queryByText('wrote') ?? screen.queryByRole('button', { name: 'Try again' })).toBeTruthy();
    });
    expect(writes).toEqual([]);
    expect(raw.get(NOTES_KEY)).toBe('{"version":1,"rows":[]}');
    expect(screen.getByText('Couldn’t load your notes.')).toBeOnTheScreen();
    expect(screen.queryByText('wrote')).toBeNull();
  });

  it('copies unreadable notes aside before the first save', async () => {
    const corrupt = '{"version":1';
    const storage = memory(corrupt);

    await render(
      <NotesProvider storage={storage} now={clock}>
        <Editor />
      </NotesProvider>,
    );

    await fireEvent.press(await screen.findByText('Write 0'));
    await waitFor(() => {
      expect(storage.raw.get(UNREADABLE_KEY)).toBe(corrupt);
    });
    expect(JSON.parse(storage.raw.get(NOTES_KEY) ?? '').rows).toEqual([
      { day_index: 0, body: 'Hello', updated_at: '2026-11-20T12:00:00.000Z' },
    ]);
  });

  it('sets updated_at on each change and removes an emptied note', async () => {
    const storage = memory();
    await render(
      <NotesProvider storage={storage} now={clock}>
        <Editor />
      </NotesProvider>,
    );

    await fireEvent.press(await screen.findByText('Write 0'));
    await waitFor(() => {
      expect(screen.getByText('Notes: 0:Hello@2026-11-20T12:00:00.000Z')).toBeOnTheScreen();
    });

    advance('2026-11-20T13:00:00.000Z');
    await fireEvent.press(screen.getByText('Revise 0'));
    await waitFor(() => {
      expect(screen.getByText('Notes: 0:Hello again@2026-11-20T13:00:00.000Z')).toBeOnTheScreen();
    });

    await fireEvent.press(screen.getByText('Clear 0'));
    await waitFor(() => {
      expect(screen.getByText('Notes:')).toBeOnTheScreen();
      expect(JSON.parse(storage.raw.get(NOTES_KEY) ?? '')).toEqual({ version: 1, rows: [] });
    });
  });

  it('keeps a failed save and retries it on the next change and when the app returns', async () => {
    let fail = true;
    const storage = memory();
    storage.setItem = async (key, value) => {
      if (fail) throw new Error('disk');
      storage.raw.set(key, value);
    };

    await render(
      <NotesProvider storage={storage} now={clock}>
        <Editor />
      </NotesProvider>,
    );

    expect(await screen.findByText('Write 0')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Write 0'));
    expect(await screen.findByText('Notes: 0:Hello@2026-11-20T12:00:00.000Z')).toBeOnTheScreen();
    expect(storage.raw.has(NOTES_KEY)).toBe(false);

    fail = false;
    for (const listener of listeners) listener('active');
    await waitFor(() => {
      expect(JSON.parse(storage.raw.get(NOTES_KEY) ?? '').rows).toEqual([
        { day_index: 0, body: 'Hello', updated_at: '2026-11-20T12:00:00.000Z' },
      ]);
    });

    storage.raw.delete(NOTES_KEY);
    fail = true;
    advance('2026-11-20T13:00:00.000Z');
    await fireEvent.press(screen.getByText('Write 1'));
    expect(await screen.findByText(/1:Other@2026-11-20T13:00:00.000Z/)).toBeOnTheScreen();
    expect(storage.raw.has(NOTES_KEY)).toBe(false);

    fail = false;
    advance('2026-11-20T14:00:00.000Z');
    await fireEvent.press(screen.getByText('Revise 0'));
    await waitFor(() => {
      const rows = JSON.parse(storage.raw.get(NOTES_KEY) ?? '').rows;
      expect(rows).toEqual([
        { day_index: 0, body: 'Hello again', updated_at: '2026-11-20T14:00:00.000Z' },
        { day_index: 1, body: 'Other', updated_at: '2026-11-20T13:00:00.000Z' },
      ]);
    });
  });
});
