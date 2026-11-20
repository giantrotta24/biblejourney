// Outside src/app so Expo Router does not bundle this test into the app.
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import TodayScreen from '@/app/(tabs)/index';
import { NotesProvider } from '@/notes/context';
import { NOTES_KEY, type KeyValueStore } from '@/notes/store';
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

const ASSISTANT_URL = process.env.EXPO_PUBLIC_ASSISTANT_URL;

function renderToday() {
  return render(
    <GestureHandlerRootView>
      <ProgressProvider>
        <NotesProvider>
          <TodayScreen />
        </NotesProvider>
      </ProgressProvider>
    </GestureHandlerRootView>,
  );
}

describe('Today note route', () => {
  beforeEach(() => {
    jest.mocked(router.push).mockClear();
    if (ASSISTANT_URL === undefined) delete process.env.EXPO_PUBLIC_ASSISTANT_URL;
    else process.env.EXPO_PUBLIC_ASSISTANT_URL = ASSISTANT_URL;
  });

  it('opens the writing sheet for the day on the page', async () => {
    await renderToday();

    await fireEvent.press(await screen.findByRole('button', { name: /Your note/ }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/note/[day]', params: { day: '0' } });
  });

  it('hides Ask about this reading when the ask address is unset', async () => {
    delete process.env.EXPO_PUBLIC_ASSISTANT_URL;
    await renderToday();
    expect(await screen.findByRole('link', { name: 'Read Genesis 1–4 on Bible Gateway' })).toBeOnTheScreen();
    expect(screen.queryByRole('link', { name: 'Ask about this reading' })).toBeNull();
  });

  it('opens the assistant for the day on the page', async () => {
    process.env.EXPO_PUBLIC_ASSISTANT_URL = 'https://project.supabase.co/functions/v1/ask';
    await renderToday();
    await fireEvent.press(await screen.findByRole('link', { name: 'Ask about this reading' }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/ask/[day]', params: { day: '0' } });
  });

  it('still shows today when notes cannot be read', async () => {
    const storage: KeyValueStore = {
      async getItem() {
        throw new Error('read');
      },
      async setItem() {},
    };
    await render(
      <GestureHandlerRootView>
        <ProgressProvider>
          <NotesProvider storage={storage}>
            <TodayScreen />
          </NotesProvider>
        </ProgressProvider>
      </GestureHandlerRootView>,
    );
    expect(await screen.findByText('Mark day 1 read')).toBeOnTheScreen();
    expect(screen.queryByText('Couldn’t load your notes.')).toBeNull();
  });

  it('keeps the note blank until notes have loaded', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const storage: KeyValueStore = {
      async getItem(key) {
        if (key !== NOTES_KEY) return null;
        await gate;
        return JSON.stringify({
          version: 1,
          rows: [{ day_index: 0, body: 'Hidden until ready', updated_at: '2026-11-20T12:00:00.000Z' }],
        });
      },
      async setItem() {},
    };
    await render(
      <GestureHandlerRootView>
        <ProgressProvider>
          <NotesProvider storage={storage}>
            <TodayScreen />
          </NotesProvider>
        </ProgressProvider>
      </GestureHandlerRootView>,
    );
    expect(await screen.findByText('Write a note on today’s reading')).toBeOnTheScreen();
    expect(screen.queryByText('Hidden until ready')).toBeNull();
    release();
    expect(await screen.findByText('Hidden until ready')).toBeOnTheScreen();
  });
});
