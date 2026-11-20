import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { eraForWeek } from '@/lib/era';
import { bibleGatewayUrl } from '@/lib/reading';
import { numeralLift, numeralSize, numeralTopInset } from '@/theme/dateline';
import { fonts, hitSize, useFontScale, useLargeText } from '@/theme/fonts';
import { ruledLine, writingScale } from '@/theme/ruled';
import { useReduceMotion } from '@/theme/motion';
import { useColors, type Palette } from '@/theme/colors';
import {
  DAY_COUNT,
  WEEKDAY_NAMES,
  currentDay,
  days,
  eras,
  getWeek,
  type PlanDay,
} from '../../../supabase/functions/_shared/content/plan';

import { DottedCut, PageEdges, Perforation, TornStubs } from './marks';

/** Tear-lift shadow extends past the page: offset 18 plus radius 16. */
const TEAR_SHADOW = 18 + 16;

export type TodayViewProps = {
  done: ReadonlySet<number>;
  dayIndex?: number | null;
  noteFor?: (index: number) => string | null;
  onMark: (index: number) => void;
  onBackToToday: () => void;
  onOpenPlan: () => void;
  onOpenNote?: (index: number) => void;
  onShowDay: (index: number | null) => void;
  signedInNote?: string | null;
  onPageTurn?: () => void;
};

export function TodayView({
  done,
  dayIndex = null,
  noteFor = () => null,
  onMark,
  onBackToToday,
  onOpenPlan,
  onOpenNote,
  onShowDay,
  signedInNote = null,
  onPageTurn,
}: TodayViewProps) {
  const colors = useColors();
  const reducedMotion = useReduceMotion();
  const current = currentDay(done);
  const selected = dayIndex == null ? current : (days.find((day) => day.index === dayIndex) ?? current);
  const finished = selected == null;
  const [leavingIndex, setLeavingIndex] = useState<number | null>(null);
  const leaving = leavingIndex == null ? null : (days.find((day) => day.index === leavingIndex) ?? null);
  const lift = useSharedValue(0);
  const fade = useSharedValue(1);
  const pageHeight = useSharedValue(0);

  const finishTear = () => {
    setLeavingIndex(null);
    lift.value = 0;
    fade.value = 1;
  };

  useEffect(() => {
    if (leavingIndex == null) return;
    if (reducedMotion) {
      fade.value = withTiming(0, { duration: 200 }, (ok) => {
        if (ok) runOnJS(finishTear)();
      });
      return;
    }
    lift.value = withTiming(1, { duration: 450, easing: Easing.out(Easing.cubic) }, (ok) => {
      if (ok) runOnJS(finishTear)();
    });
    // The shared values are stable, and this should run once per torn page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leavingIndex, reducedMotion]);

  const turn = useCallback(
    (delta: 1 | -1) => {
      if (leavingIndex != null) return;
      if (finished) {
        if (delta < 0) {
          onShowDay(DAY_COUNT - 1);
          onPageTurn?.();
        }
        return;
      }
      if (!selected) return;
      const next = selected.index + delta;
      if (next < 0) return;
      if (next >= DAY_COUNT) {
        if (current == null) {
          onShowDay(null);
          onPageTurn?.();
        }
        return;
      }
      onShowDay(next);
      onPageTurn?.();
    },
    [current, finished, leavingIndex, onPageTurn, onShowDay, selected],
  );

  const turnRef = useRef(turn);
  useEffect(() => {
    turnRef.current = turn;
  });
  const pan = usePanGesture({
    testID: 'today-turn',
    activeOffsetX: [-24, 24],
    failOffsetY: [-16, 16],
    runOnJS: true,
    onDeactivate: (event) => {
      if (event.canceled) return;
      if (event.translationX <= -56) turnRef.current(1);
      else if (event.translationX >= 56) turnRef.current(-1);
    },
  });

  function pressMark(day: PlanDay) {
    const tearing = current?.index === day.index;
    if (tearing) {
      if (leavingIndex != null) return;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setLeavingIndex(day.index);
      onPageTurn?.();
    }
    onMark(day.index);
  }

  const tearStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: reducedMotion
      ? []
      : [{ translateY: -lift.value * (pageHeight.value + TEAR_SHADOW) }, { rotate: `${-lift.value * 8}deg` }],
  }));

  return (
    <View style={{ flex: 1, backgroundColor: colors.under }}>
      <View style={{ height: 4 }} />
      <View
        style={{
          marginHorizontal: 10,
          height: 12,
          borderTopLeftRadius: 3,
          borderTopRightRadius: 3,
          backgroundColor: colors.binding,
        }}
      />
      <TornStubs count={done.size} color={colors.paper} />
      <View style={{ flex: 1, marginHorizontal: 12, marginTop: done.size > 0 ? 0 : 5 }}>
        <GestureDetector gesture={pan}>
          <View
            style={{ flex: 1, marginBottom: 2 }}
            onLayout={(event) => {
              pageHeight.value = event.nativeEvent.layout.height;
            }}>
            <Sheet colors={colors}>
              {finished || !selected ? (
                <FinishedPage colors={colors} onOpenPlan={onOpenPlan} />
              ) : (
                <DayPage
                  day={selected}
                  done={done}
                  note={noteFor(selected.index)}
                  signedInNote={signedInNote}
                  colors={colors}
                  onMark={() => pressMark(selected)}
                  onBackToToday={onBackToToday}
                  onOpenNote={onOpenNote}
                />
              )}
            </Sheet>
            {leaving ? (
              <Animated.View
                testID="torn-page"
                pointerEvents="none"
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={[StyleSheet.absoluteFill, { transformOrigin: '18% 0%', zIndex: 2 }, tearStyle]}>
                <Sheet colors={colors} lifted>
                  <DayPage
                    day={leaving}
                    done={unread(done, leaving.index)}
                    note={noteFor(leaving.index)}
                    colors={colors}
                    onMark={() => {}}
                    onBackToToday={() => {}}
                    frozen
                  />
                </Sheet>
              </Animated.View>
            ) : null}
          </View>
        </GestureDetector>
        <PageEdges paper={colors.paper} rule={colors.rule} />
      </View>
    </View>
  );
}

