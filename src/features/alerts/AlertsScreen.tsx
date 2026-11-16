import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, ChevronRight, Info, Settings, Sparkles } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { RoundButton, ScreenHeader } from '@/components/ScreenHeader';
import { Screen } from '@/components/Screen';
import { AiTag, Card, FieldChips, Pill, type PillTone } from '@/components/ui';
import type { Field } from '@/data/mock';
import type { T } from '@/lib/i18n';
import { THREAT_BY_ID, threatsInGroup, type Assessment, type RiskLevel, type ThreatGroup } from '@/lib/risk';
import { topAssessments } from '@/lib/ai/mappers';
import { useAdvice } from '@/state/ai';
import { LEVEL_COLOR, useRisk, type FieldRiskView } from '@/state/risk';
import { useLocale } from '@/state/i18n';
import { useActiveField, useStore } from '@/state/store';
import { useT } from '@/state/i18n';
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

const weekday = (day: string, locale: string, style: 'short' | 'long' = 'short') => new Date(`${day}T12:00:00`).toLocaleDateString(locale, { weekday: style });

/** "today", "tomorrow" or the weekday of an assessed day. */
function dayWord(view: FieldRiskView, day: string, t: T, locale: string): string {
  const i = view.weather.days.findIndex((d) => d.date === day);
  if (i === view.weather.todayIndex) return t('today');
  if (i === view.weather.todayIndex + 1) return t('tomorrow');
  return weekday(day, locale, 'long');
}

function updatedText(fetchedAt: number, t: T): string {
  const min = Math.max(0, Math.round((Date.now() - fetchedAt) / 60000));
  if (min < 1) return t('just now');
  if (min < 60) return t('{n} min ago', { n: min });
  return t('{n} h ago', { n: Math.round(min / 60) });
}

/** Peak assessment of the next 3 days for one threat. */
const peak = (list: Assessment[], days = 3) => list.slice(0, days).reduce((b, a) => (a.score > b.score ? a : b));

function Forecast({ list, threatName, fieldName, view }: { list: Assessment[]; threatName: string; fieldName: string; view: FieldRiskView }) {
  const showToast = useStore((s) => s.showToast);
  const t = useT();
  const locale = useLocale();
  const high = list.reduce((b, a) => (a.score > b.score ? a : b));
  const reason = high.drivers[0] ? t(high.drivers[0]) : '';
  const when = dayWord(view, high.day, t, locale);
  const note =
    high.level === 'Low'
      ? t('Low risk all week. Keep your normal checks.')
      : reason
        ? t('Highest risk {when}: {reason}.', { when, reason: `${reason.charAt(0).toLocaleLowerCase(locale)}${reason.slice(1)}` })
        : t('Highest risk {when}.', { when });
  return (
    <Card className="mt-2 p-3">
      <View className="flex-row items-start justify-between">
        <View>
          <Text className="font-i8 text-ap-card text-ink">{t('7-day forecast')}</Text>
          <Text className="font-i5 text-ap-body text-muted">{t('Biggest risk: {name}', { name: t(threatName) })}</Text>
        </View>
        <Pressable onPress={() => showToast('Each bar is the risk for one day: Low, Medium or High')} accessibilityLabel={t('More info')} className="h-8 w-8 items-end">
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
            <Text className="font-i6 text-ap-small text-ink">{weekday(a.day, locale)}</Text>
            <Text className="font-i5 text-[10px]" style={{ color: BAR[a.level].text }}>{t(a.level)}</Text>
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
  const t = useT();
  const threat = THREAT_BY_ID[a.threat];
  const text = a.drivers.find((d) => !/^(Protected by|Spray on)/.test(d));
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/farmer/alert/[threat]', params: { threat: a.threat, fieldId: field.id } })}
      accessibilityRole="link"
      className={`py-3 ${first ? '' : 'border-t border-line'}`}
    >
      <View className="flex-row items-center">
        <View className="mr-2.5 h-3 w-3 rounded-full" style={{ backgroundColor: LEVEL_COLOR[a.level] }} />
        <View className="flex-1">
          <Text className="font-i8 text-ap-card text-ink">{t(threat.name)}</Text>
          <Text className="font-i5 text-ap-body text-muted">{field.name}</Text>
        </View>
        <Pill tone={PILL[a.level]}>{t(a.level)}</Pill>
        <ChevronRight size={16} color={colors.muted} />
      </View>
      {text ? <Text className="ml-[22px] mt-1 font-i5 text-ap-body text-muted">{t(text)}</Text> : null}
    </Pressable>
  );
}

