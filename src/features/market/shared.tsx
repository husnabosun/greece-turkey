import { Star } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { factories, type Factory } from '@/data/mock';
import { fairPrice } from '@/lib/market';
import { useStore } from '@/state/store';

export function factoryById(id: string): Factory {
  const f = factories.find((x) => x.id === id);
  if (!f) throw new Error(`Unknown factory ${id}`);
  return f;
}

/** Fair price of a field, from its quality score and spray records. */
export function useFairPrice(fieldId: string) {
  const score = useStore((s) => s.fields.find((f) => f.id === fieldId)?.score ?? 0);
  const hasBanned = useStore((s) => s.sprays.some((sp) => sp.fieldId === fieldId && sp.banned));
  return { fair: fairPrice(score, hasBanned), hasBanned, score };
}

/** Wordmark in place of a real logo. */
export function FactoryLogo({ factory, size = 52 }: { factory: Factory; size?: number }) {
  const italic = factory.id === 'kamili';
  return (
    <View className="items-center justify-center rounded-xl bg-good-soft" style={{ width: size, height: size }}>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        className="px-1 font-i8 text-good"
        style={{ fontSize: factory.name.length > 7 ? 9 : factory.name.length > 5 ? 11 : 13, fontStyle: italic ? 'italic' : 'normal' }}
      >
        {factory.id === 'taris' ? factory.name.toLocaleUpperCase('tr-TR') : factory.name}
      </Text>
    </View>
  );
}

export function Rating({ value, extra }: { value: number; extra?: string }) {
  return (
    <View className="flex-row items-center gap-1">
      <Star size={12} color="#F2B731" fill="#F2B731" />
      <Text className="font-i5 text-ap-small text-muted">{extra ? `${value} · ${extra}` : `${value}`}</Text>
    </View>
  );
}

export const priceRange = (f: Factory) => `€${f.priceLow.toFixed(2)}–${f.priceHigh.toFixed(2)}`;
