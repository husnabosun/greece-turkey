import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { colors } from '@/theme/tokens';

/** Placeholder for screens that come in later steps. */
export function StubScreen({ title, back = false }: { title: string; back?: boolean }) {
  const router = useRouter();
  return (
    <Screen tabs={!back}>
      <View className="flex-row items-center gap-3">
        {back ? (
          <Pressable onPress={() => router.back()} accessibilityLabel="Back" className="h-11 w-11 items-center justify-center rounded-full border border-line bg-card">
            <ArrowLeft size={20} color={colors.ink} />
          </Pressable>
        ) : null}
        <Text className="font-i8 text-[28px] text-ink">{title}</Text>
      </View>
      <Text className="mt-4 font-i4 text-[15px] text-muted">This screen is coming in the next step.</Text>
    </Screen>
  );
}
