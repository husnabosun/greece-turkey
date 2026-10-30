import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, ChevronRight, Info, Settings, Sparkles } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { RoundButton, ScreenHeader } from '@/components/ScreenHeader';
import { Screen } from '@/components/Screen';
import { AiTag, Card, FieldChips, Pill, type PillTone } from '@/components/ui';
import type { Field } from '@/data/mock';
import { THREAT_BY_ID, threatsInGroup, type Assessment, type RiskLevel, type ThreatGroup } from '@/lib/risk';
import { topAssessments } from '@/lib/ai/mappers';
import { useAdvice } from '@/state/ai';
import { LEVEL_COLOR, useRisk, type FieldRiskView } from '@/state/risk';
import { useActiveField, useStore } from '@/state/store';
import { colors } from '@/theme/tokens';

const TABS: { key: ThreatGroup; label: string }[] = [
  { key: 'pests', label: 'Pests' },
  { key: 'weather', label: 'Weather' },
  { key: 'location', label: 'Location' },
];

const BAR: Record<RiskLevel, { color: string; height: number; text: string }> = {
  Low: { color: '#D9D8D4', height: 0.22, text: colors.muted },
  Medium: { color: '#EE9A4C', height: 0.62, text: '#D9822B' },
  High: { color: '#B3261E', height: 1, text: '#B3261E' },
};
const PILL: Record<RiskLevel, PillTone> = { High: 'risk', Medium: 'warn', Low: 'good' };
const RANK: Record<RiskLevel, number> = { Low: 0, Medium: 1, High: 2 };

const weekday = (day: string, style: 'short' | 'long' = 'short') => new Date(`${day}T12:00:00`).toLocaleDateString('en-GB', { weekday: style });

/** "today", "tomorrow" or the weekday of an assessed day. */
function dayWord(view: FieldRiskView, day: string): string {
  const i = view.weather.days.findIndex((d) => d.date === day);
  if (i === view.weather.todayIndex) return 'today';
  if (i === view.weather.todayIndex + 1) return 'tomorrow';
  return weekday(day, 'long');
}

function updatedText(fetchedAt: number): string {
  const min = Math.max(0, Math.round((Date.now() - fetchedAt) / 60000));
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  return `${Math.round(min / 60)} h ago`;
}

/** Peak assessment of the next 3 days for one threat. */
const peak = (list: Assessment[], days = 3) => list.slice(0, days).reduce((b, a) => (a.score > b.score ? a : b));

function Forecast({ list, threatName, fieldName, view }: { list: Assessment[]; threatName: string; fieldName: string; view: FieldRiskView }) {
  const showToast = useStore((s) => s.showToast);
  const high = list.reduce((b, a) => (a.score > b.score ? a : b));
  const note =
    high.level === 'Low'
      ? 'Low risk all week. Keep your normal checks.'
      : `Highest risk ${dayWord(view, high.day)}${high.drivers[0] ? `: ${high.drivers[0].charAt(0).toLowerCase()}${high.drivers[0].slice(1)}` : ''}.`;
  return (
    <Card className="mt-2 p-3">
      <View className="flex-row items-start justify-between">
        <View>
          <Text className="font-i8 text-ap-card text-ink">7-day forecast</Text>
          <Text className="font-i5 text-ap-body text-muted">{`Biggest risk: ${threatName}`}</Text>
        </View>
        <Pressable onPress={() => showToast('Each bar is the risk for one day: Low, Medium or High')} accessibilityLabel="More info" className="h-8 w-8 items-end">
          <Info size={18} color={colors.muted} />
        </Pressable>
      </View>
      <View className="mt-2 h-[90px] flex-row items-end justify-between">
        {list.map((a) => (
          <View key={a.day} className="flex-1 items-center">
            <View className="w-8 rounded-md" style={{ height: 90 * BAR[a.level].height, backgroundColor: BAR[a.level].color }} />
          </View>
        ))}
      </View>
      <View className="flex-row justify-between">
        {list.map((a) => (
          <View key={a.day} className="flex-1 items-center pt-1">
            <Text className="font-i6 text-ap-small text-ink">{weekday(a.day)}</Text>
            <Text className="font-i5 text-[10px]" style={{ color: BAR[a.level].text }}>{a.level}</Text>
          </View>
        ))}
      </View>
      <Text className="mt-2 font-i5 text-ap-small text-muted">{note}</Text>
    </Card>
  );
}

