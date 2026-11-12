import { View } from 'react-native';
import { ScreenHeader } from '@/components/ScreenHeader';

/** Back button, title and three progress dashes. */
export function OnboardingHeader({ title, step }: { title: string; step: 1 | 2 | 3 }) {
  return (
    <ScreenHeader
      back
      title={title}
      right={
        <View className="flex-row gap-1">
          {[1, 2, 3].map((n) => (
            <View key={n} className={`h-1 w-6 rounded-full ${n <= step ? 'bg-ink' : 'bg-line'}`} />
          ))}
        </View>
      }
    />
  );
}
