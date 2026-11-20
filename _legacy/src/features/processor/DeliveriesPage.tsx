import { Download, Euro, Gauge, Scale, ShieldCheck, Wheat } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Card, Pill, StatusSteps } from '@/components/ui';
import { DELIVERY_STEPS, season, type Delivery } from '@/data/mock';
import { euroPrice, euroTotal } from '@/lib/market';
import { activeDeliveries, completedDeliveries, deliveryLabel, deliveryTotal, farmersBoughtFrom, offerTotal, seasonStats, varietyLabel, weighedTons, type BoughtFrom } from '@/lib/processor';
import { useStore } from '@/state/store';
import { colors } from '@/theme/tokens';
import { Amount, Dialog, Initials, initialsOf, PageHeader, Panel, Row, ScoreBox, Segmented, StatCard, TextField, parseNumber } from './kit';
import { NewRequestDialog } from './RequestsPage';

type Tab = 'active' | 'completed';

export function DeliveriesPage() {
  const deliveries = useStore((s) => s.deliveries);
  const [tab, setTab] = useState<Tab>('active');
  const active = useMemo(() => activeDeliveries(deliveries), [deliveries]);

  return (
    <View>
      <PageHeader
        title="Deliveries"
        subtitle={tab === 'active' ? 'Accepted lots, from the weighbridge to payment. Farmer names are shown here.' : `What you bought in the ${season} season.`}
        action={
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: 'active', label: 'Active', badge: active.length },
              { value: 'completed', label: 'Completed' },
            ]}
          />
        }
      />
      {tab === 'active' ? <ActiveList deliveries={active} /> : <CompletedView deliveries={deliveries} />}
    </View>
  );
}

function ActiveList({ deliveries }: { deliveries: Delivery[] }) {
  const [weighing, setWeighing] = useState<Delivery | null>(null);
  return (
    <>
      <View className="gap-3">
        {deliveries.length === 0 ? (
          <Card className="items-center p-8">
            <Text className="font-i6 text-ap-body text-muted">No active deliveries. Accepted offers show up here.</Text>
          </Card>
        ) : (
          deliveries.map((d) => <DeliveryCard key={d.id} delivery={d} onWeigh={() => setWeighing(d)} />)
        )}
      </View>
      {weighing ? <WeighbridgeDialog delivery={weighing} onClose={() => setWeighing(null)} /> : null}
    </>
  );
}

function DeliveryCard({ delivery: d, onWeigh }: { delivery: Delivery; onWeigh: () => void }) {
  const advance = useStore((s) => s.advanceDelivery);
  const showToast = useStore((s) => s.showToast);
  const total = deliveryTotal(d);

  return (
    <Card className="p-4">
      <View className="flex-row flex-wrap items-start justify-between gap-3">
        <View className="min-w-[240px] flex-1">
          <Text className="font-i7 text-ap-small tracking-[1px] text-accent">IN PROGRESS</Text>
          <Text className="font-i8 text-ap-card text-ink">{d.farmerName}</Text>
          <Text className="font-i5 text-ap-body text-muted">{`${d.place} · ${varietyLabel(d.variety)}`}</Text>
          <Text className="font-i5 text-ap-body text-muted">{`${d.tons} t · ${euroPrice(d.pricePerKg)}/kg · scheduled ${deliveryLabel(d.scheduledIn)}`}</Text>
        </View>
        <View className="items-end">
          <Text className="font-i8 text-ap-title text-ink">{euroTotal(total)}</Text>
          <Text className="font-i5 text-ap-small text-muted">{d.actualKg ? 'by weighbridge' : 'expected'}</Text>
        </View>
      </View>

      <View className="mt-3 max-w-[760px]">
        <StatusSteps steps={DELIVERY_STEPS} current={d.step} />
      </View>

      <View className="mt-3 flex-row flex-wrap items-center gap-2">
        {d.actualKg ? <Pill tone="neutral">{`Weighed ${d.actualKg.toLocaleString('en-US')} kg`}</Pill> : null}
        {d.labResult ? <Pill tone={d.labResult === 'passed' ? 'good' : 'risk'}>{d.labResult === 'passed' ? 'Lab passed' : 'Lab failed'}</Pill> : null}
        <View className="flex-1" />
        {d.step === 0 ? <Button compact label="Record weighbridge" className="h-10 px-4" icon={<Scale size={16} color="#fff" />} onPress={onWeigh} /> : null}
        {d.step === 2 ? <Button compact label="Mark lab checked" className="h-10 px-4" onPress={() => advance(d.id)} /> : null}
        {d.step === 3 ? <Button compact label="Mark paid" className="h-10 px-4" onPress={() => advance(d.id)} /> : null}
        <Button
          compact
          variant="outline"
          label="Download traceability report"
          className="h-10 px-4"
          icon={<Download size={16} color={colors.ink} />}
          onPress={() => showToast(`Traceability report for ${d.farmerName} downloaded`)}
        />
      </View>
    </Card>
  );
}

