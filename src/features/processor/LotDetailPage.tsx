import { useRouter } from 'expo-router';
import { ArrowLeft, Check, FlaskConical, Lock, TriangleAlert } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button, Card, Chip, Pill } from '@/components/ui';
import { exchangePrice, PROCESSOR_ID, type Lot } from '@/data/mock';
import { breakdownStatus, BREAKDOWN_ROWS } from '@/features/quality/breakdown';
import { euroPrice, euroTotal, roundPrice } from '@/lib/market';
import { DELIVERY_CHOICES, deliveryLabel, expectedOilTons, harvestLabel, lotHasBanned, OIL_YIELD, offerTotal, placeLabel, sprayEuStatus, varietyLabel } from '@/lib/processor';
import { useStore } from '@/state/store';
import { colors } from '@/theme/tokens';
import { Dialog, LabReason, LotBadges, ScoreBox, TextField, parseNumber, useWide } from './kit';
import { SeasonChart } from './SeasonChart';
import { useLotInfo } from './useLotInfo';
import { useLot } from './useLots';

export function LotDetailPage({ id }: { id: string | undefined }) {
  const router = useRouter();
  const wide = useWide();
  const lot = useLot(id);
  const info = useLotInfo();
  const deliveries = useStore((s) => s.deliveries);
  const [offerOpen, setOfferOpen] = useState(false);

  const back = (
    <Pressable onPress={() => router.navigate('/processor/lots')} accessibilityRole="link" className="mb-4 h-10 flex-row items-center gap-1.5 self-start rounded-full border border-line bg-card px-3.5 hover:bg-soft">
      <ArrowLeft size={16} color={colors.ink} />
      <Text className="font-i7 text-ap-body text-ink">Find olives</Text>
    </Pressable>
  );

  if (!lot) {
    return (
      <View>
        {back}
        <Card className="items-center p-8">
          <Text className="font-i8 text-ap-card text-ink">This lot is not available any more.</Text>
          <Text className="mt-1 font-i5 text-ap-body text-muted">Go back and pick another lot.</Text>
        </Card>
      </View>
    );
  }

  // The farmer is shown only after an offer for this lot was accepted.
  const farmerVisible = deliveries.some((d) => d.lotId === lot.id);
  const banned = lotHasBanned(lot);

  return (
    <View>
      {back}
      <View className="mb-5 flex-row flex-wrap items-end justify-between gap-3">
        <View className="min-w-[240px] shrink">
          <Text accessibilityRole="header" className="font-i8 text-[32px] leading-[38px] text-ink">{`${varietyLabel(lot.variety)} · ${lot.tons} t`}</Text>
          <Text className="mt-1 font-i5 text-ap-card text-muted">{`${placeLabel(lot)} · ${lot.ha} ha field · Harvest ${harvestLabel(lot)}`}</Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          {farmerVisible ? null : <Lock size={14} color={colors.muted} />}
          <Text className="font-i6 text-ap-body text-muted">{farmerVisible ? `Farmer: ${lot.farmerName}` : 'Farmer name shows after an offer is accepted'}</Text>
        </View>
      </View>

      <View className="-mt-2 mb-5 gap-1.5">
        <Text className="font-i7 text-ap-small text-muted">BADGES</Text>
        {info(lot).badges.length ? <LotBadges badges={info(lot).badges} /> : <Text className="font-i5 text-ap-body text-muted">No badges yet.</Text>}
      </View>

      <View className={wide ? 'flex-row items-start gap-5' : 'gap-5'}>
        <View className="min-w-0 flex-1 gap-5">
          <Card className="p-4">
            <Text className="font-i8 text-ap-card text-ink">Quality score breakdown</Text>
            <Text className="font-i5 text-ap-body text-muted">The same four factors the farmer sees.</Text>
            {BREAKDOWN_ROWS.map((row) => {
              const value = lot.breakdown[row.key];
              const st = breakdownStatus(value);
              return (
                <View key={row.key} className="mt-2 flex-row items-center border-t border-line pt-2">
                  <View className="flex-1">
                    <Text className="font-i7 text-ap-body text-ink">{row.title}</Text>
                    <Text className="font-i5 text-ap-small text-muted">{row.hint}</Text>
                  </View>
                  <Text className="mr-2 font-i8 text-ap-card text-ink">{`${value}%`}</Text>
                  <View className="w-[120px] items-end">
                    <Pill tone={st.tone}>{st.label}</Pill>
                  </View>
                </View>
              );
            })}
          </Card>

          <Card className="p-4">
            <View className="flex-row flex-wrap items-start justify-between gap-2">
              <View className="min-w-[200px] shrink">
                <Text className="font-i8 text-ap-card text-ink">Spray history</Text>
                <Text className="font-i5 text-ap-body text-muted">Each product is checked against the EU list of approved substances.</Text>
              </View>
              <Pill tone={banned ? 'risk' : 'good'}>{banned ? 'Banned product used' : 'No banned products'}</Pill>
            </View>
            {lot.sprays.length === 0 ? (
              <Text className="mt-3 font-i5 text-ap-body text-muted">No sprays recorded.</Text>
            ) : (
              lot.sprays.map((s, i) => {
                const eu = sprayEuStatus(s);
                return (
                  <View key={`${s.product}-${s.date}-${i}`} className="mt-2 flex-row items-center border-t border-line pt-2">
                    <View className={`h-9 w-9 items-center justify-center rounded-full ${eu.banned ? 'bg-risk-soft' : 'bg-good-soft'}`}>
                      {eu.banned ? <TriangleAlert size={16} color={colors.risk} /> : <Check size={16} color={colors.good} strokeWidth={3} />}
                    </View>
                    <View className="ml-2.5 flex-1">
                      <Text className="font-i7 text-ap-body text-ink">{s.product}</Text>
                      <Text className="font-i5 text-ap-small text-muted">{eu.hits.length ? `${s.date} · ${eu.hits.join(', ')}` : s.date}</Text>
                    </View>
                    <Pill tone={eu.banned ? 'risk' : 'good'}>{eu.banned ? 'Not approved in EU' : 'Approved in EU'}</Pill>
                  </View>
                );
              })
            )}
          </Card>

          <Card className="p-4">
            <Text className="font-i8 text-ap-card text-ink">Season risk history</Text>
            <Text className="mb-3 font-i5 text-ap-body text-muted">How often the weather favoured the main threats in this area.</Text>
            <SeasonChart place={lot.riskPlace} />
          </Card>
        </View>

        <View className={wide ? 'w-[360px] gap-3' : 'gap-3'}>
          <SummaryCard lot={lot} onMakeOffer={() => setOfferOpen(true)} />
        </View>
      </View>

      <MakeOfferDialog lot={lot} open={offerOpen} onClose={() => setOfferOpen(false)} />
    </View>
  );
}

