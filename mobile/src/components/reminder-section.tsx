import DateTimePicker from '@react-native-community/datetimepicker';
import { getPermissionsAsync, requestPermissionsAsync } from 'expo-notifications';
import { useRef, useState } from 'react';
import { Linking, Platform, Pressable, Switch, Text, View } from 'react-native';

import { changeReminder, useReminder } from '@/reminders/client';
import { formatReminderTime } from '@/reminders/time';
import { useColors } from '@/theme/colors';

import { Row, Section } from './rows';

const NOTE = 'One calm note a day with your next reading, in your own time zone.';
const DENIED = 'Notifications are off for Bible Journey.';

function Note({ children }: { children: string }) {
  const colors = useColors();
  return <Text style={{ fontSize: 14, lineHeight: 14 * 1.4, color: colors.ink2, marginTop: 4 }}>{children}</Text>;
}

export function ReminderSection() {
  const colors = useColors();
  const reminder = useReminder();
  const [open, setOpen] = useState(false);
  const asking = useRef(false);
  const label = formatReminderTime(reminder.hour, reminder.minute);
  const value = new Date();
  value.setHours(reminder.hour, reminder.minute, 0, 0);

  async function onToggle(next: boolean) {
    if (asking.current) return;
    if (!next) {
      changeReminder({ enabled: false, awaitingPermission: false });
      return;
    }
    asking.current = true;
    try {
      const current = await getPermissionsAsync();
      let allowed = current.granted;
      if (!allowed && current.canAskAgain !== false) {
        const asked = await requestPermissionsAsync({
          ios: { allowAlert: true, allowSound: true, allowBadge: false },
        });
        allowed = asked.granted;
      }
      if (!allowed) {
        changeReminder({ enabled: false, awaitingPermission: true });
        return;
      }
      changeReminder({ enabled: true, awaitingPermission: false });
    } finally {
      asking.current = false;
    }
  }

  function onTime(date: Date) {
    changeReminder({ hour: date.getHours(), minute: date.getMinutes() });
    if (Platform.OS === 'android') setOpen(false);
  }

  return (
    <>
      <Section title="Daily reminder" />
      <View style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Text style={{ flex: 1, fontSize: 17, lineHeight: 22, color: colors.ink }}>Remind me</Text>
        <Switch
          accessible
          accessibilityLabel="Remind me"
          value={reminder.enabled}
          onValueChange={(next) => void onToggle(next)}
          trackColor={{ false: colors.rule, true: colors.blue }}
        />
      </View>
      <Row accessibilityLabel={`Time, ${label}`} onPress={() => setOpen((current) => !current)} ruled>
        <Text style={{ flex: 1, fontSize: 17, lineHeight: 22, color: colors.ink }}>Time</Text>
        <Text style={{ fontSize: 17, color: colors.ink2 }}>{label}</Text>
      </Row>
      {open && Platform.OS === 'ios' ? (
        <DateTimePicker mode="time" display="spinner" value={value} onValueChange={(_event, date) => onTime(date)} />
      ) : null}
      {open && Platform.OS === 'android' ? (
        <DateTimePicker
          mode="time"
          display="default"
          is24Hour={false}
          value={value}
          onValueChange={(_event, date) => onTime(date)}
          onDismiss={() => setOpen(false)}
        />
      ) : null}
      {reminder.awaitingPermission ? (
        <>
          <Text style={{ fontSize: 15, lineHeight: 21, color: colors.ink, marginTop: 4 }}>{DENIED}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open Settings"
            onPress={() => void Linking.openSettings()}
            style={{ alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' }}>
            <Text
              style={{
                fontSize: 17,
                color: colors.ink,
                textDecorationLine: 'underline',
                textDecorationColor: colors.ink3,
              }}>
              Open Settings
            </Text>
          </Pressable>
        </>
      ) : null}
      <Note>{NOTE}</Note>
    </>
  );
}
