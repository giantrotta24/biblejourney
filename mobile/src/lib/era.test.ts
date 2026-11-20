import { describe, expect, it } from '@jest/globals';

import { eras } from '../../../supabase/functions/_shared/content/plan';
import { currentEraIndex, eraForWeek, weekRangeLabel, type EraSpan } from './era';

const spans: EraSpan[] = [
  { title: 'Early', summary: 'The early years.', weeks: [1, 5] },
  { title: 'Later', summary: 'What came next.', weeks: [5, 12] },
  { title: 'Same start', summary: 'Listed second.', weeks: [1, 2] },
];

describe('eraForWeek', () => {
  it('returns the era whose weeks contain the day', () => {
    expect(eraForWeek(4, spans).title).toBe('Early');
    expect(eraForWeek(8, spans).summary).toBe('What came next.');
  });

  it('uses the later era when two share a boundary week', () => {
    expect(eraForWeek(5, spans).title).toBe('Later');
  });

  it('uses the later listing when two eras start together', () => {
    expect(eraForWeek(1, spans).title).toBe('Same start');
  });

  it('reads the shared plan, taking the later era on a shared week', () => {
    expect(eraForWeek(5, eras).title).toBe('Egypt and the Exodus');
    expect(eraForWeek(39, eras).title).toBe('Between the Testaments');
    expect(eraForWeek(46, eras).title).toBe('The early church');
    expect(eraForWeek(1, eras).title).toBe('Creation and the patriarchs');
  });

  it('throws when the week is outside every era', () => {
    expect(() => eraForWeek(0, spans)).toThrow(RangeError);
  });
});

describe('current era', () => {
  it('marks the later era once its first week has started', () => {
    expect(currentEraIndex(1, eras)).toBe(0);
    expect(currentEraIndex(5, eras)).toBe(1);
    expect(eras[currentEraIndex(46, eras)].title).toBe('The early church');
    expect(weekRangeLabel([39, 39])).toBe('Week 39');
    expect(weekRangeLabel([1, 5])).toBe('Weeks 1–5');
  });
});
