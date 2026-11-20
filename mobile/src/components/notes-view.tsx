import { useState } from 'react';
import { Alert, Platform, PlatformColor, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Svg, { Circle, Path } from 'react-native-svg';

import { useSession } from '@/account/session';
import { useNotes } from '@/notes/context';
import { matchingNotes } from '@/notes/query';
import { StorageBlank, StorageRetry } from '@/persist/retry';
import { useProgress } from '@/progress/context';
import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/fonts';
import { currentDay, days } from '../../../supabase/functions/_shared/content/plan';

import { InkBar } from './ink-bar';
import { DottedCut } from './marks';

const dayByIndex = new Map(days.map((day) => [day.index, day]));

export function NotesView({ onOpen }: { onOpen: (dayIndex: number) => void }) {
  const colors = useColors();
  const { rows, remove, status, retry } = useNotes();
  const { days: done } = useProgress();
  const [query, setQuery] = useState('');
  const today = currentDay(done)?.index ?? null;
  const matches = matchingNotes(rows, query, (index) => dayByIndex.get(index)?.reading ?? '');
  const android = Platform.OS === 'android';

  if (status === 'unavailable') return <StorageRetry message="Couldn’t load your notes." onRetry={retry} />;
  if (status === 'loading') return <StorageBlank />;

  function confirmRemove(dayIndex: number) {
    const number = dayIndex + 1;
    Alert.alert(
      'Delete this note?',
      `Your note on day ${number} will be deleted from this phone and your account. It can’t be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => remove(dayIndex) },
      ],
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.paper }}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}>
      <Text
        accessibilityRole="header"
        style={{
          fontSize: 34,
          lineHeight: 41,
          fontWeight: '700',
          letterSpacing: 0.34,
          color: colors.ink,
          marginTop: 6,
        }}>
        Notes
      </Text>
      {rows.length === 0 ? (
        <EmptyNotes />
      ) : (
        <>
            <View
            style={{
              marginTop: 4,
              marginBottom: 6,
              minHeight: android ? 48 : 36,
              paddingVertical: 6,
              borderRadius: android ? 24 : 10,
              backgroundColor: colors.field,
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: android ? 16 : 10,
              gap: 8,
            }}>
            <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
              <Circle cx={7} cy={7} r={5} stroke={colors.ink2} strokeWidth={1.8} />
              <Path d="m11 11 3.5 3.5" stroke={colors.ink2} strokeWidth={1.8} strokeLinecap="round" />
            </Svg>
            <TextInput
              accessibilityLabel="Search your notes"
              placeholder="Search your notes"
              placeholderTextColor={colors.ink2}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
              maxFontSizeMultiplier={1.6}
              style={{
                flex: 1,
                fontSize: android ? 16 : 17,
                lineHeight: android ? 20 : 22,
                color: colors.ink,
                paddingVertical: 0,
                ...(android ? { includeFontPadding: false } : null),
              }}
            />
          </View>
          {matches.length === 0 ? (
            <Text style={{ fontSize: 17, lineHeight: 24, color: colors.ink2, marginTop: 18 }}>
              No notes mention “{query.trim()}”.
            </Text>
          ) : (
            matches.map((row) => {
              const day = dayByIndex.get(row.day_index);
              if (!day) return null;
              const current = today === day.index;
              const when = current ? 'Today' : day.weekday;
              const card = (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Day ${day.index + 1}, ${day.reading}, ${when}. ${row.body}`}
                  accessibilityActions={[{ name: 'delete', label: 'Delete note' }]}
                  onAccessibilityAction={(event) => {
                    if (event.nativeEvent.actionName === 'delete') confirmRemove(day.index);
                  }}
                  onPress={() => onOpen(day.index)}
                  onLongPress={android ? () => confirmRemove(day.index) : undefined}
                  style={{ paddingTop: 14, paddingBottom: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}>
                    <Text
                      allowFontScaling={false}
                      style={{
                        fontFamily: fonts.numeral,
                        fontSize: 26,
                        lineHeight: 26,
                        letterSpacing: -0.26,
                        color: current ? colors.blueInk : colors.ink,
                        includeFontPadding: false,
                      }}>
                      {day.index + 1}
                    </Text>
                    <Text
                      maxFontSizeMultiplier={1.6}
                      style={{
                        flex: 1,
                        fontFamily: fonts.serifSemibold,
                        fontSize: 17,
                        lineHeight: 17 * 1.25,
                        color: colors.ink,
                      }}>
                      {day.reading}
                    </Text>
                    <Text style={{ fontSize: 14, lineHeight: 18, color: current ? colors.blueInk : colors.ink2 }}>
                      {current ? 'Today' : `${day.weekday}, week ${day.week}`}
                    </Text>
                  </View>
                  <Text
                    numberOfLines={3}
                    maxFontSizeMultiplier={2}
                    style={{
                      fontFamily: fonts.serif,
                      fontSize: 16,
                      lineHeight: 16 * 1.45,
                      color: colors.ink,
                      marginTop: 6,
                    }}>
                    {row.body}
                  </Text>
                </Pressable>
              );
              return (
                <View key={row.day_index}>
                  <DottedCut color={colors.ink3} />
                  {android ? (
                    card
                  ) : (
                    <ReanimatedSwipeable
                      childrenContainerStyle={{ backgroundColor: colors.paper }}
                      renderRightActions={() => (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Delete note on day ${day.index + 1}`}
                          onPress={() => remove(day.index)}
                          style={{
                            width: 92,
                            backgroundColor: PlatformColor('systemRed'),
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                          <Text style={{ color: colors.onBlue, fontSize: 15, fontWeight: '600' }}>Delete</Text>
                        </Pressable>
                      )}>
                      {card}
                    </ReanimatedSwipeable>
                  )}
                </View>
              );
            })
          )}
        </>
      )}
    </ScrollView>
  );
}

function EmptyNotes() {
  const colors = useColors();
  const session = useSession();
  return (
    <View style={{ paddingTop: 26 }}>
      <Text
        maxFontSizeMultiplier={1.8}
        style={{ fontFamily: fonts.serifSemibold, fontSize: 24, lineHeight: 24 * 1.2, color: colors.ink }}>
        No notes yet
      </Text>
      <Text
        maxFontSizeMultiplier={2}
        style={{
          fontFamily: fonts.serif,
          fontSize: 17,
          lineHeight: 17 * 1.5,
          color: colors.ink,
          marginTop: 8,
        }}>
        Each day’s page has room for a note under the reading. Whatever you write gathers here, newest first.
      </Text>
      {session.status === 'signed-out' || session.status === 'unavailable' ? (
        <InkBar marginTop={14}>Notes are kept on this phone. Sign in to keep them on your other devices too.</InkBar>
      ) : null}
      <View accessibilityElementsHidden style={{ marginTop: 10, height: 90 }}>
        {[1, 2, 3].map((line) => (
          <View
            key={line}
            style={{
              position: 'absolute',
              top: line * 30 - 1,
              left: 0,
              right: 0,
              height: 1,
              backgroundColor: colors.ruled,
            }}
          />
        ))}
      </View>
    </View>
  );
}
