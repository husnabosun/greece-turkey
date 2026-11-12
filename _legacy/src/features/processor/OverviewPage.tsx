import { useRouter } from 'expo-router';
import { ClipboardList, Gauge, Inbox, MapPin, Search, Truck } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { Button, Pill } from '@/components/ui';
import { exchangePrice, type IncomingOffer } from '@/data/mock';
import { euroPrice, euroTotal } from '@/lib/market';
import { avgScore, offerTotal, placeLabel } from '@/lib/processor';
import { useStore } from '@/state/store';
import { colors } from '@/theme/tokens';
import { Amount, LotBadges, LotRow, PageHeader, Panel, ScoreBox, StatCard } from './kit';
import { SupplyOutlook } from './SupplyOutlook';
import { useLotInfo } from './useLotInfo';
import { useLots } from './useLots';

export function OverviewPage() {
  const router = useRouter();
  const lots = useLots();
  const info = useLotInfo();
  const requests = useStore((s) => s.procRequests);
  const incoming = useStore((s) => s.incomingOffers);
  const deliveries = useStore((s) => s.deliveries);
  const accept = useStore((s) => s.acceptIncomingOffer);
  const showToast = useStore((s) => s.showToast);

  const open = incoming.filter((o) => o.status === 'open');
  const rows = open.map((o) => ({ offer: o, lot: lots.find((l) => l.id === o.lotId) })).filter((r): r is { offer: IncomingOffer; lot: NonNullable<typeof r.lot> } => !!r.lot);
  const openRequests = requests.filter((r) => r.filledTons < r.tons).length;
  const thisWeek = deliveries.filter((d) => d.step < 4 && d.scheduledIn >= -7 && d.scheduledIn <= 7).length;

  return (
    <View>
      <PageHeader
        title="Overview"
        subtitle="What needs your attention today."
        action={<Button label="Find olives" icon={<Search size={16} color="#fff" />} onPress={() => router.navigate('/processor/lots')} />}
      />

      <View className="flex-row flex-wrap gap-3">
        <StatCard label="Open requests" value={`${openRequests}`} hint="Waiting for farmers" icon={<ClipboardList size={18} color={colors.ink} />} />
        <StatCard label="Incoming offers" value={`${open.length}`} hint="Waiting for your answer" icon={<Inbox size={18} color={colors.ink} />} />
        <StatCard label="Deliveries this week" value={`${thisWeek}`} hint="Not paid yet" icon={<Truck size={18} color={colors.ink} />} />
        <StatCard label="Average quality score" value={rows.length ? `${avgScore(rows.map((r) => r.lot.score))}` : '–'} hint="Of incoming lots" icon={<Gauge size={18} color={colors.ink} />} />
      </View>

      <View className="mt-5">
        <Panel
          title="Incoming offers"
          subtitle="Farmers who want to sell to you. Names show after you accept."
          right={<Pill tone="neutral">{`Demo price ${euroPrice(exchangePrice.pricePerKg)} /kg`}</Pill>}
        >
          {rows.length === 0 ? (
            <View className="items-center border-t border-line p-6">
              <Text className="font-i6 text-ap-body text-muted">No open offers right now.</Text>
            </View>
          ) : (
            rows.map(({ offer, lot }, i) => (
              <LotRow
                key={offer.id}
                first={i === 0}
                lead={
                  <View className="h-11 w-11 items-center justify-center rounded-xl bg-soft">
                    <MapPin size={20} color={colors.ink} />
                  </View>
                }
                title={placeLabel(lot)}
                sub={`Variety: ${lot.variety} · ${offer.tons} t · ${lot.ha} ha field`}
                badges={<LotBadges badges={info(lot).badges} max={2} />}
                score={<ScoreBox score={lot.score} />}
                value={
                  <>
                    <Amount value={euroPrice(offer.pricePerKg)} unit="/kg" />
                    <Text className="font-i5 text-ap-small text-muted">{`≈ ${euroTotal(offerTotal(offer.tons, offer.pricePerKg))}`}</Text>
                  </>
                }
                actions={
                  <>
                    <Button compact label="Counter" variant="outline" className="h-9 px-4" onPress={() => showToast(`Counter offer sent to ${placeLabel(lot)}`)} />
                    <Button compact label="Accept" className="h-9 px-4" onPress={() => accept(offer.id)} />
                  </>
                }
                onPress={() => router.navigate(`/processor/lots/${lot.id}`)}
              />
            ))
          )}
        </Panel>
      </View>

      <View className="mt-5">
        <SupplyOutlook />
      </View>
      <Text className="mt-3 font-i5 text-ap-small text-muted">{`Demo price is the public exchange price (${exchangePrice.date}). Sample data.`}</Text>
    </View>
  );
}
