import { Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Pill } from '@/components/ui';
import { requestFill, uniqueSorted, varietyLabel } from '@/lib/processor';
import { lots } from '@/data/mock';
import { useStore } from '@/state/store';
import { ChipGroup, Dialog, Initials, PageHeader, Panel, Row, TextField, parseNumber } from './kit';

const VARIETIES = uniqueSorted(lots.map((l) => l.variety));
const REGIONS = uniqueSorted(lots.map((l) => l.region));
const WINDOWS = ['5–15 Nov', '15–25 Nov', '25 Nov–5 Dec', '5–15 Dec'];
const SCORES = ['70', '75', '80', '85'];

export function RequestsPage() {
  const requests = useStore((s) => s.procRequests);
  const [open, setOpen] = useState(false);

  return (
    <View>
      <PageHeader
        title="My requests"
        subtitle="What you want to buy. Farmers send offers against your request."
        action={<Button label="New request" icon={<Plus size={16} color="#fff" />} onPress={() => setOpen(true)} />}
      />
      <Panel title={`${requests.length} open request${requests.length === 1 ? '' : 's'}`}>
        {requests.map((r, i) => {
          const pct = requestFill(r);
          return (
            <Row
              key={r.id}
              first={i === 0}
              lead={<Initials text={r.variety.slice(0, 2).toLocaleUpperCase('tr-TR')} />}
              title={`${varietyLabel(r.variety)} · ${r.tons} t`}
              sub={`Score ${r.minScore}+ · ${r.window} · Region: ${r.region}${r.noBanned ? ' · no banned products' : ''}`}
            >
              {r.shared ? <Pill tone="accent">Visible to farmers</Pill> : null}
              <View className="w-[260px] max-w-full">
                <View className="mb-1 flex-row items-center justify-between">
                  <Text className="font-i7 text-ap-body text-ink">{`${r.filledTons} of ${r.tons} t`}</Text>
                  <Text className="font-i5 text-ap-body text-muted">{`${r.farmers} farmer${r.farmers === 1 ? '' : 's'}`}</Text>
                </View>
                <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: pct }} className="h-2 overflow-hidden rounded-full bg-soft">
                  <View className="h-2 rounded-full bg-good" style={{ width: `${pct}%` }} />
                </View>
                <Text className="mt-1 font-i5 text-ap-small text-muted">{`${pct}% filled`}</Text>
              </View>
            </Row>
          );
        })}
      </Panel>
      <NewRequestDialog open={open} onClose={() => setOpen(false)} />
    </View>
  );
}

/** `initial` prefills the form, for example from a farmer in "Your farmers". */
export function NewRequestDialog({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: { variety?: string; region?: string; farmerName?: string } }) {
  const createRequest = useStore((s) => s.createRequest);
  const [variety, setVariety] = useState(initial?.variety ?? 'Ayvalık');
  const [tons, setTons] = useState('10');
  const [minScore, setMinScore] = useState('75');
  const [deliveryWindow, setDeliveryWindow] = useState(WINDOWS[1]);
  const [region, setRegion] = useState(initial?.region ?? 'Aydın');
  const [noBanned, setNoBanned] = useState('yes');

  const t = parseNumber(tons);
  const valid = t > 0 && t <= 500;

  const submit = () => {
    createRequest({ variety, tons: t, minScore: Number(minScore), window: deliveryWindow, region, noBanned: noBanned === 'yes' });
    onClose();
  };

  const opts = (list: string[]) => list.map((v) => ({ value: v, label: v }));
  return (
    <Dialog open={open} onClose={onClose} title="New request" subtitle={initial?.farmerName ? `Prefilled for the region and variety of ${initial.farmerName}. Farmers can see it in the farmer app.` : 'Farmers can see it in the farmer app, under Market › Requests.'} actionLabel="Create request" onAction={submit} actionDisabled={!valid}>
      <ChipGroup label="Variety" value={variety} onChange={setVariety} options={opts(VARIETIES)} />
      <TextField label="Tonnes needed" value={tons} onChangeText={setTons} suffix="t" keyboardType="decimal-pad" />
      <ChipGroup label="Minimum quality score" value={minScore} onChange={setMinScore} options={SCORES.map((s) => ({ value: s, label: `${s}+` }))} />
      <ChipGroup label="Delivery window" value={deliveryWindow} onChange={setDeliveryWindow} options={opts(WINDOWS)} />
      <ChipGroup label="Province" value={region} onChange={setRegion} options={opts(REGIONS)} />
      <ChipGroup label="No banned products" value={noBanned} onChange={setNoBanned} options={[{ value: 'yes', label: 'Required' }, { value: 'no', label: 'Not required' }]} />
      {!valid ? <Text className="font-i6 text-ap-small text-risk">Enter the tonnes you need.</Text> : null}
    </Dialog>
  );
}
