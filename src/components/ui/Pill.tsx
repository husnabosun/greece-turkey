import { Text, View } from 'react-native';

const tones = {
  risk: ['bg-risk-soft', 'text-risk'],
  warn: ['bg-warn-soft', 'text-warn-text'],
  good: ['bg-good-soft', 'text-good'],
  accent: ['bg-accent-soft', 'text-accent'],
  neutral: ['bg-soft', 'text-ink'],
} as const;

export type PillTone = keyof typeof tones;

export function Pill({ tone = 'neutral', children, className = '' }: { tone?: PillTone; children: string; className?: string }) {
  const [bg, fg] = tones[tone];
  return (
    <View className={`h-6 shrink-0 justify-center self-start rounded-full px-2.5 ${bg} ${className}`}>
      <Text className={`font-i7 text-ap-pill ${fg}`}>{children}</Text>
    </View>
  );
}
