import { describe, expect, it } from '@jest/globals';

import { phases } from '../../../supabase/functions/_shared/content/plan';
import { gapsAfterPhases, weekAtX, weekCenterX } from './grid';

const GAPS = [12, 26, 39];
const WIDTH = 350;
const GAP = 6;
const COL = (WIDTH - GAPS.length * GAP) / 52;

function mockCenter(week: number): number {
  return (week - 1) * COL + GAPS.filter((end) => end < week).length * GAP + COL / 2;
}

describe('weekAtX', () => {
  it('maps a column center to that week, including the phase gaps', () => {
    for (const week of [1, 12, 13, 24, 27, 40, 52]) {
      expect(weekAtX(mockCenter(week), WIDTH, GAPS)).toBe(week);
    }
  });

  it('splits a phase gap between the weeks on either side', () => {
    const gapStart = mockCenter(12) + COL / 2;
    expect(weekAtX(gapStart + 0.4, WIDTH, GAPS)).toBe(12);
    expect(weekAtX(gapStart + GAP - 0.4, WIDTH, GAPS)).toBe(13);
  });

  it('clamps the edges of the grid', () => {
    expect(weekAtX(0, WIDTH, GAPS)).toBe(1);
    expect(weekAtX(-20, WIDTH, GAPS)).toBe(1);
    expect(weekAtX(WIDTH, WIDTH, GAPS)).toBe(52);
    expect(weekAtX(WIDTH + 40, WIDTH, GAPS)).toBe(52);
  });

  it('scales with the grid width', () => {
    expect(weekAtX(mockCenter(24) * 2, WIDTH * 2, GAPS)).toBe(24);
  });

  it('returns week 1 until the grid has a width', () => {
    expect(weekAtX(10, 0, GAPS)).toBe(1);
  });
});

describe('weekCenterX', () => {
  it('matches the column center used to hit-test', () => {
    expect(weekCenterX(24, WIDTH, GAPS)).toBeCloseTo(mockCenter(24));
    expect(weekAtX(weekCenterX(39, WIDTH, GAPS), WIDTH, GAPS)).toBe(39);
  });
});

describe('gapsAfterPhases', () => {
  it('puts a gap after every phase except the last', () => {
    expect(gapsAfterPhases(phases)).toEqual([12, 26, 39]);
  });
});
