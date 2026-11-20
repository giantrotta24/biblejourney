import { Stack } from 'expo-router';

import { useColors } from '@/theme/colors';

export default function MoreStack() {
  const colors = useColors();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="account" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="translation" />
      <Stack.Screen name="timeline" />
      <Stack.Screen name="whos-who" />
    </Stack>
  );
}
