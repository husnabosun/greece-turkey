import { ArrowDown, ArrowUp, Info } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Screen } from '@/components/Screen';
import { Card, FieldChips, Pill, type PillTone } from '@/components/ui';
import type { Breakdown } from '@/data/mock';
import { useActiveField, useStore } from '@/state/store';
import { colors } from '@/theme/tokens';

const ROWS: { key: keyof Breakdown; title: string; hint: string }[] = [
  { key: 'tree', title: 'Tree health', hint: 'Leaf condition and disease status' },
  { key: 'spray', title: 'Safe spraying', hint: 'Recent spray choice and safety compliance' },
  { key: 'harvest', title: 'Harvest timing', hint: 'Timing suitability for harvest' },
  { key: 'records', title: 'Records kept', hint: 'Spray and field records are complete' },
];

function status(value: number): { label: string; tone: PillTone } {
  if (value >= 90) return { label: 'Excellent', tone: 'good' };
  if (value >= 80) return { label: 'Very good', tone: 'good' };
  if (value >= 60) return { label: 'Good', tone: 'good' };
  return { label: 'Needs improvement', tone: 'warn' };
}

function Ring({ score }: { score: number }) {
  const r = 47;
  const c = 2 * Math.PI * r;
  const color = score < 70 ? colors.risk : score < 80 ? colors.warn : colors.good;
  return (
    <View className="h-[120px] w-[120px] items-center justify-center">
      <Svg width={120} height={120} viewBox="0 0 120 120" style={{ position: 'absolute' }}>
        <Circle cx={60} cy={60} r={r} stroke="#EDEDEA" strokeWidth={11} fill="none" />
        <Circle
          cx={60}
          cy={60}
          r={r}
          stroke={color}
          strokeWidth={11}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${(c * score) / 100} ${c}`}
          transform="rotate(-90 60 60)"
        />
      </Svg>
      <Text className="font-i8 text-ap-title text-ink">{`${score}%`}</Text>
      <Text className="font-i5 text-ap-small text-muted">Quality score</Text>
    </View>
  );
}

export function QualityScreen() {
  const field = useActiveField();
  const fields = useStore((s) => s.fields);
  const selectField = useStore((s) => s.selectField);
  const showToast = useStore((s) => s.showToast);
  const answers = useStore((s) => s.feedback.length);
  const down = field.trend.pct < 0;

  return (
    <Screen tabs={false}>
      <ScreenHeader back title="Quality score" />
      <View className="mt-2.5">
        <FieldChips fields={fields} selected={field.id} onSelect={selectField} tone="black" />
      </View>

      <Card className="mt-2 flex-row items-center p-3">
        <Ring score={field.score} />
        <View className="ml-3 flex-1">
          <Text className="font-i5 text-ap-small text-muted">{field.name}</Text>
          <Text className="font-i8 text-ap-card text-ink">Buyers see this score on your listings.</Text>
          <View className={`mt-1.5 flex-row rounded-xl p-2 ${down ? 'bg-risk-soft' : 'bg-good-soft'}`}>
            {down ? <ArrowDown size={16} color={colors.risk} /> : <ArrowUp size={16} color={colors.good} />}
            <View className="ml-1.5 flex-1">
              <Text className={`font-i8 text-ap-body ${down ? 'text-risk' : 'text-good'}`}>{`${Math.abs(field.trend.pct)}% ${down ? 'lower' : 'higher'} than last month`}</Text>
              <Text className="font-i5 text-ap-small text-muted">{field.trend.reason}</Text>
            </View>
          </View>
        </View>
      </Card>

      <Card className="mt-2 p-3">
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <Text className="font-i8 text-ap-card text-ink">Score breakdown</Text>
            <Text className="font-i5 text-ap-body text-muted">These factors show how your score is calculated.</Text>
          </View>
          <Pressable onPress={() => showToast('Each factor counts 25% of your score')} accessibilityLabel="More info" className="h-8 w-8 items-center justify-center">
            <Info size={18} color={colors.muted} />
          </Pressable>
        </View>
        {ROWS.map((row) => {
          const value = field.breakdown[row.key];
          const st = status(value);
          return (
            <View key={row.key} className="mt-2 flex-row items-center border-t border-line pt-2">
              <View className="flex-1">
                <Text className="font-i7 text-ap-body text-ink">{row.title}</Text>
                <Text className="font-i5 text-ap-small text-muted">{row.hint}</Text>
              </View>
              <Text className="mr-2 font-i8 text-ap-card text-ink">{`${value}%`}</Text>
              <View className="w-[108px] items-end">
                <Pill tone={st.tone}>{st.label}</Pill>
              </View>
            </View>
          );
        })}
      </Card>

      <Text className="mt-2 text-center font-i5 text-ap-small text-muted">{`Your feedback helps the forecast learn · ${answers} answer${answers === 1 ? '' : 's'}`}</Text>

      <Card className="mt-2 p-3">
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <Text className="font-i8 text-ap-card text-ink">AI Plan to Increase the Score</Text>
            <Text className="font-i5 text-ap-body text-muted">{`Complete these ${field.plan.length} steps to improve your quality score.`}</Text>
          </View>
          <Pressable onPress={() => showToast('Score gain: the points you win when you finish the step')} accessibilityLabel="Score gain info" className="h-8 flex-row items-center gap-1">
            <Text className="font-i5 text-ap-small text-muted">Score gain</Text>
            <Info size={16} color={colors.muted} />
          </Pressable>
        </View>
        {field.plan.map((step, i) => (
          <View key={step.text} className="mt-2 flex-row items-start border-t border-line pt-2">
            <Text className="w-6 font-i8 text-ap-body text-ink">{`${i + 1}.`}</Text>
            <Text className="flex-1 font-i5 text-ap-body text-ink">{step.text}</Text>
            <Text className="ml-2 font-i8 text-ap-body text-good">{`+${step.points}`}</Text>
          </View>
        ))}
      </Card>
    </Screen>
  );
}