/** One line in the list, like the PNG: tap to see the details on their own screen. */
function AlertRow({ field, a, first }: { field: Field; a: Assessment; first: boolean }) {
  const router = useRouter();
  const threat = THREAT_BY_ID[a.threat];
  const text = a.drivers.find((d) => !/^(Protected by|Spray on)/.test(d));
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/alert/[threat]', params: { threat: a.threat, fieldId: field.id } })}
      accessibilityRole="link"
      className={`py-3 ${first ? '' : 'border-t border-line'}`}
    >
      <View className="flex-row items-center">
        <View className="mr-2.5 h-3 w-3 rounded-full" style={{ backgroundColor: LEVEL_COLOR[a.level] }} />
        <View className="flex-1">
          <Text className="font-i8 text-ap-card text-ink">{threat.name}</Text>
          <Text className="font-i5 text-ap-body text-muted">{field.name}</Text>
        </View>
        <Pill tone={PILL[a.level]}>{a.level}</Pill>
        <ChevronRight size={16} color={colors.muted} />
      </View>
      {text ? <Text className="ml-[22px] mt-1 font-i5 text-ap-body text-muted">{text}</Text> : null}
    </Pressable>
  );
}

/** The advisor text (✦) for one field: it explains the engine's numbers in the selected language. */
function AdvisorCard({ fieldId, level }: { fieldId: string; level: RiskLevel }) {
  const { advice, loading } = useAdvice(fieldId);
  if (!advice) return null;
  return (
    <Card className="mt-2 p-3">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-1.5">
          <Sparkles size={14} color={colors.good} />
          <Text className="font-i7 text-ap-body text-good">Advisor</Text>
        </View>
        <Pill tone={PILL[level]}>{`${level} risk`}</Pill>
      </View>
      <Text className="mt-1.5 font-i7 text-ap-body text-ink">{advice.summary}</Text>
      {advice.actions.map((x) => (
        <View key={x} className="mt-1.5 flex-row items-start gap-1.5">
          <Check size={14} color={colors.good} strokeWidth={3} />
          <Text className="flex-1 font-i5 text-ap-body text-muted">{x}</Text>
        </View>
      ))}
      <Text className="mt-1.5 font-i5 text-ap-small text-muted">{advice.whyNow}</Text>
      {loading && advice.source === 'demo' ? null : <AiTag source={advice.source} className="mt-2" />}
    </Card>
  );
}

export function AlertsScreen() {
  const showToast = useStore((s) => s.showToast);
  const fields = useStore((s) => s.fields);
  const active = useActiveField();
  const risk = useRisk();
  const params = useLocalSearchParams<{ fieldId?: string; tab?: string }>();
  const [tab, setTab] = useState<ThreatGroup>(TABS.some((t) => t.key === params.tab) ? (params.tab as ThreatGroup) : 'pests');
  const [fieldId, setFieldId] = useState(fields.some((f) => f.id === params.fieldId) ? (params.fieldId as string) : active.id);

  const field = fields.find((f) => f.id === fieldId) ?? fields[0];
  const view = risk[field.id];
  const threats = threatsInGroup(tab);
  const ranked = threats.map((t) => ({ t, p: peak(view.risk[t.id]) })).sort((a, b) => b.p.score - a.p.score);
  const selected = ranked[0].t;
  const alerts = ranked.filter((r) => RANK[r.p.level] >= RANK.Medium);
  const quiet = ranked.filter((r) => RANK[r.p.level] < RANK.Medium);
  const hasLocation = (field.locationRisks?.length ?? 0) > 0;

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

      <View className="mt-2">
        <FieldChips fields={fields} selected={field.id} onSelect={(id) => setFieldId(id)} />
      </View>

      <AdvisorCard fieldId={field.id} level={topAssessments(view.risk)[0].level} />

      <Forecast list={view.risk[selected.id]} threatName={selected.name} fieldName={field.name} view={view} />

      <Text className="mt-2 font-i5 text-ap-small text-muted">
        {`Rule-based forecast from ${view.status === 'demo' ? 'demo' : 'live'} weather · updated ${updatedText(view.weather.fetchedAt)}`}
      </Text>

      <Text className="mt-3.5 font-i8 text-ap-card text-ink">Recent alerts</Text>
      {tab === 'location' && !hasLocation ? (
        <Card className="mt-2 items-center p-4">
          <Text className="font-i6 text-ap-body text-muted">{`No known location risks for ${field.name}.`}</Text>
        </Card>
      ) : alerts.length === 0 ? (
        <Card className="mt-2 items-center p-4">
          <Text className="font-i6 text-ap-body text-good">{`All clear for ${field.name}. No alerts in the next 3 days.`}</Text>
        </Card>
      ) : (
        alerts.map((r, i) => <AlertRow key={r.t.id} field={field} a={r.p} first={i === 0} />)
      )}

      {quiet.length > 0 && !(tab === 'location' && !hasLocation) ? (
        <Text className="mt-2.5 font-i5 text-ap-body text-muted">{`Low risk: ${quiet.map((r) => r.t.name).join(', ')}.`}</Text>
      ) : null}
    </Screen>
  );
}
