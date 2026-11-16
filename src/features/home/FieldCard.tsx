import { Calendar, Check, Trees } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { Card, Pill, type PillTone } from '@/components/ui';
import type { Field, Level } from '@/data/mock';
import { useT } from '@/state/i18n';
import { colors } from '@/theme/tokens';

const levelTone: Record<Level, PillTone> = { high: 'risk', medium: 'warn', low: 'good', good: 'good' };
const levelLabel: Record<Level, string> = { high: 'High', medium: 'Medium', low: 'Low', good: 'Good' };
const levelDot: Record<Level, string> = { high: colors.risk, medium: colors.warn, low: colors.good, good: colors.good };

export function FieldCard({ field, pest: livePest, onPress }: { field: Field; pest?: { name: string; level: Level }; onPress: () => void }) {
  const t = useT();
  const { harvest } = field;
  const pest = livePest ?? field.pest;
  const low = field.score < 70;
  return (
    <Pressable onPress={onPress} className="w-[236px]">
      <Card className="p-3">
        <View className="flex-row items-center">
          <View className="h-11 w-11 items-center justify-center rounded-[10px] bg-good-soft">
            <Trees size={20} color={colors.good} />
          </View>
          <View className="ml-2.5 flex-1">
            <Text className="font-i8 text-ap-card text-ink">{field.name}</Text>
            <Text className="font-i5 text-ap-small text-muted">{t('{trees} trees · {ha} ha', { trees: field.trees, ha: field.ha })}</Text>
          </View>
          <View className={`h-9 w-9 items-center justify-center rounded-full ${low ? 'bg-risk-soft' : 'bg-good-soft'}`}>
            <Text className={`font-i8 text-ap-body ${low ? 'text-risk' : 'text-good'}`}>{field.score}</Text>
          </View>
        </View>
        <View className="mt-2 gap-1.5">
          <View className="h-6 flex-row items-center gap-2">
            <View className="h-2 w-2 rounded-full" style={{ backgroundColor: levelDot[pest.level] }} />
            <Text className="flex-1 font-i6 text-ap-body text-ink">{t(pest.name)}</Text>
            <Pill tone={levelTone[pest.level]}>{t(levelLabel[pest.level])}</Pill>
          </View>
          <View className="h-6 flex-row items-center gap-2">
            {harvest.ready ? <Check size={14} color={colors.good} strokeWidth={2.6} /> : <Calendar size={14} color={colors.accent} />}
            <Text className="flex-1 font-i6 text-ap-body text-ink">{t(harvest.label)}</Text>
            <Pill tone={harvest.ready ? 'good' : 'accent'}>{t(harvest.badge)}</Pill>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}
