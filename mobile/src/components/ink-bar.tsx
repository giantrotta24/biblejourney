import { Text, View } from 'react-native';

import { useColors } from '@/theme/colors';

export function InkBar({ children, marginTop = 0 }: { children: string; marginTop?: number }) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop }}>
      <View style={{ width: 2, height: 14, backgroundColor: colors.ink, marginTop: 4 }} accessibilityElementsHidden />
      <Text style={{ flex: 1, fontSize: 15, lineHeight: 21, color: colors.ink2 }}>{children}</Text>
    </View>
  );
}
