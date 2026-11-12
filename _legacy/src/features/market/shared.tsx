import { Star } from 'lucide-react-native';
import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { exchangeRanges, factories, farmer, type Factory } from '@/data/mock';
import { hasBannedLast12Months, type ExchangeRange } from '@/lib/market';
import { regionOf } from '@/lib/processor';
import { useStore } from '@/state/store';

export function factoryById(id: string): Factory {
  const f = factories.find((x) => x.id === id);
  if (!f) throw new Error(`Unknown factory ${id}`);
  return f;
}

/** True when a banned product was used on the field in the last 12 months. */
export function useHasBanned(fieldId: string): boolean {
  const sprays = useStore((s) => s.sprays);
  return useMemo(() => hasBannedLast12Months(sprays, fieldId, Date.now()), [sprays, fieldId]);
}

/** Today's exchange range for the farmer's area, or null when there is no exchange data there (for example in Greece). */
export function useExchangeRange(): { area: string; range: ExchangeRange | null } {
  const area = regionOf(farmer.place);
  return { area, range: exchangeRanges[area] ?? null };
}

/** Wordmark in place of a real logo. */
export function FactoryLogo({ factory, size = 52 }: { factory: Factory; size?: number }) {
  const label = factory.initials ?? factory.name;
  return (
    <View className="items-center justify-center rounded-xl bg-good-soft" style={{ width: size, height: size }}>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        className="px-1 font-i8 text-good"
        style={{ fontSize: factory.initials ? size * 0.34 : label.length > 7 ? 9 : label.length > 5 ? 11 : 13 }}
      >
        {label}
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
