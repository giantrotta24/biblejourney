import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
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
});