function SummaryCard({ lot, onMakeOffer }: { lot: Lot; onMakeOffer: () => void }) {
  const showToast = useStore((s) => s.showToast);
  const sent = useStore((s) => s.sentOffers.find((o) => o.lotId === lot.id));
  const mine = useStore((s) => s.offers.find((o) => o.fieldId === lot.id && o.factoryId === PROCESSOR_ID && o.status === 'open'));
  const made = sent ?? mine;
  const oil = expectedOilTons(lot.tons, lot.use);
  const { advice } = useLotInfo()(lot);

  const line = (label: string, value: string) => (
    <View className="flex-row items-center justify-between border-t border-line py-2">
      <Text className="font-i5 text-ap-body text-muted">{label}</Text>
      <Text className="font-i7 text-ap-body text-ink">{value}</Text>
    </View>
  );

  return (
    <Card className="p-4">
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <Text className="font-i8 text-ap-card text-ink">Lot summary</Text>
          <Text className="font-i5 text-ap-body text-muted">{lot.use === 'oil' ? 'For oil' : 'Table olives'}</Text>
        </View>
        <ScoreBox score={lot.score} large />
      </View>

      <View className="mt-3">
        {line('Quantity', `${lot.tons} t`)}
        {line('Field size', `${lot.ha} ha`)}
        {line('Variety', lot.variety)}
        {line('Location', placeLabel(lot))}
        {line('Harvest', harvestLabel(lot))}
      </View>

      <View className="mt-1 rounded-xl bg-good-soft p-3">
        <Text className="font-i5 text-ap-small text-good">Expected oil yield</Text>
        <Text className="font-i8 text-ap-title text-good">{lot.use === 'oil' ? `≈ ${oil} t oil` : 'Not for oil'}</Text>
        {lot.use === 'oil' ? <Text className="font-i5 text-ap-small text-muted">{`Estimate: ${Math.round(OIL_YIELD * 100)} % of the olive weight.`}</Text> : null}
      </View>

      <View className="mt-2 flex-row items-center rounded-xl bg-accent-soft p-3">
        <FlaskConical size={20} color={colors.accent} />
        <View className="ml-2.5 flex-1">
          <Text className="font-i7 text-ap-body text-ink">{lot.lab ? (lot.lab.result === 'passed' ? 'Lab result: passed' : 'Lab result: failed') : 'No lab result yet'}</Text>
          <Text className="font-i5 text-ap-small text-muted">{lot.lab ? `${lot.lab.acidity !== undefined ? `Acidity ${lot.lab.acidity} % · ` : ''}${lot.lab.date}` : 'You can ask for a lab test.'}</Text>
        </View>
      </View>

      {advice.suggested ? (
        <View className="mt-2 rounded-xl bg-warn-soft p-3">
          <Text className="font-i7 text-ap-body text-warn-text">Lab test suggested</Text>
          <LabReason reasons={advice.reasons} />
        </View>
      ) : null}

      <View className="mt-3 flex-row items-center justify-between">
        <Text className="font-i5 text-ap-body text-muted">Demo price (public exchange)</Text>
        <Text className="font-i7 text-ap-body text-ink">{`${euroPrice(exchangePrice.pricePerKg)} /kg`}</Text>
      </View>

      {made ? (
        <View className="mt-3 rounded-xl bg-soft p-3">
          <Text className="font-i7 text-ap-body text-ink">{`Your offer: ${euroPrice(made.pricePerKg)}/kg for ${made.tons ?? lot.tons} t`}</Text>
          <Text className="font-i5 text-ap-small text-muted">{`Delivery ${deliveryLabel(made.deliveryIn ?? 5)} · waiting for the farmer`}</Text>
        </View>
      ) : null}

      <View className="mt-3 gap-2">
        <Button label={made ? 'Change offer' : 'Make offer'} onPress={onMakeOffer} />
        <Button label="Request lab test" variant="outline" icon={<FlaskConical size={16} color={colors.ink} />} onPress={() => showToast('Lab test requested')} />
      </View>
      {lot.fieldId ? <Text className="mt-2 font-i5 text-ap-small text-muted">Demo: the farmer sees this offer in the farmer app, under Market › Offers.</Text> : null}
    </Card>
  );
}

