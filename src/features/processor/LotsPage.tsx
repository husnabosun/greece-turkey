import { useRouter } from 'expo-router';
import { Check, FlaskConical, Leaf } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Card, Pill } from '@/components/ui';
import { euroPrice } from '@/lib/market';
import { ANY, filterLots, harvestLabel, NO_FILTERS, placeLabel, uniqueSorted, varietyLabel, type LotFilters } from '@/lib/processor';
import { useStore } from '@/state/store';
import { colors } from '@/theme/tokens';
import { Amount, ChipGroup, LotBadges, LotRow, PageHeader, Panel, ScoreBox, Segmented } from './kit';
import { useLotInfo } from './useLotInfo';
import { useLots } from './useLots';

const MIN_SCORES = [
  { value: '0', label: 'Any' },
  { value: '70', label: '70+' },
  { value: '75', label: '75+' },
  { value: '80', label: '80+' },
  { value: '85', label: '85+' },
];

export function LotsPage() {
  const router = useRouter();
  const lots = useLots();
  const info = useLotInfo();
  const sent = useStore((s) => s.sentOffers);
  const offers = useStore((s) => s.offers);
  const listings = useStore((s) => s.listings);
  const [filters, setFilters] = useState<LotFilters>(NO_FILTERS);
  const set = (patch: Partial<LotFilters>) => setFilters((f) => ({ ...f, ...patch }));

  const varieties = useMemo(() => uniqueSorted(lots.map((l) => l.variety)), [lots]);
  const regions = useMemo(() => uniqueSorted(lots.map((l) => l.region)), [lots]);
  const shown = useMemo(() => filterLots(lots, filters, (l) => info(l).advice.suggested), [lots, filters, info]);
  const offerSent = (id: string) => sent.some((o) => o.lotId === id) || offers.some((o) => o.fieldId === id && o.factoryId === 'demo' && o.status === 'open');
  const ask = (id: string) => listings.find((l) => l.fieldId === id)?.pricePerKg;
  const active = filters.variety !== ANY || filters.region !== ANY || filters.minScore > 0 || filters.noBanned || filters.labSuggested || filters.use !== ANY;

  return (
    <View>
      <PageHeader
        title="Find olives"
        subtitle="Lots from farmers with a quality score. Names show after an offer is accepted."
        action={
          <Segmented
            value={filters.use}
            onChange={(use) => set({ use })}
            options={[
              { value: ANY, label: 'All' },
              { value: 'oil', label: 'For oil' },
              { value: 'table', label: 'Table olives' },
            ]}
          />
        }
      />

      <Card className="gap-4 p-4">
        <View className="flex-row flex-wrap gap-x-8 gap-y-4">
          <ChipGroup label="Variety" value={filters.variety} onChange={(variety) => set({ variety })} options={[{ value: ANY, label: 'All' }, ...varieties.map((v) => ({ value: v, label: v }))]} />
          <ChipGroup label="Province" value={filters.region} onChange={(region) => set({ region })} options={[{ value: ANY, label: 'All' }, ...regions.map((v) => ({ value: v, label: v }))]} />
        </View>
        <View className="flex-row flex-wrap items-end gap-x-8 gap-y-4">
          <ChipGroup label="Minimum quality score" value={`${filters.minScore}`} onChange={(v) => set({ minScore: Number(v) })} options={MIN_SCORES} />
          <View className="flex-row flex-wrap items-center gap-2">
            <Pressable
              onPress={() => set({ noBanned: !filters.noBanned })}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: filters.noBanned }}
              className={`h-[30px] flex-row items-center gap-1 rounded-full border px-3 ${filters.noBanned ? 'border-good bg-good-soft' : 'border-line bg-card'}`}
            >
              {filters.noBanned ? <Check size={12} color={colors.good} strokeWidth={3} /> : null}
              <Text className={`font-i7 text-ap-pill ${filters.noBanned ? 'text-good' : 'text-ink'}`}>No banned products</Text>
            </Pressable>
            <Pressable
              onPress={() => set({ labSuggested: !filters.labSuggested })}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: filters.labSuggested }}
              className={`h-[30px] flex-row items-center gap-1 rounded-full border px-3 ${filters.labSuggested ? 'border-warn bg-warn-soft' : 'border-line bg-card'}`}
            >
              {filters.labSuggested ? <Check size={12} color={colors.warnText} strokeWidth={3} /> : <FlaskConical size={12} color={colors.ink} />}
              <Text className={`font-i7 text-ap-pill ${filters.labSuggested ? 'text-warn-text' : 'text-ink'}`}>Lab test suggested</Text>
            </Pressable>
            {active ? (
              <Pressable onPress={() => setFilters(NO_FILTERS)} accessibilityRole="button" className="h-[30px] justify-center">
                <Text className="font-i7 text-ap-body text-accent">Clear filters</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Card>

      <View className="mt-5">
        <Panel title={`${shown.length} lot${shown.length === 1 ? '' : 's'}`} subtitle="Best quality score first.">
          {shown.length === 0 ? (
            <View className="items-center border-t border-line p-6">
              <Text className="font-i6 text-ap-body text-muted">No lots match these filters.</Text>
            </View>
          ) : (
            shown.map((l, i) => {
              const price = ask(l.id);
              const { badges } = info(l);
              return (
                <LotRow
                  key={l.id}
                  first={i === 0}
                  lead={
                    <View className="h-11 w-11 items-center justify-center rounded-xl bg-good-soft">
                      <Leaf size={20} color={colors.good} />
                    </View>
                  }
                  title={`${varietyLabel(l.variety)} · ${l.tons} t`}
                  sub={`${placeLabel(l)} · ${l.ha} ha · Harvest ${harvestLabel(l)} · ${l.use === 'oil' ? 'For oil' : 'Table olives'}`}
                  badges={<LotBadges badges={badges} max={2} />}
                  score={<ScoreBox score={l.score} />}
                  value={
                    <>
                      {price ? <Amount value={euroPrice(price)} unit="/kg" /> : <Text className="font-i6 text-ap-body text-muted">Open to offers</Text>}
                      {price ? <Text className="font-i5 text-ap-small text-muted">Farmer’s price</Text> : null}
                    </>
                  }
                  actions={offerSent(l.id) ? <Pill tone="accent">Offer sent</Pill> : null}
                  onPress={() => router.navigate(`/processor/lots/${l.id}`)}
                />
              );
            })
          )}
        </Panel>
      </View>
    </View>
  );
}
