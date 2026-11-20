import { Redirect, router, useLocalSearchParams } from 'expo-router';

import { NoteSheet } from '@/components/note-sheet';
import { DAY_COUNT } from '../../../../supabase/functions/_shared/content/plan';

export default function NoteRoute() {
  const { day } = useLocalSearchParams<{ day?: string }>();
  const raw = Array.isArray(day) ? day[0] : day;
  const index = Number(raw);
  if (!Number.isInteger(index) || index < 0 || index >= DAY_COUNT) return <Redirect href="/notes" />;
  return <NoteSheet dayIndex={index} onClose={() => router.back()} />;
}
