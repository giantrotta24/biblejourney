import { describe, expect, it } from '@jest/globals';

import { mergeDays, mergeNotes, mergeVerses } from './merge';

const at = (minute: number) => new Date(Date.UTC(2026, 10, 20, 12, minute)).toISOString();

describe('sync merge', () => {
  it('keeps the earliest completion and the union of days', () => {
    expect(
      mergeDays(
        [
          { day_index: 1, completed_at: at(30) },
          { day_index: 3, completed_at: at(5) },
        ],
        [
          { day_index: 1, completed_at: at(20) },
          { day_index: 2, completed_at: at(40) },
        ],
      ),
    ).toEqual([
      { day_index: 1, completed_at: at(20) },
      { day_index: 2, completed_at: at(40) },
      { day_index: 3, completed_at: at(5) },
    ]);
  });

  it('keeps the earliest learned time and the union of verses', () => {
    expect(
      mergeVerses(
        [{ week: 1, learned_at: at(10) }],
        [
          { week: 1, learned_at: at(4) },
          { week: 2, learned_at: at(15) },
        ],
      ),
    ).toEqual([
      { week: 1, learned_at: at(4) },
      { week: 2, learned_at: at(15) },
    ]);
  });

  it('takes the incoming note when the timestamps are equal', () => {
    expect(
      mergeNotes(
        [{ day_index: 0, body: 'phone', updated_at: at(10) }],
        [{ day_index: 0, body: 'account', updated_at: at(10) }],
      ),
    ).toEqual([{ day_index: 0, body: 'account', updated_at: at(10) }]);
  });

  it('keeps the latest note and the union of days', () => {
    expect(
      mergeNotes(
        [{ day_index: 0, body: 'phone', updated_at: at(30) }],
        [
          { day_index: 0, body: 'account', updated_at: at(10) },
          { day_index: 4, body: 'only there', updated_at: at(12) },
        ],
      ),
    ).toEqual([
      { day_index: 0, body: 'phone', updated_at: at(30) },
      { day_index: 4, body: 'only there', updated_at: at(12) },
    ]);
  });
});
