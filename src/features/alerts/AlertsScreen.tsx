import { ChevronRight, Info, Settings, Sparkles } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { RoundButton, ScreenHeader } from '@/components/ScreenHeader';
import { Screen } from '@/components/Screen';
import { Button, Card, Pill, type PillTone } from '@/components/ui';
import { alerts, DAYS, forecasts, LOCATION_RISK_PENALTY, type AlertItem, type RiskLevel } from '@/data/mock';
import { useStore } from '@/state/store';
import { colors } from '@/theme/tokens';

type Tab = 'pests' | 'weather' | 'location';
const TABS: { key: Tab; label: string }[] = [
  { key: 'pests', label: 'Pests' },
  { key: 'weather', label: 'Weather' },
  { key: 'location', label: 'Location' },
];

const BAR: Record<RiskLevel, { color: string; height: number; label: string; text: string }> = {
  low: { color: '#D9D8D4', height: 0.22, label: 'Low', text: colors.muted },
  medium: { color: '#EE9A4C', height: 0.62, label: 'Medium', text: '#D9822B' },
  high: { color: '#B3261E', height: 1, label: 'High', text: '#B3261E' },
};

const LEVEL: Record<AlertItem['level'], { dot: string; tone: PillTone | 'grey'; label: string }> = {
  high: { dot: '#B3261E', tone: 'risk', label: 'High' },
  medium: { dot: colors.warn, tone: 'warn', label: 'Medium' },
  low: { dot: colors.good, tone: 'good', label: 'Low' },
  action: { dot: '#6B6B6B', tone: 'grey', label: 'Action needed' },
};

function Forecast({ tab }: { tab: 'pests' | 'weather' }) {
  const showToast = useStore((s) => s.showToast);
  const f = forecasts[tab];
  return (
    <Card className="mt-2 p-3">
      <View className="flex-row items-start justify-between">
        <View>
          <Text className="font-i8 text-ap-card text-ink">{f.title}</Text>
          <Text className="font-i5 text-ap-body text-muted">{f.subtitle}</Text>
        </View>
        <Pressable onPress={() => showToast('Risk is Low, Medium or High for each day')} accessibilityLabel="More info" className="h-8 w-8 items-end">
          <Info size={18} color={colors.muted} />
        </Pressable>
      </View>
      <View className="mt-2 h-[90px] flex-row items-end justify-between">
        {f.levels.map((lv, i) => (
          <View key={DAYS[i]} className="flex-1 items-center">
            <View className="w-8 rounded-md" style={{ height: 90 * BAR[lv].height, backgroundColor: BAR[lv].color }} />
          </View>
        ))}
      </View>
      <View className="flex-row justify-between">
        {f.levels.map((lv, i) => (
          <View key={DAYS[i]} className="flex-1 items-center pt-1">
            <Text className="font-i6 text-ap-small text-ink">{DAYS[i]}</Text>
            <Text className="font-i5 text-[10px]" style={{ color: BAR[lv].text }}>{BAR[lv].label}</Text>
          </View>
        ))}
      </View>
      <View className="mt-2 rounded-lg bg-soft p-2">
        <Text className="font-i5 text-ap-body text-muted">{f.note}</Text>
      </View>
    </Card>
  );
}

function AiLine({ children }: { children: string }) {
  return (
    <View className="mt-1.5 flex-row items-start gap-1.5 rounded-lg bg-soft p-2">
      <Sparkles size={13} color={colors.good} />
      <Text className="flex-1 font-i5 text-ap-small text-ink">{children}</Text>
    </View>
  );
}

function AlertRow({ item, first }: { item: AlertItem; first: boolean }) {
  const lv = LEVEL[item.level];
  const showToast = useStore((s) => s.showToast);
  const done = useStore((s) => s.locationRiskDone);
  const ordered = useStore((s) => s.labTestOrdered);
  const markDone = useStore((s) => s.markLocationRiskDone);
  const orderLab = useStore((s) => s.orderLabTest);
  const isLocation = item.tab === 'location';

  return (
    <View className={`py-2.5 ${first ? '' : 'border-t border-line'}`}>
      <View className="flex-row items-start">
        <View className="mr-2.5 mt-1.5 h-3 w-3 rounded-full" style={{ backgroundColor: isLocation && done ? colors.good : lv.dot }} />
        <View className="flex-1">
          <Text className="font-i8 text-ap-card text-ink">{item.title}</Text>
          <Text className="font-i5 text-ap-body text-muted">{item.where}</Text>
        </View>
        {isLocation && done ? (
          <Pill tone="good">Done</Pill>
        ) : lv.tone === 'grey' ? (
          <View className="h-6 justify-center rounded-full bg-soft px-2.5">
            <Text className="font-i7 text-ap-pill text-ink">{lv.label}</Text>
          </View>
        ) : (
          <Pill tone={lv.tone}>{lv.label}</Pill>
        )}
        {!isLocation ? (
          <Pressable onPress={() => showToast(item.ai)} accessibilityLabel={`${item.title} details`} className="h-6 w-6 items-end justify-center">
            <ChevronRight size={16} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
      <View className="ml-[22px]">
        <Text className="mt-1 font-i5 text-ap-body text-muted">{item.text}</Text>
        <AiLine>{item.ai}</AiLine>
        {isLocation ? (
          <>
            <View className="mt-2 flex-row gap-2">
              <Button compact className="h-10 flex-1" label={done ? 'Done' : 'Mark as done'} onPress={() => !done && markDone()} />
              <Button compact className="h-10 flex-1" variant="outline" label={ordered ? 'Lab test ordered' : 'Order lab test'} onPress={() => !ordered && orderLab()} />
            </View>
            <Text className="mt-1.5 font-i5 text-ap-small text-muted">
              {done ? "Hill's quality score stays the same." : `If no action is taken, Hill's quality score drops by ${LOCATION_RISK_PENALTY}.`}
            </Text>
          </>
        ) : null}
      </View>
    </View>
  );
}

export function AlertsScreen() {
  const showToast = useStore((s) => s.showToast);
  const [tab, setTab] = useState<Tab>('pests');
  const list = alerts.filter((a) => a.tab === tab);

  return (
    <Screen tabs={false}>
      <ScreenHeader
        back
        title="Alerts"
        right={
          <RoundButton label="Alert settings" onPress={() => showToast('Alert settings are coming soon')}>
            <Settings size={18} color={colors.ink} />
          </RoundButton>
        }
      />
      <View className="mt-2.5 h-10 flex-row rounded-full bg-soft p-1">
        {TABS.map((t) => (
          <Pressable key={t.key} onPress={() => setTab(t.key)} accessibilityRole="tab" className={`flex-1 items-center justify-center rounded-full ${tab === t.key ? 'bg-ink' : ''}`}>
            <Text className={`font-i7 text-ap-pill ${tab === t.key ? 'text-white' : 'text-muted'}`}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {tab !== 'location' ? <Forecast tab={tab} /> : null}

      <Text className="mt-3.5 font-i8 text-ap-card text-ink">Recent alerts</Text>
      <View className="mt-1">
        {list.map((a, i) => (
          <AlertRow key={a.id} item={a} first={i === 0} />
        ))}
      </View>
    </Screen>
  );
}
