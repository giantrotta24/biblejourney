import { ScrollView, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/fonts';

export function PlaceholderScreen({ title, line }: { title: string; line: string }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.paper }}
      contentContainerStyle={{ paddingTop: insets.top + 6, paddingHorizontal: 20, paddingBottom: 32 }}>
      <Text
        accessibilityRole="header"
        style={{
          fontSize: 34,
          lineHeight: 41,
          fontWeight: '700',
          letterSpacing: 0.34,
          color: colors.ink,
          marginBottom: 8,
        }}>
        {title}
      </Text>
      <Text
        maxFontSizeMultiplier={2}
        style={{
          fontFamily: fonts.serif,
          fontSize: 17,
          lineHeight: 17 * 1.5,
          color: colors.ink,
        }}>
        {line}
      </Text>
    </ScrollView>
  );
}
