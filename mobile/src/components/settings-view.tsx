import { router } from 'expo-router';
import { Alert, Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useProgress } from '@/progress/context';
import { changeSettings, useSettings } from '@/settings/client';
import { THEMES, TRANSLATIONS, type Theme, type TranslationCode } from '@/settings/settings';
import { useRuntime } from '@/sync/react';
import { useColors } from '@/theme/colors';
import { useVerses } from '@/verses/context';

import { ReminderSection } from './reminder-section';
import { Row, RowChevron, Section } from './rows';
import { StackPage } from './stack-page';

const THEME_LABELS: Record<Theme, string> = {
  system: 'Match the phone',
  light: 'Light',
  dark: 'Dark',
};

const RESET_TITLE = 'Reset your progress?';
const RESET_MESSAGE =
  'This clears every day and memory verse you’ve marked, on this phone and on your account if you’re signed in. Your notes are kept. It can’t be undone.';

function Note({ children }: { children: string }) {
  const colors = useColors();
  return <Text style={{ fontSize: 14, lineHeight: 14 * 1.4, color: colors.ink2, marginTop: 4 }}>{children}</Text>;
}

function Tick() {
  const colors = useColors();
  return (
    <Svg width={14} height={10} viewBox="0 0 14 10" fill="none" accessibilityElementsHidden>
      <Path d="M1.5 5.5 5 9l7.5-7.5" stroke={colors.ink} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function Choice({
  label,
  selected,
  onPress,
  ruled = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  ruled?: boolean;
}) {
  const colors = useColors();
  return (
    <Row accessibilityLabel={label} accessibilityState={{ selected }} onPress={onPress} ruled={ruled}>
      <Text style={{ flex: 1, fontSize: 17, lineHeight: 22, color: colors.ink }}>{label}</Text>
      {selected ? <Tick /> : null}
    </Row>
  );
}

export function SettingsView() {
  const colors = useColors();
  const { theme, linkTranslation } = useSettings();
  const { clearDays } = useProgress();
  const { clearVerses } = useVerses();
  const runtime = useRuntime();

  function confirmReset() {
    Alert.alert(RESET_TITLE, RESET_MESSAGE, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => {
          clearDays();
          clearVerses();
          return runtime?.sync.markReset(new Date().toISOString());
        },
      },
    ]);
  }

  return (
    <StackPage title="Settings" backLabel="More">
      <ReminderSection />
      <Section title="Appearance" />
      {THEMES.map((value, index) => (
        <Choice
          key={value}
          label={THEME_LABELS[value]}
          selected={theme === value}
          ruled={index > 0}
          onPress={() => changeSettings({ theme: value })}
        />
      ))}
      <Section title="Read online" />
      <Row accessibilityLabel={`Translation, ${linkTranslation}`} onPress={() => router.push('/more/translation')}>
        <Text style={{ flex: 1, fontSize: 17, lineHeight: 22, color: colors.ink }}>Translation</Text>
        <Text style={{ fontSize: 17, color: colors.ink2 }}>{linkTranslation}</Text>
        <RowChevron />
      </Row>
      <Note>Read on Bible Gateway opens the day’s passage in this translation.</Note>
      <Section title="Start over" />
      <Row accessibilityLabel="Reset progress…" onPress={confirmReset}>
        <Text style={{ fontSize: 17, lineHeight: 22, color: colors.danger }}>Reset progress…</Text>
      </Row>
      <Note>Clears every day and memory verse you’ve marked and begins again from week 1. Your notes are kept.</Note>
    </StackPage>
  );
}

export function TranslationView() {
  const { linkTranslation } = useSettings();
  return (
    <StackPage title="Translation" backLabel="Settings">
      <Note>Read on Bible Gateway opens the day’s passage in this translation.</Note>
      {TRANSLATIONS.map((item, index) => (
        <Choice
          key={item.code}
          label={`${item.name} (${item.code})`}
          selected={linkTranslation === item.code}
          ruled={index > 0}
          onPress={() => changeSettings({ linkTranslation: item.code as TranslationCode })}
        />
      ))}
    </StackPage>
  );
}
