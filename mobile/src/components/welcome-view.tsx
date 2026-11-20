import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors } from '@/theme/colors';
import { fonts, hitSize } from '@/theme/fonts';
import { DAY_COUNT, WEEKDAY_NAMES, days } from '../../../supabase/functions/_shared/content/plan';

import { PageEdges, Perforation } from './marks';

export function WelcomeView({ onStart, onAccount }: { onStart: () => void; onAccount: () => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const day = days[0];
  const android = Platform.OS === 'android';
  const buttonHeight = android ? 48 : 50;
  if (!day) return null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.under, paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 8) }}>
      <View style={{ height: 4 }} />
      <View
        style={{
          marginHorizontal: 10,
          height: 12,
          borderTopLeftRadius: 3,
          borderTopRightRadius: 3,
          backgroundColor: colors.binding,
        }}
      />
      <View style={{ flex: 1, marginHorizontal: 12, marginTop: 5 }}>
        <View
          style={{
            flex: 1,
            backgroundColor: colors.paper,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.rule,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.16,
            shadowRadius: 3,
            elevation: 2,
          }}>
          <Perforation color={colors.under} />
          <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 14, paddingBottom: 28 }}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Text
                allowFontScaling={false}
                accessibilityLabel="Day 1"
                style={{
                  fontFamily: fonts.numeral,
                  fontSize: 96,
                  lineHeight: 96,
                  letterSpacing: -1.9,
                  color: colors.ink,
                  includeFontPadding: false,
                }}>
                1
              </Text>
              <View style={{ flex: 1, justifyContent: 'space-between', paddingTop: 4, paddingBottom: 6 }}>
                <Text
                  allowFontScaling={false}
                  style={{ fontFamily: fonts.numeral, fontSize: 30, lineHeight: 30, color: colors.ink, includeFontPadding: false }}>
                  Day
                </Text>
                <View>
                  <Text style={{ fontSize: 14, lineHeight: 18, fontWeight: '600', color: colors.ink }}>of {DAY_COUNT}</Text>
                  <Text style={{ fontSize: 14, lineHeight: 18, color: colors.ink2 }}>
                    {WEEKDAY_NAMES[day.weekday]}, week {day.week}
                  </Text>
                </View>
              </View>
            </View>
            <Text
              maxFontSizeMultiplier={1.6}
              style={{
                fontFamily: fonts.serifSemibold,
                fontSize: 30,
                lineHeight: 30 * 1.15,
                letterSpacing: -0.15,
                color: colors.ink,
                marginTop: 18,
                marginBottom: 10,
              }}>
              Read the whole Bible in a year, in the order it happened.
            </Text>
            <Text
              maxFontSizeMultiplier={2}
              style={{ fontFamily: fonts.serif, fontSize: 18, lineHeight: 18 * 1.5, color: colors.ink }}>
              One page a day: what to read, why it matters, and a verse for the week. Read it in your own Bible or online.
            </Text>
            <Text style={{ fontSize: 15, lineHeight: 15 * 1.5, color: colors.ink2, marginTop: 12, marginBottom: 18 }}>
              52 weeks · {DAY_COUNT} reading days · no streaks. Miss a day and the next page is simply waiting.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Start with day 1"
              onPress={onStart}
              style={({ pressed }) => ({
                minHeight: buttonHeight,
                borderRadius: 10,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.blue,
                opacity: pressed ? 0.72 : 1,
              })}>
              <Text
                style={{
                  color: colors.onBlue,
                  fontSize: android ? 15 : 17,
                  fontWeight: android ? '500' : '600',
                }}>
                Start with day 1
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="I already have an account"
              onPress={onAccount}
              style={{ minHeight: hitSize(), alignItems: 'center', justifyContent: 'center', marginTop: 4 }}>
              <Text
                style={{
                  fontSize: 16,
                  color: colors.ink,
                  textDecorationLine: 'underline',
                  textDecorationColor: colors.ink3,
                }}>
                I already have an account
              </Text>
            </Pressable>
          </ScrollView>
        </View>
        <PageEdges paper={colors.paper} rule={colors.rule} />
      </View>
    </View>
  );
}
