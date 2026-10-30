import { Star } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { factories, type Factory } from '@/data/mock';
import { useMemo } from 'react';
import { exchangePrice } from '@/data/mock';
import { fairPrice, fittingRequests, hasBannedLast12Months, priceFactors, suggestedRange } from '@/lib/market';
import { useStore } from '@/state/store';

export function factoryById(id: string): Factory {
  const f = factories.find((x) => x.id === id);
  if (!f) throw new Error(`Unknown factory ${id}`);
  return f;
}

/**
 * Fair price of a field: the exchange price, adjusted for quality score, banned products in the last
 * 12 months and the open factory requests that fit the field. `factors` are the lines of "Why this price?".
 */
export function useFairPrice(fieldId: string) {
  const score = useStore((s) => s.fields.find((f) => f.id === fieldId)?.score ?? 0);
  const sprays = useStore((s) => s.sprays);
  return useMemo(() => {
    const hasBanned = hasBannedLast12Months(sprays, fieldId, Date.now());
    const input = { score, hasBanned, fittingRequests: fittingRequests(factories, score, hasBanned), exchange: exchangePrice };
    const fair = fairPrice(input);
    return { fair, range: suggestedRange(fair), factors: priceFactors(input), hasBanned, score };
  }, [score, sprays, fieldId]);
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
