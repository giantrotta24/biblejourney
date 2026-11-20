import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { PlanView } from './plan-view';

describe('Plan notes', () => {
  it('shows Note on a day that has one', async () => {
    await render(
      <GestureHandlerRootView>
        <PlanView done={new Set()} noted={new Set([0])} onOpenDay={() => {}} onToggleDay={() => {}} />
      </GestureHandlerRootView>,
    );

    expect(screen.getByText('Note')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /Genesis 1–4, today, note/ })).toBeOnTheScreen();
  });

  it('opens the week a timeline era asked for', async () => {
    await render(
      <GestureHandlerRootView>
        <PlanView done={new Set()} noted={new Set()} onOpenDay={() => {}} onToggleDay={() => {}} focusWeek={5} />
      </GestureHandlerRootView>,
    );
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Week 5,/ }).props.accessibilityState).toMatchObject({ expanded: true });
    });
  });
});

describe('Plan day checks', () => {
  it('checks a read day and leaves an unread day unchecked', async () => {
    await render(
      <GestureHandlerRootView>
        <PlanView done={new Set([0])} noted={new Set()} onOpenDay={() => {}} onToggleDay={() => {}} />
      </GestureHandlerRootView>,
    );

    const read = screen.getByRole('checkbox', { name: 'Day 1, Genesis 1–4' });
    expect(read.props.accessibilityState).toMatchObject({ checked: true });
    const unread = screen.getByRole('checkbox', { name: 'Day 2, Genesis 5–7' });
    expect(unread.props.accessibilityState).toMatchObject({ checked: false });
  });

  it('unmarks a read day and marks an unread one from its check', async () => {
    const onToggleDay = jest.fn();
    const onOpenDay = jest.fn();
    await render(
      <GestureHandlerRootView>
        <PlanView done={new Set([0])} noted={new Set()} onOpenDay={onOpenDay} onToggleDay={onToggleDay} />
      </GestureHandlerRootView>,
    );

    await fireEvent.press(screen.getByRole('checkbox', { name: 'Day 1, Genesis 1–4' }));
    expect(onToggleDay).toHaveBeenLastCalledWith(0, false);
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Day 3, Genesis 8–11' }));
    expect(onToggleDay).toHaveBeenLastCalledWith(2, true);
    expect(onOpenDay).not.toHaveBeenCalled();
  });

  it('still opens the day from the rest of the row', async () => {
    const onToggleDay = jest.fn();
    const onOpenDay = jest.fn();
    await render(
      <GestureHandlerRootView>
        <PlanView done={new Set([0])} noted={new Set()} onOpenDay={onOpenDay} onToggleDay={onToggleDay} />
      </GestureHandlerRootView>,
    );

    await fireEvent.press(screen.getByRole('button', { name: /^Mon, Genesis 1–4, read/ }));
    expect(onOpenDay).toHaveBeenCalledWith(0);
    expect(onToggleDay).not.toHaveBeenCalled();
  });
});
