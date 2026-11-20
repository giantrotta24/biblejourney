import { getPermissionsAsync } from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useProgress } from '@/progress/context';

import {
  changeReminder,
  reminderLoadFailed,
  reminderSnapshot,
  retryReminderLoad,
  useReminder,
  whenReminderReady,
} from './client';
import { listenForNotificationOpen, syncReminderSchedule, watchTimeZone } from './schedule';

type DayRow = { day_index: number; completed_at: string };

async function reconcile(rows: readonly DayRow[]) {
  if (reminderLoadFailed()) return;
  const permission = await getPermissionsAsync();
  if (reminderLoadFailed()) return;
  const reminder = reminderSnapshot();
  if (reminder.enabled && !permission.granted) {
    changeReminder({ enabled: false, awaitingPermission: true });
    return;
  }
  if (reminder.awaitingPermission && permission.granted) {
    changeReminder({ awaitingPermission: false });
  }
  const current = reminderSnapshot();
  await syncReminderSchedule({
    enabled: current.enabled,
    hour: current.hour,
    minute: current.minute,
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
  const sawQuiet = useRef(false);

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void (async () => {
        if (reminderLoadFailed()) {
          await retryReminderLoad();
          if (reminderLoadFailed()) return;
        }
        await reconcile(rowsRef.current);
      })().catch(() => undefined);
    });
    const stopOpen = listenForNotificationOpen(() => {
      router.navigate('/');
    });
    return () => {
      subscription.remove();
      stopOpen();
    };
  }, []);

  useEffect(() => {
    if (!reminder.enabled) return;
    return watchTimeZone(() => {
      const current = reminderSnapshot();
      if (!current.enabled) return;
      void syncReminderSchedule({
        enabled: true,
        hour: current.hour,
        minute: current.minute,
        rows: rowsRef.current,
      }).catch(() => undefined);
    });
  }, [reminder.enabled]);

  useEffect(() => {
    if (reminderLoadFailed()) {
      sawQuiet.current = false;
      return;
    }
    const quiet = !reminder.enabled && !reminder.awaitingPermission;
    const skip = quiet && sawQuiet.current;
    sawQuiet.current = quiet;
    if (skip) return;
    void reconcile(rows).catch(() => undefined);
  }, [reminder, rows]);

  return null;
}
