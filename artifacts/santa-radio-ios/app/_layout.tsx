import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { Cinzel_400Regular, Cinzel_500Medium } from '@expo-google-fonts/cinzel';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SantaAppProvider } from '@/lib/mobile';
import { RadioProvider } from '@/lib/radio';
import { brand } from '@/constants/colors';

SplashScreen.preventAutoHideAsync();
const queryClient = new QueryClient();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Cinzel_400Regular, Cinzel_500Medium });
  useEffect(() => { if (fontsLoaded || fontError) SplashScreen.hideAsync(); }, [fontsLoaded, fontError]);
  if (!fontsLoaded && !fontError) return null;
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <SantaAppProvider>
            <RadioProvider>
              <GestureHandlerRootView style={{ flex: 1, backgroundColor: brand.navyDark }}>
                <KeyboardProvider>
                  <StatusBar style="light" />
                  <Stack screenOptions={{ headerBackTitle: 'Back', contentStyle: { backgroundColor: brand.navyDark } }}>
                    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                  </Stack>
                </KeyboardProvider>
              </GestureHandlerRootView>
            </RadioProvider>
          </SantaAppProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
