import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors } from '@/theme/colors';

import { BackButton } from './auth-chrome';

export function StackPage({
  title,
  backLabel,
  children,
}: {
  title: string;
  backLabel: string;
  children: ReactNode;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.paper, paddingTop: insets.top }}>
      <View style={{ height: 44, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 }}>
        <View style={{ flex: 1 }}>
          <BackButton label={backLabel} onPress={() => router.back()} />
        </View>
        <Text accessibilityRole="header" style={{ fontSize: 17, fontWeight: '600', color: colors.ink }}>
          {title}
        </Text>
        <View style={{ flex: 1 }} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>{children}</ScrollView>
    </View>
  );
}
