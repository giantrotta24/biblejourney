import { useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View, type ScrollViewInstance } from 'react-native';

import { useColors } from '@/theme/colors';
import { fonts, useLargeText } from '@/theme/fonts';
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
  onOpenDay: (index: number) => void;
};

export function PlanView({ done, onOpenDay }: PlanViewProps) {
  const colors = useColors();
  const large = useLargeText();
  const current = currentDay(done);
  const currentWeek = current?.week ?? WEEK_COUNT;
  const [open, setOpen] = useState<ReadonlySet<number>>(() => new Set([currentWeek]));
  const [seenWeek, setSeenWeek] = useState(currentWeek);
  const [scrub, setScrub] = useState<number | null>(null);
  const [compact, setCompact] = useState(false);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const listTop = useRef(0);
  const offsets = useRef(new Map<number, number>());
  const pending = useRef<number | null>(null);

  if (seenWeek !== currentWeek) {
    setSeenWeek(currentWeek);
    if (!open.has(currentWeek)) {
      const next = new Set(open);
      next.add(currentWeek);
      setOpen(next);
    }
  }

  function scrollToWeek(week: number) {
    const y = listTop.current + (offsets.current.get(week) ?? 0);
    scrollRef.current?.scrollTo({ y: Math.max(0, y - BAR), animated: true });
  }

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
  const body = large ? 19 : 15;

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
        <View
          style={{ marginTop: 16 }}
          onLayout={(event) => {
            listTop.current = event.nativeEvent.layout.y;
          }}>
          {weeks.map((week) => {
            const expanded = open.has(week.week);
            const today = current?.index;
            return (
              <View
                key={week.week}
                onLayout={(event) => {
                  offsets.current.set(week.week, event.nativeEvent.layout.y);
                  if (pending.current === week.week) {
                    pending.current = null;
                    scrollToWeek(week.week);
                  }
                }}>
                <DottedCut color={colors.ink3} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  accessibilityLabel={`Week ${week.week}, ${week.title}`}
                  onPress={() => {
                    setOpen((prev) => {
                      const next = new Set(prev);
                      if (next.has(week.week)) next.delete(week.week);
                      else next.add(week.week);
                      return next;
                    });
                  }}
                  style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Text style={{ flex: 1, fontSize: body, lineHeight: body * 1.35 }}>
                    <Text style={{ fontFamily: fonts.serifSemibold, fontSize: 18, color: colors.ink }}>
                      Week {week.week}
                    </Text>
                    <Text style={{ color: colors.ink2 }}> {week.title}</Text>
                  </Text>
                  <Chevron open={expanded} color={colors.ink3} />
                </Pressable>
                {expanded
                  ? week.days.map((day) => {
                      const read = done.has(day.index);
                      const isToday = today === day.index;
                      const markColor = isToday ? colors.blueInk : read ? colors.ink : colors.ink3;
                      return (
                        <Pressable
                          key={day.index}
                          accessibilityRole="button"
                          accessibilityLabel={`${day.weekday}, ${day.reading}${isToday ? ', today' : read ? ', read' : ''}`}
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
                          <Text style={{ width: 42, fontSize: 14, color: isToday ? colors.blueInk : colors.ink2 }}>
                            {day.weekday}
                          </Text>
                          <Text
                            style={{
                              flex: 1,
                              fontSize: 16,
                              color: isToday ? colors.blueInk : read ? colors.ink2 : colors.ink,
                              fontWeight: isToday ? '600' : '400',
                            }}>
                            {day.reading}
                          </Text>
                        </Pressable>
                      );
                    })
                  : null}
                {expanded ? (
                  <Text
                    style={{
                      fontFamily: fonts.serifItalic,
                      fontSize: 15,
                      lineHeight: 21,
                      color: colors.ink2,
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
      </ScrollView>
    </View>
  );
}
