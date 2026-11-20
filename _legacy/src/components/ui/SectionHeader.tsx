import { ChevronRight } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { colors } from '@/theme/tokens';

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View className="mt-3.5 flex-row items-center justify-between">
      <Text className="font-i8 text-ap-card text-ink">{title}</Text>
      {action ? (
        <Pressable onPress={onAction} className="h-6 flex-row items-center justify-center gap-0.5">
          <Text className="font-i5 text-ap-body text-muted">{action}</Text>
          <ChevronRight size={14} color={colors.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}
