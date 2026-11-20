import { describe, expect, it } from '@jest/globals';

import { caretLineY, ruledLine, writingScale } from './ruled';

describe('ruled lines', () => {
  it('computes sheet and page sizes at scale 1 and 2', () => {
    expect(writingScale(1)).toBe(1);
    expect(writingScale(3)).toBe(2);
    expect(ruledLine(32, 1)).toBe(32);
    expect(ruledLine(32, 2)).toBe(64);
    expect(18 * writingScale(1)).toBe(18);
    expect(18 * writingScale(2)).toBe(36);
    expect(ruledLine(30, 1)).toBe(30);
    expect(ruledLine(30, 2)).toBe(60);
    expect(16 * writingScale(1)).toBe(16);
    expect(16 * writingScale(2)).toBe(32);
  });

  it('places the caret on its line', () => {
    const text = 'one\ntwo\nthree';
    expect(caretLineY(text, 0, 32)).toBe(0);
    expect(caretLineY(text, text.length, 32)).toBe(64);
  });
});
