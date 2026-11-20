import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { accessToken, DELETE_FAILED, requestAccountDelete } from '@/account/delete';
import { SIGN_IN_UNAVAILABLE } from '@/account/errors';
import { signOut, useSession } from '@/account/session';
import { clearWelcomed } from '@/account/welcome';
import { useNotes } from '@/notes/context';
import { useProgress } from '@/progress/context';
import { accountLine } from '@/sync/copy';
import { useRejectedCount, useRuntime, useSyncStatus } from '@/sync/react';
import { useColors } from '@/theme/colors';
import { fonts } from '@/theme/fonts';
import { useVerses } from '@/verses/context';

import { BackButton, PrimaryButton } from './auth-chrome';
import { InkBar } from './ink-bar';

const NEW_HERE = 'Sign in to keep it in step on your other devices. New here? The same steps create your account.';
const SIGN_OUT_NOTE = 'Signing out keeps your progress and notes on this phone.';
const DELETE_NOTE = 'Deletes your progress and notes from your account and from this phone. You’ll be asked to confirm.';
const DELETE_TITLE = 'Delete your account?';
const DELETE_MESSAGE = 'This deletes your account and clears your progress and notes on this phone. It can’t be undone.';

export function AccountBody({
  onBack,
  onSignIn,
  onDeleted,
}: {
  onBack: () => void;
  onSignIn: () => void;
  onDeleted: () => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const status = useSyncStatus();
  const rejected = useRejectedCount();
  const runtime = useRuntime();
  const { clearDays } = useProgress();
  const { clearVerses } = useVerses();
  const { clearNotes } = useNotes();
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
  const signedIn = session.status === 'signed-in';
  const title = signedIn ? (session.email ?? 'Signed in') : 'Not signed in';

  function confirmDelete() {
    if (deleting) return;
    Alert.alert(DELETE_TITLE, DELETE_MESSAGE, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => runDelete() },
    ]);
  }

  async function runDelete() {
    if (deleting) return;
    setDeleting(true);
    setDeleteError(false);
    const token = await accessToken();
    const ok = token ? await requestAccountDelete(token) : false;
    if (!ok) {
      setDeleting(false);
      setDeleteError(true);
      return;
    }
    await signOut();
    clearDays();
    clearVerses();
    clearNotes();
    await runtime?.sync.clearQueue();
    await clearWelcomed();
    onDeleted();
  }

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
          <InkBar marginTop={8}>{accountLine(signedIn, status, rejected)}</InkBar>
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
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Delete account…"
                accessibilityState={{ disabled: deleting }}
                disabled={deleting}
                onPress={confirmDelete}
                style={{ minHeight: 48, justifyContent: 'center', marginTop: 22, opacity: deleting ? 0.4 : 1 }}>
                <Text style={{ fontSize: 17, color: colors.danger }}>Delete account…</Text>
              </Pressable>
              <Text style={{ fontSize: 14, lineHeight: 14 * 1.4, color: colors.ink2, marginTop: 4 }}>{DELETE_NOTE}</Text>
              {deleteError ? (
                <Text accessibilityLiveRegion="polite" style={{ fontSize: 15, lineHeight: 21, color: colors.ink, marginTop: 12 }}>
                  {DELETE_FAILED}
                </Text>
              ) : null}
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
