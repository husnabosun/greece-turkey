import { useMemo } from 'react';
import { farmer, lots as otherLots, tonsAvailable, type Lot } from '@/data/mock';
import { buildUserLots } from '@/lib/processor';
import { useStore } from '@/state/store';

/** All lots the processor can see: the demo farmer's fields (live) and the lots of other farmers. Best score first. */
export function useLots(): Lot[] {
  const fields = useStore((s) => s.fields);
  const sprays = useStore((s) => s.sprays);
  const sales = useStore((s) => s.sales);
  const listings = useStore((s) => s.listings);
  return useMemo(() => {
    const own = buildUserLots({ fields, sprays, sales, listings, farmerName: farmer.name, place: farmer.place, defaultTons: tonsAvailable });
    return [...own, ...otherLots].sort((a, b) => b.score - a.score);
  }, [fields, sprays, sales, listings]);
}

export function useLot(id: string | undefined): Lot | undefined {
  const all = useLots();
  return all.find((l) => l.id === id);
}

/** The location a lot is named by while the farmer is hidden: region and field size only. */
export const lotPlace = (l: Lot) => `${l.region} · ${l.ha} ha`;