function MakeOfferDialog({ lot, open, onClose }: { lot: Lot; open: boolean; onClose: () => void }) {
  const makeOffer = useStore((s) => s.makeOffer);
  const [price, setPrice] = useState(exchangePrice.pricePerKg.toFixed(2));
  const [tons, setTons] = useState(`${lot.tons}`);
  const [days, setDays] = useState<number>(DELIVERY_CHOICES[1]);

  const p = roundPrice(parseNumber(price));
  const t = parseNumber(tons);
  const valid = p >= 0.1 && p <= 5 && t > 0 && t <= lot.tons;

  const submit = () => {
    makeOffer({ lotId: lot.id, tons: t, pricePerKg: p, deliveryIn: days });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} title="Make offer" subtitle={`${varietyLabel(lot.variety)} · ${placeLabel(lot)} · up to ${lot.tons} t`} actionLabel="Send offer" onAction={submit} actionDisabled={!valid}>
      <TextField label="Price per kg" value={price} onChangeText={setPrice} suffix="€ / kg" keyboardType="decimal-pad" />
      <Text className="-mt-1.5 font-i5 text-ap-small text-muted">{`Demo price today: ${euroPrice(exchangePrice.pricePerKg)}/kg. Prices are rounded to €0.05.`}</Text>
      <TextField label="Tonnes" value={tons} onChangeText={setTons} suffix="t" keyboardType="decimal-pad" />
      <View className="gap-1.5">
        <Text className="font-i7 text-ap-small text-muted">DELIVERY DATE</Text>
        <View className="flex-row flex-wrap gap-2">
          {DELIVERY_CHOICES.map((d) => (
            <Chip key={d} tone="black" on={days === d} onPress={() => setDays(d)}>
              <Text className={`font-i7 text-ap-pill ${days === d ? 'text-white' : 'text-ink'}`}>{deliveryLabel(d)}</Text>
            </Chip>
          ))}
        </View>
      </View>
      <View className="flex-row items-center justify-between rounded-xl bg-soft p-3">
        <Text className="font-i6 text-ap-body text-muted">Total</Text>
        <Text className="font-i8 text-ap-card text-ink">{valid ? euroTotal(offerTotal(t, p)) : '–'}</Text>
      </View>
      {!valid ? <Text className="font-i6 text-ap-small text-risk">{`Enter a price and an amount up to ${lot.tons} t.`}</Text> : null}
    </Dialog>
  );
}
