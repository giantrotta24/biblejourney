import { describe, expect, it } from '@jest/globals';

import { days } from '../../../supabase/functions/_shared/content/plan';
import { matchingNotes, type NoteRow } from './query';

const row = (day_index: number, body: string, updated_at: string): NoteRow => ({ day_index, body, updated_at });

const reading = (dayIndex: number) => days.find((day) => day.index === dayIndex)?.reading ?? '';

describe('matchingNotes', () => {
  const notes = [
    row(0, 'In the garden', '2026-11-18T12:00:00.000Z'),
    row(2, 'A note about manna later', '2026-11-20T12:00:00.000Z'),
    row(1, 'Manna in the wilderness', '2026-11-19T12:00:00.000Z'),
  ];

  it('lists notes newest first', () => {
    expect(matchingNotes(notes, '', reading).map((note) => note.day_index)).toEqual([2, 1, 0]);
  });

  it('matches the note body or the day’s reading, ignoring case', () => {
    expect(matchingNotes(notes, 'MANNA', reading).map((note) => note.day_index)).toEqual([2, 1]);
    expect(matchingNotes(notes, 'genesis 8', reading).map((note) => note.day_index)).toEqual([2]);
  });

  it('returns no rows when nothing matches', () => {
    expect(matchingNotes(notes, 'quail', reading)).toEqual([]);
  });
});
