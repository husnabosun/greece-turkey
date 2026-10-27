import { Check } from 'lucide-react-native';
import { Text, View } from 'react-native';

/** Horizontal stepper. `current` is the index of the active step; earlier steps are done. */
export function StatusSteps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <View className="flex-row">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <View key={label} className="flex-1 items-center">
            <View className="h-6 w-full flex-row items-center justify-center">
              <View className={`h-0.5 flex-1 ${i === 0 ? 'bg-transparent' : i <= current ? 'bg-good' : 'bg-line'}`} />
              <View
                className={`h-6 w-6 items-center justify-center rounded-full ${
                  done ? 'bg-good' : active ? 'border-2 border-good bg-card' : 'bg-soft'
                }`}
              >
                {done ? <Check size={13} color="#fff" strokeWidth={3} /> : null}
              </View>
              <View className={`h-0.5 flex-1 ${i === steps.length - 1 ? 'bg-transparent' : i < current ? 'bg-good' : 'bg-line'}`} />
            </View>
            <Text className={`mt-1 text-ap-small ${active ? 'font-i6 text-ink' : done ? 'font-i6 text-good' : 'font-i4 text-muted'}`}>
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
