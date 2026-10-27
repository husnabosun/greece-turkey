import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowRight, Check, ChevronDown, Minus, Plus, Sparkles, Trees } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Screen } from '@/components/Screen';
import { Button, Card, Pill } from '@/components/ui';
import { tonsAvailable } from '@/data/mock';
import { euroPrice, priceFactors, roundPrice, suggestedRange } from '@/lib/market';
import { useStore } from '@/state/store';
import { colors } from '@/theme/tokens';
import { factoryById, useFairPrice } from './shared';

const PERIODS = ['3–10 Nov', '10–17 Nov', '17–24 Nov'];

export function NewListingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ fieldId?: string; factoryId?: string }>();
  const fields = useStore((s) => s.fields);
  const publishListing = useStore((s) => s.publishListing);

  const request = params.factoryId ? factoryById(params.factoryId) : null;
  const [fieldId, setFieldId] = useState(params.fieldId && fields.some((f) => f.id === params.fieldId) ? params.fieldId : 'river');
  const field = fields.find((f) => f.id === fieldId)!;
  const { fair, hasBanned } = useFairPrice(fieldId);
  const range = suggestedRange(fair);
  const requestPrice = request ? roundPrice((request.priceLow + request.priceHigh) / 2) : null;

  const [tons, setTons] = useState(tonsAvailable);
  const [period, setPeriod] = useState(PERIODS[0]);
  const [negotiable, setNegotiable] = useState(false);
  const [delivery, setDelivery] = useState<'pickup' | 'deliver'>('pickup');
  const [custom, setCustom] = useState<number | null>(requestPrice);
  const price = custom ?? fair;

  const changeField = () => {
    const next = fields[(fields.findIndex((f) => f.id === fieldId) + 1) % fields.length];
    setFieldId(next.id);
    setCustom(null);
  };

  const publish = () => {
    publishListing({ fieldId, tons, pricePerKg: price, period, negotiable, delivery });
    router.replace('/market');
  };

  const low = field.score < 70;

  return (
    <Screen tabs={false}>
      <ScreenHeader
        back
        title="New listing"
        right={
          <View className="flex-row gap-1">
            <View className="h-1 w-6 rounded-full bg-ink" />
            <View className="h-1 w-6 rounded-full bg-ink/70" />
            <View className="h-1 w-6 rounded-full bg-line" />
          </View>
        }
      />

      {request ? (
        <View className="mt-2.5 self-start">
          <Pill tone="good">{`For ${request.name} request · ${euroPrice(request.priceLow)}–${euroPrice(request.priceHigh)}/kg`}</Pill>
        </View>
      ) : null}

      <Label>Field</Label>
      <Card className="flex-row items-center p-3">
        <View className="h-14 w-14 items-center justify-center rounded-[10px] bg-good-soft">
          <Trees size={24} color={colors.good} />
        </View>
        <View className="ml-2.5 flex-1">
          <View className="flex-row items-center justify-between">
            <Text className="font-i8 text-ap-card text-ink">{field.name}</Text>
            <Pressable onPress={changeField} accessibilityRole="button" className="h-6 justify-center">
              <Text className="font-i7 text-ap-body text-accent">Change</Text>
            </Pressable>
          </View>
          <View className="mt-1 flex-row flex-wrap gap-1">
            <Pill tone="neutral">{`${field.variety} variety`}</Pill>
            <Pill tone="neutral">{`${field.trees} trees`}</Pill>
            <Pill tone="good">{field.harvest.ready ? 'Ready to harvest' : 'Safe to harvest'}</Pill>
            <Pill tone={hasBanned ? 'risk' : 'good'}>{hasBanned ? 'Banned product used' : 'No banned products'}</Pill>
          </View>
        </View>
        <View className={`ml-2 items-center rounded-xl px-2.5 py-1.5 ${low ? 'bg-risk-soft' : 'bg-good-soft'}`}>
          <Text className={`font-i6 text-[10px] ${low ? 'text-risk' : 'text-good'}`}>Quality score</Text>
          <Text className={`font-i8 text-ap-title ${low ? 'text-risk' : 'text-good'}`}>{field.score}</Text>
        </View>
      </Card>

      <View className="mt-2 flex-row gap-2">
        <Card className="flex-1 p-3">
          <Text className="font-i5 text-ap-body text-muted">How much?</Text>
          <Stepper
            value={`${tons} t`}
            onMinus={() => setTons((t) => Math.max(0.5, t - 0.5))}
            onPlus={() => setTons((t) => Math.min(25, t + 0.5))}
          />
        </Card>
        <Card className="flex-1 p-3">
          <Text className="font-i5 text-ap-body text-muted">Harvest period</Text>
          <Pressable
            onPress={() => setPeriod(PERIODS[(PERIODS.indexOf(period) + 1) % PERIODS.length])}
            accessibilityRole="button"
            className="mt-1.5 h-10 flex-row items-center justify-between rounded-xl border border-line px-3"
          >
            <Text className="font-i6 text-ap-btn text-ink">{period}</Text>
            <ChevronDown size={16} color={colors.muted} />
          </Pressable>
        </Card>
      </View>

      <Pressable onPress={() => setNegotiable((v) => !v)} accessibilityRole="checkbox" accessibilityState={{ checked: negotiable }} className="mt-2">
        <Card className="h-12 flex-row items-center px-3">
          <View className={`h-5 w-5 items-center justify-center rounded-md border-2 ${negotiable ? 'border-primary bg-primary' : 'border-ink/60'}`}>
            {negotiable ? <Check size={13} color="#fff" strokeWidth={3} /> : null}
          </View>
          <Text className="ml-3 font-i6 text-ap-btn text-ink">Open to negotiation</Text>
        </Card>
      </Pressable>

      <Label>Delivery</Label>
      <View className="h-10 flex-row rounded-xl bg-soft p-1">
        {(
          [
            ['pickup', 'Factory picks up'],
            ['deliver', 'I deliver'],
          ] as const
        ).map(([key, text]) => (
          <Pressable key={key} onPress={() => setDelivery(key)} className={`flex-1 items-center justify-center rounded-lg ${delivery === key ? 'border border-ink bg-white' : ''}`}>
            <Text className={`font-i7 text-ap-body ${delivery === key ? 'text-ink' : 'text-muted'}`}>{text}</Text>
          </Pressable>
        ))}
      </View>

      <Label>Price</Label>
      <Card className="p-3">
        <View className="rounded-xl bg-good-soft p-2.5">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-1.5">
              <Sparkles size={14} color={colors.good} />
              <Text className="font-i8 text-ap-body text-good">AI suggests</Text>
            </View>
            <Text className="font-i8 text-ap-card text-ink">
              {`${euroPrice(range.low)} – ${euroPrice(range.high)}`}
              <Text className="font-i5 text-ap-small text-muted">{' /kg'}</Text>
            </Text>
          </View>
          <Text className="mt-0.5 font-i5 text-ap-small text-muted">Based on your field’s quality score and current market demand.</Text>
        </View>

        <Text className="mb-1.5 mt-2.5 font-i5 text-ap-body text-muted">Your price per kg</Text>
        <View className="h-12 flex-row items-center justify-between rounded-xl border border-line px-2">
          <RoundStep label="Lower price" onPress={() => setCustom(Math.max(0.5, roundPrice(price - 0.05)))}>
            <Minus size={18} color={colors.ink} />
          </RoundStep>
          <Text className="font-i8 text-ap-title text-ink">{euroPrice(price)}</Text>
          <RoundStep label="Raise price" onPress={() => setCustom(roundPrice(price + 0.05))}>
            <Plus size={18} color={colors.ink} />
          </RoundStep>
        </View>
        {price > range.high ? <Text className="mt-1 font-i5 text-ap-small text-warn-text">Above the suggested range. Fewer buyers may answer.</Text> : null}

        <View className="mt-2.5 rounded-xl bg-good-soft p-2.5">
          <Text className="mb-1 font-i8 text-ap-body text-ink">Why this price?</Text>
          {priceFactors(field.score, hasBanned).map((f) => (
            <View key={f.label} className="h-6 flex-row items-center justify-between">
              <Text className="font-i5 text-ap-body text-ink">{f.label}</Text>
              <Text className={`font-i6 text-ap-body ${f.amount ? 'text-good' : 'text-muted'}`}>{`+ ${euroPrice(f.amount)}`}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Button
        className="mt-3 h-12"
        label="Publish listing"
        icon={<ArrowRight size={18} color="#fff" />}
        onPress={publish}
      />
    </Screen>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <Text className="mb-1.5 mt-3 font-i7 text-ap-small uppercase tracking-[1px] text-muted">{children}</Text>;
}

function RoundStep({ children, onPress, label }: { children: ReactNode; onPress: () => void; label: string }) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} className="h-9 w-9 items-center justify-center rounded-full bg-soft">
      {children}
    </Pressable>
  );
}

function Stepper({ value, onMinus, onPlus }: { value: string; onMinus: () => void; onPlus: () => void }) {
  return (
    <View className="mt-1.5 h-10 flex-row items-center justify-between">
      <RoundStep label="Less" onPress={onMinus}>
        <Minus size={16} color={colors.ink} />
      </RoundStep>
      <Text className="font-i8 text-ap-card text-ink">{value}</Text>
      <RoundStep label="More" onPress={onPlus}>
        <Plus size={16} color={colors.ink} />
      </RoundStep>
    </View>
  );
}
