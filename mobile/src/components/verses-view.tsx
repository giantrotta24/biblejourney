import { useRef, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  type LayoutChangeEvent,
  type ScrollViewInstance,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { nextVerseWeek, unlockedWeeks } from '@/lib/practice';
import { firstLetters } from '@/lib/reading';
import { useProgress } from '@/progress/context';
import { useColors, type Palette } from '@/theme/colors';
import { fonts, hitSize } from '@/theme/fonts';
import { useVerses } from '@/verses/context';
import { getWeek, weeks, type Week } from '../../../supabase/functions/_shared/content/plan';

import { Chevron } from './icons';
import { DottedCut, PageEdges, Perforation } from './marks';

type Mode = 'full' | 'letters';

export function VersesView() {
  const colors = useColors();
  const { days: done } = useProgress();
  const { rows, setLearned } = useVerses();
  const known = new Set(rows.map((row) => row.week));
  const through = unlockedWeeks(done).at(-1) ?? 1;
  const week = getWeek(through);
  const [mode, setMode] = useState<Mode>('full');
  const pool = unlockedWeeks(done);
  const [shown, setShown] = useState(() => nextVerseWeek(pool, through));
  const scrollRef = useRef<ScrollViewInstance>(null);
  const opened = useRef(false);
  const [revealed, setRevealed] = useState(false);
  const practiceWeek = getWeek(shown <= through ? shown : through);
  const buttonHeight = Platform.OS === 'android' ? 48 : 50;
  const buttonSize = Platform.OS === 'android' ? 15 : 17;
  const text = mode === 'letters' ? firstLetters(week.memoryVerse.textKJV) : week.memoryVerse.textKJV;

  function next() {
    setShown(nextVerseWeek(pool, practiceWeek.week));
    setRevealed(false);
  }

  function placeCurrent(event: LayoutChangeEvent) {
    if (opened.current) return;
    opened.current = true;
    scrollRef.current?.scrollTo({ y: event.nativeEvent.layout.y, animated: false });
  }

  function chooseMode() {
    const options = ['Full text', 'First letters'] as const;
    function apply(index: number) {
      const choice = options[index];
      if (choice === 'Full text') setMode('full');
      else if (choice === 'First letters') setMode('letters');
    }
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { title: 'Show the verse as', options: [...options, 'Cancel'], cancelButtonIndex: 2 },
        apply,
      );
      return;
    }
    Alert.alert('Show the verse as', undefined, [
      { text: 'Full text', onPress: () => apply(0) },
      { text: 'First letters', onPress: () => apply(1) },
    ]);
  }

  const modeLabel = mode === 'full' ? 'Full text' : 'First letters';

  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1, backgroundColor: colors.paper }}
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
      <Text
        accessibilityRole="header"
        style={{
          fontSize: 34,
          lineHeight: 41,
          fontWeight: '700',
          letterSpacing: 0.34,
          color: colors.ink,
          marginTop: 6,
        }}>
        Verses
      </Text>
      <View
        style={{
          backgroundColor: colors.under,
          marginHorizontal: -20,
          marginTop: 6,
          paddingTop: 12,
          paddingHorizontal: 12,
          paddingBottom: 18,
        }}>
        <View
          style={{
            backgroundColor: colors.paper,
            borderBottomWidth: 0.5,
            borderBottomColor: colors.rule,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.16,
            shadowRadius: 3,
            elevation: 2,
          }}>
          <Perforation color={colors.under} />
          <View style={{ paddingTop: 18, paddingHorizontal: 16, paddingBottom: 6 }}>
            <Text
              maxFontSizeMultiplier={1.6}
              style={{
                fontFamily: fonts.serifSemibold,
                fontSize: 26,
                lineHeight: 26 * 1.15,
                color: colors.ink,
                marginTop: 2,
              }}>
              {week.memoryVerse.ref}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <Text style={{ flex: 1, fontSize: 14, lineHeight: 18, color: colors.ink2 }}>
                This week’s verse · week {week.week} · KJV
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Show the verse as"
                accessibilityValue={{ text: modeLabel }}
                onPress={chooseMode}
                style={{ minHeight: hitSize(), flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ fontSize: 14, color: colors.ink }}>{modeLabel}</Text>
                <Chevron open color={colors.ink} />
              </Pressable>
            </View>
            <Text
              maxFontSizeMultiplier={2}
              style={{ fontFamily: fonts.serif, fontSize: 17, lineHeight: 17 * 1.45, color: colors.ink }}>
              {text}
            </Text>
            <KnowIt
              colors={colors}
              reference={week.memoryVerse.ref}
              checked={known.has(week.week)}
              onPress={() => setLearned(week.week, !known.has(week.week))}
            />
          </View>
        </View>
        <PageEdges paper={colors.paper} rule={colors.rule} />
      </View>

      <View style={{ marginTop: 12 }}>
        <DottedCut color={colors.ink3} />
        <Text
          maxFontSizeMultiplier={2}
          style={{ fontFamily: fonts.serifSemibold, fontSize: 15, lineHeight: 15 * 1.3, color: colors.ink, marginTop: 12 }}>
          Practice
        </Text>
        <Text
          maxFontSizeMultiplier={1.6}
          style={{ fontFamily: fonts.serifSemibold, fontSize: 22, lineHeight: 22 * 1.2, color: colors.ink, marginTop: 2 }}>
          {practiceWeek.memoryVerse.ref}
        </Text>
        {revealed ? (
          <Text
            maxFontSizeMultiplier={2}
            style={{ fontFamily: fonts.serif, fontSize: 17, lineHeight: 17 * 1.45, color: colors.ink, marginTop: 6 }}>
            {practiceWeek.memoryVerse.textKJV}
          </Text>
        ) : (
          <Text style={{ fontSize: 14, lineHeight: 14 * 1.45, color: colors.ink2, marginTop: 4 }}>
            {pool.length === 1
              ? 'One verse you’ve reached. Say it from memory, then reveal to check.'
              : `One of the ${pool.length} verses you’ve reached. Say it from memory, then reveal to check.`}
          </Text>
        )}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide' : 'Reveal'}
            onPress={() => setRevealed((value) => !value)}
            style={{
              flex: 1,
              minHeight: buttonHeight,
              borderRadius: 10,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: revealed ? colors.paper : colors.blue,
              borderWidth: revealed ? 1.5 : 0,
              borderColor: colors.ink,
            }}>
            <Text
              style={{
                color: revealed ? colors.ink : colors.onBlue,
                fontSize: buttonSize,
                fontWeight: Platform.OS === 'android' ? '500' : '600',
              }}>
              {revealed ? 'Hide' : 'Reveal'}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next verse"
            accessibilityState={{ disabled: pool.length < 2 }}
            disabled={pool.length < 2}
            onPress={next}
            style={{
              flex: 1,
              minHeight: buttonHeight,
              borderRadius: 10,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1.5,
              borderColor: colors.ink,
              opacity: pool.length < 2 ? 0.4 : 1,
            }}>
            <Text style={{ color: colors.ink, fontSize: buttonSize, fontWeight: Platform.OS === 'android' ? '500' : '600' }}>
              Next verse
            </Text>
          </Pressable>
        </View>
      </View>

      <Text
        maxFontSizeMultiplier={2}
        style={{
          fontFamily: fonts.serifSemibold,
          fontSize: 15,
          lineHeight: 15 * 1.3,
          color: colors.ink,
          marginTop: 24,
          marginBottom: 2,
        }}>
        All 52 verses, week 1 to 52
      </Text>
      {weeks.map((item) => (
        <VerseRow
          key={item.week}
          week={item}
          current={item.week === through}
          upcoming={item.week > through}
          known={known.has(item.week)}
          onKnow={(nextKnown) => setLearned(item.week, nextKnown)}
          onLayout={item.week === through ? placeCurrent : undefined}
          colors={colors}
        />
      ))}
    </ScrollView>
  );
}

