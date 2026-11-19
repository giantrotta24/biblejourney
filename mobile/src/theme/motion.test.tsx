import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen, act } from '@testing-library/react-native';
import { AccessibilityInfo, Text } from 'react-native';

import { useReduceMotion } from './motion';

function Probe() {
  const reduce = useReduceMotion();
  return <Text>{reduce ? 'reduce' : 'motion'}</Text>;
}

describe('useReduceMotion', () => {
  let listener: ((enabled: boolean) => void) | null = null;

  beforeEach(() => {
    listener = null;
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation((_event, callback) => {
      listener = callback as (enabled: boolean) => void;
      return { remove: jest.fn() };
    });
  });

  it('follows reduce motion after launch', async () => {
    await render(<Probe />);
    expect(await screen.findByText('motion')).toBeOnTheScreen();
    await act(async () => {
      listener?.(true);
    });
    expect(screen.getByText('reduce')).toBeOnTheScreen();
  });
});
