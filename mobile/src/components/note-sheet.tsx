import { useEffect, useRef, useState } from 'react';
import { Alert, AppState, Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useNotes } from '@/notes/context';
import { useColors } from '@/theme/colors';
import { fonts, hitSize } from '@/theme/fonts';
import { days } from '../../../supabase/functions/_shared/content/plan';

export const NOTE_SAVE_DELAY_MS = 400;

const LINE = 32;

export function NoteSheet({ dayIndex, onClose }: { dayIndex: number; onClose: () => void }) {
  const colors = useColors();
  const { rows, setBody, remove } = useNotes();
  const day = days.find((item) => item.index === dayIndex);
  const stored = rows.find((row) => row.day_index === dayIndex)?.body ?? '';
  const [draft, setDraft] = useState(stored);
  const [keyboard, setKeyboard] = useState(false);
  const [inkHeight, setInkHeight] = useState(LINE * 8);
  const draftRef = useRef(stored);
  const committedRef = useRef(stored);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function flushNow() {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      if (draftRef.current === committedRef.current) return;
      const body = draftRef.current;
      committedRef.current = body;
      setBody(dayIndex, body);
    }
    const app = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') flushNow();
    });
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboard(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(false));
    return () => {
      app.remove();
      show.remove();
      hide.remove();
      flushNow();
    };
  }, [dayIndex, setBody]);

  if (!day) return null;

  function onChange(text: string) {
    draftRef.current = text;
    setDraft(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      if (draftRef.current === committedRef.current) return;
      const body = draftRef.current;
      committedRef.current = body;
      setBody(dayIndex, body);
    }, NOTE_SAVE_DELAY_MS);
  }

  function confirmDelete() {
    Alert.alert(
      'Delete this note?',
      `Your note on day ${dayIndex + 1} will be deleted from this phone and your account. It can’t be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (timer.current) {
              clearTimeout(timer.current);
              timer.current = null;
            }
            draftRef.current = '';
            committedRef.current = '';
            setDraft('');
            remove(dayIndex);
          },
        },
      ],
    );
  }

  const lines = Math.max(8, Math.ceil(inkHeight / LINE));
  const showDelete = !keyboard && (draft.length > 0 || stored.length > 0);
  const android = Platform.OS === 'android';

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper, paddingTop: 8, paddingHorizontal: 22 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <Text
          accessibilityRole="header"
          maxFontSizeMultiplier={1.6}
          style={{
            flex: 1,
            fontFamily: fonts.serifSemibold,
            fontSize: 22,
            lineHeight: 22 * 1.2,
            color: colors.ink,
            paddingTop: 8,
          }}>
          {day.reading}
        </Text>
        {android ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            style={{ minWidth: hitSize(), minHeight: hitSize(), alignItems: 'center', justifyContent: 'center' }}>
            <View
              style={{
                width: 30,
                height: 30,
                borderRadius: 15,
                backgroundColor: colors.field,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Svg width={12} height={12} viewBox="0 0 12 12">
                <Path d="M2 2l8 8M10 2l-8 8" stroke={colors.ink} strokeWidth={2} strokeLinecap="round" />
              </Svg>
            </View>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Done"
            onPress={onClose}
            style={{ minHeight: hitSize(), justifyContent: 'center', paddingHorizontal: 2 }}>
            <Text style={{ fontSize: 17, color: colors.ink }}>Done</Text>
          </Pressable>
        )}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={{ fontSize: 14, lineHeight: 20, color: colors.ink2 }}>Day {dayIndex + 1} · your note</Text>
        <Text style={{ fontSize: 14, lineHeight: 20, color: colors.ink2 }}>Saved</Text>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 12 }}>
        <View style={{ minHeight: LINE * lines }}>
          <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden>
            {Array.from({ length: lines }, (_, index) => (
              <View
                key={index}
                style={{
                  position: 'absolute',
                  top: (index + 1) * LINE - 1,
                  left: 0,
                  right: 0,
                  height: 1,
                  backgroundColor: colors.ruled,
                }}
              />
            ))}
          </View>
          <TextInput
            accessibilityLabel="Note"
            autoFocus
            multiline
            value={draft}
            onChangeText={onChange}
            onContentSizeChange={(event) => setInkHeight(event.nativeEvent.contentSize.height)}
            scrollEnabled={false}
            style={{
              fontFamily: fonts.serif,
              fontSize: 18,
              lineHeight: LINE,
              color: colors.ink,
              minHeight: LINE * 8,
              padding: 0,
              textAlignVertical: 'top',
            }}
          />
        </View>
      </ScrollView>
      {showDelete ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete note…"
          onPress={confirmDelete}
          style={{ minHeight: hitSize(), justifyContent: 'center', marginBottom: 8 }}>
          <Text style={{ fontSize: android ? 15 : 17, color: colors.danger }}>Delete note…</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
