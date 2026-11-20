import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { Platform, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { useColors } from '@/theme/colors';

import { TabIcon } from './icons';

const IOS_PAPER = {
  light: 'rgba(247,247,243,0.88)',
  dark: 'rgba(23,23,21,0.88)',
} as const;

const ICONS = {
  index: 'today',
  plan: 'plan',
  verses: 'verses',
  notes: 'notes',
  more: 'more',
} as const;

export function PaperTabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const colors = useColors();
  const dark = useColorScheme() === 'dark';
  const android = Platform.OS === 'android';
  const barColor = android ? colors.paper : dark ? IOS_PAPER.dark : IOS_PAPER.light;

  const row = (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        backgroundColor: barColor,
        paddingTop: 6,
        paddingBottom: Math.max(insets.bottom, 8),
      }}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const label = descriptors[route.key]?.options.title ?? route.name;
        const icon = ICONS[route.name as keyof typeof ICONS] ?? 'today';
        const color = focused ? colors.ink : colors.ink2;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
            onPress={() => {
              const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (event.defaultPrevented) return;
              if (route.name === 'index') {
                if (focused) router.setParams({ day: '' });
                else router.navigate({ pathname: '/', params: { day: '' } });
                return;
              }
              if (!focused) navigateToTab(route.key);
            }}
            onLongPress={() => {
              emitter.emit({ type: 'tabLongPress', target: route.key });
            }}
            style={{ flex: 1, alignItems: 'center', minHeight: android ? 48 : 44 }}>
            <View style={{ width: 56, height: 32, alignItems: 'center', justifyContent: 'center' }}>
              {android && focused ? (
                <View
                  style={{
                    position: 'absolute',
                    width: 56,
                    height: 32,
                    borderRadius: 8,
                    backgroundColor: colors.binding,
                  }}
                />
              ) : null}
              <TabIcon name={icon} color={color} size={android ? 24 : 26} strokeWidth={focused ? 2.2 : 1.6} />
            </View>
            <Text
              style={{
                color,
                fontSize: android ? 12 : 10,
                fontWeight: focused ? '700' : '500',
                marginTop: 2,
              }}>
              {label}
            </Text>
        </Pressable>
      );
    })}
    </View>
  );

  const edge = {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.rule,
    overflow: 'hidden' as const,
  };

  if (android) return <View style={edge}>{row}</View>;

  return (
    <BlurView intensity={20} tint={dark ? 'dark' : 'light'} style={edge}>
      {row}
    </BlurView>
  );
}
