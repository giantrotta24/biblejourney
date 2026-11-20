import { describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert, Platform, PlatformColor, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { SessionProvider } from '@/account/session';
import { NotesProvider } from '@/notes/context';
import { NOTES_KEY, type KeyValueStore, type NoteRow } from '@/notes/store';
import { ProgressProvider } from '@/progress/context';
import { light } from '@/theme/colors';
import { days } from '../../../supabase/functions/_shared/content/plan';

import { NotesView } from './notes-view';

function memory(rows: NoteRow[]): KeyValueStore & { raw: Map<string, string> } {
  const raw = new Map<string, string>([[NOTES_KEY, JSON.stringify({ version: 1, rows })]]);
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

const notes: NoteRow[] = [
  { day_index: 0, body: 'In the garden', updated_at: '2026-11-18T12:00:00.000Z' },
  { day_index: 2, body: 'A note about manna later', updated_at: '2026-11-20T12:00:00.000Z' },
  { day_index: 1, body: 'Manna in the wilderness', updated_at: '2026-11-19T12:00:00.000Z' },
];

async function renderNotes(rows: NoteRow[], onOpen = jest.fn()) {
  const storage = memory(rows);
  await render(
    <GestureHandlerRootView>
      <SessionProvider>
        <ProgressProvider>
          <NotesProvider storage={storage}>
            <NotesView onOpen={onOpen} />
          </NotesProvider>
        </ProgressProvider>
      </SessionProvider>
    </GestureHandlerRootView>,
  );
  return { storage, onOpen };
}

describe('Notes', () => {
  it('lists notes newest first and marks today in blue', async () => {
    await renderNotes(notes);
    const bodies = screen.getAllByText(/garden|manna/i);
    expect(bodies.map((node) => node.props.children)).toEqual([
      'A note about manna later',
      'Manna in the wilderness',
      'In the garden',
    ]);
    expect(StyleSheet.flatten(screen.getByText('1').props.style).color).toBe(light.blueInk);
    expect(StyleSheet.flatten(screen.getByText('Today').props.style).color).toBe(light.blueInk);
  });

  it('filters by the note or the reading and says when nothing matches', async () => {
    const onOpen = jest.fn();
    await renderNotes(notes, onOpen);

    await fireEvent.changeText(screen.getByLabelText('Search your notes'), 'MANNA');
    expect(screen.queryByText('In the garden')).toBeNull();
    expect(screen.getByText('A note about manna later')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Search your notes'), 'Genesis 8');
    expect(screen.getByText('A note about manna later')).toBeOnTheScreen();
    expect(screen.queryByText('Manna in the wilderness')).toBeNull();

    await fireEvent.changeText(screen.getByLabelText('Search your notes'), 'quail');
    expect(screen.getByText('No notes mention “quail”.')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByLabelText('Search your notes'), '');
    await fireEvent.press(screen.getByRole('button', { name: /A note about manna later/ }));
    expect(onOpen).toHaveBeenCalledWith(2);
  });

  it('shows the empty state before the first note', async () => {
    await renderNotes([]);
    expect(screen.getByText('No notes yet')).toBeOnTheScreen();
    expect(screen.getByText(/Whatever you write gathers here/)).toBeOnTheScreen();
    const sync = screen.getByText('Notes are kept on this phone. Sign in to keep them on your other devices too.');
    expect(sync).toBeOnTheScreen();
    expect(StyleSheet.flatten(sync.props.style).color).toBe(light.ink2);
    expect(screen.queryByLabelText('Search your notes')).toBeNull();
  });

  it('deletes from a long press on Android after a confirm', async () => {
    const original = Platform.OS;
    Object.defineProperty(Platform, 'OS', { get: () => 'android' });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    try {
      await renderNotes(notes);
      await fireEvent(screen.getByRole('button', { name: /In the garden/ }), 'longPress');
      const buttons = alert.mock.calls[0]?.[2] as { text: string; onPress?: () => void }[];
      await act(async () => {
        buttons.find((button) => button.text === 'Delete')?.onPress?.();
      });
      await waitFor(() => {
        expect(screen.queryByText('In the garden')).toBeNull();
      });
    } finally {
      Object.defineProperty(Platform, 'OS', { get: () => original });
      alert.mockRestore();
    }
  });

  it('names the day and deletes from the screen reader', async () => {
    const day = days[2];
    if (!day) throw new Error('missing day 3');
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    try {
      await renderNotes(notes);
      const row = screen.getByRole('button', {
        name: `Day 3, ${day.reading}, ${day.weekday}. A note about manna later`,
      });
      expect(row.props.accessibilityActions).toEqual([{ name: 'delete', label: 'Delete note' }]);
      await fireEvent(row, 'accessibilityAction', { nativeEvent: { actionName: 'delete' } });
      expect(alert).toHaveBeenCalledWith('Delete this note?', expect.stringContaining('day 3'), expect.any(Array));

      const input = screen.getByLabelText('Search your notes');
      expect(input.props.placeholderTextColor).toBe(light.ink2);
      expect(input.props.maxFontSizeMultiplier).toBe(1.6);
      expect(StyleSheet.flatten(input.props.style).lineHeight).toBe(22);
      expect(StyleSheet.flatten(input.props.style).paddingVertical).toBe(0);
      const box = input.parent;
      expect(StyleSheet.flatten(box?.props.style).minHeight).toBe(36);
      expect(StyleSheet.flatten(box?.props.style).paddingVertical).toBe(6);

      let cover: ReturnType<typeof screen.getByText> | null = row.parent;
      while (cover && StyleSheet.flatten(cover.props.style)?.backgroundColor !== light.paper) cover = cover.parent;
      expect(StyleSheet.flatten(cover?.props.style).flex).not.toBe(1);
      expect(StyleSheet.flatten(cover?.props.style).backgroundColor).toBe(light.paper);
      const action = screen.getAllByRole('button', { name: /Delete note on day/ })[0];
      expect(StyleSheet.flatten(action?.props.style).backgroundColor).toEqual(PlatformColor('systemRed'));
      expect(StyleSheet.flatten(screen.getAllByText('Delete')[0]?.props.style).color).toBe(light.onBlue);
    } finally {
      alert.mockRestore();
    }
  });
});
