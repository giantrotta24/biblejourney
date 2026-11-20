import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View, type ScrollViewInstance } from 'react-native';

import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/fonts';
import {
  DAY_COUNT,
  WEEK_COUNT,
  currentDay,
  getWeek,
  phases,
  weeks,
} from '../../../supabase/functions/_shared/content/plan';

import { Chevron } from './icons';
import { DottedCut } from './marks';
import { YearGrid } from './year-grid';

const BAR = 44;

type PlanViewProps = {
  done: ReadonlySet<number>;
  noted: ReadonlySet<number>;
  onOpenDay: (index: number) => void;
  focusWeek?: number | null;
  onFocusApplied?: () => void;
};

export function PlanView({ done, noted, onOpenDay, focusWeek = null, onFocusApplied }: PlanViewProps) {
  const colors = useColors();
  const current = currentDay(done);
  const currentWeek = current?.week ?? WEEK_COUNT;
  const [open, setOpen] = useState<ReadonlySet<number>>(() => new Set([currentWeek]));
  const [seenWeek, setSeenWeek] = useState(currentWeek);
  const [scrub, setScrub] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const [compact, setCompact] = useState(false);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const listTop = useRef(0);
  const offsets = useRef(new Map<number, number>());
  const pending = useRef<number | null>(null);
  const listPlaced = useRef(false);
  const onFocusAppliedRef = useRef(onFocusApplied);

  if (seenWeek !== currentWeek) {
    setSeenWeek(currentWeek);
    if (!open.has(currentWeek)) {
      const next = new Set(open);
      next.add(currentWeek);
      setOpen(next);
    }
  }

  const scrollToWeek = useCallback((week: number) => {
    const y = listTop.current + (offsets.current.get(week) ?? 0);
    scrollRef.current?.scrollTo({ y: Math.max(0, y - BAR), animated: true });
  }, []);

  if (focusWeek != null && focused !== focusWeek) {
    setFocused(focusWeek);
    setScrub(null);
    if (!open.has(focusWeek)) {
      const next = new Set(open);
      next.add(focusWeek);
      setOpen(next);
    }
  }

  useEffect(() => {
    onFocusAppliedRef.current = onFocusApplied;
  }, [onFocusApplied]);

  const finishFocus = useCallback(
    (week: number) => {
      pending.current = null;
      scrollToWeek(week);
      onFocusAppliedRef.current?.();
    },
    [scrollToWeek],
  );

  useEffect(() => {
    if (focusWeek == null) return;
    pending.current = focusWeek;
    if (listPlaced.current && offsets.current.has(focusWeek)) finishFocus(focusWeek);
  }, [focusWeek, finishFocus]);

  const openDayRef = useRef(onOpenDay);
  useEffect(() => {
    openDayRef.current = onOpenDay;
  }, [onOpenDay]);
  const openDay = useCallback((index: number) => openDayRef.current(index), []);
  const toggleWeek = useCallback((week: number) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(week)) next.delete(week);
      else next.add(week);
      return next;
    });
  }, []);
  const placeList = useCallback(
    (y: number) => {
      listTop.current = y;
      listPlaced.current = true;
      const week = pending.current;
      if (week != null && offsets.current.has(week)) finishFocus(week);
    },
    [finishFocus],
  );
  const placeWeek = useCallback(
    (week: number, y: number) => {
      offsets.current.set(week, y);
      if (pending.current === week && listPlaced.current) finishFocus(week);
    },
    [finishFocus],
  );

  function reveal(week: number) {
    setScrub(null);
    if (open.has(week)) scrollToWeek(week);
    else pending.current = week;
    setOpen((prev) => {
      if (prev.has(week)) return prev;
      const next = new Set(prev);
      next.add(week);
      return next;
    });
  }

  const readoutWeek = scrub ?? currentWeek;
  const readoutTitle = getWeek(readoutWeek).title;
  const body = 15;

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      {compact ? (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 2,
            height: BAR,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.paper,
            borderBottomWidth: 0.5,
            borderBottomColor: colors.rule,
          }}>
          <Text accessibilityRole="header" style={{ fontSize: 17, fontWeight: '600', color: colors.ink }}>
            Plan
          </Text>
        </View>
      ) : null}
      <ScrollView
        ref={scrollRef}
        scrollEventThrottle={16}
        onScroll={(event) => setCompact(event.nativeEvent.contentOffset.y > 36)}
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
          Plan
        </Text>
        <Text style={{ fontSize: body, lineHeight: body * 1.4, color: colors.ink2, marginTop: 2, marginBottom: 16 }}>
          {scrub == null ? (
            `${done.size} of ${DAY_COUNT} days read. You’re in week ${currentWeek} of ${WEEK_COUNT}.`
          ) : (
            <Text>
              <Text style={{ fontFamily: fonts.serifSemibold, fontSize: 17, color: colors.ink }}>Week {scrub}</Text>
              <Text style={{ color: colors.ink2 }}> {readoutTitle}</Text>
            </Text>
          )}
        </Text>
        <YearGrid done={done} onScrub={setScrub} onCommit={reveal} />
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
          {phases.map((phase) => (
            <Text
              key={phase.id}
              style={{
                flex: phase.weeks[1] - phase.weeks[0] + 1,
                fontSize: 11,
                lineHeight: 14,
                color: colors.ink2,
              }}>
              {phase.name}
            </Text>
          ))}
        </View>
        <PlanWeeks
          done={done}
          noted={noted}
          open={open}
          todayIndex={current?.index ?? null}
          ink={colors.ink}
          ink2={colors.ink2}
          ink3={colors.ink3}
          blueInk={colors.blueInk}
          onOpenDay={openDay}
          onToggle={toggleWeek}
          onListTop={placeList}
          onWeekTop={placeWeek}
        />
      </ScrollView>
    </View>
  );
}

