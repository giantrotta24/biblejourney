import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';

import NoteRoute from '@/app/note/[day]';

// jest.mock factories cannot close over imports, so the redirect stand-in is required here.
/* eslint-disable @typescript-eslint/no-require-imports */
jest.mock('expo-router', () => {
  const React = require('react');
  const { Text: Label } = require('react-native');
  return {
    Redirect: ({ href }: { href: string }) => React.createElement(Label, null, `redirect:${href}`),
    router: { back: jest.fn() },
    useLocalSearchParams: () => ({ day: 'nope' }),
  };
});
/* eslint-enable @typescript-eslint/no-require-imports */

describe('note route', () => {
  it('sends an invalid day to Notes', async () => {
    await render(<NoteRoute />);
    expect(screen.getByText('redirect:/notes')).toBeOnTheScreen();
  });
});
