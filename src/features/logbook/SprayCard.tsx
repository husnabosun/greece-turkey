import { Text, View } from 'react-native';
import { Pill } from '@/components/ui';
import { RISK_CONFIG } from '@/lib/risk';
import { rainWithinHours } from '@/lib/weather';
import { useStore } from '@/state/store';
import type { Spray } from '@/data/mock';
import { useT } from '@/state/i18n';
import { colors } from '@/theme/tokens';

/** Rain (mm) in the 24 hours after a spray that is enough to wash it off, or null when we have no weather for that time. */
export function useWashoff(spray: Spray): number | null {
  const w = useStore((s) => s.weather[spray.fieldId]);
  if (!w || spray.banned) return null;
  const mm = rainWithinHours(w, spray.ts, RISK_CONFIG.protection.washoffHours);
  return mm !== null && mm >= RISK_CONFIG.protection.washoffRainMm ? mm : null;
}

export function sprayColor(s: Spray, washoff: number | null) {
  return s.banned ? colors.risk : washoff !== null ? colors.warn : colors.good;
}

export function SprayCard({ spray }: { spray: Spray }) {
  const washoff = useWashoff(spray);
  const t = useT();
  const tone = spray.banned ? 'risk' : washoff !== null ? 'warn' : 'good';
  return (
    <View className={`rounded-[18px] border p-2.5 ${spray.banned ? 'border-[#EDB6A6] bg-risk-soft' : 'border-line bg-card'}`}>
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Text className="font-i8 text-ap-card text-ink">{spray.banned ? t('Banned product used') : spray.product}</Text>
          <Text className="font-i5 text-ap-body text-muted">
            {spray.banned ? `${t(spray.date)} · ${t(spray.area)}` : `${t(spray.date)} · ${t(spray.area)} · ${t(spray.dose)}`}
          </Text>
        </View>
        <Pill tone={tone}>{t(spray.banned ? 'Not allowed' : 'Allowed')}</Pill>
      </View>

      {spray.banned ? (
        <View className="mt-2 rounded-lg bg-[#F8D3C8] p-2">
          <Text className="font-i5 text-ap-body text-risk">{t('This product contains chlorpyrifos, which is banned in the EU. Buyers will see this.')}</Text>
        </View>
      ) : (
        <View className="mt-2 rounded-lg bg-soft px-2 py-1.5">
          <Text className="font-i7 text-ap-body text-good">{spray.tag ? `${t('Approved for olives')} · ${t(spray.tag)}` : t('Approved for olives')}</Text>
          <Text className="font-i5 text-ap-small text-muted">{t('Licence {licence} · Olive · Growth stage {stage}', { licence: spray.licence ?? '', stage: spray.stage ?? '' })}</Text>
        </View>
      )}
      {washoff !== null ? (
        <View className="mt-1.5 rounded-lg bg-warn-soft px-2 py-1.5">
          <Text className="font-i5 text-ap-small text-warn-text">{t('It rained {mm} mm within 24 hours. The spray may have washed off.', { mm: Math.round(washoff) })}</Text>
        </View>
      ) : null}
    </View>
  );
}
