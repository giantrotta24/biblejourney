import { Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/fonts';

const TIMELINE = 'The 11 eras, from the patriarchs to the early church';
const WHOS_WHO = 'Peoples and prophets';
const SETTINGS = 'Appearance, translation, start over';

function RowChevron() {
  const colors = useColors();
  return (
    <Svg width={8} height={13} viewBox="0 0 8 13" fill="none" accessibilityElementsHidden>
      <Path d="M1.5 1.5 6.5 6.5 1.5 11.5" stroke={colors.ink3} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function HubRow({ title, detail, onPress }: { title: string; detail: string; onPress: () => void }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={detail ? `${title}, ${detail}` : title}
      onPress={onPress}
      style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 17, lineHeight: 22, color: colors.ink }}>{title}</Text>
        {detail ? <Text style={{ fontSize: 14, lineHeight: 18, color: colors.ink2 }}>{detail}</Text> : null}
      </View>
      <RowChevron />
    </Pressable>
  );
}

function Section({ title }: { title: string }) {
  const colors = useColors();
  return (
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
      {title}
    </Text>
  );
}

export function MoreHub({
  detail,
  onTimeline,
  onWhosWho,
  onAccount,
  onSettings,
}: {
  detail: string;
  onTimeline: () => void;
  onWhosWho: () => void;
  onAccount: () => void;
  onSettings: () => void;
}) {
  const colors = useColors();
  return (
    <View style={{ paddingHorizontal: 20, paddingBottom: 32 }}>
      <Text
        accessibilityRole="header"
        style={{ fontSize: 34, lineHeight: 41, fontWeight: '700', letterSpacing: 0.34, color: colors.ink, marginTop: 6 }}>
        More
      </Text>
      <View style={{ marginTop: 10 }}>
        <HubRow title="Timeline" detail={TIMELINE} onPress={onTimeline} />
        <HubRow title="Who’s who" detail={WHOS_WHO} onPress={onWhosWho} />
      </View>
      <Section title="You" />
      <HubRow title="Account" detail={detail} onPress={onAccount} />
      <HubRow title="Settings" detail={SETTINGS} onPress={onSettings} />
    </View>
  );
}
