import '../global.css';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NotificationBanners, PhoneFrame, Toast } from '@/components/ui';
import { useStore } from '@/state/store';

/** Refresh the weather this often. The weather lib keeps its own 1-hour cache, so most calls are free. */
const WEATHER_REFRESH_MS = 15 * 60 * 1000;

export default function RootLayout() {
  const [loaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold });
  const loadWeather = useStore((s) => s.loadWeather);
  const hydrateFeedback = useStore((s) => s.hydrateFeedback);

  useEffect(() => {
    void hydrateFeedback();
    void loadWeather();
    const t = setInterval(() => void loadWeather(), WEATHER_REFRESH_MS);
    return () => clearInterval(t);
  }, [loadWeather, hydrateFeedback]);

  if (!loaded) return null;

  return (
    <SafeAreaProvider>
      <PhoneFrame>
        <Stack screenOptions={{ headerShown: false, animation: 'fade', animationDuration: 120, contentStyle: { backgroundColor: '#FAFAF8' } }} />
        <Toast />
        <NotificationBanners />
      </PhoneFrame>
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
