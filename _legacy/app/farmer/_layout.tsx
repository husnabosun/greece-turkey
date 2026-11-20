import { Stack } from 'expo-router';
import { NotificationBanners, PhoneFrame, Toast } from '@/components/ui';

/** The farmer app: always inside the phone frame on wide web screens. */
export default function FarmerLayout() {
  return (
    <PhoneFrame>
      <Stack screenOptions={{ headerShown: false, animation: 'fade', animationDuration: 120, contentStyle: { backgroundColor: '#FAFAF8' } }} />
      <Toast />
      <NotificationBanners />
    </PhoneFrame>
  );
}
