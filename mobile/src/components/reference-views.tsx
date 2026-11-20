import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { currentEraIndex, weekRangeLabel } from '@/lib/era';
import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/fonts';
import { currentDay, eras, peoples, prophets } from '../../../supabase/functions/_shared/content/plan';

import { DottedCut } from './marks';
import { RowChevron } from './rows';
import { StackPage } from './stack-page';

function PageTitle({ children }: { children: string }) {
  const colors = useColors();
  return (
    <Text
      accessibilityRole="header"
      style={{
        fontFamily: fonts.serifSemibold,
        fontSize: 28,
        lineHeight: 28 * 1.15,
        color: colors.ink,
        marginTop: 8,
      }}>
      {children}
    </Text>
  );
}

function Intro({ children }: { children: string }) {
  const colors = useColors();
  return <Text style={{ fontSize: 15, lineHeight: 15 * 1.45, color: colors.ink2, marginTop: 8 }}>{children}</Text>;
}

function SectionTitle({ children }: { children: string }) {
  const colors = useColors();
  return (
    <Text
      accessibilityRole="header"
      style={{
        fontFamily: fonts.serifSemibold,
        fontSize: 22,
        lineHeight: 22 * 1.2,
        color: colors.ink,
        marginTop: 28,
      }}>
      {children}
    </Text>
  );
}

export function TimelineView({ done }: { done: ReadonlySet<number> }) {
  const colors = useColors();
  const day = currentDay(done);
  const current = day ? currentEraIndex(day.week, eras) : eras.length - 1;
  return (
    <StackPage title="Timeline" backLabel="More">
      <PageTitle>The story in time</PageTitle>
      <Intro>Each era, the empire in charge, and the weeks you’ll read it. Dates are approximate; early ones are debated.</Intro>
      {eras.map((era, index) => {
        const here = index === current;
        return (
          <View key={era.title}>
            {index > 0 ? (
              <View style={{ marginTop: 16 }}>
                <DottedCut color={colors.ink3} />
              </View>
            ) : (
              <View style={{ height: 16 }} />
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: here }}
              accessibilityHint={`Opens week ${era.weeks[0]} in Plan`}
              onPress={() => router.navigate({ pathname: '/plan', params: { week: String(era.weeks[0]) } })}
              style={{ paddingVertical: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Text
                  style={{
                    flex: 1,
                    fontFamily: fonts.serifSemibold,
                    fontSize: 20,
                    lineHeight: 20 * 1.2,
                    color: here ? colors.blueInk : colors.ink,
                  }}>
                  {era.title}
                </Text>
                <RowChevron />
              </View>
              <Text style={{ fontSize: 14, lineHeight: 18, color: colors.ink2, marginTop: 4 }}>{era.when}</Text>
              <Text style={{ fontSize: 14, lineHeight: 18, color: colors.ink2, marginTop: 2 }}>
                {era.empire} · {weekRangeLabel(era.weeks)}
              </Text>
              <Text style={{ fontFamily: fonts.serif, fontSize: 17, lineHeight: 17 * 1.45, color: colors.ink, marginTop: 8 }}>
                {era.summary}
              </Text>
              <Text style={{ fontSize: 14, lineHeight: 18, color: colors.ink2, marginTop: 6 }}>Key people: {era.keyPeople}</Text>
            </Pressable>
          </View>
        );
      })}
    </StackPage>
  );
}

export function WhosWhoView() {
  const colors = useColors();
  return (
    <StackPage title="Who’s who" backLabel="More">
      <PageTitle>Who’s who</PageTitle>
      <Intro>The peoples and prophets you’ll meet, and how they relate.</Intro>
      <SectionTitle>The peoples</SectionTitle>
      {peoples.map((people, index) => (
        <View key={people.name}>
          {index > 0 ? (
            <View style={{ marginTop: 14 }}>
              <DottedCut color={colors.ink3} />
            </View>
          ) : null}
          <Text
            style={{
              fontFamily: fonts.serifSemibold,
              fontSize: 18,
              lineHeight: 18 * 1.3,
              color: colors.ink,
              marginTop: 14,
            }}>
            {people.name}
          </Text>
          <Text style={{ fontFamily: fonts.serif, fontSize: 17, lineHeight: 17 * 1.45, color: colors.ink, marginTop: 4 }}>
            {people.desc}
          </Text>
        </View>
      ))}
      <SectionTitle>The prophets in their time</SectionTitle>
      {prophets.map((prophet, index) => (
        <View key={prophet.name}>
          {index > 0 ? (
            <View style={{ marginTop: 14 }}>
              <DottedCut color={colors.ink3} />
            </View>
          ) : null}
          <Text
            style={{
              fontFamily: fonts.serifSemibold,
              fontSize: 18,
              lineHeight: 18 * 1.3,
              color: colors.ink,
              marginTop: 14,
            }}>
            {prophet.name}
          </Text>
          <Fact label="When" value={prophet.when} />
          <Fact label="Spoke to" value={prophet.audience} />
          <Fact label="Message" value={prophet.message} />
        </View>
      ))}
    </StackPage>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return (
    <Text style={{ fontSize: 15, lineHeight: 20, color: colors.ink, marginTop: 4 }}>
      <Text style={{ color: colors.ink2 }}>{label} </Text>
      {value}
    </Text>
  );
}
