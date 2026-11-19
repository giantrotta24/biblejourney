import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { eraForWeek } from '@/lib/era';
import { bibleGatewayUrl } from '@/lib/reading';
import { fonts, hitSize, useLargeText } from '@/theme/fonts';
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

export type TodayViewProps = {
  done: ReadonlySet<number>;
  dayIndex?: number | null;
  onMark: (index: number) => void;
  onBackToToday: () => void;
  onOpenPlan: () => void;
  onShowDay: (index: number | null) => void;
};

export function TodayView({ done, dayIndex = null, onMark, onBackToToday, onOpenPlan, onShowDay }: TodayViewProps) {
  const colors = useColors();
  const reducedMotion = useReducedMotion();
  const current = currentDay(done);
  const selected = dayIndex == null ? current : (days.find((day) => day.index === dayIndex) ?? current);
  const finished = selected == null;
  const [leavingIndex, setLeavingIndex] = useState<number | null>(null);
  const leaving = leavingIndex == null ? null : (days.find((day) => day.index === leavingIndex) ?? null);
  const lift = useSharedValue(0);
  const fade = useSharedValue(1);

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
        if (delta < 0) onShowDay(DAY_COUNT - 1);
        return;
      }
      if (!selected) return;
      const next = selected.index + delta;
      if (next < 0) return;
      if (next >= DAY_COUNT) {
        if (current == null) onShowDay(null);
        return;
      }
      onShowDay(next);
    },
    [current, finished, leavingIndex, onShowDay, selected],
  );

  const turnRef = useRef(turn);
  useEffect(() => {
    turnRef.current = turn;
  });
  const pan = usePanGesture({
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
    }
    onMark(day.index);
  }

  const tearStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: reducedMotion
      ? []
      : [{ translateY: -lift.value * 720 }, { rotate: `${-lift.value * 8}deg` }],
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
          <View style={{ flex: 1, marginBottom: 2 }}>
            <Sheet colors={colors}>
              {finished || !selected ? (
                <FinishedPage colors={colors} onOpenPlan={onOpenPlan} />
              ) : (
                <DayPage
                  day={selected}
                  done={done}
                  colors={colors}
                  onMark={() => pressMark(selected)}
                  onBackToToday={onBackToToday}
                />
              )}
            </Sheet>
            {leaving ? (
              <Animated.View
                pointerEvents="none"
                style={[StyleSheet.absoluteFill, { transformOrigin: '18% 0%', zIndex: 2 }, tearStyle]}>
                <Sheet colors={colors} lifted>
                  <DayPage
                    day={leaving}
                    done={unread(done, leaving.index)}
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
  colors,
  onMark,
  onBackToToday,
  frozen = false,
}: {
  day: PlanDay;
  done: ReadonlySet<number>;
  colors: Palette;
  onMark: () => void;
  onBackToToday: () => void;
  frozen?: boolean;
}) {
  const large = useLargeText();
  const week = getWeek(day.week);
  const era = eraForWeek(day.week, eras);
  const number = day.index + 1;
  const current = currentDay(done);
  const isCurrent = current?.index === day.index;
  const isRead = done.has(day.index);
  const numeral = large ? 112 : 128;
  const readingSize = large ? 36 : 31;
  const metaSize = large ? 19 : 14;
  const contextSize = large ? 23 : 17;
  const linkSize = large ? 19 : 15;
  const buttonHeight = large ? 58 : Platform.OS === 'android' ? 48 : 50;
  const buttonSize = large ? 22 : Platform.OS === 'android' ? 15 : 17;

  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <Text
          accessibilityLabel={`Day ${number}`}
          style={{
            fontFamily: fonts.numeral,
            fontSize: numeral,
            lineHeight: numeral * 0.84,
            letterSpacing: numeral * -0.02,
            color: colors.ink,
          }}>
          {number}
        </Text>
        <View style={{ flex: 1, minWidth: 96, justifyContent: 'space-between', paddingTop: 6, paddingBottom: 4 }}>
          <Text
            style={{
              fontFamily: fonts.numeral,
              fontSize: 30,
              lineHeight: 30,
              color: colors.ink,
            }}>
            Day
          </Text>
          <View>
            <Text style={{ fontSize: metaSize, lineHeight: metaSize * 1.35, fontWeight: '600', color: colors.ink }}>
              of {DAY_COUNT}
            </Text>
            <Text style={{ fontSize: metaSize, lineHeight: metaSize * 1.35, color: colors.ink2 }}>
              {WEEKDAY_NAMES[day.weekday]}, week {day.week}
            </Text>
          </View>
        </View>
      </View>

      <Text
        style={{
          fontFamily: fonts.serifSemibold,
          fontSize: readingSize,
          lineHeight: readingSize * 1.12,
          letterSpacing: readingSize * -0.005,
          color: colors.ink,
          marginTop: 16,
        }}>
        {day.reading}
      </Text>
      <Text style={{ fontSize: large ? 19 : 15, lineHeight: (large ? 19 : 15) * 1.35, color: colors.ink2, marginTop: 4 }}>
        {week.title} · {era.title}
      </Text>
      <Text
        style={{
          fontFamily: fonts.serif,
          fontSize: contextSize,
          lineHeight: contextSize * (large ? 1.42 : 1.5),
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
        <Text style={{ fontSize: linkSize, color: colors.ink, textDecorationLine: 'underline', textDecorationColor: colors.ink3 }}>
          Read on Bible Gateway
        </Text>
      </Pressable>

      {isRead ? (
        <View style={{ minHeight: hitSize(), flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 2, height: 14, backgroundColor: colors.ink }} accessibilityElementsHidden />
          <Text style={{ fontSize: 15, color: colors.ink }}>Read</Text>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Back to today"
            disabled={frozen}
            onPress={onBackToToday}
            style={{ marginLeft: 'auto', minHeight: hitSize(), justifyContent: 'center' }}>
            <Text
              style={{
                fontSize: linkSize,
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
            marginTop: 6,
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

      <View style={{ marginTop: 16 }}>
        <DottedCut color={colors.ink3} />
        <Text
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
          numberOfLines={3}
          ellipsizeMode="tail"
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
  );
}

function FinishedPage({ colors, onOpenPlan }: { colors: Palette; onOpenPlan: () => void }) {
  const large = useLargeText();
  const numeral = large ? 112 : 128;
  return (
    <View>
      <Text
        accessibilityLabel={`Day ${DAY_COUNT}`}
        style={{
          fontFamily: fonts.numeral,
          fontSize: numeral,
          lineHeight: numeral * 0.84,
          letterSpacing: numeral * -0.02,
          color: colors.ink,
        }}>
        {DAY_COUNT}
      </Text>
      <Text
        style={{
          fontFamily: fonts.serifSemibold,
          fontSize: large ? 26 : 22,
          lineHeight: large ? 32 : 28,
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
            fontSize: large ? 19 : 17,
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
