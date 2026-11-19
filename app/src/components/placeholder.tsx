import { ScrollView, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors } from '@/theme/colors';
import { fonts, useLargeText } from '@/theme/fonts';

export function PlaceholderScreen({ title, line }: { title: string; line: string }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const large = useLargeText();
  const body = large ? 23 : 17;
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
        style={{
          fontFamily: fonts.serif,
          fontSize: body,
          lineHeight: body * 1.5,
          color: colors.ink,
        }}>
        {line}
      </Text>
    </ScrollView>
  );
}
