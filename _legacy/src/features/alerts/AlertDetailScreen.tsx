import { useLocalSearchParams } from 'expo-router';
import { Check } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Screen } from '@/components/Screen';
import { Button, Pill, type PillTone } from '@/components/ui';
import { LOCATION_RISK_PENALTY } from '@/data/mock';
import { THREAT_BY_ID, type RiskLevel, type ThreatId } from '@/lib/risk';
import { useRisk } from '@/state/risk';
import { useStore } from '@/state/store';
import { colors } from '@/theme/tokens';
import { FeedbackRow } from './FeedbackRow';

const PILL: Record<RiskLevel, PillTone> = { High: 'risk', Medium: 'warn', Low: 'good' };

/** Details of one alert: why, what to do, and "Was this right?". The Alerts list only shows the short line. */
export function AlertDetailScreen() {
  const { threat, fieldId } = useLocalSearchParams<{ threat: ThreatId; fieldId: string }>();
  const field = useStore((s) => s.fields.find((f) => f.id === fieldId));
  const done = useStore((s) => s.locationRiskDone);
  const ordered = useStore((s) => s.labTestOrdered);
  const markDone = useStore((s) => s.markLocationRiskDone);
  const orderLab = useStore((s) => s.orderLabTest);
  const view = useRisk()[fieldId ?? ''];
  const meta = THREAT_BY_ID[threat];

  if (!field || !view || !meta) {
    return (
      <Screen tabs={false}>
        <ScreenHeader back title="Alert" subtitle="This alert was not found." />
      </Screen>
    );
  }

  // The worst day of the next 3, like the list.
  const a = view.risk[threat].slice(0, 3).reduce((b, x) => (x.score > b.score ? x : b));
  const reasons = a.drivers.filter((d) => !/^(Protected by|Spray on)/.test(d)).slice(0, 2);
  const isLocation = threat === 'location' && (field.locationRisks?.length ?? 0) > 0;

  return (
    <Screen tabs={false}>
      <ScreenHeader back title={meta.name} subtitle={field.name} />

      <View className="mt-3 self-start">
        <Pill tone={PILL[a.level]}>{`${a.level} risk`}</Pill>
      </View>

      <Text className="mt-4 font-i8 text-ap-card text-ink">Why</Text>
      {reasons.map((d) => (
        <Text key={d} className="mt-1 font-i5 text-ap-body text-muted">{`• ${d}`}</Text>
      ))}

      <Text className="mt-4 font-i8 text-ap-card text-ink">What you can do</Text>
      {a.actions.slice(0, 3).map((x) => (
        <View key={x} className="mt-1.5 flex-row items-start gap-1.5">
          <Check size={14} color={colors.good} strokeWidth={3} />
          <Text className="flex-1 font-i5 text-ap-body text-muted">{x}</Text>
        </View>
      ))}

      {isLocation ? (
        <>
          <View className="mt-4 flex-row gap-2">
            <Button compact className="flex-1" label={done ? 'Done' : 'Mark as done'} onPress={() => !done && markDone()} />
            <Button compact className="flex-1" variant="outline" label={ordered ? 'Lab test ordered' : 'Order lab test'} onPress={() => !ordered && orderLab()} />
          </View>
          <Text className="mt-1.5 font-i5 text-ap-small text-muted">
            {done ? `${field.name} keeps its quality score.` : `If no action is taken, ${field.name}'s quality score drops by ${LOCATION_RISK_PENALTY}.`}
          </Text>
        </>
      ) : null}

      <View className="mt-4 border-t border-line pt-2">
        <FeedbackRow fieldId={field.id} assessment={a} />
      </View>
    </Screen>
  );
}
