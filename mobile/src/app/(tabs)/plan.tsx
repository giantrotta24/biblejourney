import { router } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PlanView } from '@/components/plan-view';
import { useNotes } from '@/notes/context';
import { useProgress } from '@/progress/context';
import { useColors } from '@/theme/colors';
import { currentDay } from '../../../../supabase/functions/_shared/content/plan';

export default function PlanScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { days } = useProgress();
  const { rows } = useNotes();
  const noted = new Set(rows.map((row) => row.day_index));

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper, paddingTop: insets.top }}>
      <PlanView
        done={days}
        noted={noted}
        onOpenDay={(index) => {
          const today = currentDay(days)?.index ?? null;
          router.navigate({ pathname: '/', params: { day: index === today ? '' : String(index) } });
        }}
      />
    </View>
  );
}
