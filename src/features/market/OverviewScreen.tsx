import { useRouter } from 'expo-router';
import { ChevronRight, Plus } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { Button, Card, Pill, SectionHeader } from '@/components/ui';
import { factories, type Field } from '@/data/mock';
import { euroPrice, pctAbove } from '@/lib/market';
import { useStore } from '@/state/store';
import { colors } from '@/theme/tokens';
import { FactoryLogo, factoryById, priceRange, Rating, useFairPrice } from './shared';

export function OverviewScreen() {
  const router = useRouter();
  const fields = useStore((s) => s.fields);
  const offers = useStore((s) => s.offers);
  const acceptOffer = useStore((s) => s.acceptOffer);
  const showToast = useStore((s) => s.showToast);

  const open = offers.filter((o) => o.status === 'open');
  const best = open.reduce<(typeof open)[number] | null>((b, o) => (!b || o.pricePerKg > b.pricePerKg ? o : b), null);

  return (
    <Screen topPadding={false}>
      <Pressable onPress={() => router.push('/market/new')} accessibilityRole="button" className="h-14 flex-row items-center rounded-[18px] bg-ink px-3">
        <View className="h-9 w-9 items-center justify-center rounded-full bg-white/15">
          <Plus size={20} color="#fff" />
        </View>
        <Text className="ml-3 flex-1 font-i8 text-ap-card text-white">Sell your olives</Text>
        <View className="h-8 w-8 items-center justify-center rounded-full bg-white">
          <ChevronRight size={18} color={colors.ink} />
        </View>
      </Pressable>

      <SectionHeader title="Best offer" />
      {best ? <BestOffer offerId={best.id} onAccept={() => acceptOffer(best.id)} onCounter={() => showToast('Counter offer sent')} /> : (
        <Card className="mt-2 items-center p-4">
          <Text className="font-i6 text-ap-body text-muted">No open offers right now.</Text>
        </Card>
      )}

      <SectionHeader title="Your fields" />
      <View className="mt-2 flex-row flex-wrap gap-2">
        {fields.map((f) => (
          <FieldPriceCard key={f.id} field={f} />
        ))}
      </View>

      <SectionHeader title="Factories looking to buy" />
      <View className="mt-2 gap-2">
        {factories
          .filter((f) => f.requests && f.kind === 'food-oil')
          .map((f) => (
            <Pressable key={f.id} onPress={() => router.replace('/market/requests')}>
              <Card className="flex-row items-center p-2.5">
                <FactoryLogo factory={f} />
                <View className="ml-2.5 flex-1">
                  <Text className="font-i8 text-ap-card text-ink">{f.name}</Text>
                  <Text className="font-i5 text-ap-body text-muted">{`Needs ${f.needsTons} t`}</Text>
                </View>
                <View className="mr-2 items-center rounded-lg bg-good-soft px-2 py-1">
                  <Text className="font-i5 text-[10px] text-good">Quality score</Text>
                  <Text className="font-i8 text-ap-card text-good">{f.minScore}</Text>
                </View>
                <View className="mr-1 items-center rounded-lg bg-soft px-2 py-1">
                  <Text className="font-i7 text-ap-small text-ink">{priceRange(f)}</Text>
                  <Text className="font-i5 text-[10px] text-muted">/kg</Text>
                </View>
                <ChevronRight size={16} color={colors.muted} />
              </Card>
            </Pressable>
          ))}
      </View>
    </Screen>
  );
}

function BestOffer({ offerId, onAccept, onCounter }: { offerId: string; onAccept: () => void; onCounter: () => void }) {
  const offer = useStore((s) => s.offers.find((o) => o.id === offerId))!;
  const factory = factoryById(offer.factoryId);
  const { fair } = useFairPrice(offer.fieldId);
  const pct = pctAbove(offer.pricePerKg, fair);
  return (
    <Card className="mt-2 p-3">
      <View className="flex-row items-center">
        <FactoryLogo factory={factory} />
        <View className="ml-2.5 flex-1">
          <Text className="font-i8 text-ap-card text-ink">{factory.name}</Text>
          <Rating value={factory.rating} />
        </View>
        <Text className="font-i8 text-ap-title text-ink">
          {euroPrice(offer.pricePerKg)}
          <Text className="font-i5 text-ap-small text-muted">{' /kg'}</Text>
        </Text>
      </View>
      <View className="mt-2 flex-row items-center justify-between">
        <Pill tone={pct >= 0 ? 'good' : 'risk'}>{`${pct >= 0 ? '+' : ''}${pct}% ${pct >= 0 ? 'above' : 'below'} suggested`}</Pill>
        <View className="flex-row gap-2">
          <Button compact label="Counter" variant="outline" className="h-9 px-4" onPress={onCounter} />
          <Button compact label="Accept" className="h-9 px-4" onPress={onAccept} />
        </View>
      </View>
    </Card>
  );
}

function FieldPriceCard({ field }: { field: Field }) {
  const router = useRouter();
  const { fair, hasBanned } = useFairPrice(field.id);
  const openOffers = useStore((s) => s.offers.filter((o) => o.fieldId === field.id && o.status === 'open').length);
  const listing = useStore((s) => s.listings.find((l) => l.fieldId === field.id));
  const low = field.score < 70;

  let action = (
    <Pressable onPress={() => router.push({ pathname: '/market/new', params: { fieldId: field.id } })} className="h-6 flex-row items-center">
      <Text className="font-i7 text-ap-body text-ink">List now</Text>
      <ChevronRight size={14} color={colors.ink} />
    </Pressable>
  );
  if (listing) {
    action = <Text className="font-i7 text-ap-body text-good">{`Listed · ${listing.tons} t`}</Text>;
  } else if (openOffers > 0) {
    action = (
      <Pressable onPress={() => router.replace('/market/offers')} className="h-6 flex-row items-center">
        <Text className="font-i7 text-ap-body text-accent">{`${openOffers} offers`}</Text>
        <ChevronRight size={14} color={colors.accent} />
      </Pressable>
    );
  }

  return (
    <Card className="w-[171px] p-3">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 flex-row items-center gap-1.5 pr-1">
          <View className="h-2 w-2 rounded-full" style={{ backgroundColor: field.color }} />
          <Text numberOfLines={1} className="flex-1 font-i8 text-ap-body text-ink">{field.name}</Text>
        </View>
        <View className={`h-7 w-7 items-center justify-center rounded-full ${low ? 'bg-risk-soft' : 'bg-good-soft'}`}>
          <Text className={`font-i8 text-ap-body ${low ? 'text-risk' : 'text-good'}`}>{field.score}</Text>
        </View>
      </View>
      <Text className="mt-1 font-i8 text-ap-title text-ink">
        {euroPrice(fair)}
        <Text className="font-i5 text-ap-small text-muted">{' /kg'}</Text>
      </Text>
      {hasBanned ? <Text className="font-i7 text-ap-small text-risk">1 issue lowers price</Text> : null}
      <View className="mt-1">{action}</View>
    </Card>
  );
}