function NoteArea({
  note,
  colors,
  large,
  disabled,
  onPress,
}: {
  note: string | null;
  colors: Palette;
  large: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const fontScale = useFontScale();
  const scale = writingScale(fontScale);
  const line = ruledLine(30, fontScale);
  const written = note != null && note.length > 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={written ? `Your note. ${note}` : 'Your note. Write a note on today’s reading'}
      disabled={disabled}
      onPress={onPress}
      style={{ minHeight: hitSize(), marginTop: 2 }}>
      <Text style={{ fontSize: large ? 18 : 14, lineHeight: (large ? 18 : 14) * 1.35, color: colors.ink2 }}>Your note</Text>
      <View style={{ height: line * 2, overflow: 'hidden' }}>
        <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden>
          {[1, 2].map((index) => (
            <View
              key={index}
              style={{
                position: 'absolute',
                top: index * line - 1,
                left: 0,
                right: 0,
                height: 1,
                backgroundColor: colors.ruled,
              }}
            />
          ))}
        </View>
        <Text
          numberOfLines={2}
          allowFontScaling={false}
          style={{
            fontFamily: written ? fonts.serif : fonts.serifItalic,
            fontSize: 16 * scale,
            lineHeight: line,
            color: written ? colors.ink : colors.ink2,
          }}>
          {written ? note : 'Write a note on today’s reading'}
        </Text>
      </View>
    </Pressable>
  );
}

function unread(done: ReadonlySet<number>, index: number): Set<number> {
  const next = new Set(done);
  next.delete(index);
  return next;
}

function Sheet({
  children,
  colors,
  lifted = false,
}: {
  children: ReactNode;
  colors: Palette;
  lifted?: boolean;
}) {
  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: colors.paper,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.rule,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: lifted ? 18 : 2 },
          shadowOpacity: lifted ? 0.28 : 0.16,
          shadowRadius: lifted ? 16 : 3,
          elevation: lifted ? 12 : 2,
        },
      ]}>
      <View style={{ flex: 1, overflow: 'hidden', backgroundColor: colors.paper }}>
        <Perforation color={colors.under} />
        <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 28 }}>{children}</ScrollView>
      </View>
    </View>
  );
}

