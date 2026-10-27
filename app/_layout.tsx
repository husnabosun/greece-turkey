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
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NotificationBanners, PhoneFrame, Toast } from '@/components/ui';

export default function RootLayout() {
  const [loaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold });
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
