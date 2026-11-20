import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { PixelRatio, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { createGestureController, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';

import { ProgressProvider, useProgress } from '../progress/context';
import { DAY_COUNT } from '../../../supabase/functions/_shared/content/plan';
import { TodayView, type TodayViewProps } from './today-view';

async function renderToday(props: Partial<TodayViewProps> & Pick<TodayViewProps, 'done'>) {
  return render(
    <GestureHandlerRootView>
      <TodayView onMark={() => {}} onBackToToday={() => {}} onOpenPlan={() => {}} onShowDay={() => {}} {...props} />
    </GestureHandlerRootView>,
  );
}

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  selectionAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}));

jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(),
}));

describe('Today', () => {
  it('shows day 1 when nothing is read', async () => {
    await renderToday({ done: new Set() });

    expect(screen.getByText('1')).toBeOnTheScreen();
    expect(screen.getByText('Genesis 1–4')).toBeOnTheScreen();
    expect(screen.getByText('Mark day 1 read')).toBeOnTheScreen();
  });

  it('opens Bible Gateway in the translation it was given', async () => {
    const open = jest.mocked(WebBrowser.openBrowserAsync);
    open.mockClear();
    await renderToday({ done: new Set(), translation: 'ESV' });
    await fireEvent.press(screen.getByRole('link', { name: 'Read Genesis 1–4 on Bible Gateway' }));
    expect(open).toHaveBeenCalledWith('https://www.biblegateway.com/passage/?search=Genesis+1-4&version=ESV');
  });

  it('offers Ask about this reading under Bible Gateway as full-width rows when asking is available', async () => {
    const onOpenAsk = jest.fn();
    await renderToday({ done: new Set(), onOpenAsk });
    const gateway = screen.getByRole('link', { name: 'Read Genesis 1–4 on Bible Gateway' });
    const ask = screen.getByRole('button', { name: 'Ask about this reading' });
    for (const row of [gateway, ask]) {
      const style = StyleSheet.flatten(row.props.style);
      expect(style.minHeight).toBe(48);
      expect(style.flexDirection).toBe('row');
      expect(style.paddingVertical).toBe(8);
    }
    for (const label of ['Read on Bible Gateway', 'Ask about this reading']) {
      const text = StyleSheet.flatten(screen.getByText(label).props.style);
      expect(text.fontSize).toBe(17);
      expect(text.fontWeight).toBe('600');
      expect(text.textDecorationLine).toBeUndefined();
    }
    expect(textOrder(screen.root).indexOf('Read on Bible Gateway')).toBeLessThan(
      textOrder(screen.root).indexOf('Ask about this reading'),
    );
    await fireEvent.press(ask);
    expect(onOpenAsk).toHaveBeenCalledWith(0);
  });

  it('hides Ask about this reading when asking is not offered', async () => {
    await renderToday({ done: new Set() });
    expect(screen.getByRole('link', { name: 'Read Genesis 1–4 on Bible Gateway' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Ask about this reading' })).toBeNull();
    expect(screen.queryByText('Ask about this reading')).toBeNull();
  });

  it('shows day N+1 after N days are read', async () => {
    const read = 6;
    await renderToday({ done: new Set(Array.from({ length: read }, (_, index) => index)) });

    expect(screen.getByText(String(read + 1))).toBeOnTheScreen();
    expect(screen.getByText('Job 13–15')).toBeOnTheScreen();
    expect(screen.getByText('Mark day 7 read')).toBeOnTheScreen();
  });

  it('shows Read on Monday and no blue button on a day already read', async () => {
    await renderToday({ done: new Set([0]), dayIndex: 0 });

    expect(screen.getByText('Read on Monday')).toBeOnTheScreen();
    expect(screen.getByText('Back to today')).toBeOnTheScreen();
    expect(screen.queryByText('Mark day 1 read')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mark day 1 read' })).toBeNull();
  });

  it('offers Mark as unread on a day already read', async () => {
    const onUnmark = jest.fn();
    await renderToday({ done: new Set([0, 1]), dayIndex: 0, onUnmark });

    const button = screen.getByRole('button', { name: 'Mark as unread' });
    expect(StyleSheet.flatten(button.props.style).minHeight).toBeGreaterThanOrEqual(44);
    await fireEvent.press(button);
    expect(onUnmark).toHaveBeenCalledWith(0);
  });

  it('unmarks a read day and shows the day unread again', async () => {
    function Loop() {
      const { days, mark, unmark } = useProgress();
      return (
        <TodayView
          done={days}
          dayIndex={0}
          onMark={mark}
          onUnmark={unmark}
          onBackToToday={() => {}}
          onOpenPlan={() => {}}
          onShowDay={() => {}}
        />
      );
    }

    const saved = new Map<string, string>();
    const storage = {
      async getItem(key: string) {
        return saved.get(key) ?? null;
      },
      async setItem(key: string, value: string) {
        saved.set(key, value);
      },
    };
    await render(
      <GestureHandlerRootView>
        <ProgressProvider storage={storage}>
          <Loop />
        </ProgressProvider>
      </GestureHandlerRootView>,
    );

    await fireEvent.press(await screen.findByRole('button', { name: 'Mark day 1 read' }));
    expect(await screen.findByText('Read on Monday')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Mark as unread' }));
    expect(await screen.findByRole('button', { name: 'Mark day 1 read' })).toBeOnTheScreen();
    expect(screen.queryByText('Read on Monday')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mark as unread' })).toBeNull();
  });

  it('shows the whole verse', async () => {
    await renderToday({ done: new Set() });
    const verse = screen.getByText(/In the beginning God created/);
    expect(verse.props.numberOfLines).toBeUndefined();
    expect(verse.props.ellipsizeMode).toBeUndefined();
  });

  it('uses the design size once and steps the numeral down at large text', async () => {
    jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(2);
    await renderToday({ done: new Set() });

    const numeral = screen.getByLabelText('Day 1');
    const numeralStyle = StyleSheet.flatten(numeral.props.style);
    expect(numeral.props.allowFontScaling).toBe(false);
    expect(numeralStyle.fontSize).toBe(112);
    expect(numeralStyle.lineHeight).toBeGreaterThanOrEqual(112);

    const reading = screen.getByText('Genesis 1–4');
    expect(StyleSheet.flatten(reading.props.style).fontSize).toBe(31);
    expect(reading.props.maxFontSizeMultiplier).toBe(1.6);

    const context = screen.getByText(/From the garden/);
    expect(StyleSheet.flatten(context.props.style).fontSize).toBe(17);
    expect(context.props.maxFontSizeMultiplier).toBe(2);
    jest.restoreAllMocks();
  });

  it('marks the current day and shows the next one', async () => {
    function Loop() {
      const { days, mark } = useProgress();
      return (
        <TodayView done={days} onMark={mark} onBackToToday={() => {}} onOpenPlan={() => {}} onShowDay={() => {}} />
      );
    }

    await render(
      <GestureHandlerRootView>
        <ProgressProvider>
          <Loop />
        </ProgressProvider>
      </GestureHandlerRootView>,
    );

    await fireEvent.press(await screen.findByRole('button', { name: 'Mark day 1 read' }));
    expect(await screen.findByRole('button', { name: 'Mark day 2 read' })).toBeOnTheScreen();
    expect(screen.getByText('Genesis 5–7')).toBeOnTheScreen();
  });

  it('does not tear when a later unread day is marked', async () => {
    const onMark = jest.fn();
    jest.mocked(Haptics.impactAsync).mockClear();
    await renderToday({ done: new Set(), dayIndex: 2, onMark });

    await fireEvent.press(screen.getByRole('button', { name: 'Mark day 3 read' }));

    expect(onMark).toHaveBeenCalledWith(2);
    expect(Haptics.impactAsync).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Mark day 3 read' })).toBeOnTheScreen();
    expect(screen.queryByTestId('torn-page', { includeHiddenElements: true })).toBeNull();
  });

  it('hides the page that is tearing', async () => {
    const reanimated = jest.requireMock('react-native-reanimated') as {
      withTiming: { mockImplementation: (fn: (...args: unknown[]) => unknown) => void };
    };
    reanimated.withTiming.mockImplementation((...args: unknown[]) => args[0]);
    await renderToday({ done: new Set() });
    await fireEvent.press(screen.getByRole('button', { name: 'Mark day 1 read' }));

    const torn = screen.getByTestId('torn-page', { includeHiddenElements: true });
    expect(torn.props.accessibilityElementsHidden).toBe(true);
    expect(torn.props.importantForAccessibility).toBe('no-hide-descendants');

    reanimated.withTiming.mockImplementation((...args: unknown[]) => {
      const callback = args[2] as ((finished: boolean) => void) | undefined;
      callback?.(true);
      return args[0];
    });
  });

  it('stops a turn before day 1 and after day 312', async () => {
    const onShowDay = jest.fn();
    const first = await renderToday({ done: new Set(), onShowDay });
    swipe(80);
    expect(onShowDay).not.toHaveBeenCalled();
    await first.unmount();

    const last = DAY_COUNT - 1;
    const read = new Set(Array.from({ length: last }, (_, index) => index));
    await renderToday({ done: read, onShowDay });
    swipe(-80);
    expect(onShowDay).not.toHaveBeenCalled();
  });

  it('shows the note placeholder, then the note’s first lines, and opens that day', async () => {
    const onOpenNote = jest.fn();
    const note =
      'The gleaning law stopped me. Leave part of the harvest on purpose, for the widow and the stranger.';
    const first = await renderToday({ done: new Set(), onOpenNote, noteFor: () => null });

    const placeholder = screen.getByText('Write a note on today’s reading');
    expect(placeholder.props.numberOfLines).toBe(2);
    expect(screen.getByRole('button', { name: /Your note/ })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: /Your note/ }));
    expect(onOpenNote).toHaveBeenCalledWith(0);

    await first.unmount();
    await renderToday({ done: new Set([0]), dayIndex: 0, noteFor: () => note });
    const written = screen.getByText(note);
    expect(written.props.numberOfLines).toBe(2);
    expect(screen.getByText('Read on Monday')).toBeOnTheScreen();
    const order = textOrder(screen.root);
    const noteAt = order.indexOf('Your note');
    const readAt = order.indexOf('Read on ');
    expect(noteAt).toBeGreaterThan(-1);
    expect(readAt).toBeGreaterThan(noteAt);
  });

  it('keeps the note rules on the text at font scale 1 and 2', async () => {
    const scale = jest.spyOn(PixelRatio, 'getFontScale').mockReturnValue(1);
    try {
      const first = await renderToday({ done: new Set() });
      const small = screen.getByText('Write a note on today’s reading');
      expect(small.props.allowFontScaling).toBe(false);
      expect(StyleSheet.flatten(small.props.style).fontSize).toBe(16);
      expect(StyleSheet.flatten(small.props.style).lineHeight).toBe(30);
      expect(StyleSheet.flatten(small.parent?.props.style).height).toBe(60);
      await first.unmount();

      scale.mockReturnValue(2);
      await renderToday({ done: new Set() });
      const large = screen.getByText('Write a note on today’s reading');
      expect(StyleSheet.flatten(large.props.style).fontSize).toBe(32);
      expect(StyleSheet.flatten(large.props.style).lineHeight).toBe(60);
      expect(StyleSheet.flatten(large.parent?.props.style).height).toBe(120);
    } finally {
      scale.mockRestore();
    }
  });

  it('shows the finished page after every day is read', async () => {
    const onShowDay = jest.fn();
    const done = new Set(Array.from({ length: DAY_COUNT }, (_, index) => index));
    await renderToday({ done, onShowDay });

    expect(screen.getByText('You’ve read the whole Bible.')).toBeOnTheScreen();
    expect(screen.getByText('The whole year is in Plan')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /Mark day/ })).toBeNull();

    swipe(-80);
    expect(onShowDay).not.toHaveBeenCalled();
    swipe(80);
    expect(onShowDay).toHaveBeenCalledWith(DAY_COUNT - 1);
  });

  it('shows the signed-in line until the page turns', async () => {
    const onPageTurn = jest.fn();
    await renderToday({
      done: new Set(),
      signedInNote: 'Signed in. Your progress came with you.',
      onPageTurn,
    });
    expect(screen.getByText('Signed in. Your progress came with you.')).toBeOnTheScreen();
    swipe(20);
    expect(onPageTurn).not.toHaveBeenCalled();
    swipe(-80);
    expect(onPageTurn).toHaveBeenCalledTimes(1);
  });
});

function textOrder(node: ReturnType<typeof screen.getByText> | null): string[] {
  if (!node) return [];
  const texts: string[] = [];
  function walk(current: ReturnType<typeof screen.getByText>) {
    for (const child of current.children) {
      if (typeof child === 'string') texts.push(child);
      else walk(child);
    }
  }
  walk(node);
  return texts;
}

function swipe(translationX: number) {
  const controller = createGestureController(getByGestureTestId('today-turn'));
  controller.begin();
  controller.activate();
  controller.end({ translationX, translationY: 0 });
}
