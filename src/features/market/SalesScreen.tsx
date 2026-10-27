import { ChevronRight, Wallet } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { Card, SectionHeader } from '@/components/ui';
import { euroTotal, saleTotal } from '@/lib/market';
import { useStore } from '@/state/store';
import { colors } from '@/theme/tokens';
import { InProgressCard, PaidRow } from './SaleCards';

export function SalesScreen() {
  const sales = useStore((s) => s.sales);
  const showToast = useStore((s) => s.showToast);

  const inProgress = sales.filter((s) => s.status === 'inProgress');
  const paid = sales.filter((s) => s.status === 'paid');
  const total = (list: typeof sales) => list.reduce((t, s) => t + saleTotal(s.tons, s.pricePerKg), 0);

  return (
    <Screen topPadding={false}>
      <Card className="flex-row items-center p-3">
        <View className="flex-1">
          <Text className="font-i5 text-ap-body text-muted">Paid this season</Text>
          <Text className="font-i8 text-ap-title text-ink">{euroTotal(total(paid))}</Text>
        </View>
        <View className="mx-3 h-9 w-px bg-line" />
        <View className="flex-1">
          <Text className="font-i5 text-ap-body text-muted">On the way</Text>
          <Text className="font-i8 text-ap-title text-good">{euroTotal(total(inProgress))}</Text>
        </View>
        <Pressable onPress={() => showToast('Wallet is coming soon')} className="h-9 flex-row items-center gap-1.5 rounded-full border border-ink px-3">
          <Wallet size={16} color={colors.ink} />
          <Text className="font-i7 text-ap-btn text-ink">Wallet</Text>
        </Pressable>
      </Card>

      <SectionHeader title="In progress" />
      <View className="mt-2 gap-2">
        {inProgress.length === 0 ? (
          <Card className="items-center p-4">
            <Text className="font-i6 text-ap-body text-muted">Nothing on the way right now.</Text>
          </Card>
        ) : (
          inProgress.map((s) => <InProgressCard key={s.id} sale={s} variant="safe" />)
        )}
      </View>

      <SectionHeader title="Completed" action="See all" onAction={() => showToast('That is all your sales so far')} />
      <Card className="mt-2">
        {paid.map((s, i) => (
          <View key={s.id} className={i ? 'border-t border-line' : ''}>
            <PaidRow
              sale={s}
              action={
                <Pressable onPress={() => showToast('Receipt saved to your phone')} className="h-6 flex-row items-center">
                  <Text className="font-i7 text-ap-body text-accent">Receipt</Text>
                  <ChevronRight size={14} color={colors.accent} />
                </Pressable>
              }
            />
          </View>
        ))}
      </Card>
    </Screen>
  );
}
