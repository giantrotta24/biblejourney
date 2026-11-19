import { describe, expect, it } from '@jest/globals';

import { bibleGatewayUrl } from './reading';

describe('bibleGatewayUrl', () => {
  it('links the reading on Bible Gateway in the NIV', () => {
    expect(bibleGatewayUrl('Genesis 1–4')).toBe(
      'https://www.biblegateway.com/passage/?search=Genesis+1-4&version=NIV',
    );
  });

  it('turns an em dash into a hyphen and keeps another translation when asked', () => {
    expect(bibleGatewayUrl('Job 1—4', 'KJV')).toBe(
      'https://www.biblegateway.com/passage/?search=Job+1-4&version=KJV',
    );
  });
});
