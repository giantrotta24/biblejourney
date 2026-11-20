import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppState, Alert, Keyboard, PixelRatio, Platform, ScrollView, StyleSheet } from 'react-native';

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

type Instance = ReturnType<typeof screen.getByText>;

function findNode(node: Instance | null, match: (node: Instance) => boolean): Instance | null {
  if (!node) return null;
  if (match(node)) return node;
  for (const child of node.children) {
    if (typeof child === 'string') continue;
    const found = findNode(child, match);
    if (found) return found;
  }
  return null;
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

  it('says Saving… until the note is stored, and Not saved when the write fails', async () => {
    const storage = memory();
    await renderSheet(storage);
    const input = await screen.findByLabelText('Note');
    expect(screen.getByText('Saved').props.accessibilityLiveRegion).toBe('polite');

    await fireEvent.changeText(input, 'Leave the edges');
    expect(screen.getByText('Saving…')).toBeOnTheScreen();

    await act(async () => {
      jest.advanceTimersByTime(NOTE_SAVE_DELAY_MS);
    });
    await waitFor(() => {
      expect(screen.getByText('Saved')).toBeOnTheScreen();
    });

    storage.setItem = async () => {
      throw new Error('disk');
    };
    await fireEvent.changeText(screen.getByLabelText('Note'), 'Leave the edges out');
    await act(async () => {
      jest.advanceTimersByTime(NOTE_SAVE_DELAY_MS);
    });
    await waitFor(() => {
      expect(screen.getByText('Not saved')).toBeOnTheScreen();
    });
  });

  it('draws rules at the text size for scale 1 and 2', async () => {
    const scale = jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(1);
    try {
      const first = await renderSheet(memory());
      const small = await screen.findByLabelText('Note');
      expect(small.props.allowFontScaling).toBe(false);
      expect(StyleSheet.flatten(small.props.style).fontSize).toBe(18);
      expect(StyleSheet.flatten(small.props.style).lineHeight).toBe(32);
      await first.unmount();

      scale.mockReturnValue(2);
      await renderSheet(memory());
      const large = await screen.findByLabelText('Note');
      expect(StyleSheet.flatten(large.props.style).fontSize).toBe(36);
      expect(StyleSheet.flatten(large.props.style).lineHeight).toBe(64);
      expect(StyleSheet.flatten(large.props.style).minHeight).toBe(64 * 8);
    } finally {
      scale.mockRestore();
    }
  });

  it('keeps the header clear of the note and scrolls the caret line into view', async () => {
    const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => {});
    try {
      const storage = memory([{ day_index: 0, body: 'Keep this', updated_at: '2026-11-20T11:00:00.000Z' }]);
      await renderSheet(storage);
      expect(await screen.findByText('Delete note…')).toBeOnTheScreen();
      const header = findNode(screen.root, (node) => node.props.collapsable === false);
      expect(header).toBeTruthy();
      expect(findNode(header ?? screen.root, (node) => StyleSheet.flatten(node.props.style)?.height === 8)).toBeTruthy();
      const scroll = findNode(screen.root, (node) => node.props.automaticallyAdjustKeyboardInsets === true);
      expect(scroll?.props.keyboardDismissMode).toBe('interactive');
      let parent = screen.getByText('Delete note…').parent;
      let insideScroll = false;
      while (parent) {
        if (parent.props.automaticallyAdjustKeyboardInsets) insideScroll = true;
        parent = parent.parent;
      }
      expect(insideScroll).toBe(true);

      const text = 'one\ntwo\nthree';
      const input = screen.getByLabelText('Note');
      await fireEvent.changeText(input, text);
      await fireEvent(input, 'selectionChange', {
        nativeEvent: { selection: { start: text.length, end: text.length } },
      });
      const lineHeight = StyleSheet.flatten(input.props.style).lineHeight as number;
      expect(scrollTo).toHaveBeenCalledWith({ y: 2 * lineHeight, animated: false });
    } finally {
      scrollTo.mockRestore();
    }
  });

  it('lifts the sheet with the keyboard on Android', async () => {
    const original = Platform.OS;
    Object.defineProperty(Platform, 'OS', { get: () => 'android' });
    try {
      await renderSheet(memory());
      expect(await screen.findByLabelText('Close')).toBeOnTheScreen();
      expect(screen.getByTestId('note-keyboard')).toBeOnTheScreen();
    } finally {
      Object.defineProperty(Platform, 'OS', { get: () => original });
    }
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
