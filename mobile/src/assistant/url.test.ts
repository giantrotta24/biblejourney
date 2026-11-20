import { afterEach, describe, expect, it } from '@jest/globals';

import { askUrl, reportUrl } from './url';

const ORIGINAL = process.env.EXPO_PUBLIC_ASSISTANT_URL;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.EXPO_PUBLIC_ASSISTANT_URL;
  else process.env.EXPO_PUBLIC_ASSISTANT_URL = ORIGINAL;
});

describe('assistant url', () => {
  it('is unset when the variable is missing or not an http address', () => {
    delete process.env.EXPO_PUBLIC_ASSISTANT_URL;
    expect(askUrl()).toBeNull();
    expect(reportUrl()).toBeNull();

    process.env.EXPO_PUBLIC_ASSISTANT_URL = '   ';
    expect(askUrl()).toBeNull();

    process.env.EXPO_PUBLIC_ASSISTANT_URL = 'functions/v1/ask';
    expect(askUrl()).toBeNull();
  });

  it('uses the ask function address and adds /report for a report', () => {
    process.env.EXPO_PUBLIC_ASSISTANT_URL = 'https://project.supabase.co/functions/v1/ask/';
    expect(askUrl()).toBe('https://project.supabase.co/functions/v1/ask');
    expect(reportUrl()).toBe('https://project.supabase.co/functions/v1/ask/report');
  });
});
