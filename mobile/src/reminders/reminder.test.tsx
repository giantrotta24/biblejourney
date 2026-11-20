import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { AccessibilityInfo, Alert, AppState, Linking, Platform, Pressable, Text } from 'react-native';

import { dark, light } from '@/theme/colors';

import { fakeAuth, fakeProfiles, resetFakeAuth } from '@/account/fake-supabase';
import { ReadingProviders } from '@/providers';
import AccountRoute from '@/app/(tabs)/more/account';
import MoreScreen from '@/app/(tabs)/more/index';
import SettingsRoute from '@/app/(tabs)/more/settings';
import { useProgress } from '@/progress/context';
import { currentDay, DAY_COUNT } from '../../../supabase/functions/_shared/content/plan';

import { reminderSnapshot, resetReminderForTests } from './client';
import {
  cancelCount,
  emitNotificationResponse,
  permissionRequestCount,
  resetNotificationsMock,
  scheduledNotifications,
  setLastNotificationResponse,
  setNotificationPermission,
} from './notifications-mock';
import { setReminderClockForTests, setReminderTimeZoneForTests, setTimeZonePollForTests } from './schedule';
import { zonedInstant } from './time';

/* eslint-disable @typescript-eslint/no-require-imports -- the mock factory cannot close over an import */
jest.mock('@/account/supabase', () => require('@/account/fake-supabase'));
/* eslint-enable @typescript-eslint/no-require-imports */
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), navigate: jest.fn(), dismissAll: jest.fn() },
  useLocalSearchParams: () => ({}),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const ZONE = 'America/New_York';
const TITLE = 'Today\u2019s reading is ready';
const DENIED = 'Notifications are off for Bible Journey.';
const NOTE = 'One calm note a day with your next reading, sent in your own time zone.';
const granted = { granted: true, canAskAgain: false, status: 'granted', expires: 'never' as const };
const denied = { granted: false, canAskAgain: false, status: 'denied', expires: 'never' as const };

let now = new Date('2026-11-20T11:00:00.000Z');
const appListeners = new Set<(state: string) => void>();

function localDate(instant: Date, timeZone = ZONE) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  );
  const hour = Number(parts.hour);
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: hour === 24 ? 0 : hour,
    minute: Number(parts.minute),
  };
}

function moments() {
  return scheduledNotifications()
    .map((item) => {
      if (item.trigger.type === 'calendar') {
        return zonedInstant(
          item.trigger.year ?? 0,
          item.trigger.month ?? 0,
          item.trigger.day ?? 0,
          item.trigger.hour ?? 0,
          item.trigger.minute ?? 0,
          ZONE,
        );
      }
      const raw = item.trigger.date;
      if (raw == null) throw new Error('a scheduled reminder has no date');
      return raw instanceof Date ? raw : new Date(raw);
    })
    .sort((a, b) => a.getTime() - b.getTime());
}

async function confirm(title: string, label: string) {
  const call = jest.mocked(Alert.alert).mock.calls.filter((item) => item[0] === title).at(-1);
  const buttons = call?.[2] as { text: string; onPress?: () => void | Promise<void> }[] | undefined;
  const button = buttons?.find((item) => item.text === label);
  if (!button?.onPress) throw new Error(`No ${label} button on ${title}`);
  await act(async () => {
    await button.onPress?.();
  });
}

function BringDays({
  label,
  rows,
}: {
  label: string;
  rows: readonly { day_index: number; completed_at: string }[];
}) {
  const { replaceDays } = useProgress();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => replaceDays(rows)}>
      <Text>{label}</Text>
    </Pressable>
  );
}

async function renderSettings() {
  await render(
    <ReadingProviders>
      <SettingsRoute />
    </ReadingProviders>,
  );
  return screen.findByRole('switch', { name: 'Remind me' });
}

async function turnOn() {
  await fireEvent(await screen.findByRole('switch', { name: 'Remind me' }), 'valueChange', true);
  await waitFor(() => expect(scheduledNotifications()).toHaveLength(7));
}

