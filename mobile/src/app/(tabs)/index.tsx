import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { askUrl } from '@/assistant/url';
import { TodayView } from '@/components/today-view';
import { useNotes } from '@/notes/context';
import { useProgress } from '@/progress/context';
import { SIGNED_IN_NOTE } from '@/sync/copy';
import { useSignedInNote } from '@/sync/react';
import { useSettings } from '@/settings/client';
import { useColors } from '@/theme/colors';
import { currentDay, DAY_COUNT } from '../../../../supabase/functions/_shared/content/plan';

function dayParam(value: string | string[] | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;
  const index = Number(raw);
  if (!Number.isInteger(index) || index < 0 || index >= DAY_COUNT) return null;
  return index;
}

export default function TodayScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { days, mark } = useProgress();
  const { rows, status: notesStatus } = useNotes();
  const signedIn = useSignedInNote();
  const { day } = useLocalSearchParams<{ day?: string }>();
  const dayIndex = dayParam(day);
  const { linkTranslation } = useSettings();

  return (
    <View style={{ flex: 1, backgroundColor: colors.under, paddingTop: insets.top }}>
      <TodayView
        done={days}
        dayIndex={dayIndex}
        noteFor={(index) =>
          notesStatus === 'ready' ? (rows.find((row) => row.day_index === index)?.body ?? null) : null
        }
        onMark={(index) => {
          const tearing = currentDay(days)?.index === index;
          mark(index);
          if (tearing) router.setParams({ day: '' });
        }}
        onBackToToday={() => router.setParams({ day: '' })}
        onOpenPlan={() => router.navigate('/plan')}
        onOpenNote={(index) => router.push({ pathname: '/note/[day]', params: { day: String(index) } })}
        onOpenAsk={
          askUrl()
            ? (index) => router.push({ pathname: '/ask/[day]', params: { day: String(index) } })
            : undefined
        }
        signedInNote={signedIn.visible ? SIGNED_IN_NOTE : null}
        onPageTurn={signedIn.dismiss}
        translation={linkTranslation}
        onShowDay={(index) => {
          const today = currentDay(days)?.index ?? null;
          if (index == null || index === today) router.setParams({ day: '' });
          else router.setParams({ day: String(index) });
        }}
      />
    </View>
  );
}
