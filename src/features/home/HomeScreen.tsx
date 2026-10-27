import { useRouter } from 'expo-router';
import { Bell, Camera, Cloud, CloudLightning, CloudRain, Droplet, Globe, Leaf, MapPin, Plus, Settings, Sun, Tag, TriangleAlert, type LucideIcon } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { Button, Card, FieldChips, SectionHeader } from '@/components/ui';
import { farmer, type Level, type ScanMode } from '@/data/mock';
import { openCamera } from '@/features/scan/nav';
import { THREAT_BY_ID, type Assessment, type RiskLevel, type ThreatId } from '@/lib/risk';
import type { WeatherIcon } from '@/lib/weather';
import { countRisks, topPest, topRiskOfAll, useRisk } from '@/state/risk';
import { useStore } from '@/state/store';
import { colors } from '@/theme/tokens';
import { FieldCard } from './FieldCard';

const ICON: Record<WeatherIcon, LucideIcon> = { sunny: Sun, cloudy: Cloud, rain: CloudRain, storm: CloudLightning };

/** What to scan for each threat when the farmer taps "Take a photo". */
const SCAN_MODE: Partial<Record<ThreatId, ScanMode>> = {
  'peacock-spot': 'leaf',
  'olive-moth': 'leaf',
  'olive-knot': 'leaf',
  'olive-fly': 'trap',
  anthracnose: 'fruit',
};

const KICKER = { pests: 'FIELD CHECK', weather: 'WEATHER WATCH', location: 'LOCATION WATCH' } as const;

const TONE: Record<RiskLevel, { card: string; kicker: string; icon: string; iconBg: string; iconColor: string; btn: 'risk' | 'dark' }> = {
  High: { card: 'bg-risk-soft', kicker: 'text-risk', icon: '#F6CFC2', iconBg: 'bg-[#F6CFC2]', iconColor: colors.risk, btn: 'risk' },
  Medium: { card: 'bg-warn-soft', kicker: 'text-warn-text', icon: '#EEDDA8', iconBg: 'bg-[#EEDDA8]', iconColor: colors.warnText, btn: 'dark' },
  Low: { card: 'bg-good-soft', kicker: 'text-good', icon: '#CFE3C4', iconBg: 'bg-[#CFE3C4]', iconColor: colors.good, btn: 'dark' },
};

const toLevel = (l: RiskLevel): Level => (l === 'High' ? 'high' : l === 'Medium' ? 'medium' : 'low');

