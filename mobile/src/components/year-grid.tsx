import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Svg, { Rect } from 'react-native-svg';

import { gapsAfterPhases, weekAtX, weekCenterX } from '@/lib/grid';
import { useColors } from '@/theme/colors';
import {
  WEEK_COUNT,
  currentDay,
  days,
  getWeek,
  phases,
} from '../../../supabase/functions/_shared/content/plan';

const VIEWBOX_WIDTH = 350;
const VIEWBOX_HEIGHT = 74;

type YearGridProps = {
  done: ReadonlySet<number>;
  onScrub: (week: number | null) => void;
  onCommit: (week: number) => void;
};

export function YearGrid({ done, onScrub, onCommit }: YearGridProps) {
  const colors = useColors();
  const gaps = gapsAfterPhases(phases);
  const current = currentDay(done);
  const homeWeek = current?.week ?? WEEK_COUNT;
  const [width, setWidth] = useState(0);
  const [week, setWeek] = useState(homeWeek);
  const [scrubbing, setScrubbing] = useState(false);
  const weekRef = useRef(homeWeek);
  const widthRef = useRef(0);
  const committed = useRef(false);
  const start = useRef({ x: 0, y: 0 });
  const onCommitRef = useRef(onCommit);
  const onScrubRef = useRef(onScrub);
  const [trackedHome, setTrackedHome] = useState(homeWeek);
  if (trackedHome !== homeWeek) {
    setTrackedHome(homeWeek);
    if (week === trackedHome) setWeek(homeWeek);
  }

  useEffect(() => {
    onCommitRef.current = onCommit;
    onScrubRef.current = onScrub;
    weekRef.current = week;
  });

  function moveTo(x: number, settle: boolean) {
    const next = weekAtX(x, widthRef.current, gaps);
    if (next !== weekRef.current) {
      weekRef.current = next;
      setWeek(next);
      void Haptics.selectionAsync();
    }
    setScrubbing(!settle);
    onScrubRef.current(settle ? null : next);
    if (settle) onCommitRef.current(next);
  }

  const pan = usePanGesture({
    activeOffsetX: [-8, 8],
    failOffsetY: [-14, 14],
    runOnJS: true,
    onTouchesDown: (event) => {
      const touch = event.allTouches[0];
      if (!touch || widthRef.current <= 0) return;
      committed.current = false;
      start.current = { x: touch.x, y: touch.y };
    },
    onUpdate: (event) => {
      if (widthRef.current <= 0) return;
      moveTo(event.x, false);
    },
    onDeactivate: (event) => {
      if (event.canceled || committed.current || widthRef.current <= 0) return;
      committed.current = true;
      moveTo(event.x, true);
    },
    onTouchesUp: (event) => {
      if (committed.current || widthRef.current <= 0) return;
      const touch = event.changedTouches[0] ?? event.allTouches[0];
      if (!touch) return;
      const dx = Math.abs(touch.x - start.current.x);
      const dy = Math.abs(touch.y - start.current.y);
      if (dy > 12 && dy > dx) {
        setScrubbing(false);
        onScrubRef.current(null);
        return;
      }
      committed.current = true;
      moveTo(touch.x, true);
    },
  });

  function step(delta: number) {
    const next = Math.min(WEEK_COUNT, Math.max(1, weekRef.current + delta));
    if (next === weekRef.current) return;
    weekRef.current = next;
    setWeek(next);
    void Haptics.selectionAsync();
    onCommitRef.current(next);
  }

  const title = getWeek(week).title;
  const label = `The year, ${WEEK_COUNT} weeks. Week ${week} of ${WEEK_COUNT}, ${title}. ${done.size} of 312 days read.`;
  const height = width > 0 ? (width * VIEWBOX_HEIGHT) / VIEWBOX_WIDTH : 74;
  const lineX = width > 0 ? weekCenterX(week, width, gaps) : 0;

  return (
    <GestureDetector gesture={pan}>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ text: `Week ${week}` }}
        accessibilityActions={[
          { name: 'increment', label: 'Next week' },
          { name: 'decrement', label: 'Previous week' },
        ]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'increment') step(1);
          if (event.nativeEvent.actionName === 'decrement') step(-1);
        }}
        onLayout={(event) => {
          const next = event.nativeEvent.layout.width;
          widthRef.current = next;
          setWidth(next);
        }}
        style={{ height, marginTop: 8 }}>
        <Svg width="100%" height={height} viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`} accessible={false}>
          {days.map((day) => {
            const center = weekCenterX(day.week, VIEWBOX_WIDTH, gaps);
            const y = day.position * 12;
            const read = done.has(day.index);
            const today = current?.index === day.index;
            const mark = today
              ? { x: center - 1.25, y: y + 1, width: 2.5, height: 11, fill: colors.blueInk }
              : read
                ? { x: center - 0.75, y: y + 2, width: 1.5, height: 9, fill: colors.ink }
                : { x: center - 0.75, y: y + 8, width: 1.5, height: 3, fill: colors.ink3 };
            return <Rect key={day.index} {...mark} />;
          })}
        </Svg>
        {scrubbing && width > 0 ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: 1,
              left: lineX - 0.5,
              backgroundColor: colors.ink,
            }}
          />
        ) : null}
      </View>
    </GestureDetector>
  );
}
