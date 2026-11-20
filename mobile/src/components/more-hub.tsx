import { ScrollView, Text, View } from 'react-native';

import { useColors } from '@/theme/colors';

import { Row, RowChevron, Section } from './rows';

const TIMELINE = 'The 11 eras, from the patriarchs to the early church';
const WHOS_WHO = 'Peoples and prophets';
const SETTINGS = 'Appearance, translation, start over';

function HubRow({ title, detail, onPress, ruled = false }: { title: string; detail: string; onPress: () => void; ruled?: boolean }) {
  const colors = useColors();
  return (
    <Row accessibilityLabel={detail ? `${title}, ${detail}` : title} onPress={onPress} ruled={ruled}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 17, lineHeight: 22, color: colors.ink }}>{title}</Text>
        {detail ? <Text style={{ fontSize: 14, lineHeight: 18, color: colors.ink2 }}>{detail}</Text> : null}
      </View>
      <RowChevron />
    </Row>
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
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}>
      <Text
        accessibilityRole="header"
        style={{ fontSize: 34, lineHeight: 41, fontWeight: '700', letterSpacing: 0.34, color: colors.ink, marginTop: 6 }}>
        More
      </Text>
      <View style={{ marginTop: 10 }}>
        <HubRow title="Timeline" detail={TIMELINE} onPress={onTimeline} />
        <HubRow title="Who’s who" detail={WHOS_WHO} onPress={onWhosWho} ruled />
      </View>
      <Section title="You" />
      <HubRow title="Account" detail={detail} onPress={onAccount} />
      <HubRow title="Settings" detail={SETTINGS} onPress={onSettings} ruled />
    </ScrollView>
  );
}
