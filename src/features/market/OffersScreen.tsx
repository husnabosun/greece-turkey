import { ChevronRight, MapPin, Wallet } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { Button, Card, Pill, SectionHeader } from '@/components/ui';
import { type Offer } from '@/data/mock';
import { euroPrice, euroTotal, offerVerdict, saleTotal } from '@/lib/market';
import { useStore } from '@/state/store';
import { colors } from '@/theme/tokens';
import { InProgressCard, PaidRow } from './SaleCards';
import { FactoryLogo, factoryById, Rating, useFairPrice } from './shared';

export function OffersScreen() {
  const sales = useStore((s) => s.sales);
  const offers = useStore((s) => s.offers);
  const fields = useStore((s) => s.fields);
  const showToast = useStore((s) => s.showToast);

  const inProgress = sales.filter((s) => s.status === 'inProgress');
  const lastPaid = sales.find((s) => s.status === 'paid');
  const open = offers.filter((o) => o.status === 'open');
  const fieldsWithOffers = fields.filter((f) => open.some((o) => o.fieldId === f.id));

  return (
    <Screen topPadding={false}>
      <View className="gap-2">
        {inProgress.map((s) => (
          <InProgressCard key={s.id} sale={s} variant="lab" />
        ))}
      </View>

      {lastPaid ? (
        <Card className="mt-2 border-good/20 bg-good-soft/50">
          <PaidRow
            sale={lastPaid}
            action={
              <Pressable onPress={() => showToast('Wallet is coming soon')} className="h-7 flex-row items-center gap-1 rounded-lg bg-white px-2">
                <Wallet size={14} color={colors.good} />
                <Text className="font-i7 text-ap-small text-good">Go to wallet</Text>
                <ChevronRight size={12} color={colors.good} />
              </Pressable>
            }
          >
            <View className="mt-0.5 flex-row items-center gap-1">
              <MapPin size={11} color={colors.muted} />
              <Text className="font-i5 text-ap-small text-muted">{`Total ${euroTotal(saleTotal(lastPaid.tons, lastPaid.pricePerKg))}`}</Text>
            </View>
          </PaidRow>
        </Card>
      ) : null}

      {fieldsWithOffers.length === 0 ? (
        <>
          <SectionHeader title="Offers" />
          <Card className="mt-2 items-center p-4">
            <Text className="font-i6 text-ap-body text-muted">No open offers right now.</Text>
          </Card>
        </>
      ) : null}

      {fieldsWithOffers.map((f) => (
        <View key={f.id}>
          <SectionHeader title={`Offers for ${f.name}`} />
          <View className="mt-2 gap-2">
            {open
              .filter((o) => o.fieldId === f.id)
              .sort((a, b) => b.pricePerKg - a.pricePerKg)
              .map((o) => (
                <OfferCard key={o.id} offer={o} />
              ))}
          </View>
        </View>
      ))}
    </Screen>
  );
}

function OfferCard({ offer }: { offer: Offer }) {
  const acceptOffer = useStore((s) => s.acceptOffer);
  const showToast = useStore((s) => s.showToast);
  const factory = factoryById(offer.factoryId);
  const { fair } = useFairPrice(offer.fieldId);
  const { label, tone, diff } = offerVerdict(offer.pricePerKg, fair);
  const text = diff === 0 ? 'at fair price' : `${euroPrice(Math.abs(diff))} ${diff > 0 ? 'above' : 'below'} fair`;

  return (
    <Card className="p-3">
      <View className="flex-row items-center">
        <FactoryLogo factory={factory} />
        <View className="ml-2.5 flex-1">
          <Text className="font-i8 text-ap-card text-ink">{factory.name}</Text>
          <Rating value={factory.rating} extra={factory.praise} />
        </View>
        <Text className="font-i8 text-ap-title text-ink">
          {euroPrice(offer.pricePerKg)}
          <Text className="font-i5 text-ap-small text-muted">{' /kg'}</Text>
        </Text>
      </View>
      <View className="mt-2 flex-row items-center justify-between">
        <Pill tone={tone}>{`${label} · ${text}`}</Pill>
        <View className="flex-row gap-2">
          <Button compact label="Counter" variant="outline" className="h-9 px-4" onPress={() => showToast(`Counter offer sent to ${factory.name}`)} />
          <Button compact label="Accept" variant="primary" className="h-9 px-4" onPress={() => acceptOffer(offer.id)} />
        </View>
      </View>
    </Card>
  );
}
