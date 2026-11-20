import { Stack } from 'expo-router';

import { useColors } from '@/theme/colors';

export default function SignInLayout() {
  const colors = useColors();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }} />;
}
