import { getPermissionsAsync } from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useProgress } from '@/progress/context';

import { changeReminder, reminderSnapshot, useReminder, whenReminderReady } from './client';
import { listenForNotificationOpen, syncReminderSchedule, watchTimeZone } from './schedule';
import type { ReminderPreference } from './store';

type DayRow = { day_index: number; completed_at: string };

async function reconcile(reminder: ReminderPreference, rows: readonly DayRow[]) {
  const permission = await getPermissionsAsync();
  if (reminder.enabled && !permission.granted) {
    changeReminder({ enabled: false, awaitingPermission: true });
    return;
  }
  if (reminder.awaitingPermission && permission.granted) {
    changeReminder({ enabled: true, awaitingPermission: false });
    return;
  }
  await syncReminderSchedule({
    enabled: reminder.enabled,
    hour: reminder.hour,
    minute: reminder.minute,
    rows,
  });
}

export function ReminderRuntime() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    void whenReminderReady().then(() => {
      if (live) setReady(true);
    });
    return () => {
      live = false;
    };
  }, []);
  if (!ready) return null;
  return <ReminderSync />;
}

function ReminderSync() {
  const reminder = useReminder();
  const { rows } = useProgress();
  const rowsRef = useRef(rows);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void onActive(rowsRef.current).catch(() => undefined);
    });
    const stopWatch = watchTimeZone(() => {
      const current = reminderSnapshot();
      if (!current.enabled) return;
      void syncReminderSchedule({
        enabled: true,
        hour: current.hour,
        minute: current.minute,
        rows: rowsRef.current,
      }).catch(() => undefined);
    });
    const stopOpen = listenForNotificationOpen(() => {
      router.navigate('/');
    });
    return () => {
      subscription.remove();
      stopWatch();
      stopOpen();
    };
  }, []);

  useEffect(() => {
    void reconcile(reminder, rows).catch(() => undefined);
  }, [reminder, rows]);

  return null;
}

async function onActive(rows: readonly DayRow[]) {
  const permission = await getPermissionsAsync();
  const current = reminderSnapshot();
  if (current.enabled && !permission.granted) {
    changeReminder({ enabled: false, awaitingPermission: true });
    return;
  }
  if (current.awaitingPermission && permission.granted) {
    changeReminder({ enabled: true, awaitingPermission: false });
    return;
  }
  if (!current.enabled) return;
  await syncReminderSchedule({
    enabled: true,
    hour: current.hour,
    minute: current.minute,
    rows,
  });
}
