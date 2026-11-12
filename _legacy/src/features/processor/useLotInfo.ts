import { useMemo } from 'react';
import { areas, type Lot } from '@/data/mock';
import { areaDemoWeather, labAdvice, lotBadgeList, lotBadges, lotHasBanned, summarizeRisk, type AreaRisk, type LabAdvice, type LotBadge } from '@/lib/processor';
import { assessField } from '@/lib/risk';
import { useStore } from '@/state/store';

const NO_SIGNALS = { scans: [], sprays: [], locationRisks: [], locationMitigated: false };

/** Pest risk this week per region, from the risk engine and the weather of the region (live, cached or demo). */
export function useAreaRisk(): Record<string, AreaRisk> {
  const areaWeather = useStore((s) => s.areaWeather);
  return useMemo(() => {
    const now = Date.now();
    return Object.fromEntries(areas.map((a) => [a.region, summarizeRisk(assessField(areaWeather[a.region] ?? areaDemoWeather(a, now), NO_SIGNALS, now, 7))]));
  }, [areaWeather]);
}

export interface LotInfo {
  /** All badges of the lot, most important first (Lab test suggested comes first). */
  badges: LotBadge[];
  advice: LabAdvice;
  /** Pest risk this week in the area of the lot. */
  risk: AreaRisk | null;
}

/** Badges and lab test advice of a lot. The lab advice uses the risk of the lot's area, not of the single field. */
export function useLotInfo(): (lot: Lot) => LotInfo {
  const areaRisk = useAreaRisk();
  const deliveries = useStore((s) => s.deliveries);
  return useMemo(
    () => (lot: Lot) => {
      const risk = areaRisk[lot.region] ?? null;
      const advice = labAdvice(lot, risk);
      return { badges: lotBadgeList(lotBadges(lot, deliveries), advice, lotHasBanned(lot)), advice, risk };
    },
    [areaRisk, deliveries],
  );
}
