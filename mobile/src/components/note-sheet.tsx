import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ScrollViewInstance,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useNotes } from '@/notes/context';
import { StorageBlank, StorageRetry } from '@/persist/retry';
import { useColors } from '@/theme/colors';
import { fonts, hitSize, useFontScale } from '@/theme/fonts';
import { caretLineY, ruledLine, writingScale } from '@/theme/ruled';
import { days } from '../../../supabase/functions/_shared/content/plan';

import { Perforation } from './marks';

export const NOTE_SAVE_DELAY_MS = 400;

export function NoteSheet({ dayIndex, onClose }: { dayIndex: number; onClose: () => void }) {
  const colors = useColors();
  const { rows, setBody, remove, saving, failed, status, retry } = useNotes();
  const day = days.find((item) => item.index === dayIndex);
  const stored = rows.find((row) => row.day_index === dayIndex)?.body ?? '';
  const fontScale = useFontScale();
  const scale = writingScale(fontScale);
  const line = ruledLine(32, fontScale);
  const [draft, setDraft] = useState<string | null>(null);
  const [committed, setCommitted] = useState<string | null>(null);
  const text = draft ?? stored;
  const baseline = committed ?? stored;
  const [keyboard, setKeyboard] = useState(false);
  const [inkHeight, setInkHeight] = useState(line * 8);
  const draftRef = useRef(text);
  const committedRef = useRef(baseline);
  const caretRef = useRef(0);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    draftRef.current = text;
    committedRef.current = baseline;
  }, [text, baseline]);

  const publish = useCallback(
    (body: string) => {
      committedRef.current = body;
      setCommitted(body);
      setBody(dayIndex, body);
    },
    [dayIndex, setBody],
  );

  useEffect(() => {
    function flushNow() {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      if (draftRef.current === committedRef.current) return;
      publish(draftRef.current);
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
  }, [publish]);

  function onChange(next: string) {
    draftRef.current = next;
    setDraft(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      if (draftRef.current === committedRef.current) return;
      publish(draftRef.current);
    }, NOTE_SAVE_DELAY_MS);
  }

  function reveal(index: number) {
    caretRef.current = index;
    scrollRef.current?.scrollTo({ y: caretLineY(draftRef.current, index, line), animated: false });
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
            setCommitted('');
            remove(dayIndex);
          },
        },
      ],
    );
  }

  if (status === 'loading') return <StorageBlank />;
  if (status === 'unavailable') return <StorageRetry message="Couldn’t load your notes." onRetry={retry} />;
  if (!day) return null;

  const lines = Math.max(8, Math.ceil(inkHeight / line));
  const showDelete = !keyboard && (text.length > 0 || stored.length > 0);
  const android = Platform.OS === 'android';
  const saveLabel = text !== baseline || saving ? 'Saving…' : failed ? 'Not saved' : 'Saved';

  const sheet = (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <View collapsable={false}>
        <Perforation color={colors.under} />
        <View style={{ paddingHorizontal: 22 }}>
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
            <Text accessibilityLiveRegion="polite" style={{ fontSize: 14, lineHeight: 20, color: colors.ink2 }}>
              {saveLabel}
            </Text>
          </View>
        </View>
      </View>
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="interactive"
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 12 }}>
        <View style={{ minHeight: line * lines }}>
          <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden>
            {Array.from({ length: lines }, (_, index) => (
              <View
                key={index}
                style={{
                  position: 'absolute',
                  top: (index + 1) * line - 1,
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
            allowFontScaling={false}
            value={text}
            onChangeText={onChange}
            onSelectionChange={(event) => reveal(event.nativeEvent.selection.end)}
            onContentSizeChange={(event) => {
              setInkHeight(event.nativeEvent.contentSize.height);
              reveal(caretRef.current);
            }}
            scrollEnabled={false}
            style={{
              fontFamily: fonts.serif,
              fontSize: 18 * scale,
              lineHeight: line,
              color: colors.ink,
              minHeight: line * 8,
              padding: 0,
              textAlignVertical: 'top',
            }}
          />
        </View>
        {showDelete ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete note…"
            onPress={confirmDelete}
            style={{ minHeight: hitSize(), justifyContent: 'center', marginBottom: 8 }}>
            <Text style={{ fontSize: android ? 15 : 17, color: colors.danger }}>Delete note…</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );

  if (android) {
    return (
      <KeyboardAvoidingView behavior="height" style={{ flex: 1 }} testID="note-keyboard">
        {sheet}
      </KeyboardAvoidingView>
    );
  }
  return sheet;
}
