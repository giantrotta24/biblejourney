import { describe, expect, it } from '@jest/globals';

import {
  NOTE_MAX_LENGTH,
  NOTES_KEY,
  NOTES_UNREADABLE_KEY,
  loadNotes,
  saveNotes,
  withNote,
  type KeyValueStore,
  type NoteRow,
} from './store';

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

const row = (day_index: number, body: string, updated_at: string): NoteRow => ({ day_index, body, updated_at });

describe('notes store', () => {
  it('loads an empty result when nothing is stored', async () => {
    await expect(loadNotes(memory())).resolves.toEqual({ status: 'empty' });
  });

  it('reports a read failure instead of an empty notebook', async () => {
    const storage: KeyValueStore = {
      async getItem() {
        throw new Error('unavailable');
      },
      async setItem() {
        throw new Error('unavailable');
      },
    };
    await expect(loadNotes(storage)).resolves.toEqual({ status: 'unavailable' });
  });

  it('reports a stored payload that cannot be parsed', async () => {
    const storage = memory('{"version":1');
    await expect(loadNotes(storage)).resolves.toEqual({ status: 'unreadable', raw: '{"version":1' });
  });

  it('keeps valid rows and drops a day outside the plan', async () => {
    const stored = JSON.stringify({
      version: 1,
      rows: [row(1, 'kept', '2026-11-20T12:00:00.000Z'), row(400, 'nope', '2026-11-20T12:00:00.000Z'), row(1, 'older', '2026-11-19T12:00:00.000Z')],
    });
    await expect(loadNotes(memory(stored))).resolves.toEqual({
      status: 'ready',
      value: [row(1, 'kept', '2026-11-20T12:00:00.000Z')],
    });
  });

  it('saves rows and reads them back', async () => {
    const storage = memory();
    const notes = [row(4, 'later day', '2026-11-20T12:00:00.000Z'), row(1, 'earlier day', '2026-11-20T11:00:00.000Z')];
    await saveNotes(notes, storage);
    expect(JSON.parse(storage.raw.get(NOTES_KEY) ?? '')).toEqual({ version: 1, rows: [notes[1], notes[0]] });
    await expect(loadNotes(storage)).resolves.toEqual({ status: 'ready', value: [notes[1], notes[0]] });
  });

  it('copies unreadable notes aside before the first save', async () => {
    const storage = memory('{');
    await saveNotes([row(0, 'fresh', '2026-11-20T12:00:00.000Z')], storage, '{');
    expect(storage.raw.get(NOTES_UNREADABLE_KEY)).toBe('{');
    expect(JSON.parse(storage.raw.get(NOTES_KEY) ?? '').rows).toEqual([row(0, 'fresh', '2026-11-20T12:00:00.000Z')]);
  });
});

describe('withNote', () => {
  const at = '2026-11-20T12:00:00.000Z';
  const later = '2026-11-20T13:00:00.000Z';

  it('sets updated_at when the body changes and removes an emptied note', () => {
    const next = withNote([], 3, 'A line', at);
    expect(next).toEqual([row(3, 'A line', at)]);
    expect(withNote(next, 3, 'A line revised', later)).toEqual([row(3, 'A line revised', later)]);
    expect(withNote(next, 3, '')).toEqual([]);
  });

  it('leaves the timestamp alone when the body is unchanged', () => {
    const notes = [row(3, 'A line', at)];
    expect(withNote(notes, 3, 'A line', later)).toBe(notes);
  });

  it('clamps a note to 20,000 characters', () => {
    expect(NOTE_MAX_LENGTH).toBe(20000);
    const next = withNote([], 3, 'x'.repeat(20001), at);
    expect(next).toHaveLength(1);
    expect(next[0]?.body).toHaveLength(20000);
  });

  it('ignores a day outside the plan', () => {
    const notes = [row(3, 'A line', at)];
    expect(withNote(notes, -1, 'nope', later)).toBe(notes);
    expect(withNote(notes, 312, 'nope', later)).toBe(notes);
  });
});
