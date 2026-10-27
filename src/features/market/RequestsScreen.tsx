import { useRouter } from 'expo-router';
import { ArrowRight, ArrowUp, Check, ChevronRight, SlidersHorizontal, Sprout, TrendingUp } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/ui';
import { factories, farmerGroups, marketTrend, tonsAvailable, type Factory } from '@/data/mock';
import { euroPrice, euroTotal, roundPrice, roundTotal } from '@/lib/market';
import { useStore } from '@/state/store';
import { colors } from '@/theme/tokens';
import { FactoryLogo, priceRange, Rating } from './shared';

type FilterKey = 'fits' | 'near' | 'variety' | 'region';
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'fits', label: 'Fits my fields' },
  { key: 'near', label: 'Near me' },
  { key: 'variety', label: 'Ayvalık' },
  { key: 'region', label: 'Aydın' },
];

export function RequestsScreen() {
  const router = useRouter();
  const fields = useStore((s) => s.fields);
  const sprays = useStore((s) => s.sprays);
  const [active, setActive] = useState<FilterKey[]>(['fits']);

  const toggle = (k: FilterKey) => setActive((a) => (a.includes(k) ? a.filter((x) => x !== k) : [...a, k]));

  const hasBanned = (fieldId: string) => sprays.some((s) => s.fieldId === fieldId && s.banned);
  const fieldFits = (f: Factory) => fields.some((fl) => fl.score >= f.minScore && !(f.noBanned && hasBanned(fl.id)));
  const passes = (f: Factory) =>
    (!active.includes('fits') || fieldFits(f)) &&
    (!active.includes('near') || f.km <= 25) &&
    (!active.includes('variety') || f.variety === 'Ayvalık' || f.variety === 'any') &&
    (!active.includes('region') || f.region === 'Aydın');

  const shown = factories.filter((f) => f.requests && passes(f));

  const lowest = fields.reduce((a, b) => (b.score < a.score ? b : a));
  const fitsLowest = factories.filter((f) => f.minScore <= lowest.score).length;
  const better = factories.filter((f) => f.requests && f.kind === 'food-oil' && f.minScore > lowest.score);
  const reach = Math.max(...better.map((f) => f.minScore));

  return (
    <Screen topPadding={false}>
      <View className="flex-row items-center rounded-[18px] bg-good-soft p-3">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-white">
          <TrendingUp size={20} color={colors.good} />
        </View>
        <View className="ml-3 flex-1">
          <Text className="font-i8 text-ap-card text-good">Prices are going up this week</Text>
          <Text className="font-i5 text-ap-body text-muted">{`Factories near you pay ${euroPrice(marketTrend.avgPrice)}/kg on average (+${marketTrend.pct}%)`}</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5 mt-2" contentContainerClassName="gap-2 px-5">
        {FILTERS.map((f) => {
          const on = active.includes(f.key);
          return (
            <Pressable
              key={f.key}
              onPress={() => toggle(f.key)}
              className={`h-[30px] flex-row items-center gap-1 rounded-full border px-3 ${on ? 'border-good bg-good-soft' : 'border-line bg-card'}`}
            >
              {on ? <Check size={12} color={colors.good} strokeWidth={3} /> : null}
              <Text className={`font-i7 text-ap-pill ${on ? 'text-good' : 'text-ink'}`}>{f.label}</Text>
            </Pressable>
          );
        })}
        <Pressable onPress={() => setActive([])} accessibilityLabel="Clear filters" className="h-[30px] w-[30px] items-center justify-center rounded-full border border-line bg-card">
          <SlidersHorizontal size={14} color={colors.ink} />
        </Pressable>
      </ScrollView>

      <Pressable onPress={() => router.push('/quality')} className="mt-2 flex-row items-center rounded-[18px] bg-risk-soft p-3">
        <ArrowUp size={20} color={colors.risk} />
        <View className="ml-3 flex-1">
          <Text className="font-i8 text-ap-body text-ink">{`${lowest.name} (quality score ${lowest.score}) fits ${fitsLowest} buyer${fitsLowest === 1 ? '' : 's'}`}</Text>
          <Text className="font-i5 text-ap-small text-muted">{`Soap & refinery buyers accept lower scores. Reach ${reach} for ${better.length} more food-oil buyers.`}</Text>
        </View>
        <Text className="font-i7 text-ap-body text-risk">How</Text>
        <ChevronRight size={14} color={colors.risk} />
      </Pressable>

      <View className="mt-2 gap-2">
        {shown.length === 0 ? (
          <Card className="items-center p-5">
            <Text className="font-i6 text-ap-body text-muted">No requests match these filters.</Text>
          </Card>
        ) : (
          shown.map((f) => <RequestCard key={f.id} factory={f} />)
        )}
      </View>
    </Screen>
  );
}