/** "today", "tomorrow" or the weekday of an assessed day. */
function dayWord(day: string, todayIndex: number, days: { date: string }[]): string {
  const i = days.findIndex((d) => d.date === day);
  if (i === todayIndex) return 'today';
  if (i === todayIndex + 1) return 'tomorrow';
  return new Date(`${day}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long' }).toLowerCase();
}

export function HomeScreen() {
  const router = useRouter();
  const fields = useStore((s) => s.fields);
  const tasks = useStore((s) => s.tasks);
  const offers = useStore((s) => s.offers);
  const trees = useStore((s) => s.trees);
  const selected = useStore((s) => s.selectedFieldId);
  const selectField = useStore((s) => s.selectField);
  const showWelcomeBanners = useStore((s) => s.showWelcomeBanners);
  const showToast = useStore((s) => s.showToast);
  const [menu, setMenu] = useState(false);
  const risk = useRisk();

  useEffect(() => {
    showWelcomeBanners();
  }, [showWelcomeBanners]);

  const shown = selected === 'all' ? fields : fields.filter((f) => f.id === selected);
  const scope = Object.fromEntries(Object.entries(risk).filter(([id]) => shown.some((f) => f.id === id)));
  const top = topRiskOfAll(scope, 3);
  const weatherField = shown[0] ?? fields[0];
  const view = risk[weatherField.id];
  const w = view?.weather;

  const done = tasks.filter((t) => t.done).length;
  const rechecks = tasks.filter((t) => t.kind === 'recheck' && !t.done).length;
  const openOffers = offers.filter((o) => o.status === 'open').length;
  const risks = countRisks(scope, 3);

  const tomorrow = w ? w.days[w.todayIndex + 1] : undefined;
  const WeatherIconCmp = ICON[w?.current.icon ?? 'sunny'];

  // The "Today" card: the highest risk of the next 3 days, or an all-clear.
  const a: Assessment | undefined = top?.assessment;
  const level: RiskLevel = a && a.level !== 'Low' ? a.level : 'Low';
  const tone = TONE[level];
  const field = fields.find((f) => f.id === top?.fieldId) ?? weatherField;
  const threat = a ? THREAT_BY_ID[a.threat] : undefined;
  const group = threat?.group ?? 'pests';
  const when = a && w ? dayWord(a.day, w.todayIndex, w.days) : 'today';
  const mode = a ? SCAN_MODE[a.threat] : undefined;
  const CardIcon: LucideIcon = group === 'weather' ? CloudRain : group === 'location' ? MapPin : Leaf;

  return (
    <Screen>
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <Text className="font-i8 text-ap-title text-ink">{`Good morning,\n${farmer.name}`}</Text>
          <View className="mt-1 flex-row items-center gap-1">
            <MapPin size={14} color={colors.muted} />
            <Text className="font-i5 text-ap-body text-muted">{farmer.place}</Text>
          </View>
        </View>
        <View className="flex-row gap-2">
          <Pressable onPress={() => setMenu((v) => !v)} accessibilityLabel="Settings" className="h-10 w-10 items-center justify-center rounded-full border border-line bg-card">
            <Settings size={18} color={colors.ink} />
          </Pressable>
          <Pressable onPress={() => router.push('/tasks')} accessibilityLabel="This week" className="h-10 w-10 items-center justify-center rounded-full border border-line bg-card">
            <Bell size={18} color={colors.good} />
            <View className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-[#E5473A]" />
          </Pressable>
        </View>
      </View>

      {menu ? (
        <View className="absolute right-5 top-[64px] z-20 w-[200px] rounded-2xl border border-line bg-card p-1.5" style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
          <Pressable
            onPress={() => {
              setMenu(false);
              router.push('/onboarding');
            }}
            className="h-11 flex-row items-center gap-2.5 rounded-xl px-2.5"
          >
            <Plus size={18} color={colors.ink} />
            <Text className="font-i6 text-ap-body text-ink">Add a field</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setMenu(false);
              showToast('The app is in English for now');
            }}
            className="h-11 flex-row items-center gap-2.5 rounded-xl px-2.5"
          >
            <Globe size={18} color={colors.ink} />
            <Text className="font-i6 text-ap-body text-ink">Language: English</Text>
          </Pressable>
        </View>
      ) : null}

      <View className="mt-2.5">
        <FieldChips fields={fields} selected={selected} onSelect={selectField} showAll />
      </View>

      <Card className="mt-2 h-10 flex-row items-center px-3">
        <WeatherIconCmp size={18} color={colors.warn} />
        <Text className="ml-2 font-i7 text-ap-body text-ink">{w ? `${Math.round(w.current.temp)}°C` : '–'}</Text>
        <Text className="ml-1.5 font-i5 text-ap-body text-muted">{w?.current.label ?? ''}</Text>
        <View className="mx-2.5 h-5 w-px bg-line" />
        <View className="flex-1 flex-row items-center justify-end gap-1.5">
          <Droplet size={16} color={colors.accent} />
          <Text className="font-i5 text-ap-body text-muted" numberOfLines={1}>
            {tomorrow ? (tomorrow.rain >= 1 ? 'Rain tomorrow' : 'No rain tomorrow') : ''}
          </Text>
        </View>
      </Card>

      <View className={`mt-2 rounded-[18px] p-3 ${tone.card}`}>
        <View className="flex-row items-center gap-1 self-start rounded-lg bg-white px-2 py-1">
          <MapPin size={12} color={tone.iconColor} />
          <Text className="font-i7 text-ap-small text-ink">{`${field.name} · ${field.trees} trees`}</Text>
        </View>
        <Text className={`mt-2 font-i7 text-ap-small tracking-[1.2px] ${tone.kicker}`}>{a && level !== 'Low' ? `${KICKER[group]} · ${when.toUpperCase()}` : 'ALL CLEAR'}</Text>
        <Text className="mt-0.5 max-w-[240px] font-i8 text-[20px] leading-[24px] text-ink">
          {a && level !== 'Low' ? `${threat?.name}${/risk$/i.test(threat?.name ?? '') ? '' : ' risk'} is ${level.toLowerCase()}` : 'No big risks in the next 3 days'}
        </Text>
        <Text className="mt-1 font-i5 text-ap-body text-[#5a5a5a]" numberOfLines={2}>
          {a ? a.actions[0] : 'Keep your normal checks.'}
        </Text>
        <View className={`absolute right-3 top-[44px] h-12 w-12 items-center justify-center rounded-full ${tone.iconBg}`}>
          <CardIcon size={22} color={tone.iconColor} />
        </View>
        <View className="mt-2.5 flex-row items-center justify-between">
          {level !== 'Low' && mode ? (
            <Button
              label="Take a photo"
              variant={tone.btn}
              icon={<Camera size={18} color="#fff" />}
              onPress={() => openCamera(router, { fieldId: field.id, treeId: trees[field.id]?.find((t) => t.status === 'diseased')?.id, mode })}
            />
          ) : (
            <Button label="See alerts" variant={tone.btn} icon={<TriangleAlert size={18} color="#fff" />} onPress={() => router.push('/alerts')} />
          )}
          <Pressable onPress={() => router.push('/tasks')} className="h-8 justify-center">
            <Text className={`font-i6 text-ap-small ${tone.kicker}`}>{`${done} / ${tasks.length} tasks`}</Text>
          </Pressable>
        </View>
      </View>

      <View className="mt-2 flex-row gap-2">
        <StatChip label={`${risks} risks`} tone="risk" icon={<TriangleAlert size={16} color={colors.risk} />} onPress={() => router.push('/alerts')} />
        <StatChip label={`${rechecks} re-check`} tone="warn" icon={<Leaf size={16} color={colors.warn} />} onPress={() => router.push('/tasks')} />
        <StatChip label={`${openOffers} offers`} tone="good" icon={<Tag size={16} color={colors.good} />} onPress={() => router.push('/market/offers')} />
      </View>

      <SectionHeader title="Your fields" action="See all" onAction={() => router.push('/field')} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5 mt-1.5" contentContainerClassName="gap-2 px-5">
        {shown.map((f) => {
          const p = topPest(risk[f.id]);
          return (
            <FieldCard
              key={f.id}
              field={f}
              pest={p ? { name: THREAT_BY_ID[p.threat].name, level: toLevel(p.level) } : undefined}
              onPress={() => {
                selectField(f.id);
                router.push('/field');
              }}
            />
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const chipStyle = { risk: 'border-[#E9B5A6]', warn: 'border-[#E3CF95]', good: 'border-[#A9BE9C]' } as const;
const chipText = { risk: 'text-risk', warn: 'text-warn-text', good: 'text-good' } as const;

function StatChip({ label, tone, icon, onPress }: { label: string; tone: keyof typeof chipStyle; icon: ReactNode; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className={`h-9 flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border-[1.5px] bg-card ${chipStyle[tone]}`}>
      {icon}
      <Text className={`font-i7 text-ap-pill ${chipText[tone]}`}>{label}</Text>
    </Pressable>
  );
}
