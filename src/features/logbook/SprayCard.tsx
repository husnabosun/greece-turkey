import { Text, View } from 'react-native';
import { Pill } from '@/components/ui';
import type { Spray } from '@/data/mock';
import { colors } from '@/theme/tokens';

export function sprayColor(s: Spray) {
  return s.banned ? colors.risk : s.note ? colors.warn : colors.good;
}

export function SprayCard({ spray }: { spray: Spray }) {
  const tone = spray.banned ? 'risk' : spray.note ? 'warn' : 'good';
  return (
    <View className={`rounded-[18px] border p-2.5 ${spray.banned ? 'border-[#EDB6A6] bg-risk-soft' : 'border-line bg-card'}`}>
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Text className="font-i8 text-ap-card text-ink">{spray.banned ? 'Banned product used' : spray.product}</Text>
          <Text className="font-i5 text-ap-body text-muted">
            {spray.banned ? `${spray.date} · ${spray.area}` : `${spray.date} · ${spray.area} · ${spray.dose}`}
          </Text>
        </View>
        <Pill tone={tone}>{spray.banned ? 'Not allowed' : 'Allowed'}</Pill>
      </View>

      {spray.banned ? (
        <View className="mt-2 rounded-lg bg-[#F8D3C8] p-2">
          <Text className="font-i5 text-ap-body text-risk">This product contains chlorpyrifos, which is banned in the EU. Buyers will see this.</Text>
        </View>
      ) : (
        <View className="mt-2 rounded-lg bg-soft px-2 py-1.5">
          <Text className="font-i7 text-ap-body text-good">{spray.tag ? `Approved for olives · ${spray.tag}` : 'Approved for olives'}</Text>
          <Text className="font-i5 text-ap-small text-muted">{`Licence ${spray.licence} · Olive · Growth stage ${spray.stage}`}</Text>
        </View>
      )}
      {spray.note ? (
        <View className="mt-1.5 rounded-lg bg-warn-soft px-2 py-1.5">
          <Text className="font-i5 text-ap-small text-warn-text">{spray.note}</Text>
        </View>
      ) : null}
    </View>
  );
}
