import { Sparkles } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { colors } from '@/theme/tokens';

/**
 * Card for AI content, marked with the sparkle icon. Light by default: only make an AI card dark
 * when the PNG of that screen shows it dark.
 */
export function AIBox({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <View className="rounded-[18px] border border-line bg-card p-3">
      <View className="flex-row items-center gap-2">
        <Sparkles size={14} color={colors.good} />
        <Text className="font-i7 text-ap-body text-good">{title}</Text>
      </View>
      {typeof children === 'string' ? <Text className="mt-1.5 font-i5 text-ap-body text-ink">{children}</Text> : children}
    </View>
  );
}
