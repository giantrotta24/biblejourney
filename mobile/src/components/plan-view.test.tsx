import { describe, expect, it } from '@jest/globals';
import { render, screen, waitFor } from '@testing-library/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { PlanView } from './plan-view';

describe('Plan notes', () => {
  it('shows Note on a day that has one', async () => {
    await render(
      <GestureHandlerRootView>
        <PlanView done={new Set()} noted={new Set([0])} onOpenDay={() => {}} />
      </GestureHandlerRootView>,
    );

    expect(screen.getByText('Note')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /Genesis 1–4, today, note/ })).toBeOnTheScreen();
  });

  it('opens the week a timeline era asked for', async () => {
    await render(
      <GestureHandlerRootView>
        <PlanView done={new Set()} noted={new Set()} onOpenDay={() => {}} focusWeek={5} />
      </GestureHandlerRootView>,
    );
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Week 5,/ }).props.accessibilityState).toMatchObject({ expanded: true });
    });
  });
});
