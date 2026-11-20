import { router } from 'expo-router';
import { Alert, Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useProgress } from '@/progress/context';
import { changeSettings, useSettings } from '@/settings/client';
import { THEMES, TRANSLATIONS, type Theme, type TranslationCode } from '@/settings/settings';
import { useRuntime } from '@/sync/react';
import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/fonts';
import { useVerses } from '@/verses/context';

import { StackPage } from './stack-page';

const THEME_LABELS: Record<Theme, string> = {
  system: 'Match the phone',
  light: 'Light',
  dark: 'Dark',
};

const RESET_TITLE = 'Reset your progress?';
const RESET_MESSAGE =
  'This clears every day and memory verse you’ve marked, on this phone and on your account if you’re signed in. Your notes are kept. It can’t be undone.';

function Section({ title }: { title: string }) {
  const colors = useColors();
  return (
    <Text
      accessibilityRole="header"
      style={{
        fontFamily: fonts.serifSemibold,
        fontSize: 15,
        lineHeight: 15 * 1.3,
        color: colors.ink,
        marginTop: 22,
        marginBottom: 2,
      }}>
      {title}
    </Text>
  );
}

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

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center' }}>
      <Text style={{ flex: 1, fontSize: 17, lineHeight: 22, color: colors.ink }}>{label}</Text>
      {selected ? <Tick /> : null}
    </Pressable>
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
      <Section title="Appearance" />
      {THEMES.map((value) => (
        <Choice
          key={value}
          label={THEME_LABELS[value]}
          selected={theme === value}
          onPress={() => changeSettings({ theme: value })}
        />
      ))}
      <Section title="Read online" />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Translation, ${linkTranslation}`}
        onPress={() => router.push('/more/translation')}
        style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Text style={{ flex: 1, fontSize: 17, lineHeight: 22, color: colors.ink }}>Translation</Text>
        <Text style={{ fontSize: 17, color: colors.ink2 }}>{linkTranslation}</Text>
        <Svg width={8} height={13} viewBox="0 0 8 13" fill="none" accessibilityElementsHidden>
          <Path d="M1.5 1.5 6.5 6.5 1.5 11.5" stroke={colors.ink3} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Pressable>
      <Note>Read on Bible Gateway opens the day’s passage in this translation.</Note>
      <Section title="Start over" />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Reset progress…"
        onPress={confirmReset}
        style={{ minHeight: 48, justifyContent: 'center' }}>
        <Text style={{ fontSize: 17, lineHeight: 22, color: colors.danger }}>Reset progress…</Text>
      </Pressable>
      <Note>Clears every day and memory verse you’ve marked and begins again from week 1. Your notes are kept.</Note>
    </StackPage>
  );
}

export function TranslationView() {
  const { linkTranslation } = useSettings();
  return (
    <StackPage title="Translation" backLabel="Settings">
      <Note>Read on Bible Gateway opens the day’s passage in this translation.</Note>
      <View style={{ marginTop: 8 }}>
        {TRANSLATIONS.map((item) => (
          <Choice
            key={item.code}
            label={`${item.name} (${item.code})`}
            selected={linkTranslation === item.code}
            onPress={() => changeSettings({ linkTranslation: item.code as TranslationCode })}
          />
        ))}
      </View>
    </StackPage>
  );
}
