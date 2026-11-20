import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { whenReminderReady } from '@/reminders/client';
import { whenSettingsReady } from '@/settings/client';
import { useColors } from '@/theme/colors';
import { useResolvedScheme } from '@/theme/scheme';

import { ReadingProviders } from './providers';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const scheme = useResolvedScheme();
  const [settingsReady, setSettingsReady] = useState(false);
  const [loaded, error] = useFonts({
    ArchivoCondensedExtraBold: require('../../assets/fonts/ArchivoCondensed-ExtraBold.ttf'),
    SourceSerif4: require('@expo-google-fonts/source-serif-4/400Regular/SourceSerif4_400Regular.ttf'),
    SourceSerif4Italic: require('@expo-google-fonts/source-serif-4/400Regular_Italic/SourceSerif4_400Regular_Italic.ttf'),
    SourceSerif4Semibold: require('@expo-google-fonts/source-serif-4/600SemiBold/SourceSerif4_600SemiBold.ttf'),
  });

  useEffect(() => {
    let live = true;
    void Promise.all([whenSettingsReady(), whenReminderReady()]).then(() => {
      if (live) setSettingsReady(true);
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if ((loaded || error) && settingsReady) void SplashScreen.hideAsync();
  }, [loaded, error, settingsReady]);

  if ((!loaded && !error) || !settingsReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <ReadingProviders>
        <RootStack />
      </ReadingProviders>
    </GestureHandlerRootView>
  );
}

function RootStack() {
  const colors = useColors();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}>
      <Stack.Screen
        name="note/[day]"
        options={{
          presentation: 'formSheet',
          headerShown: false,
          sheetGrabberVisible: true,
        }}
      />
      <Stack.Screen
        name="ask/[day]"
        options={{
          presentation: 'formSheet',
          headerShown: false,
          sheetGrabberVisible: true,
          sheetCornerRadius: Platform.OS === 'android' ? 28 : 12,
          contentStyle: { backgroundColor: colors.paper },
        }}
      />
      <Stack.Screen
        name="sign-in"
        options={{
          presentation: 'formSheet',
          headerShown: false,
          sheetGrabberVisible: true,
          sheetCornerRadius: Platform.OS === 'android' ? 28 : 12,
          contentStyle: { backgroundColor: colors.paper },
        }}
      />
    </Stack>
  );
}
