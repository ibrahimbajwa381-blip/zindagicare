import { useCallback, useEffect, useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from "@expo-google-fonts/plus-jakarta-sans";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { LocaleProvider } from "@/lib/locale-context";
import { usePushNotifications } from "@/lib/push-notifications";
import { BrandLoadingScreen } from "@/components/ui/brand-loading-screen";
import { colors, fonts } from "@/lib/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

function PushNotificationsGate() {
  const { user } = useAuth();
  usePushNotifications(user);
  return null;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });
  const [ready, setReady] = useState(false);

  const onLayout = useCallback(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync().catch(() => {});
      setReady(true);
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    onLayout();
  }, [onLayout]);

  if (!ready) {
    return <BrandLoadingScreen />;
  }

  return (
    <SafeAreaProvider>
      <LocaleProvider>
        <AuthProvider>
          <PushNotificationsGate />
          <StatusBar style="auto" />
          <Stack
            screenOptions={{
              headerShown: true,
              headerTitleStyle: { fontFamily: fonts.semibold },
              headerTintColor: colors.neutral.foreground,
            }}
          >
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(doctor)" options={{ headerShown: false }} />
          </Stack>
        </AuthProvider>
      </LocaleProvider>
    </SafeAreaProvider>
  );
}