const PlanWeeks = memo(function PlanWeeks({
  done,
  noted,
  open,
  todayIndex,
  ink,
  ink2,
  ink3,
  blueInk,
  onOpenDay,
  onToggle,
  onListTop,
  onWeekTop,
}: {
  done: ReadonlySet<number>;
  noted: ReadonlySet<number>;
  open: ReadonlySet<number>;
  todayIndex: number | null;
  ink: string;
  ink2: string;
  ink3: string;
  blueInk: string;
  onOpenDay: (index: number) => void;
  onToggle: (week: number) => void;
  onListTop: (y: number) => void;
  onWeekTop: (week: number, y: number) => void;
}) {
  return (
    <View
      style={{ marginTop: 16 }}
      onLayout={(event) => {
        onListTop(event.nativeEvent.layout.y);
      }}>
      {weeks.map((week) => {
        const expanded = open.has(week.week);
        return (
          <View
            key={week.week}
            onLayout={(event) => {
              onWeekTop(week.week, event.nativeEvent.layout.y);
            }}>
            <DottedCut color={ink3} />
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              accessibilityLabel={`Week ${week.week}, ${week.title}`}
              onPress={() => onToggle(week.week)}
              style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Text style={{ flex: 1, fontSize: 15, lineHeight: 15 * 1.35 }}>
                <Text maxFontSizeMultiplier={2} style={{ fontFamily: fonts.serifSemibold, fontSize: 18, color: ink }}>
                  Week {week.week}
                </Text>
                <Text style={{ color: ink2 }}> {week.title}</Text>
              </Text>
              <Chevron open={expanded} color={ink3} />
            </Pressable>
            {expanded
              ? week.days.map((day) => {
                  const read = done.has(day.index);
                  const hasNote = noted.has(day.index);
                  const isToday = todayIndex === day.index;
                  const markColor = isToday ? blueInk : read ? ink : ink3;
                  return (
                    <Pressable
                      key={day.index}
                      accessibilityRole="button"
                      accessibilityLabel={`${day.weekday}, ${day.reading}${isToday ? ', today' : read ? ', read' : ''}${hasNote ? ', note' : ''}`}
                      onPress={() => onOpenDay(day.index)}
                      style={{
                        minHeight: Platform.OS === 'android' ? 48 : 44,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 10,
                      }}>
                      <View
                        style={{
                          width: isToday ? 3 : 2,
                          height: isToday ? 18 : read ? 16 : 6,
                          backgroundColor: markColor,
                        }}
                      />
                      <Text style={{ width: 42, fontSize: 14, color: isToday ? blueInk : ink2 }}>{day.weekday}</Text>
                      <Text
                        style={{
                          flex: 1,
                          fontSize: 16,
                          color: isToday ? blueInk : read ? ink2 : ink,
                          fontWeight: isToday ? '600' : '400',
                        }}>
                        {day.reading}
                      </Text>
                      {hasNote ? <Text style={{ fontSize: 13, lineHeight: 18, color: ink2 }}>Note</Text> : null}
                    </Pressable>
                  );
                })
              : null}
            {expanded ? (
              <Text
                maxFontSizeMultiplier={2}
                style={{
                  fontFamily: fonts.serifItalic,
                  fontSize: 15,
                  lineHeight: 21,
                  color: ink2,
                  paddingLeft: 16,
                  paddingBottom: 12,
                }}>
                Sunday: {week.deepDive}
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
});