function Tag({ children, tone = 'good', icon = true }: { children: string; tone?: 'good' | 'risk'; icon?: boolean }) {
  return (
    <View className={`h-6 flex-row items-center gap-1 rounded-lg px-2 ${tone === 'good' ? 'bg-good-soft' : 'bg-risk-soft'}`}>
      {icon ? <Check size={12} color={tone === 'good' ? colors.good : colors.risk} strokeWidth={3} /> : null}
      <Text className={`font-i7 text-ap-small ${tone === 'good' ? 'text-good' : 'text-risk'}`}>{children}</Text>
    </View>
  );
}

function RequestCard({ factory }: { factory: Factory }) {
  const router = useRouter();
  const joined = useStore((s) => s.joinedGroups);
  const joinGroup = useStore((s) => s.joinGroup);
  const group = farmerGroups.find((g) => g.factoryId === factory.id);
  const tooSmall = factory.minPerSeller !== undefined && tonsAvailable < factory.minPerSeller;
  const bestField = useStore((s) => {
    const ok = s.fields.filter((f) => f.score >= factory.minScore && !(factory.noBanned && s.sprays.some((sp) => sp.fieldId === f.id && sp.banned)));
    return (ok.length ? ok : s.fields).reduce((a, b) => (b.score > a.score ? b : a)).id;
  });
  const mid = roundPrice((factory.priceLow + factory.priceHigh) / 2);
  const revenue = roundTotal(tonsAvailable * 1000 * mid);

  const tags: ReactNode[] = [
    <Tag key="s">{`Score ${factory.minScore}+`}</Tag>,
    factory.variety === 'Ayvalık' && factory.minPerSeller ? <Tag key="v">{factory.variety}</Tag> : <Tag key="h">{`Harvest by ${factory.harvestBy}`}</Tag>,
    factory.noBanned ? <Tag key="b">No banned</Tag> : null,
    tooSmall ? <Tag key="m" tone="risk" icon={false}>{`Min. ${factory.minPerSeller} t per seller`}</Tag> : null,
  ];

  return (
    <Card className="p-3">
      <View className="flex-row items-center">
        <FactoryLogo factory={factory} />
        <View className="ml-2.5 flex-1">
          <Text className="font-i8 text-ap-card text-ink">{factory.name}</Text>
          <Rating value={factory.rating} extra={`${factory.km} km · needs ${factory.needsTons} t`} />
        </View>
        <View className="items-end">
          <Text className="font-i8 text-ap-card text-ink">{priceRange(factory)}</Text>
          <Text className="font-i5 text-ap-small text-muted">/kg</Text>
        </View>
      </View>
      <View className="mt-2 flex-row flex-wrap gap-1.5">{tags}</View>

      {tooSmall && group ? (
        <View className="mt-2 rounded-xl border border-dashed border-good/50 bg-good-soft/40 p-2.5">
          <Text className="font-i7 text-ap-body text-risk">{`You have ${tonsAvailable} t. The minimum is ${factory.minPerSeller} t.`}</Text>
          <View className="mt-1.5 flex-row items-center">
            <View className="flex-row">
              {group.initials.map((i, n) => (
                <View key={i} className="h-8 w-8 items-center justify-center rounded-full border-2 border-white" style={{ backgroundColor: group.colors[n], marginLeft: n ? -8 : 0 }}>
                  <Text className="font-i7 text-[10px] text-white">{i}</Text>
                </View>
              ))}
            </View>
            <Text className="ml-2 flex-1 font-i5 text-ap-small text-muted">{`Combine with ${group.nearby} nearby farmers to reach ${factory.minPerSeller} t and get a better price.`}</Text>
            <Pressable
              onPress={() => !joined.includes(group.id) && joinGroup(group.id)}
              accessibilityRole="button"
              className={`h-8 items-center justify-center rounded-full px-4 ${joined.includes(group.id) ? 'bg-good-soft' : 'bg-primary'}`}
            >
              <Text className={`font-i7 text-ap-pill ${joined.includes(group.id) ? 'text-good' : 'text-white'}`}>{joined.includes(group.id) ? 'Joined' : 'Join'}</Text>
            </Pressable>
          </View>
          <Text className="mt-1.5 font-i5 text-ap-small text-muted">{`Same variety · similar quality (${group.quality}) · ${group.nearby} farmers nearby`}</Text>
        </View>
      ) : (
        <View className="mt-2 flex-row items-center rounded-xl bg-soft p-2.5">
          <Sprout size={22} color={colors.ink} />
          <View className="ml-2.5 flex-1">
            <Text className="font-i7 text-ap-body text-ink">{`Your ${tonsAvailable} t can be sold here.`}</Text>
            <Text className="font-i5 text-ap-small text-muted">{`Estimated revenue: ≈ ${euroTotal(revenue)}`}</Text>
          </View>
          <Pressable
            onPress={() => router.push({ pathname: '/market/new', params: { fieldId: bestField, factoryId: factory.id } })}
            accessibilityRole="button"
            className="h-9 flex-row items-center gap-1 rounded-full bg-ink px-4"
          >
            <Text className="font-i7 text-ap-btn text-white">Offer</Text>
            <ArrowRight size={14} color="#fff" />
          </Pressable>
        </View>
      )}
    </Card>
  );
}
