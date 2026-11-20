import { describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ActionSheetIOS, Alert, Platform, ScrollView, StyleSheet, Text } from 'react-native';

import { firstLetters } from '@/lib/reading';
import { ProgressProvider } from '@/progress/context';
import { PROGRESS_KEY } from '@/progress/store';
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
    const boxes = screen.getAllByRole('checkbox', { name: `I know it, ${reference}` });
    expect(boxes[0]?.props.accessibilityState).toEqual({ checked: true });
    expect(boxes.at(-1)?.props.accessibilityState.checked).toBe(true);
  });

  it('hides the verse and the checkbox for a week that has not come up', async () => {
    await render(
      <ProgressProvider>
        <VersesProvider storage={memory()}>
          <VersesView />
        </VersesProvider>
      </ProgressProvider>,
    );

    const later = getWeek(2);
    expect(await screen.findByText('Week 2, coming up')).toBeOnTheScreen();
    expect(screen.queryByRole('checkbox', { name: `I know it, ${later.memoryVerse.ref}` })).toBeNull();
    expect(screen.queryByText(later.memoryVerse.textKJV)).toBeNull();
    expect(screen.getAllByText(getWeek(1).memoryVerse.textKJV)).toHaveLength(1);
  });

  it('opens on another reached verse and scrolls to this week once', async () => {
    const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => {});
    const random = jest.spyOn(Math, 'random').mockReturnValue(0);
    try {
      await render(
        <ProgressProvider storage={readDays(6)}>
          <VersesProvider storage={memory()}>
            <VersesView />
          </VersesProvider>
        </ProgressProvider>,
      );

      expect(await screen.findByText('Week 2')).toBeOnTheScreen();
      const order = textOrder(screen.root);
      const practice = order.indexOf('Practice');
      expect(order[practice + 1]).toBe(getWeek(1).memoryVerse.ref);

      const row = layoutHost(screen.getByText('Week 2'));
      await fireEvent(row, 'layout', { nativeEvent: { layout: { x: 0, y: 640, width: 300, height: 48 } } });
      await fireEvent(row, 'layout', { nativeEvent: { layout: { x: 0, y: 640, width: 300, height: 48 } } });
      expect(scrollTo).toHaveBeenCalledTimes(1);
      expect(scrollTo).toHaveBeenCalledWith({ y: 640, animated: false });
    } finally {
      scrollTo.mockRestore();
      random.mockRestore();
    }
  });

  it('asks how to show the verse instead of toggling it', async () => {
    const sheet = jest.spyOn(ActionSheetIOS, 'showActionSheetWithOptions').mockImplementation(() => {});
    try {
      await render(
        <ProgressProvider>
          <VersesProvider storage={memory()}>
            <VersesView />
          </VersesProvider>
        </ProgressProvider>,
      );

      const verse = getWeek(1).memoryVerse.textKJV;
      const control = await screen.findByLabelText('Show the verse as');
      expect(control.props.accessibilityValue).toEqual({ text: 'Full text' });
      await fireEvent.press(control);
      expect(sheet).toHaveBeenCalled();
      expect(screen.getByText(verse)).toBeOnTheScreen();

      const choose = sheet.mock.calls[0]?.[1];
      if (!choose) throw new Error('missing action sheet callback');
      await act(async () => {
        choose(1);
      });
      expect(screen.getByText(firstLetters(verse))).toBeOnTheScreen();
      expect(screen.queryByText(verse)).toBeNull();
      expect(screen.getByLabelText('Show the verse as').props.accessibilityValue).toEqual({
        text: 'First letters',
      });
    } finally {
      sheet.mockRestore();
    }
  });

  it('asks with an alert on Android', async () => {
    const original = Platform.OS;
    Object.defineProperty(Platform, 'OS', { get: () => 'android' });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    try {
      await render(
        <ProgressProvider>
          <VersesProvider storage={memory()}>
            <VersesView />
          </VersesProvider>
        </ProgressProvider>,
      );
      await fireEvent.press(await screen.findByLabelText('Show the verse as'));
      expect(alert).toHaveBeenCalledWith('Show the verse as', undefined, [
        expect.objectContaining({ text: 'Full text' }),
        expect.objectContaining({ text: 'First letters' }),
      ]);
    } finally {
      Object.defineProperty(Platform, 'OS', { get: () => original });
      alert.mockRestore();
    }
  });

  it('offers try again when verses cannot be read', async () => {
    const storage: KeyValueStore = {
      async getItem() {
        throw new Error('read');
      },
      async setItem() {},
    };
    await render(
      <ProgressProvider>
        <VersesProvider storage={storage}>
          <>
            <Text>still here</Text>
            <VersesView />
          </>
        </VersesProvider>
      </ProgressProvider>,
    );
    expect(await screen.findByText('Couldn’t load your verses.')).toBeOnTheScreen();
    expect(screen.getByText('still here')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeOnTheScreen();
  });

  it('sets this week’s page on the pad', async () => {
    await render(
      <ProgressProvider>
        <VersesProvider storage={memory()}>
          <VersesView />
        </VersesProvider>
      </ProgressProvider>,
    );
    expect(await screen.findByText('Week 1')).toBeOnTheScreen();
    expect(findPad(screen.root)).toBeTruthy();
  });
});

function readDays(count: number): KeyValueStore {
  const raw = new Map<string, string>([
    [PROGRESS_KEY, JSON.stringify({ version: 1, days: Array.from({ length: count }, (_, index) => index) })],
  ]);
  return {
    async getItem(key) {
      return raw.get(key) ?? null;
    },
    async setItem(key, value) {
      raw.set(key, value);
    },
  };
}

type Instance = ReturnType<typeof screen.getByText>;

function textOrder(node: Instance | null): string[] {
  if (!node) return [];
  const texts: string[] = [];
  function walk(current: Instance) {
    for (const child of current.children) {
      if (typeof child === 'string') texts.push(child);
      else walk(child);
    }
  }
  walk(node);
  return texts;
}

function findPad(node: Instance | null): Instance | null {
  if (!node) return null;
  const style = StyleSheet.flatten(node.props.style);
  if (style?.backgroundColor === light.under && style?.marginHorizontal === -20) return node;
  for (const child of node.children) {
    if (typeof child === 'string') continue;
    const found = findPad(child);
    if (found) return found;
  }
  return null;
}

function layoutHost(node: Instance): Instance {
  let current: Instance | null = node;
  while (current) {
    if (current.props.onLayout) return current;
    current = current.parent;
  }
  throw new Error('no layout host');
}
