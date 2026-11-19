import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ProgressProvider } from '@/progress/context';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const scheme = useColorScheme();
  const [loaded, error] = useFonts({
    ArchivoCondensedExtraBold: require('../../assets/fonts/ArchivoCondensed-ExtraBold.ttf'),
    SourceSerif4: require('@expo-google-fonts/source-serif-4/400Regular/SourceSerif4_400Regular.ttf'),
    SourceSerif4Italic: require('@expo-google-fonts/source-serif-4/400Regular_Italic/SourceSerif4_400Regular_Italic.ttf'),
    SourceSerif4Semibold: require('@expo-google-fonts/source-serif-4/600SemiBold/SourceSerif4_600SemiBold.ttf'),
  });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <ProgressProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </ProgressProvider>
    </GestureHandlerRootView>
  );
}
