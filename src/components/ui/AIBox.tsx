import { Sparkles } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { colors } from '@/theme/tokens';

/** Dark card for AI content. Always marked with the sparkle icon. */
export function AIBox({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <View className="rounded-[18px] bg-ink p-3">
      <View className="flex-row items-center gap-2">
        <Sparkles size={14} color={colors.lime} />
        <Text className="font-i7 text-ap-body text-lime">{title}</Text>
      </View>
      {typeof children === 'string' ? <Text className="mt-1.5 font-i5 text-ap-body text-white">{children}</Text> : children}
    </View>
  );
}