/** Paid deliveries of the season: totals, the list, and the farmers bought from. */
function CompletedView({ deliveries }: { deliveries: Delivery[] }) {
  const showToast = useStore((s) => s.showToast);
  const [requestFor, setRequestFor] = useState<BoughtFrom | null>(null);
  const completed = useMemo(() => completedDeliveries(deliveries), [deliveries]);
  const stats = useMemo(() => seasonStats(deliveries, season), [deliveries]);
  const farmers = useMemo(() => farmersBoughtFrom(completed), [completed]);

  return (
    <View>
      <View className="flex-row flex-wrap gap-3">
        <StatCard compact label="Tonnes bought" value={`${stats.tons} t`} hint={`${stats.deliveries} deliveries`} icon={<Wheat size={16} color={colors.ink} />} />
        <StatCard compact label="Total spent" value={euroTotal(stats.spent)} hint={`Season ${season}`} icon={<Euro size={16} color={colors.ink} />} />
        <StatCard compact label="Average quality score" value={stats.deliveries ? `${stats.avgScore}` : '–'} hint="Of the lots you bought" icon={<Gauge size={16} color={colors.ink} />} />
        <StatCard compact label="No banned products" value={stats.deliveries ? `${stats.cleanShare}%` : '–'} hint="Share of lots" icon={<ShieldCheck size={16} color={colors.ink} />} />
      </View>

      <View className="mt-5 gap-5">
        <View>
          <Panel title="Purchase history" subtitle="Newest first. Totals are rounded to €50.">
            {completed.length === 0 ? (
              <View className="items-center border-t border-line p-6">
                <Text className="font-i6 text-ap-body text-muted">Nothing paid yet. Paid deliveries show up here.</Text>
              </View>
            ) : (
              completed.map((d, i) => (
                <Row
                  key={d.id}
                  first={i === 0}
                  lead={<Initials text={initialsOf(d.farmerName)} />}
                  title={d.farmerName}
                  sub={`${d.place} · ${varietyLabel(d.variety)}`}
                >
                  <View className="w-[76px]">
                    <Text className="font-i7 text-ap-body text-ink">{(d.paidDate ?? '').replace(/ \d{4}$/, '')}</Text>
                    <Text className="font-i5 text-ap-small text-muted">Paid</Text>
                  </View>
                  <View className="w-[64px] items-end">
                    <Text className="font-i7 text-ap-body text-ink">{`${weighedTons(d).toFixed(2)} t`}</Text>
                    <Text className="font-i5 text-ap-small text-muted">weighed</Text>
                  </View>
                  <ScoreBox score={d.score ?? 0} />
                  <View className="w-[84px] items-end">
                    <Amount value={euroPrice(d.pricePerKg)} unit="/kg" />
                    <Text className="font-i5 text-ap-small text-muted">{d.bannedFree === false ? 'Banned product used' : 'No banned products'}</Text>
                  </View>
                  <View className="w-[76px] items-end">
                    <Amount value={euroTotal(deliveryTotal(d))} />
                  </View>
                  <Button compact variant="outline" label="Traceability report" className="h-9 px-3" onPress={() => showToast(`Traceability report for ${d.farmerName} downloaded`)} />
                </Row>
              ))
            )}
          </Panel>
        </View>

        <View>
          <Panel title="Your farmers" subtitle="The farmers you bought from most this season.">
            {farmers.slice(0, 5).map((f, i) => (
              <Row key={f.farmerName} first={i === 0} lead={<Initials text={initialsOf(f.farmerName)} size={40} />} title={f.farmerName} sub={`${f.place} · ${varietyLabel(f.variety)}`}>
                <View className="items-end">
                  <Text className="font-i7 text-ap-body text-ink">{`${f.deliveries} deliver${f.deliveries === 1 ? 'y' : 'ies'}`}</Text>
                </View>
                <ScoreBox score={f.avgScore} />
                <Button compact variant="outline" label="Send request" className="h-9 px-3" onPress={() => setRequestFor(f)} />
              </Row>
            ))}
          </Panel>
        </View>
      </View>

      {requestFor ? (
        <NewRequestDialog open onClose={() => setRequestFor(null)} initial={{ variety: requestFor.variety, region: requestFor.region, farmerName: requestFor.farmerName }} />
      ) : null}
    </View>
  );
}

function WeighbridgeDialog({ delivery: d, onClose }: { delivery: Delivery; onClose: () => void }) {
  const record = useStore((s) => s.recordWeighbridge);
  const [kg, setKg] = useState(`${Math.round(d.tons * 1000)}`);
  const value = parseNumber(kg);
  const valid = value > 0 && value <= 100_000;

  return (
    <Dialog
      open
      onClose={onClose}
      title="Record weighbridge"
      subtitle={`${d.farmerName} · ${d.tons} t agreed`}
      actionLabel="Save weight"
      actionDisabled={!valid}
      onAction={() => {
        record(d.id, Math.round(value));
        onClose();
      }}
    >
      <TextField label="Actual weight" value={kg} onChangeText={setKg} suffix="kg" keyboardType="numeric" />
      <View className="flex-row items-center justify-between rounded-xl bg-soft p-3">
        <Text className="font-i6 text-ap-body text-muted">Total at the agreed price</Text>
        <Text className="font-i8 text-ap-card text-ink">{valid ? euroTotal(offerTotal(value / 1000, d.pricePerKg)) : '–'}</Text>
      </View>
      {!valid ? <Text className="font-i6 text-ap-small text-risk">Enter the weight in kg.</Text> : null}
    </Dialog>
  );
}
