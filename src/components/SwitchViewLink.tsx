import { useRouter } from 'expo-router';
import { ArrowLeftRight } from 'lucide-react-native';
import { Platform, Pressable, Text } from 'react-native';
import { useStore } from '@/state/store';
import { colors } from '@/theme/tokens';

/** Web only: back to the landing page, where the demo viewer picks the farmer app or the processor panel. */
export function SwitchViewLink({ className = '', onPress }: { className?: string; onPress?: () => void }) {
  const router = useRouter();
  if (Platform.OS !== 'web') return null;
  return (
    <Pressable
      onPress={() => {
        onPress?.();
        useStore.getState().hideToast();
        router.navigate('/');
      }}
      accessibilityRole="link"
      accessibilityLabel="Switch view"
      className={`h-9 flex-row items-center gap-1.5 rounded-full px-3 hover:bg-white/60 ${className}`}
    >
      <ArrowLeftRight size={14} color={colors.muted} />
      <Text className="font-i6 text-ap-body text-muted">Switch view</Text>
    </Pressable>
  );
}