function DayPage({
  day,
  done,
  note,
  signedInNote = null,
  colors,
  onMark,
  onBackToToday,
  onOpenNote,
  frozen = false,
}: {
  day: PlanDay;
  done: ReadonlySet<number>;
  note: string | null;
  signedInNote?: string | null;
  colors: Palette;
  onMark: () => void;
  onBackToToday: () => void;
  onOpenNote?: (index: number) => void;
  frozen?: boolean;
}) {
  const large = useLargeText();
  const numeral = numeralSize(large);
  const lift = numeralLift(numeral);
  const week = getWeek(day.week);
  const era = eraForWeek(day.week, eras);
  const number = day.index + 1;
  const current = currentDay(done);
  const isCurrent = current?.index === day.index;
  const isRead = done.has(day.index);
  const buttonHeight = Platform.OS === 'android' ? 48 : 50;
  const buttonSize = Platform.OS === 'android' ? 15 : 17;

  return (
    <View style={{ paddingTop: 22 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <Text
          allowFontScaling={false}
          accessibilityLabel={`Day ${number}`}
          style={{
            fontFamily: fonts.numeral,
            fontSize: numeral,
            lineHeight: numeral,
            marginTop: -numeralTopInset(numeral),
            marginBottom: -lift,
            letterSpacing: numeral * -0.02,
            color: colors.ink,
            includeFontPadding: false,
          }}>
          {number}
        </Text>
        <View style={{ flex: 1, minWidth: 96, justifyContent: 'space-between', paddingTop: 6, paddingBottom: 4 }}>
          <Text
            allowFontScaling={false}
            style={{
              fontFamily: fonts.numeral,
              fontSize: 30,
              lineHeight: 30,
              color: colors.ink,
              includeFontPadding: false,
            }}>
            Day
          </Text>
          <View>
            <Text style={{ fontSize: 14, lineHeight: 14 * 1.35, fontWeight: '600', color: colors.ink }}>
              of {DAY_COUNT}
            </Text>
            <Text style={{ fontSize: 14, lineHeight: 14 * 1.35, color: colors.ink2 }}>
              {WEEKDAY_NAMES[day.weekday]}, week {day.week}
            </Text>
          </View>
        </View>
      </View>
      {signedInNote && !frozen ? (
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'baseline', marginTop: 10, marginBottom: -6 }}>
          <View
            style={{ width: 2, height: 13, backgroundColor: colors.ink, transform: [{ translateY: 2 }] }}
            accessibilityElementsHidden
          />
          <Text style={{ flex: 1, fontSize: 14, lineHeight: 14 * 1.4, color: colors.ink }}>{signedInNote}</Text>
        </View>
      ) : null}

      <Text
        maxFontSizeMultiplier={1.6}
        style={{
          fontFamily: fonts.serifSemibold,
          fontSize: 31,
          lineHeight: 31 * 1.12,
          letterSpacing: 31 * -0.005,
          color: colors.ink,
          marginTop: 16,
        }}>
        {day.reading}
      </Text>
      <Text style={{ fontSize: 15, lineHeight: 15 * 1.35, color: colors.ink2, marginTop: 4 }}>
        {week.title} · {era.title}
      </Text>
      <Text
        maxFontSizeMultiplier={2}
        style={{
          fontFamily: fonts.serif,
          fontSize: 17,
          lineHeight: 17 * 1.5,
          color: colors.ink,
          marginTop: 14,
        }}>
        {era.summary}
      </Text>

      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`Read ${day.reading} on Bible Gateway`}
        disabled={frozen}
        onPress={() => {
          void WebBrowser.openBrowserAsync(bibleGatewayUrl(day.reading));
        }}
        style={{ minHeight: hitSize(), justifyContent: 'center', alignSelf: 'flex-start' }}>
        <Text style={{ fontSize: 15, color: colors.ink, textDecorationLine: 'underline', textDecorationColor: colors.ink3 }}>
          Read on Bible Gateway
        </Text>
      </Pressable>

      <NoteArea note={note} colors={colors} large={large} disabled={frozen} onPress={() => onOpenNote?.(day.index)} />

      {isRead ? (
        <View style={{ minHeight: hitSize(), flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 2, height: 14, backgroundColor: colors.ink }} accessibilityElementsHidden />
          <Text style={{ fontSize: 15, color: colors.ink }}>Read on {WEEKDAY_NAMES[day.weekday]}</Text>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Back to today"
            disabled={frozen}
            onPress={onBackToToday}
            style={{ marginLeft: 'auto', minHeight: hitSize(), justifyContent: 'center' }}>
            <Text
              style={{
                fontSize: 15,
                color: colors.ink,
                textDecorationLine: 'underline',
                textDecorationColor: colors.ink3,
              }}>
              Back to today
            </Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Mark day ${number} read`}
          disabled={frozen}
          onPress={onMark}
          style={({ pressed }) => ({
            marginTop: 10,
            minHeight: buttonHeight,
            borderRadius: 10,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: isCurrent ? colors.blue : colors.paper,
            borderWidth: isCurrent ? 0 : 1.5,
            borderColor: colors.ink,
            opacity: pressed ? 0.72 : 1,
          })}>
          <Text
            style={{
              color: isCurrent ? colors.onBlue : colors.ink,
              fontSize: buttonSize,
              fontWeight: Platform.OS === 'android' ? '500' : '600',
              letterSpacing: Platform.OS === 'android' ? 0.15 : 0,
            }}>
            Mark day {number} read
          </Text>
        </Pressable>
      )}

      <View style={{ marginTop: 16, marginHorizontal: -22 }}>
        <DottedCut color={colors.ink3} />
        <View style={{ paddingHorizontal: 22 }}>
          <Text
            maxFontSizeMultiplier={2}
            style={{
              fontFamily: fonts.serifSemibold,
              fontSize: 15,
              lineHeight: 20,
              color: colors.ink,
              marginTop: 12,
            }}>
            This week’s verse
          </Text>
          <Text
            maxFontSizeMultiplier={2}
            style={{
              fontFamily: fonts.serifItalic,
              fontSize: 16,
              lineHeight: 16 * 1.45,
              color: colors.ink,
              marginTop: 6,
            }}>
            “{week.memoryVerse.textKJV}”
          </Text>
          <Text style={{ fontSize: 13, lineHeight: 19, color: colors.ink2, marginTop: 6 }}>
            {week.memoryVerse.ref} · KJV
          </Text>
        </View>
      </View>
    </View>
  );
}

function FinishedPage({ colors, onOpenPlan }: { colors: Palette; onOpenPlan: () => void }) {
  const numeral = numeralSize(useLargeText());
  const lift = numeralLift(numeral);
  return (
    <View style={{ paddingTop: 22 }}>
      <Text
        allowFontScaling={false}
        accessibilityLabel={`Day ${DAY_COUNT}`}
        style={{
          fontFamily: fonts.numeral,
          fontSize: numeral,
          lineHeight: numeral,
          marginTop: -numeralTopInset(numeral),
          marginBottom: -lift,
          letterSpacing: numeral * -0.02,
          color: colors.ink,
          includeFontPadding: false,
        }}>
        {DAY_COUNT}
      </Text>
      <Text
        maxFontSizeMultiplier={1.6}
        style={{
          fontFamily: fonts.serifSemibold,
          fontSize: 22,
          lineHeight: 28,
          color: colors.ink,
          marginTop: 16,
        }}>
        You’ve read the whole Bible.
      </Text>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="The whole year is in Plan"
        onPress={onOpenPlan}
        style={{ minHeight: hitSize(), justifyContent: 'center', alignSelf: 'flex-start', marginTop: 8 }}>
        <Text
          style={{
            fontSize: 17,
            color: colors.ink,
            textDecorationLine: 'underline',
            textDecorationColor: colors.ink3,
          }}>
          The whole year is in Plan
        </Text>
      </Pressable>
    </View>
  );
}
