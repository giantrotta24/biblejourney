import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { accessToken } from '@/account/delete';
import { useSession } from '@/account/session';
import { supabaseAnonKey } from '@/account/supabase';
import { useColors } from '@/theme/colors';
import { fonts, hitSize } from '@/theme/fonts';
import { QUESTION_MAX_LENGTH, REPORT_NOTE_MAX } from '../../../supabase/functions/_shared/assistant/limits';
import { days } from '../../../supabase/functions/_shared/content/plan';

import {
  defaultTransport,
  loadStatus,
  requestAnswer,
  submitReport,
  type AskPayload,
  type AssistantStatus,
  type AssistantTransport,
  type QuickPromptType,
  type ReportPayload,
} from '../assistant/client';
import {
  INVITATION_LINE,
  NOT_CONFIGURED_LINE,
  QUICK_PROMPTS,
  REPORT_THANKS,
  SIGN_IN_LINE,
  UPSTREAM_LINE,
  answerNotice,
  failureLine,
  reportLine,
} from '../assistant/copy';
import { askUrl, reportUrl } from '../assistant/url';

import { Perforation } from './marks';
import { Row, RowChevron } from './rows';

type Gate = 'checking' | 'not-configured' | 'sign-in' | 'invitation' | 'unavailable' | 'ready';

type ReportTarget =
  | { kind: 'question'; question: string; answer: string }
  | { kind: QuickPromptType; answer: string };

function gateFor(status: AssistantStatus, signedIn: boolean): Gate {
  if (!status.configured) return 'not-configured';
  if (status.enabled === false) return 'invitation';
  if (status.signInRequired && !signedIn) return 'sign-in';
  return 'ready';
}

function reportTarget(payload: AskPayload, text: string): ReportTarget {
  if ('type' in payload) return { kind: payload.type, answer: text };
  return { kind: 'question', question: payload.question, answer: text };
}

