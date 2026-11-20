// Outside src/app so Expo Router does not bundle this test into the app.
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import TodayScreen from '@/app/(tabs)/index';
import { NotesProvider } from '@/notes/context';
import { ProgressProvider } from '@/progress/context';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), setParams: jest.fn(), navigate: jest.fn() },
  useLocalSearchParams: () => ({}),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}));

jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(),
}));

describe('Today note route', () => {
  beforeEach(() => {
    jest.mocked(router.push).mockClear();
  });

  it('opens the writing sheet for the day on the page', async () => {
    await render(
      <GestureHandlerRootView>
        <ProgressProvider>
          <NotesProvider>
            <TodayScreen />
          </NotesProvider>
        </ProgressProvider>
      </GestureHandlerRootView>,
    );

    await fireEvent.press(await screen.findByRole('button', { name: /Your note/ }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/note/[day]', params: { day: '0' } });
  });
});
