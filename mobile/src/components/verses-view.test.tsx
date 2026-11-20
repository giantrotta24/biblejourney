import { describe, expect, it } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { ProgressProvider } from '@/progress/context';
import { light } from '@/theme/colors';
import { VersesProvider } from '@/verses/context';
import { VERSES_KEY, type KeyValueStore } from '@/verses/store';
import { getWeek } from '../../../supabase/functions/_shared/content/plan';

import { VersesView } from './verses-view';

function memory(): KeyValueStore & { raw: Map<string, string> } {
  const raw = new Map<string, string>();
  return {
    raw,
    async getItem(key) {
      return raw.get(key) ?? null;
    },
    async setItem(key, value) {
      raw.set(key, value);
    },
  };
}

describe('Verses', () => {
  it('shows this week’s verse in blue and keeps I know it', async () => {
    const storage = memory();
    const now = new Date('2026-11-20T12:00:00.000Z');
    await render(
      <ProgressProvider>
        <VersesProvider storage={storage} now={() => now}>
          <VersesView />
        </VersesProvider>
      </ProgressProvider>,
    );

    const reference = getWeek(1).memoryVerse.ref;
    expect(await screen.findByText('Week 1')).toBeOnTheScreen();
    expect(StyleSheet.flatten(screen.getByText('Week 1').props.style).color).toBe(light.blueInk);

    const know = screen.getAllByRole('checkbox', { name: `I know it, ${reference}` })[0];
    if (!know) throw new Error('missing checkbox');
    await fireEvent.press(know);
    await waitFor(() => {
      expect(JSON.parse(storage.raw.get(VERSES_KEY) ?? '').rows).toEqual([
        { week: 1, learned_at: '2026-11-20T12:00:00.000Z' },
      ]);
    });
    expect(screen.getAllByRole('checkbox', { name: `I know it, ${reference}` })[0]?.props.accessibilityState).toEqual({
      checked: true,
    });
  });
});
