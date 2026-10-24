import { PlusJakartaSans_400Regular } from "@expo-google-fonts/plus-jakarta-sans/400Regular";
import { PlusJakartaSans_500Medium } from "@expo-google-fonts/plus-jakarta-sans/500Medium";
import { PlusJakartaSans_600SemiBold } from "@expo-google-fonts/plus-jakarta-sans/600SemiBold";
import { PlusJakartaSans_700Bold } from "@expo-google-fonts/plus-jakarta-sans/700Bold";
import { PlusJakartaSans_800ExtraBold } from "@expo-google-fonts/plus-jakarta-sans/800ExtraBold";
import { QueryClient,QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { Slot } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator,View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "../../global.css";
import { AppShell } from "../components/AppShell";
import { DataProvider } from "../services/data";
import { ThemeProvider } from "../theme";
const client = new QueryClient({
  defaultOptions: { queries: { staleTime: 30000, retry: 1 } },
});
export default function RootLayout() {
  const [loaded, error] = useFonts({
    JakartaRegular: PlusJakartaSans_400Regular,
    JakartaMedium: PlusJakartaSans_500Medium,
    JakartaSemiBold: PlusJakartaSans_600SemiBold,
    JakartaBold: PlusJakartaSans_700Bold,
    JakartaExtraBold: PlusJakartaSans_800ExtraBold,
  });
  const loading = (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#F7F8FA",
      }}
    >
      <ActivityIndicator color="#5851DB" />
    </View>
  );
  if (!loaded && !error) return loading;
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={client}>
        <ThemeProvider>
          <StatusBar style="auto" />
          <DataProvider fallback={loading}>
            <AppShell>
              <Slot />
            </AppShell>
          </DataProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
