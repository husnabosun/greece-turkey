import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { colors } from '@/theme/tokens';

interface Props {
  title: string;
  subtitle?: string;
  /** Shows a round back button. On tab screens it goes Home when there is nothing to go back to. */
  back?: boolean;
  right?: ReactNode;
}

export function ScreenHeader({ title, subtitle, back = false, right }: Props) {
  const router = useRouter();
  const goBack = () => (router.canGoBack() ? router.back() : router.navigate('/'));
  return (
    <View className="flex-row items-center">
      {back ? (
        <Pressable onPress={goBack} accessibilityLabel="Back" className="mr-3 h-10 w-10 items-center justify-center rounded-full border border-line bg-card">
          <ArrowLeft size={20} color={colors.ink} />
        </Pressable>
      ) : null}
      <View className="flex-1">
        <Text className="font-i8 text-ap-title text-ink">{title}</Text>
        {subtitle ? <Text className="font-i5 text-ap-body text-muted">{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function RoundButton({ children, onPress, label, active = false }: { children: ReactNode; onPress?: () => void; label: string; active?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      className={`h-10 w-10 items-center justify-center rounded-full border ${active ? 'border-ink bg-ink' : 'border-line bg-card'}`}
    >
      {children}
    </Pressable>
  );
}