function VerseRow({
  week,
  current,
  upcoming,
  known,
  onKnow,
  onLayout,
  colors,
}: {
  week: Week;
  current: boolean;
  upcoming: boolean;
  known: boolean;
  onKnow: (known: boolean) => void;
  onLayout?: (event: LayoutChangeEvent) => void;
  colors: Palette;
}) {
  const title = current ? colors.blueInk : upcoming ? colors.ink3 : colors.ink;
  return (
    <View
      onLayout={onLayout}
      style={{ borderTopWidth: 0.5, borderTopColor: colors.rule, paddingTop: 12, paddingBottom: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <Text
          maxFontSizeMultiplier={1.8}
          style={{ flex: 1, fontFamily: fonts.serifSemibold, fontSize: 18, lineHeight: 18 * 1.3, color: title }}>
          {week.memoryVerse.ref}
        </Text>
        <Text style={{ fontSize: 14, lineHeight: 18, color: current ? colors.blueInk : colors.ink2 }}>
          {upcoming ? `Week ${week.week}, coming up` : `Week ${week.week}`}
        </Text>
      </View>
      {upcoming || current ? null : (
        <Text
          maxFontSizeMultiplier={2}
          style={{
            fontFamily: fonts.serif,
            fontSize: 16,
            lineHeight: 16 * 1.45,
            color: colors.ink,
            marginTop: 4,
          }}>
          {week.memoryVerse.textKJV}
        </Text>
      )}
      {upcoming ? null : (
        <KnowIt colors={colors} reference={week.memoryVerse.ref} checked={known} onPress={() => onKnow(!known)} />
      )}
    </View>
  );
}

function KnowIt({
  colors,
  reference,
  checked,
  onPress,
}: {
  colors: Palette;
  reference: string;
  checked: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={`I know it, ${reference}`}
      accessibilityState={{ checked }}
      onPress={onPress}
      style={{ minHeight: hitSize(), flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'flex-start' }}>
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          borderWidth: 1.5,
          borderColor: checked ? colors.ink : colors.ink3,
          backgroundColor: checked ? colors.ink : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {checked ? (
          <Svg width={14} height={10} viewBox="0 0 14 10" fill="none">
            <Path d="M1.5 5.5 5 9l7.5-7.5" stroke={colors.paper} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        ) : null}
      </View>
      <Text style={{ fontSize: 16, color: colors.ink }}>I know it</Text>
    </Pressable>
  );
}
