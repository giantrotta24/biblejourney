import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SIGN_IN_UNAVAILABLE } from '@/account/errors';
import { signOut, useSession } from '@/account/session';
import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/fonts';

import { BackButton, PrimaryButton } from './auth-chrome';

const KEPT = 'Your progress and notes are kept on this phone.';
const NEXT_UPDATE = 'Your progress and notes are kept on this phone. Syncing with your account arrives in the next update.';
const NEW_HERE = 'Sign in to keep it in step on your other devices. New here? The same steps create your account.';
const SIGN_OUT_NOTE = 'Signing out keeps your progress and notes on this phone.';

function InkBar({ children }: { children: string }) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 8 }}>
      <View style={{ width: 2, height: 14, backgroundColor: colors.ink, marginTop: 4 }} accessibilityElementsHidden />
      <Text style={{ flex: 1, fontSize: 15, lineHeight: 21, color: colors.ink2 }}>{children}</Text>
    </View>
  );
}

export function AccountBody({ onBack, onSignIn }: { onBack: () => void; onSignIn: () => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const signedIn = session.status === 'signed-in';
  const title = signedIn ? (session.email ?? 'Signed in') : 'Not signed in';

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper, paddingTop: insets.top }}>
      <View style={{ height: 44, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 }}>
        <View style={{ flex: 1 }}>
          <BackButton label="More" onPress={onBack} />
        </View>
        <Text accessibilityRole="header" style={{ fontSize: 17, fontWeight: '600', color: colors.ink }}>
          Account
        </Text>
        <View style={{ flex: 1 }} />
      </View>
      {session.status === 'loading' ? null : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}>
          <Text
            accessibilityRole="header"
            style={{
              fontFamily: fonts.serifSemibold,
              fontSize: 24,
              lineHeight: 24 * 1.2,
              color: colors.ink,
              marginTop: 10,
            }}>
            {title}
          </Text>
          <InkBar>{signedIn ? NEXT_UPDATE : KEPT}</InkBar>
          {signedIn ? (
            <>
              <Text
                accessibilityRole="header"
                style={{
                  fontFamily: fonts.serifSemibold,
                  fontSize: 15,
                  lineHeight: 15 * 1.3,
                  color: colors.ink,
                  marginTop: 24,
                  marginBottom: 2,
                }}>
                Signing out
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sign out"
                onPress={() => void signOut()}
                style={{ minHeight: 48, justifyContent: 'center' }}>
                <Text style={{ fontSize: 17, color: colors.ink }}>Sign out</Text>
              </Pressable>
              <Text style={{ fontSize: 14, lineHeight: 14 * 1.4, color: colors.ink2, marginTop: 4 }}>{SIGN_OUT_NOTE}</Text>
            </>
          ) : session.status === 'unavailable' ? (
            <Text style={{ fontSize: 15, lineHeight: 21, color: colors.ink2, marginTop: 14 }}>{SIGN_IN_UNAVAILABLE}</Text>
          ) : (
            <>
              <Text style={{ fontSize: 15, lineHeight: 21, color: colors.ink2, marginTop: 14, marginBottom: 16 }}>{NEW_HERE}</Text>
              <PrimaryButton label="Sign in" onPress={onSignIn} />
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}
