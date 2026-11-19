import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

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

  it('shows day N+1 after N days are read', async () => {
    const read = 6;
    await renderToday({ done: new Set(Array.from({ length: read }, (_, index) => index)) });

    expect(screen.getByText(String(read + 1))).toBeOnTheScreen();
    expect(screen.getByText('Job 13–15')).toBeOnTheScreen();
    expect(screen.getByText('Mark day 7 read')).toBeOnTheScreen();
  });

  it('shows Read and no blue button on a day already read', async () => {
    await renderToday({ done: new Set([0]), dayIndex: 0 });

    expect(screen.getByText('Read')).toBeOnTheScreen();
    expect(screen.getByText('Back to today')).toBeOnTheScreen();
    expect(screen.queryByText('Mark day 1 read')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mark day 1 read' })).toBeNull();
  });
});
