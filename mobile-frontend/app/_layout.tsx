import { Stack } from "expo-router";
import WalletProvider from "@/providers/WalletProvider";
import { Slot } from "expo-router";
import { useCallback } from "react";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useColorScheme } from "@/hooks/useColorScheme";
import { QueryClientProvider } from "@tanstack/react-query";
import { useQueryClient } from "@/hooks/useQueryClient";
import { AuthProvider } from "./_auth";
import { useEffect } from "react";
import { SplashScreen as ComponentSplashScreen } from "@/components/SplashScreen";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({});
  const colorScheme = useColorScheme();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return <ComponentSplashScreen />;
  }

  return (
    <WalletProvider>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <Slot />
            <StatusBar style="dark" hidden={false} translucent={false} />
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </WalletProvider>
  );
}
