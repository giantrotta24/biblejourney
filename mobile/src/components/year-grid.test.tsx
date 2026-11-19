import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { createGestureController, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { DAY_COUNT, WEEK_COUNT, getWeek } from '../../../supabase/functions/_shared/content/plan';

import { YearGrid } from './year-grid';

async function renderGrid(onScrub = jest.fn(), onCommit = jest.fn()) {
  await render(
    <GestureHandlerRootView>
      <YearGrid done={new Set()} onScrub={onScrub} onCommit={onCommit} />
    </GestureHandlerRootView>,
  );
  await fireEvent(screen.getByRole('adjustable'), 'layout', {
    nativeEvent: { layout: { width: 350, height: 74, x: 0, y: 0 } },
  });
  return { onScrub, onCommit };
}

describe('YearGrid', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('reads the year with the day count, and the week only as the value', async () => {
    await renderGrid();
    const grid = screen.getByRole('adjustable');
    expect(grid.props.accessibilityLabel).toBe(`The year, ${WEEK_COUNT} weeks. 0 of ${DAY_COUNT} days read.`);
    expect(grid.props.accessibilityValue).toEqual({ text: `Week 1, ${getWeek(1).title}` });
    expect(grid.props.accessibilityLabel).not.toContain('Week 1');
  });

  it('moves the readout while stepping and opens the week after a pause', async () => {
    jest.useFakeTimers();
    const { onScrub, onCommit } = await renderGrid();
    const grid = screen.getByRole('adjustable');

    await fireEvent(grid, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });

    expect(onCommit).not.toHaveBeenCalled();
    expect(onScrub).toHaveBeenCalledWith(2);
    expect(grid.props.accessibilityValue.text).toBe(`Week 2, ${getWeek(2).title}`);

    await act(async () => {
      jest.advanceTimersByTime(600);
    });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(2);
    expect(onScrub).toHaveBeenCalledWith(null);
  });

  it('opens the stepped week when the control is activated', async () => {
    jest.useFakeTimers();
    const { onCommit } = await renderGrid();
    const grid = screen.getByRole('adjustable');

    await fireEvent(grid, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    await fireEvent(grid, 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(2);
    await act(async () => {
      jest.advanceTimersByTime(600);
    });
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('clears the scrub line when the pan is cancelled', async () => {
    const { onScrub } = await renderGrid();
    const controller = createGestureController(getByGestureTestId('year-scrub'));
    controller.begin();
    controller.activate();
    controller.update({ x: 180 });
    onScrub.mockClear();

    controller.cancel();

    expect(onScrub).toHaveBeenCalledWith(null);
  });
});
