import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, type AccessibilityState, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/fonts';

export function Note({ children }: { children: string }) {
  const colors = useColors();
  return <Text style={{ fontSize: 14, lineHeight: 14 * 1.4, color: colors.ink2, marginTop: 4 }}>{children}</Text>;
}

export function Section({ title }: { title: string }) {
  const colors = useColors();
  return (
    <Text
      accessibilityRole="header"
      style={{
        fontFamily: fonts.serifSemibold,
        fontSize: 15,
        lineHeight: 15 * 1.3,
        color: colors.ink,
        marginTop: 24,
        marginBottom: 2,
      }}>
      {title}
    </Text>
  );
}

export function RowChevron() {
  const colors = useColors();
  return (
    <Svg width={8} height={13} viewBox="0 0 8 13" fill="none" accessibilityElementsHidden>
      <Path d="M1.5 1.5 6.5 6.5 1.5 11.5" stroke={colors.ink3} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function Row({
  children,
  onPress,
  accessibilityLabel,
  accessibilityState,
  disabled = false,
  ruled = false,
  style,
}: {
  children: ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityState?: AccessibilityState;
  disabled?: boolean;
  ruled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={disabled ? { ...accessibilityState, disabled: true } : accessibilityState}
      disabled={disabled}
      onPress={onPress}
      style={[
        {
          minHeight: 48,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          borderTopWidth: ruled ? StyleSheet.hairlineWidth : 0,
          borderTopColor: colors.rule,
        },
        style,
      ]}>
      {children}
    </Pressable>
  );
}
