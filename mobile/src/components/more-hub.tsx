import { Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/fonts';

export function MoreHub({ detail, onAccount }: { detail: string; onAccount: () => void }) {
  const colors = useColors();
  return (
    <View style={{ paddingHorizontal: 20, paddingBottom: 32 }}>
      <Text
        accessibilityRole="header"
        style={{ fontSize: 34, lineHeight: 41, fontWeight: '700', letterSpacing: 0.34, color: colors.ink, marginTop: 6 }}>
        More
      </Text>
      <Text
        accessibilityRole="header"
        style={{
          fontFamily: fonts.serifSemibold,
          fontSize: 15,
          lineHeight: 15 * 1.3,
          color: colors.ink,
          marginTop: 18,
          marginBottom: 2,
        }}>
        You
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Account, ${detail}`}
        onPress={onAccount}
        style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 17, lineHeight: 22, color: colors.ink }}>Account</Text>
          <Text style={{ fontSize: 14, lineHeight: 18, color: colors.ink2 }}>{detail}</Text>
        </View>
        <Svg width={8} height={13} viewBox="0 0 8 13" fill="none" accessibilityElementsHidden>
          <Path d="M1.5 1.5 6.5 6.5 1.5 11.5" stroke={colors.ink3} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Pressable>
    </View>
  );
}
