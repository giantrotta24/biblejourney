import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';

import AskRoute from '@/app/ask/[day]';

jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));

/* eslint-disable @typescript-eslint/no-require-imports -- the mock factory cannot close over an import */
jest.mock('expo-router', () => {
  const React = require('react');
  const { Text: Label } = require('react-native');
  return {
    Redirect: ({ href }: { href: string }) => React.createElement(Label, null, `redirect:${href}`),
    router: { back: jest.fn(), push: jest.fn() },
    useLocalSearchParams: () => ({ day: 'nope' }),
  };
});
/* eslint-enable @typescript-eslint/no-require-imports */

describe('ask route', () => {
  it('sends an invalid day back to today', async () => {
    await render(<AskRoute />);
    expect(screen.getByText('redirect:/')).toBeOnTheScreen();
  });
});
