import { AppleAuthenticationButton, AppleAuthenticationButtonStyle, AppleAuthenticationButtonType } from 'expo-apple-authentication';
import { useState } from 'react';
import { Dimensions, Platform, Pressable, Text, useColorScheme, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { signInWithApple } from '@/account/apple';
import { authErrorLine, SIGN_IN_UNAVAILABLE } from '@/account/errors';
import { signInWithGoogle } from '@/account/google';
import { useSession } from '@/account/session';
import { supabase } from '@/account/supabase';
import { useColors } from '@/theme/colors';

import { AuthField, AuthSheet, CancelButton, ErrorLine, InkButton, Lead, OrDivider, SheetTitle } from './auth-chrome';

const LEAD =
  'Keep your progress and notes in step on your other devices. Anything already on this phone comes with you. New here? The same steps create your account.';

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function GoogleMark() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18">
      <Path
        fill="#4285F4"
        d="M17.6 9.2c0-.6-.1-1.2-.2-1.7H9v3.3h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.5z"
      />
      <Path fill="#34A853" d="M9 18c2.4 0 4.5-.8 5.9-2.2L12 13.6c-.8.5-1.8.9-3 .9-2.3 0-4.3-1.6-5-3.7H1v2.3A9 9 0 0 0 9 18z" />
      <Path fill="#FBBC05" d="M4 10.8a5.4 5.4 0 0 1 0-3.5V5H1a9 9 0 0 0 0 8.1z" />
      <Path
        fill="#EA4335"
        d="M9 3.6c1.3 0 2.5.5 3.4 1.3L15 2.4A9 9 0 0 0 1 5l3 2.3c.7-2.1 2.7-3.7 5-3.7z"
      />
    </Svg>
  );
}

export function SignInForm({
  onCancel,
  onSent,
  onSignedIn,
}: {
  onCancel: () => void;
  onSent: (email: string) => void;
  onSignedIn: () => void;
}) {
  const colors = useColors();
  const scheme = useColorScheme();
  const session = useSession();
  const android = Platform.OS === 'android';
  const [email, setEmail] = useState('');
  const [line, setLine] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const height = android ? 48 : 50;

  async function apple() {
    if (busy) return;
    setBusy(true);
    setLine(null);
    try {
      const result = await signInWithApple();
      if (result.ok) onSignedIn();
      else if (result.line) setLine(result.line);
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    if (busy) return;
    setBusy(true);
    setLine(null);
    try {
      const result = await signInWithGoogle();
      if (result.ok) onSignedIn();
      else if (result.line) setLine(result.line);
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    const address = email.trim();
    if (!isEmail(address)) {
      setLine('Enter a valid email address.');
      return;
    }
    if (!supabase || busy) return;
    setBusy(true);
    setLine(null);
    try {
      const { error } = await supabase.auth.signInWithOtp({ email: address, options: { shouldCreateUser: true } });
      if (error) {
        setLine(authErrorLine(error));
        return;
      }
      onSent(address);
    } catch (error) {
      setLine(authErrorLine(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthSheet>
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44 }}>
        <SheetTitle>Sign in</SheetTitle>
        <CancelButton onPress={onCancel} />
      </View>
      {session.status === 'unavailable' ? (
        <ErrorLine quiet>{SIGN_IN_UNAVAILABLE}</ErrorLine>
      ) : (
        <>
          <Lead>{LEAD}</Lead>
          {line ? <ErrorLine>{line}</ErrorLine> : null}
          {Platform.OS === 'ios' ? (
            <AppleAuthenticationButton
              buttonType={AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={scheme === 'dark' ? AppleAuthenticationButtonStyle.WHITE : AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={10}
              onPress={() => void apple()}
              style={{ width: Dimensions.get('window').width - 44, height: 50, marginBottom: 10 }}
            />
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
            disabled={busy}
            onPress={() => void google()}
            style={({ pressed }) => ({
              minHeight: height,
              borderRadius: 10,
              borderWidth: 1.5,
              borderColor: colors.ink3,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              marginBottom: 10,
              opacity: pressed ? 0.72 : 1,
            })}>
            <GoogleMark />
            <Text style={{ color: colors.ink, fontSize: android ? 15 : 17, fontWeight: android ? '500' : '600' }}>
              Continue with Google
            </Text>
          </Pressable>
          <OrDivider />
          <AuthField
            label="Email address"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
          />
          <InkButton label="Email me a code" disabled={busy} onPress={() => void send()} />
          <Text style={{ fontSize: 13, lineHeight: 13 * 1.45, color: colors.ink2, marginTop: 12 }}>
            No password. We email a code each time you sign in.
          </Text>
        </>
      )}
    </AuthSheet>
  );
}
