import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { Platform, StyleSheet } from 'react-native';

import { PaperTabBar } from './tab-bar';

jest.mock('expo-router', () => ({
  router: { navigate: jest.fn(), setParams: jest.fn() },
}));

jest.mock('expo-blur', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const { View } = jest.requireActual('react-native') as typeof import('react-native');
  return {
    BlurView: ({ children, ...props }: { children?: React.ReactNode }) =>
      React.createElement(View, { ...props, testID: 'tab-blur' }, children),
  };
});

async function renderBar(focused: 'index' | 'plan') {
  const navigateToTab = jest.fn();
  const routes = [
    { key: 'today', name: 'index' },
    { key: 'plan', name: 'plan' },
  ];
  const props = {
    state: { index: focused === 'index' ? 0 : 1, routes },
    descriptors: {
      today: { options: { title: 'Today' } },
      plan: { options: { title: 'Plan' } },
    },
    emitter: { emit: () => ({ defaultPrevented: false }) },
    navigateToTab,
    insets: { top: 0, bottom: 0, left: 0, right: 0 },
  } as unknown as BottomTabBarProps;
  await render(<PaperTabBar {...props} />);
  return { navigateToTab };
}

describe('PaperTabBar', () => {
  beforeEach(() => {
    jest.mocked(router.navigate).mockClear();
    jest.mocked(router.setParams).mockClear();
  });

  it('pressing Today clears the day, focused or not', async () => {
    await renderBar('plan');
    await fireEvent.press(screen.getByRole('tab', { name: 'Today' }));
    expect(router.navigate).toHaveBeenCalledWith({ pathname: '/', params: { day: '' } });

    await renderBar('index');
    await fireEvent.press(screen.getByRole('tab', { name: 'Today' }));
    expect(router.setParams).toHaveBeenCalledWith({ day: '' });
  });

  it('lays a blur under translucent paper on iOS', async () => {
    await renderBar('index');
    expect(screen.getByTestId('tab-blur')).toBeOnTheScreen();
    expect(barBackground()).toBe('rgba(247,247,243,0.88)');
  });

  it('keeps a solid paper bar on Android', async () => {
    const platform = Platform as { OS: string };
    const os = platform.OS;
    platform.OS = 'android';
    await renderBar('index');
    expect(screen.queryByTestId('tab-blur')).toBeNull();
    expect(barBackground()).toBe('#f7f7f3');
    platform.OS = os;
  });
});

function barBackground() {
  return StyleSheet.flatten(screen.getByRole('tab', { name: 'Today' }).parent?.props.style).backgroundColor;
}