/** The advisor text (✦) for one field: it explains the engine's numbers in the selected language. */
function AdvisorCard({ fieldId, level }: { fieldId: string; level: RiskLevel }) {
  const { advice, loading } = useAdvice(fieldId);
  const t = useT();
  if (!advice) return null;
  const tx = (s: string) => (advice.source === 'demo' ? t(s) : s);
  return (
    <Card className="mt-2 p-3">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-1.5">
          <Sparkles size={14} color={colors.good} />
          <Text className="font-i7 text-ap-body text-good">{t('Advisor')}</Text>
        </View>
        <Pill tone={PILL[level]}>{t('{level} risk', { level: t(level) })}</Pill>
      </View>
      <Text className="mt-1.5 font-i7 text-ap-body text-ink">{tx(advice.summary)}</Text>
      {advice.actions.map((x) => (
        <View key={x} className="mt-1.5 flex-row items-start gap-1.5">
          <Check size={14} color={colors.good} strokeWidth={3} />
          <Text className="flex-1 font-i5 text-ap-body text-muted">{tx(x)}</Text>
        </View>
      ))}
      <Text className="mt-1.5 font-i5 text-ap-small text-muted">{tx(advice.whyNow)}</Text>
      {loading && advice.source === 'demo' ? null : <AiTag source={advice.source} className="mt-2" />}
    </Card>
  );
}

export function AlertsScreen() {
  const showToast = useStore((s) => s.showToast);
  const fields = useStore((s) => s.fields);
  const active = useActiveField();
  const risk = useRisk();
  const t = useT();
  const params = useLocalSearchParams<{ fieldId?: string; tab?: string }>();
  const [tab, setTab] = useState<ThreatGroup>(TABS.some((x) => x.key === params.tab) ? (params.tab as ThreatGroup) : 'pests');
  const [fieldId, setFieldId] = useState(fields.some((f) => f.id === params.fieldId) ? (params.fieldId as string) : active.id);

  const field = fields.find((f) => f.id === fieldId) ?? fields[0];
  const view = risk[field.id];
  const threats = threatsInGroup(tab);
  const ranked = threats.map((th) => ({ t: th, p: peak(view.risk[th.id]) })).sort((a, b) => b.p.score - a.p.score);
  const selected = ranked[0].t;
  const alerts = ranked.filter((r) => RANK[r.p.level] >= RANK.Medium);
  const quiet = ranked.filter((r) => RANK[r.p.level] < RANK.Medium);
  const hasLocation = (field.locationRisks?.length ?? 0) > 0;

  return (
    <Screen tabs={false}>
      <ScreenHeader
        back
        title={t('Alerts')}
        right={
          <RoundButton label={t('Alert settings')} onPress={() => showToast('Alert settings are coming soon')}>
            <Settings size={18} color={colors.ink} />
          </RoundButton>
        }
      />
      <View className="mt-2.5 h-10 flex-row rounded-full bg-soft p-1">
        {TABS.map((x) => (
          <Pressable key={x.key} onPress={() => setTab(x.key)} accessibilityRole="tab" className={`flex-1 items-center justify-center rounded-full ${tab === x.key ? 'bg-ink' : ''}`}>
            <Text className={`font-i7 text-ap-pill ${tab === x.key ? 'text-white' : 'text-muted'}`}>{t(x.label)}</Text>
          </Pressable>
        ))}
      </View>

      <View className="mt-2">
        <FieldChips fields={fields} selected={field.id} onSelect={(id) => setFieldId(id)} />
      </View>

      <AdvisorCard fieldId={field.id} level={topAssessments(view.risk)[0].level} />

      <Forecast list={view.risk[selected.id]} threatName={selected.name} fieldName={field.name} view={view} />

      <Text className="mt-2 font-i5 text-ap-small text-muted">
        {t(view.status === 'demo' ? 'Rule-based forecast from demo weather · updated {when}' : 'Rule-based forecast from live weather · updated {when}', { when: updatedText(view.weather.fetchedAt, t) })}
      </Text>

      <Text className="mt-3.5 font-i8 text-ap-card text-ink">{t('Recent alerts')}</Text>
      {tab === 'location' && !hasLocation ? (
        <Card className="mt-2 items-center p-4">
          <Text className="font-i6 text-ap-body text-muted">{t('No known location risks for {name}.', { name: field.name })}</Text>
        </Card>
      ) : alerts.length === 0 ? (
        <Card className="mt-2 items-center p-4">
          <Text className="font-i6 text-ap-body text-good">{t('All clear for {name}. No alerts in the next 3 days.', { name: field.name })}</Text>
        </Card>
      ) : (
        alerts.map((r, i) => <AlertRow key={r.t.id} field={field} a={r.p} first={i === 0} />)
      )}

      {quiet.length > 0 && !(tab === 'location' && !hasLocation) ? (
        <Text className="mt-2.5 font-i5 text-ap-body text-muted">{t('Low risk: {names}.', { names: quiet.map((r) => t(r.t.name)).join(', ') })}</Text>
      ) : null}
    </Screen>
  );
}