describe('Daily reminder settings', () => {
  beforeEach(async () => {
    now = new Date('2026-11-20T11:00:00.000Z');
    appListeners.clear();
    resetNotificationsMock();
    resetReminderForTests();
    resetFakeAuth();
    setReminderClockForTests(() => now);
    setReminderTimeZoneForTests(() => ZONE);
    setTimeZonePollForTests(30_000);
    setNotificationPermission(granted);
    jest.restoreAllMocks();
    jest.mocked(router.push).mockClear();
    jest.mocked(router.navigate).mockClear();
    jest.mocked(router.dismissAll).mockClear();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    jest.spyOn(AppState, 'addEventListener').mockImplementation((type, listener) => {
      if (type === 'change') appListeners.add(listener as (state: string) => void);
      return { remove: () => appListeners.delete(listener as (state: string) => void) };
    });
    await AsyncStorage.clear();
  });

  it('shows the daily reminder first, off, at 7:00 AM', async () => {
    await renderSettings();
    const headers = screen.getAllByRole('header').map((item) => item.props.children);
    expect(headers.indexOf('Daily reminder')).toBeGreaterThan(-1);
    expect(headers.indexOf('Daily reminder')).toBeLessThan(headers.indexOf('Appearance'));
    const remind = screen.getByRole('switch', { name: 'Remind me' });
    expect(remind).not.toBeChecked();
    expect(remind.props.tintColor).toBe(light.rule);
    expect(remind.props.onTintColor).toBe(light.ink);
    expect(remind.props.thumbTintColor).toBe('#ffffff');
    const caption = screen.getByText('Remind me', { includeHiddenElements: true });
    expect(caption.props.accessibilityElementsHidden).toBe(true);
    expect(caption.props.importantForAccessibility).toBe('no');
    const time = screen.getByRole('button', { name: 'Time, 7:00 AM' });
    expect(time.props.accessibilityState).toEqual(expect.objectContaining({ expanded: false }));
    expect(time).toBeOnTheScreen();
    expect(screen.getByText(NOTE)).toBeOnTheScreen();
    expect(screen.queryByText(DENIED)).toBeNull();
    expect(permissionRequestCount()).toBe(0);
  });

  it('describes Settings as the reminder, appearance, and translation', async () => {
    await render(
      <ReadingProviders>
        <MoreScreen />
      </ReadingProviders>,
    );
    await fireEvent.press(await screen.findByRole('button', { name: 'Settings, Reminder, appearance, translation' }));
    expect(router.push).toHaveBeenCalledWith('/more/settings');
  });

  it('schedules seven days when she turns it on, and stores the choice on the phone', async () => {
    await renderSettings();
    expect(permissionRequestCount()).toBe(0);
    await turnOn();
    expect(permissionRequestCount()).toBe(0);
    expect(screen.getByRole('switch', { name: 'Remind me' })).toBeChecked();
    expect(scheduledNotifications().every((item) => item.content.title === TITLE)).toBe(true);
    expect(scheduledNotifications().every((item) => item.content.body === currentDay(new Set())?.reading)).toBe(true);
    expect(moments().map((moment) => localDate(moment).date)[0]).toBe('2026-11-20');
    const stored = JSON.parse((await AsyncStorage.getItem('biblejourney.reminder.v1')) ?? '{}') as {
      enabled?: boolean;
      hour?: number;
      minute?: number;
    };
    expect(stored).toMatchObject({ enabled: true, hour: 7, minute: 0 });
    const settings = JSON.parse((await AsyncStorage.getItem('biblejourney.settings.v1')) ?? '{}') as Record<string, unknown>;
    expect(settings.reminderTime).toBeUndefined();
    expect(JSON.stringify(fakeProfiles.saves)).not.toContain('reminder_time');
  });

  it('does not write the account reminder time when she is signed in', async () => {
    fakeAuth.session = { access_token: 'token', user: { id: 'user-1', email: 'reader@example.com' } };
    await renderSettings();
    await screen.findByRole('switch', { name: 'Remind me' });
    await waitFor(() => expect(fakeProfiles.saves.length).toBeGreaterThan(0));
    await turnOn();
    expect(JSON.stringify(fakeProfiles.saves)).not.toContain('reminder_time');
    expect(JSON.stringify(fakeProfiles.saves)).not.toContain('timezone');
  });

  it('keeps a chosen time while off, then reschedules at that time', async () => {
    await renderSettings();
    await fireEvent.press(screen.getByRole('button', { name: 'Time, 7:00 AM' }));
    expect(screen.getByRole('button', { name: 'Time, 7:00 AM' }).props.accessibilityState).toEqual(
      expect.objectContaining({ expanded: true }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Time picker' }));
    expect(screen.getByRole('button', { name: 'Time, 8:30 AM' })).toBeOnTheScreen();
    expect(scheduledNotifications()).toEqual([]);
    await turnOn();
    expect(moments().map((moment) => localDate(moment))).toEqual(
      ['2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26'].map((date) => ({
        date,
        hour: 8,
        minute: 30,
      })),
    );
  });

  it('opens the Android time dialog and closes it after a choice', async () => {
    const original = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'android' });
    try {
      await renderSettings();
      await fireEvent.press(screen.getByRole('button', { name: 'Time, 7:00 AM' }));
      const picker = screen.getByRole('button', { name: 'Time picker' });
      expect(picker).toBeOnTheScreen();
      expect(picker.props.is24Hour).toBeUndefined();
      await fireEvent.press(screen.getByRole('button', { name: 'Time picker' }));
      expect(screen.queryByRole('button', { name: 'Time picker' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Time, 8:30 AM' })).toBeOnTheScreen();
    } finally {
      Object.defineProperty(Platform, 'OS', { configurable: true, get: () => original });
    }
  });

  it('stays off when permission is denied and offers Settings', async () => {
    setNotificationPermission({ granted: false, canAskAgain: true, status: 'undetermined', expires: 'never' });
    await renderSettings();
    await fireEvent(screen.getByRole('switch', { name: 'Remind me' }), 'valueChange', true);
    expect(permissionRequestCount()).toBe(1);
    expect(screen.getByRole('switch', { name: 'Remind me' })).not.toBeChecked();
    expect(screen.getByText(DENIED)).toBeOnTheScreen();
    expect(screen.getByText(DENIED).props.accessibilityLiveRegion).toBe('polite');
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(DENIED);
    expect(scheduledNotifications()).toEqual([]);
    const stored = JSON.parse((await AsyncStorage.getItem('biblejourney.reminder.v1')) ?? '{}') as { enabled?: boolean };
    expect(stored.enabled).toBe(false);
    await fireEvent.press(screen.getByRole('button', { name: 'Open Settings' }));
    expect(Linking.openSettings).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Open Settings' }).props.style).toEqual(
      expect.objectContaining({ minHeight: 44 }),
    );
  });

  it('gives Open Settings a 48dp target on Android', async () => {
    const original = Platform.OS;
    Object.defineProperty(Platform, 'OS', { configurable: true, get: () => 'android' });
    setNotificationPermission({ granted: false, canAskAgain: true, status: 'undetermined', expires: 'never' });
    try {
      await renderSettings();
      await fireEvent(screen.getByRole('switch', { name: 'Remind me' }), 'valueChange', true);
      expect(screen.getByRole('button', { name: 'Open Settings' }).props.style).toEqual(
        expect.objectContaining({ minHeight: 48 }),
      );
    } finally {
      Object.defineProperty(Platform, 'OS', { configurable: true, get: () => original });
    }
  });

  it('uses a paper thumb when the ink switch is on in the dark', async () => {
    await renderSettings();
    await turnOn();
    expect(screen.getByRole('switch', { name: 'Remind me' }).props.thumbTintColor).toBe('#ffffff');
    await fireEvent.press(screen.getByRole('button', { name: 'Dark' }));
    const remind = screen.getByRole('switch', { name: 'Remind me' });
    expect(remind.props.tintColor).toBe(dark.rule);
    expect(remind.props.onTintColor).toBe(dark.ink);
    expect(remind.props.thumbTintColor).toBe(dark.paper);
  });

  it('turns on after she allows notifications and comes back', async () => {
    setNotificationPermission(denied);
    await renderSettings();
    await fireEvent(screen.getByRole('switch', { name: 'Remind me' }), 'valueChange', true);
    expect(permissionRequestCount()).toBe(0);
    expect(screen.getByText(DENIED)).toBeOnTheScreen();
    setNotificationPermission(granted);
    await act(async () => {
      for (const listener of appListeners) listener('active');
    });
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Remind me' })).toBeChecked());
    expect(screen.queryByText(DENIED)).toBeNull();
    await waitFor(() => expect(scheduledNotifications()).toHaveLength(7));
  });

  it('reschedules when progress arrives, when she resets, and when today is read', async () => {
    const yesterday = [{ day_index: 0, completed_at: '2026-11-19T15:00:00.000Z' }];
    const today = [{ day_index: 0, completed_at: '2026-11-20T11:00:00.000Z' }];
    await render(
      <ReadingProviders>
        <SettingsRoute />
        <BringDays label="Bring yesterday" rows={yesterday} />
        <BringDays label="Read today" rows={today} />
      </ReadingProviders>,
    );
    await turnOn();
    expect(scheduledNotifications()[0]?.content.body).toBe(currentDay(new Set())?.reading);

    await fireEvent.press(screen.getByRole('button', { name: 'Bring yesterday' }));
    await waitFor(() => expect(scheduledNotifications()[0]?.content.body).toBe(currentDay(new Set([0]))?.reading));
    expect(moments().map((moment) => localDate(moment).date)[0]).toBe('2026-11-20');
    expect(scheduledNotifications()).toHaveLength(7);

    await fireEvent.press(screen.getByRole('button', { name: 'Read today' }));
    await waitFor(() => expect(moments().map((moment) => localDate(moment).date)[0]).toBe('2026-11-21'));
    expect(scheduledNotifications()).toHaveLength(6);

    await fireEvent.press(screen.getByRole('button', { name: 'Reset progress…' }));
    await confirm('Reset your progress?', 'Reset');
    await waitFor(() => expect(scheduledNotifications()[0]?.content.body).toBe(currentDay(new Set())?.reading));
    expect(scheduledNotifications()).toHaveLength(7);
    expect(moments().map((moment) => localDate(moment).date)[0]).toBe('2026-11-20');
  });

  it('rolls the seven days forward when the app returns to the foreground', async () => {
    await renderSettings();
    await turnOn();
    expect(moments().map((moment) => localDate(moment).date)[0]).toBe('2026-11-20');
    now = new Date('2026-11-21T11:00:00.000Z');
    await act(async () => {
      for (const listener of appListeners) listener('active');
    });
    await waitFor(() => expect(moments().map((moment) => localDate(moment).date)[0]).toBe('2026-11-21'));
    expect(scheduledNotifications()).toHaveLength(7);
  });

  it('reschedules when the phone changes time zone', async () => {
    setTimeZonePollForTests(20);
    await renderSettings();
    await turnOn();
    if (Platform.OS === 'android') {
      expect(moments()[0]?.getUTCHours()).toBe(12);
    } else {
      expect(scheduledNotifications()[0]?.trigger).toMatchObject({ type: 'calendar', hour: 7, repeats: false });
      expect(scheduledNotifications()[0]?.trigger.timezone).toBeUndefined();
    }
    const cancels = cancelCount();
    setReminderTimeZoneForTests(() => 'America/Los_Angeles');
    await waitFor(() => expect(cancelCount()).toBeGreaterThan(cancels));
    if (Platform.OS === 'android') {
      expect(moments()[0]?.getUTCHours()).toBe(15);
      expect(moments().every((moment) => localDate(moment, 'America/Los_Angeles').hour === 7)).toBe(true);
    } else {
      expect(scheduledNotifications().every((item) => item.trigger.hour === 7 && item.trigger.timezone === undefined)).toBe(true);
    }
  });

  it('schedules nothing from the screen once the year is finished', async () => {
    const rows = Array.from({ length: DAY_COUNT }, (_, day_index) => ({
      day_index,
      completed_at: '2026-11-19T15:00:00.000Z',
    }));
    await render(
      <ReadingProviders>
        <SettingsRoute />
        <BringDays label="Finish the year" rows={rows} />
      </ReadingProviders>,
    );
    await turnOn();
    await fireEvent.press(screen.getByRole('button', { name: 'Finish the year' }));
    await waitFor(() => expect(scheduledNotifications()).toEqual([]));
    expect(screen.getByRole('switch', { name: 'Remind me' })).toBeChecked();
  });

  it('cancels the reminders when she turns the switch off', async () => {
    await renderSettings();
    await turnOn();
    const cancels = cancelCount();
    await fireEvent(screen.getByRole('switch', { name: 'Remind me' }), 'valueChange', false);
    await waitFor(() => expect(scheduledNotifications()).toEqual([]));
    expect(cancelCount()).toBeGreaterThan(cancels);
    expect(screen.getByRole('switch', { name: 'Remind me' })).not.toBeChecked();
    expect(reminderSnapshot().enabled).toBe(false);
  });

  it('opens Today when she taps a reminder', async () => {
    await renderSettings();
    emitNotificationResponse({ actionIdentifier: 'expo.modules.notifications.actions.DEFAULT' });
    await waitFor(() => expect(router.navigate).toHaveBeenCalledWith('/'));
  });

  it('opens Today when a reminder launched the app', async () => {
    setLastNotificationResponse({ actionIdentifier: 'expo.modules.notifications.actions.DEFAULT' });
    await renderSettings();
    await waitFor(() => expect(router.navigate).toHaveBeenCalledWith('/'));
    await screen.unmount();
    jest.mocked(router.navigate).mockClear();
    await render(
      <ReadingProviders>
        <SettingsRoute />
      </ReadingProviders>,
    );
    await screen.findByRole('switch', { name: 'Remind me' });
    expect(router.navigate).not.toHaveBeenCalled();
  });
});

describe('Delete account and the reminder', () => {
  beforeEach(async () => {
    now = new Date('2026-11-20T11:00:00.000Z');
    appListeners.clear();
    resetNotificationsMock();
    resetReminderForTests();
    resetFakeAuth();
    setReminderClockForTests(() => now);
    setReminderTimeZoneForTests(() => ZONE);
    setTimeZonePollForTests(30_000);
    setNotificationPermission(granted);
    jest.restoreAllMocks();
    jest.mocked(router.navigate).mockClear();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.spyOn(AppState, 'addEventListener').mockImplementation((type, listener) => {
      if (type === 'change') appListeners.add(listener as (state: string) => void);
      return { remove: () => appListeners.delete(listener as (state: string) => void) };
    });
    await AsyncStorage.clear();
    fakeAuth.session = { access_token: 'token', user: { id: 'user-1', email: 'reader@example.com' } };
  });

  async function renderAccount() {
    await render(
      <ReadingProviders>
        <SettingsRoute />
        <AccountRoute />
      </ReadingProviders>,
    );
    expect(await screen.findByText('reader@example.com')).toBeOnTheScreen();
    await turnOn();
  }

  it('turns the reminder off when the account is deleted', async () => {
    jest.spyOn(globalThis as { fetch: typeof fetch }, 'fetch').mockImplementation((async () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 })) as typeof fetch);
    await renderAccount();
    await fireEvent.press(screen.getByRole('button', { name: 'Delete account…' }));
    await confirm('Delete your account?', 'Delete');
    await waitFor(() => expect(reminderSnapshot().enabled).toBe(false));
    expect(scheduledNotifications()).toEqual([]);
    const stored = JSON.parse((await AsyncStorage.getItem('biblejourney.reminder.v1')) ?? '{}') as { enabled?: boolean };
    expect(stored.enabled).toBe(false);
  });

  it('leaves the reminder when delete fails', async () => {
    jest.spyOn(globalThis as { fetch: typeof fetch }, 'fetch').mockImplementation((async () =>
      new Response(JSON.stringify({ error: 'upstream' }), { status: 502 })) as typeof fetch);
    await renderAccount();
    await fireEvent.press(screen.getByRole('button', { name: 'Delete account…' }));
    await confirm('Delete your account?', 'Delete');
    expect(await screen.findByText('Couldn’t delete your account. Try again in a moment.')).toBeOnTheScreen();
    expect(reminderSnapshot().enabled).toBe(true);
    expect(scheduledNotifications()).toHaveLength(7);
  });

  it('leaves the reminder when she signs out', async () => {
    await renderAccount();
    await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByText('Not signed in')).toBeOnTheScreen();
    expect(reminderSnapshot().enabled).toBe(true);
    expect(scheduledNotifications()).toHaveLength(7);
  });
});
