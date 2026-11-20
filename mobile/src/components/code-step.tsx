import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { authErrorLine, isWrongCode, WRONG_CODE } from '@/account/errors';
import { supabase } from '@/account/supabase';
import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/fonts';

import { AuthField, AuthSheet, BackButton, CancelButton, ErrorLine, PrimaryButton, TextButton } from './auth-chrome';

const RESEND_WAIT_MS = 30_000;

export function CodeStep({
  email,
  onCancel,
  onBack,
  onSignedIn,
}: {
  email: string;
  onCancel: () => void;
  onBack: () => void;
  onSignedIn: () => void;
}) {
  const colors = useColors();
  const [code, setCode] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(true);
  const [sentAck, setSentAck] = useState(false);
  const [lock, setLock] = useState(0);
  const wrong = problem === 'wrong';

  useEffect(() => {
    const id = setTimeout(() => setWaiting(false), RESEND_WAIT_MS);
    return () => clearTimeout(id);
  }, [lock]);

  async function submit() {
    if (!/^\d{6,10}$/.test(code)) {
      setProblem('wrong');
      return;
    }
    if (!supabase || busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
      if (error) {
        setProblem(isWrongCode(error) ? 'wrong' : authErrorLine(error));
        return;
      }
      onSignedIn();
    } catch (error) {
      setProblem(isWrongCode(error) ? 'wrong' : authErrorLine(error));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (waiting || busy || !supabase) return;
    setBusy(true);
    setProblem(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
      if (error) {
        setProblem(authErrorLine(error));
        return;
      }
      setSentAck(true);
      setWaiting(true);
      setLock((value) => value + 1);
    } catch (error) {
      setProblem(authErrorLine(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthSheet>
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44 }}>
        <BackButton label="Back" onPress={onBack} />
        <View style={{ flex: 1 }} />
        <CancelButton onPress={onCancel} />
      </View>
      <Text
        accessibilityRole="header"
        style={{
          fontFamily: fonts.serifSemibold,
          fontSize: 28,
          lineHeight: 28 * 1.15,
          color: colors.ink,
          marginTop: 8,
          marginBottom: 6,
        }}>
        Check your email
      </Text>
      <Text style={{ fontSize: 16, lineHeight: 24, color: colors.ink2, marginBottom: 16 }}>
        We sent a code to {email}. Enter it here; it can be 6 to 10 digits.
      </Text>
      <AuthField
        label="Email code"
        value={code}
        onChangeText={(next) => {
          setCode(next.replace(/\D/g, '').slice(0, 10));
          setProblem(null);
        }}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        bad={wrong}
        code
        autoFocus
        maxLength={10}
      />
      {problem ? <ErrorLine>{wrong ? WRONG_CODE : problem}</ErrorLine> : null}
      <PrimaryButton label="Sign in" disabled={busy} onPress={() => void submit()} />
      {sentAck ? (
        <Text accessibilityLiveRegion="polite" style={{ textAlign: 'center', color: colors.ink2, fontSize: 14, marginTop: 8 }}>
          Sent
        </Text>
      ) : null}
      <TextButton label="Send a new code" disabled={waiting || busy} onPress={() => void resend()} />
      <TextButton label="Use a different email" onPress={onBack} />
    </AuthSheet>
  );
}
