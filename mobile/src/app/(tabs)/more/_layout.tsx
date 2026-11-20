import { Stack } from 'expo-router';

import { useColors } from '@/theme/colors';

export default function MoreStack() {
  const colors = useColors();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="account" />
    </Stack>
  );
}