export function AskSheet({
  dayIndex,
  onClose,
  onSignIn,
  transport = defaultTransport,
}: {
  dayIndex: number;
  onClose: () => void;
  onSignIn: () => void;
  transport?: AssistantTransport;
}) {
  const colors = useColors();
  const session = useSession();
  const day = days.find((item) => item.index === dayIndex);
  const signedIn = session.status === 'signed-in';
  const address = askUrl();
  const [remoteGate, setRemoteGate] = useState<Gate>('checking');
  const [question, setQuestion] = useState('');
  const [asked, setAsked] = useState<string | null>(null);
  const [answer, setAnswer] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [report, setReport] = useState<ReportTarget | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportNote, setReportNote] = useState('');
  const [reportThanks, setReportThanks] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const askAbort = useRef<AbortController | null>(null);
  const reportAbort = useRef<AbortController | null>(null);
  const sending = useRef(false);
  const live = useRef(true);

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      askAbort.current?.abort();
      reportAbort.current?.abort();
    };
  }, []);

  useEffect(() => {
    const url = askUrl();
    if (!url || session.status === 'loading') return;
    const controller = new AbortController();
    let current = true;
    void (async () => {
      try {
        const token = signedIn ? await accessToken() : null;
        if (!current) return;
        const status = await loadStatus({
          transport,
          url,
          token,
          anonKey: supabaseAnonKey ?? null,
          signal: controller.signal,
        });
        if (!current) return;
        setRemoteGate(gateFor(status, signedIn));
      } catch {
        if (!current || controller.signal.aborted) return;
        setRemoteGate('unavailable');
      }
    })();
    return () => {
      current = false;
      controller.abort();
    };
  }, [session.status, session.user?.id, signedIn, transport]);

  if (!day) return null;

  async function ask(payload: AskPayload) {
    const url = askUrl();
    if (!url || streaming || sending.current) return;
    askAbort.current?.abort();
    const controller = new AbortController();
    askAbort.current = controller;
    setStreaming(true);
    setAnswer('');
    setAsked('question' in payload ? payload.question : null);
    setNotice(null);
    setReport(null);
    setReportOpen(false);
    setReportNote('');
    setReportThanks(false);
    setReportError(null);
    try {
      const token = await accessToken();
      if (!live.current || controller.signal.aborted) return;
      const outcome = await requestAnswer({
        transport,
        url,
        token,
        anonKey: supabaseAnonKey ?? null,
        payload,
        signal: controller.signal,
        onText: (text) => {
          if (live.current && askAbort.current === controller) setAnswer(text);
        },
      });
      if (!live.current || controller.signal.aborted || outcome.kind === 'aborted') return;
      if (outcome.kind === 'failure') {
        const line = failureLine(outcome);
        setAnswer('');
        setAsked(null);
        setReport(null);
        if (line.kind === 'sign-in') setRemoteGate('sign-in');
        else if (line.kind === 'invitation') setRemoteGate('invitation');
        else if (line.kind === 'not-configured') setRemoteGate('not-configured');
        else setNotice(line.text);
        return;
      }
      const next = answerNotice(outcome);
      setAnswer(next.keep ? outcome.text : '');
      if (!next.keep) setAsked(null);
      setNotice(next.text || null);
      setReport(next.report ? reportTarget(payload, outcome.text) : null);
      if (next.announce) AccessibilityInfo.announceForAccessibility(outcome.text);
    } finally {
      if (askAbort.current === controller) {
        askAbort.current = null;
        if (live.current) setStreaming(false);
      }
    }
  }

  function submitQuestion() {
    const trimmed = question.trim();
    if (!trimmed || streaming) return;
    void ask({ dayIndex, question: trimmed });
  }

  async function sendReport() {
    const url = reportUrl();
    if (!report || !url || reportThanks || sending.current) return;
    sending.current = true;
    setReportError(null);
    const controller = new AbortController();
    reportAbort.current = controller;
    const note = reportNote.trim();
    const payload: ReportPayload =
      report.kind === 'question'
        ? {
            dayIndex,
            kind: 'question',
            question: report.question,
            answer: report.answer,
            ...(note ? { note } : {}),
          }
        : { dayIndex, kind: report.kind, answer: report.answer, ...(note ? { note } : {}) };
    try {
      const token = await accessToken();
      if (!live.current) return;
      const outcome = await submitReport({
        transport,
        url,
        token,
        anonKey: supabaseAnonKey ?? null,
        payload,
        signal: controller.signal,
      });
      if (!live.current || outcome.kind === 'aborted') return;
      if (outcome.kind === 'ok') {
        setReportThanks(true);
        setReportOpen(false);
        return;
      }
      setReportError(reportLine(outcome));
    } finally {
      if (reportAbort.current === controller) reportAbort.current = null;
      sending.current = false;
    }
  }

  const android = Platform.OS === 'android';
  const gate = address ? remoteGate : 'not-configured';
  const ready = gate === 'ready';
  let statusLine: string | null = null;
  if (gate === 'not-configured') statusLine = NOT_CONFIGURED_LINE;
  else if (gate === 'invitation') statusLine = INVITATION_LINE;
  else if (gate === 'unavailable') statusLine = UPSTREAM_LINE;

  const sheet = (
    <>
      <View collapsable={false} style={{ backgroundColor: colors.paper }}>
        <Perforation color={colors.under} />
        <View style={{ paddingHorizontal: 22, flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
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
              <Text style={{ fontSize: 17, fontWeight: '600', color: colors.ink }}>Done</Text>
            </Pressable>
          )}
        </View>
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 16 }}>
        {gate === 'sign-in' ? (
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Sign in"
            onPress={onSignIn}
            style={{ minHeight: hitSize(), justifyContent: 'center' }}>
            <Text
              style={{
                fontSize: 15,
                lineHeight: 22,
                color: colors.ink2,
                textDecorationLine: 'underline',
                textDecorationColor: colors.ink3,
              }}>
              {SIGN_IN_LINE}
            </Text>
          </Pressable>
        ) : null}
        {statusLine ? (
          <Text accessibilityLiveRegion="polite" style={{ fontSize: 15, lineHeight: 22, color: colors.ink2, marginTop: 8 }}>
            {statusLine}
          </Text>
        ) : null}
        {ready ? (
          <View style={{ marginTop: 6 }}>
            {QUICK_PROMPTS.map((prompt, index) => (
              <Row
                key={prompt.type}
                ruled={index > 0}
                disabled={streaming}
                accessibilityLabel={prompt.label}
                onPress={() => {
                  void ask({ dayIndex, type: prompt.type });
                }}>
                <Text style={{ flex: 1, fontSize: 17, color: colors.ink }}>{prompt.label}</Text>
                <RowChevron />
              </Row>
            ))}
          </View>
        ) : null}
        {asked ? (
          <Text style={{ fontSize: 17, lineHeight: 17 * 1.35, fontWeight: '600', color: colors.ink, marginTop: 18 }}>{asked}</Text>
        ) : null}
        {answer ? (
          <Text
            maxFontSizeMultiplier={2}
            style={{
              fontFamily: fonts.serif,
              fontSize: 17,
              lineHeight: 17 * 1.55,
              color: colors.ink,
              marginTop: asked ? 8 : 18,
            }}>
            {answer}
          </Text>
        ) : null}
        {notice ? (
          <Text accessibilityLiveRegion="polite" style={{ fontSize: 15, lineHeight: 22, color: colors.ink2, marginTop: 8 }}>
            {notice}
          </Text>
        ) : null}
        {report && !streaming ? (
          reportThanks ? (
            <Text accessibilityLiveRegion="polite" style={{ fontSize: 15, lineHeight: 22, color: colors.ink2, marginTop: 8 }}>
              {REPORT_THANKS}
            </Text>
          ) : reportOpen ? (
            <View style={{ marginTop: 8 }}>
              <Text style={{ fontSize: 14, color: colors.ink2, marginBottom: 6 }}>Add a note, if you want</Text>
              <TextInput
                accessibilityLabel="Add a note, if you want"
                value={reportNote}
                onChangeText={setReportNote}
                maxLength={REPORT_NOTE_MAX}
                multiline
                placeholderTextColor={colors.ink2}
                style={{
                  minHeight: android ? 56 : 48,
                  borderRadius: android ? 4 : 10,
                  borderWidth: android ? 1 : 0,
                  borderColor: colors.ink2,
                  backgroundColor: android ? 'transparent' : colors.field,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  fontSize: 16,
                  color: colors.ink,
                  textAlignVertical: 'top',
                }}
              />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Send the report"
                  onPress={() => {
                    void sendReport();
                  }}
                  style={{ minHeight: hitSize(), justifyContent: 'center', paddingRight: 12 }}>
                  <Text style={{ fontSize: 17, color: colors.ink }}>Send</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                  onPress={() => {
                    setReportOpen(false);
                    setReportNote('');
                    setReportError(null);
                  }}
                  style={{ minHeight: hitSize(), justifyContent: 'center' }}>
                  <Text style={{ fontSize: 17, color: colors.ink2 }}>Cancel</Text>
                </Pressable>
              </View>
              {reportError ? (
                <Text accessibilityLiveRegion="polite" style={{ fontSize: 15, lineHeight: 22, color: colors.ink2 }}>
                  {reportError}
                </Text>
              ) : null}
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Report this answer"
              onPress={() => setReportOpen(true)}
              style={{ minHeight: hitSize(), justifyContent: 'center', alignSelf: 'flex-start' }}>
              <Text
                style={{
                  fontSize: 14,
                  color: colors.ink2,
                  textDecorationLine: 'underline',
                  textDecorationColor: colors.ink3,
                }}>
                Report this answer
              </Text>
            </Pressable>
          )
        ) : null}
      </ScrollView>
      {ready ? (
        <View
          style={{
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.rule,
            paddingHorizontal: 14,
            paddingTop: 8,
            paddingBottom: 12,
            backgroundColor: colors.paper,
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <TextInput
              accessibilityLabel="Ask about this reading"
              value={question}
              onChangeText={setQuestion}
              placeholder="Ask about this reading"
              placeholderTextColor={colors.ink2}
              maxLength={QUESTION_MAX_LENGTH}
              editable={!streaming}
              returnKeyType="send"
              onSubmitEditing={submitQuestion}
              style={{
                flex: 1,
                height: android ? 56 : 44,
                borderRadius: android ? 4 : 10,
                borderWidth: android ? 1 : 0,
                borderColor: colors.ink2,
                backgroundColor: android ? 'transparent' : colors.field,
                paddingHorizontal: 14,
                fontSize: 16,
                color: colors.ink,
              }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send"
              accessibilityState={{ disabled: streaming || question.trim().length === 0 }}
              disabled={streaming || question.trim().length === 0}
              onPress={submitQuestion}
              style={{ minWidth: hitSize(), minHeight: hitSize(), alignItems: 'center', justifyContent: 'center' }}>
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  backgroundColor: streaming || question.trim().length === 0 ? colors.ink3 : colors.ink,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
                  <Path
                    d="M8 13V3M3.5 7.5 8 3l4.5 4.5"
                    stroke={colors.paper}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </View>
            </Pressable>
          </View>
        </View>
      ) : null}
    </>
  );

  if (!android) return sheet;
  return (
    <KeyboardAvoidingView behavior="height" style={{ flex: 1 }}>
      {sheet}
    </KeyboardAvoidingView>
  );
}
