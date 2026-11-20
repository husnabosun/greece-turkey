import { Check, ChevronRight, FlaskConical, Lock } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';
import { Pressable } from 'react-native';
import { Card, StatusSteps } from '@/components/ui';
import { SALE_STEPS, type Sale } from '@/data/mock';
import { euroPrice, euroTotal, saleTotal } from '@/lib/market';
import { useStore } from '@/state/store';
import { colors } from '@/theme/tokens';
import { factoryById } from './shared';

function useFieldName(fieldId: string) {
  return useStore((s) => s.fields.find((f) => f.id === fieldId)?.name ?? '');
}

/** Sale that is not paid yet: route, amount, five steps and a status box. */
export function InProgressCard({ sale, variant }: { sale: Sale; variant: 'lab' | 'safe' }) {
  const showToast = useStore((s) => s.showToast);
  const field = useFieldName(sale.fieldId);
  const factory = factoryById(sale.factoryId);
  const labStep = sale.step >= 3;

  return (
    <Card className="p-3">
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <Text className="font-i7 text-ap-small tracking-[1px] text-accent">IN PROGRESS</Text>
          <Text className="font-i8 text-ap-card text-ink">{`${field} → ${factory.name}`}</Text>
          <Text className="font-i5 text-ap-body text-muted">{`${sale.tons} t · ${euroPrice(sale.pricePerKg)}/kg · ${sale.note}`}</Text>
        </View>
        <View className="items-end">
          <Text className="font-i8 text-ap-title text-ink">{euroTotal(saleTotal(sale.tons, sale.pricePerKg))}</Text>
          <Text className="font-i5 text-ap-small text-muted">you’ll get</Text>
        </View>
      </View>
      <View className="mt-2">
        <StatusSteps steps={SALE_STEPS} current={sale.step} />
      </View>
      {variant === 'lab' ? (
        <Pressable onPress={() => showToast('Lab results are not ready yet')} className="mt-2 flex-row items-center rounded-xl bg-accent-soft p-2.5">
          <FlaskConical size={20} color={colors.accent} />
          <View className="ml-2.5 flex-1">
            <Text className="font-i7 text-ap-body text-ink">{labStep ? 'Lab check in progress' : 'Next: pick-up'}</Text>
            <Text className="font-i5 text-ap-small text-muted">
              {labStep ? 'Payment will be released after the lab results are confirmed.' : 'The factory will contact you to pick up the olives.'}
            </Text>
          </View>
          <ChevronRight size={16} color={colors.muted} />
        </Pressable>
      ) : (
        <View className="mt-2 flex-row items-center rounded-xl bg-accent-soft p-2.5">
          <Lock size={20} color={colors.accent} />
          <View className="ml-2.5 flex-1">
            <Text className="font-i7 text-ap-body text-ink">Your money is safe</Text>
            <Text className="font-i5 text-ap-small text-accent">{`${factory.name} already paid in. Yours after the lab check.`}</Text>
          </View>
        </View>
      )}
    </Card>
  );
}

function CheckCircle({ size = 36 }: { size?: number }) {
  return (
    <View className="items-center justify-center rounded-full bg-good-soft" style={{ width: size, height: size }}>
      <Check size={size / 2} color={colors.good} strokeWidth={2.6} />
    </View>
  );
}

/** Row for a paid sale with a link on the right. */
export function PaidRow({ sale, action, children }: { sale: Sale; action: ReactNode; children?: ReactNode }) {
  const field = useFieldName(sale.fieldId);
  const factory = factoryById(sale.factoryId);
  return (
    <View className="flex-row items-center p-3">
      <CheckCircle />
      <View className="ml-2.5 flex-1">
        <Text className="font-i8 text-ap-body text-ink">{`${field} → ${factory.name}`}</Text>
        <Text className="font-i5 text-ap-small text-muted">{`${sale.tons} t · ${euroPrice(sale.pricePerKg)}/kg · paid ${sale.paidDate}`}</Text>
        {children}
      </View>
      <View className="items-end">
        <Text className="font-i8 text-ap-card text-ink">{euroTotal(saleTotal(sale.tons, sale.pricePerKg))}</Text>
        {action}
      </View>
    </View>
  );
}
