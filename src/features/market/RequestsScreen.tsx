import { useRouter } from 'expo-router';
import { ArrowRight, ArrowUp, Check, ChevronRight, SlidersHorizontal, Sprout, TrendingUp } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { Card } from '@/components/ui';
import { factories, farmerGroups, marketTrend, PROCESSOR_ID, tonsAvailable, type Factory } from '@/data/mock';
import { euroPrice, euroTotal, roundPrice, roundTotal } from '@/lib/market';
import { requestAsFactory } from '@/lib/processor';
import { localFactory } from '@/lib/profile';
import { useT } from '@/state/i18n';
import { useStore } from '@/state/store';
import { colors } from '@/theme/tokens';
import { FactoryLogo, priceRange, Rating } from './shared';

type FilterKey = 'fits' | 'near' | 'variety' | 'region';
type Filter = { key: FilterKey; label: string };

export function RequestsScreen() {
  const router = useRouter();
  const fields = useStore((s) => s.fields);
  const sprays = useStore((s) => s.sprays);
  const procRequests = useStore((s) => s.procRequests);
  const [active, setActive] = useState<FilterKey[]>(['fits']);
  const farmer = useStore((s) => s.farmer);
  const t = useT();
  // Variety and region filters are the farmer's own: Ayvalık / Aydın in Türkiye, Koroneiki / Messinia in Greece.
  const variety = farmer.varieties[0];
  const FILTERS: Filter[] = [
    { key: 'fits', label: 'Fits my fields' },
    { key: 'near', label: 'Near me' },
    { key: 'variety', label: variety },
    { key: 'region', label: farmer.region },
  ];

  const toggle = (k: FilterKey) => setActive((a) => (a.includes(k) ? a.filter((x) => x !== k) : [...a, k]));

  const hasBanned = (fieldId: string) => sprays.some((s) => s.fieldId === fieldId && s.banned);
  const fieldFits = (f: Factory) => fields.some((fl) => fl.score >= f.minScore && !(f.noBanned && hasBanned(fl.id)));
  const passes = (f: Factory) =>
    (!active.includes('fits') || fieldFits(f)) &&
    (!active.includes('near') || f.km <= 25) &&
    (!active.includes('variety') || f.variety === variety || f.variety === 'any') &&
    (!active.includes('region') || f.region === farmer.region);

  // Requests made in the processor panel come after the factories' own requests.
  const demoBuyer = factories.find((f) => f.id === PROCESSOR_ID)!;
  const all = [
    ...factories.filter((f) => f.requests).map((f) => ({ key: f.id, factory: localFactory(f, farmer) })),
    ...procRequests.filter((r) => r.shared).map((r) => ({ key: r.id, factory: localFactory(requestAsFactory(r, demoBuyer), farmer) })),
  ];
  const shown = all.filter((x) => passes(x.factory));

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
          <Text className="font-i8 text-ap-card text-good">{t('Prices are going up this week')}</Text>
          <Text className="font-i5 text-ap-body text-muted">{t('Factories near you pay {price}/kg on average (+{pct}%)', { price: euroPrice(marketTrend.avgPrice), pct: marketTrend.pct })}</Text>
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
              <Text className={`font-i7 text-ap-pill ${on ? 'text-good' : 'text-ink'}`}>{t(f.label)}</Text>
            </Pressable>
          );
        })}
        <Pressable onPress={() => setActive([])} accessibilityLabel={t('Clear filters')} className="h-[30px] w-[30px] items-center justify-center rounded-full border border-line bg-card">
          <SlidersHorizontal size={14} color={colors.ink} />
        </Pressable>
      </ScrollView>

      <Pressable onPress={() => router.push('/farmer/quality')} className="mt-2 flex-row items-center rounded-[18px] bg-risk-soft p-3">
        <ArrowUp size={20} color={colors.risk} />
        <View className="ml-3 flex-1">
          <Text className="font-i8 text-ap-body text-ink">{t(fitsLowest === 1 ? '{name} (quality score {score}) fits {n} buyer' : '{name} (quality score {score}) fits {n} buyers', { name: lowest.name, score: lowest.score, n: fitsLowest })}</Text>
          <Text className="font-i5 text-ap-small text-muted">{t('Soap & refinery buyers accept lower scores. Reach {score} for {n} more food-oil buyers.', { score: reach, n: better.length })}</Text>
        </View>
        <Text className="font-i7 text-ap-body text-risk">{t('How')}</Text>
        <ChevronRight size={14} color={colors.risk} />
      </Pressable>

      <View className="mt-2 gap-2">
        {shown.length === 0 ? (
          <Card className="items-center p-5">
            <Text className="font-i6 text-ap-body text-muted">{t('No requests match these filters.')}</Text>
          </Card>
        ) : (
          shown.map((x) => <RequestCard key={x.key} factory={x.factory} />)
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
  const t = useT();
  const group = farmerGroups.find((g) => g.factoryId === factory.id);
  const tooSmall = factory.minPerSeller !== undefined && tonsAvailable < factory.minPerSeller;
  const bestField = useStore((s) => {
    const ok = s.fields.filter((f) => f.score >= factory.minScore && !(factory.noBanned && s.sprays.some((sp) => sp.fieldId === f.id && sp.banned)));
    return (ok.length ? ok : s.fields).reduce((a, b) => (b.score > a.score ? b : a)).id;
  });
  const mid = roundPrice((factory.priceLow + factory.priceHigh) / 2);
  const revenue = roundTotal(tonsAvailable * 1000 * mid);

  const tags: ReactNode[] = [
    <Tag key="s">{t('Score {n}+', { n: factory.minScore })}</Tag>,
    factory.variety !== 'any' && factory.minPerSeller ? <Tag key="v">{factory.variety}</Tag> : <Tag key="h">{t('Harvest by {date}', { date: t(factory.harvestBy ?? '') })}</Tag>,
    factory.noBanned ? <Tag key="b">{t('No banned')}</Tag> : null,
    tooSmall ? <Tag key="m" tone="risk" icon={false}>{t('Min. {n} t per seller', { n: factory.minPerSeller ?? 0 })}</Tag> : null,
  ];

  return (
    <Card className="p-3">
      <View className="flex-row items-center">
        <FactoryLogo factory={factory} />
        <View className="ml-2.5 flex-1">
          <Text className="font-i8 text-ap-card text-ink">{factory.name}</Text>
          <Rating value={factory.rating} extra={t('{km} km · needs {n} t', { km: factory.km, n: factory.needsTons ?? 0 })} />
        </View>
        <View className="items-end">
          <Text className="font-i8 text-ap-card text-ink">{priceRange(factory)}</Text>
          <Text className="font-i5 text-ap-small text-muted">/kg</Text>
        </View>
      </View>
      <View className="mt-2 flex-row flex-wrap gap-1.5">{tags}</View>

      {tooSmall && group ? (
        <View className="mt-2 rounded-xl border border-dashed border-good/50 bg-good-soft/40 p-2.5">
          <Text className="font-i7 text-ap-body text-risk">{t('You have {have} t. The minimum is {min} t.', { have: tonsAvailable, min: factory.minPerSeller ?? 0 })}</Text>
          <View className="mt-1.5 flex-row items-center">
            <View className="flex-row">
              {group.initials.map((i, n) => (
                <View key={i} className="h-8 w-8 items-center justify-center rounded-full border-2 border-white" style={{ backgroundColor: group.colors[n], marginLeft: n ? -8 : 0 }}>
                  <Text className="font-i7 text-[10px] text-white">{i}</Text>
                </View>
              ))}
            </View>
            <Text className="ml-2 flex-1 font-i5 text-ap-small text-muted">{t('Combine with {n} nearby farmers to reach {min} t and get a better price.', { n: group.nearby, min: factory.minPerSeller ?? 0 })}</Text>
            <Pressable
              onPress={() => !joined.includes(group.id) && joinGroup(group.id)}
              accessibilityRole="button"
              className={`h-8 items-center justify-center rounded-full px-4 ${joined.includes(group.id) ? 'bg-good-soft' : 'bg-primary'}`}
            >
              <Text className={`font-i7 text-ap-pill ${joined.includes(group.id) ? 'text-good' : 'text-white'}`}>{t(joined.includes(group.id) ? 'Joined' : 'Join')}</Text>
            </Pressable>
          </View>
          <Text className="mt-1.5 font-i5 text-ap-small text-muted">{t('Same variety · similar quality ({q}) · {n} farmers nearby', { q: t(group.quality), n: group.nearby })}</Text>
        </View>
      ) : (
        <View className="mt-2 flex-row items-center rounded-xl bg-soft p-2.5">
          <Sprout size={22} color={colors.ink} />
          <View className="ml-2.5 flex-1">
            <Text className="font-i7 text-ap-body text-ink">{t('Your {n} t can be sold here.', { n: tonsAvailable })}</Text>
            <Text className="font-i5 text-ap-small text-muted">{t('Estimated revenue: ≈ {amount}', { amount: euroTotal(revenue) })}</Text>
          </View>
          <Pressable
            onPress={() => router.push({ pathname: '/farmer/market/new', params: { fieldId: bestField, factoryId: factory.id } })}
            accessibilityRole="button"
            className="h-9 flex-row items-center gap-1 rounded-full bg-ink px-4"
          >
            <Text className="font-i7 text-ap-btn text-white">{t('Offer')}</Text>
            <ArrowRight size={14} color="#fff" />
          </Pressable>
        </View>
      )}
    </Card>
  );
}
