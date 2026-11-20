import { Redirect, router, useLocalSearchParams } from 'expo-router';

import { AskSheet } from '@/components/ask-sheet';
import { DAY_COUNT } from '../../../../supabase/functions/_shared/content/plan';

export default function AskRoute() {
  const { day } = useLocalSearchParams<{ day?: string }>();
  const raw = Array.isArray(day) ? day[0] : day;
  const index = Number(raw);
  if (!Number.isInteger(index) || index < 0 || index >= DAY_COUNT) return <Redirect href="/" />;
  return <AskSheet dayIndex={index} onClose={() => router.back()} onSignIn={() => router.push('/sign-in')} />;
}
