import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppState, Alert, Keyboard } from 'react-native';

import { NotesProvider } from '@/notes/context';
import { NOTES_KEY, type KeyValueStore } from '@/notes/store';

import { NOTE_SAVE_DELAY_MS, NoteSheet } from './note-sheet';

function memory(rows: { day_index: number; body: string; updated_at: string }[] = []): KeyValueStore & {
  raw: Map<string, string>;
} {
  const raw = new Map<string, string>();
  if (rows.length > 0) raw.set(NOTES_KEY, JSON.stringify({ version: 1, rows }));
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

function storedBody(storage: { raw: Map<string, string> }): string | null {
  const raw = storage.raw.get(NOTES_KEY);
  if (!raw) return null;
  const rows = JSON.parse(raw).rows as { body: string }[];
  return rows[0]?.body ?? null;
}

describe('NoteSheet', () => {
  const appListeners = new Set<(state: string) => void>();
  const keys = new Map<string, Set<() => void>>();

  beforeEach(() => {
    jest.useFakeTimers();
    appListeners.clear();
    keys.clear();
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      appListeners.add(listener as (state: string) => void);
      return { remove: () => appListeners.delete(listener as (state: string) => void) };
    });
    jest.spyOn(Keyboard, 'addListener').mockImplementation((event, listener) => {
      const set = keys.get(event) ?? new Set();
      set.add(listener as () => void);
      keys.set(event, set);
      return { remove: () => set.delete(listener as () => void) };
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  async function renderSheet(storage: ReturnType<typeof memory>, dayIndex = 0) {
    return render(
      <NotesProvider storage={storage} now={() => new Date('2026-11-20T12:00:00.000Z')}>
        <NoteSheet dayIndex={dayIndex} onClose={() => {}} />
      </NotesProvider>,
    );
  }

  it('saves what she types after a pause, and on the way out', async () => {
    const storage = memory();
    const view = await renderSheet(storage);
    const input = await screen.findByLabelText('Note');
    expect(input.props.autoFocus).toBe(true);

    await fireEvent.changeText(input, 'Leave the edges');
    expect(storage.raw.has(NOTES_KEY)).toBe(false);

    await act(async () => {
      jest.advanceTimersByTime(NOTE_SAVE_DELAY_MS);
    });
    await waitFor(() => {
      expect(storedBody(storage)).toBe('Leave the edges');
    });

    await fireEvent.changeText(input, 'Leave the edges for the stranger');
    await view.unmount();
    await waitFor(() => {
      expect(storedBody(storage)).toBe('Leave the edges for the stranger');
    });
  });

  it('asks before Delete note… and then removes the note', async () => {
    const storage = memory([{ day_index: 0, body: 'Keep this', updated_at: '2026-11-20T11:00:00.000Z' }]);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderSheet(storage);

    expect(await screen.findByText('Delete note…')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('Delete note…'));
    expect(alert).toHaveBeenCalledWith(
      'Delete this note?',
      'Your note on day 1 will be deleted from this phone and your account. It can’t be undone.',
      expect.any(Array),
    );
    const buttons = alert.mock.calls[0]?.[2] as { text: string; onPress?: () => void }[];
    await act(async () => {
      buttons.find((button) => button.text === 'Delete')?.onPress?.();
    });
    await waitFor(() => {
      expect(JSON.parse(storage.raw.get(NOTES_KEY) ?? '')).toEqual({ version: 1, rows: [] });
    });
    expect(screen.queryByText('Delete note…')).toBeNull();
  });

  it('hides Delete note… while the keyboard is up', async () => {
    const storage = memory([{ day_index: 0, body: 'Keep this', updated_at: '2026-11-20T11:00:00.000Z' }]);
    await renderSheet(storage);
    expect(await screen.findByText('Delete note…')).toBeOnTheScreen();

    await act(async () => {
      for (const listener of keys.get('keyboardDidShow') ?? []) listener();
    });
    expect(screen.queryByText('Delete note…')).toBeNull();

    await act(async () => {
      for (const listener of keys.get('keyboardDidHide') ?? []) listener();
    });
    expect(screen.getByText('Delete note…')).toBeOnTheScreen();
  });

  it('flushes a pending note when the app leaves the foreground', async () => {
    const storage = memory();
    await renderSheet(storage);
    await fireEvent.changeText(await screen.findByLabelText('Note'), 'Before it sleeps');
    expect(storage.raw.has(NOTES_KEY)).toBe(false);

    await act(async () => {
      for (const listener of appListeners) listener('background');
    });
    await waitFor(() => {
      expect(storedBody(storage)).toBe('Before it sleeps');
    });
  });
});
