import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PlanView } from '@/components/plan-view';
import { useNotes } from '@/notes/context';
import { useProgress } from '@/progress/context';
import { useColors } from '@/theme/colors';
import { WEEK_COUNT, currentDay } from '../../../../supabase/functions/_shared/content/plan';

function weekParam(value: string | string[] | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;
  const week = Number(raw);
  if (!Number.isInteger(week) || week < 1 || week > WEEK_COUNT) return null;
  return week;
}

export default function PlanScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { days } = useProgress();
  const { rows } = useNotes();
  const noted = new Set(rows.map((row) => row.day_index));
  const { week } = useLocalSearchParams<{ week?: string }>();
  const focusWeek = weekParam(week);

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper, paddingTop: insets.top }}>
      <PlanView
        done={days}
        noted={noted}
        focusWeek={focusWeek}
        onOpenDay={(index) => {
          const today = currentDay(days)?.index ?? null;
          router.navigate({ pathname: '/', params: { day: index === today ? '' : String(index) } });
        }}
      />
    </View>
  );
}
