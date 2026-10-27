import { useRouter } from 'expo-router';
import { Bell, Camera, CloudSun, Droplet, Globe, Leaf, MapPin, Plus, Settings, Tag, TriangleAlert } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { Button, Card, FieldChips, SectionHeader } from '@/components/ui';
import { farmer, weather } from '@/data/mock';
import { useStore } from '@/state/store';
import { colors } from '@/theme/tokens';
import { openCamera } from '@/features/scan/nav';
import { FieldCard } from './FieldCard';

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

  useEffect(() => {
    showWelcomeBanners();
  }, [showWelcomeBanners]);

  const shown = selected === 'all' ? fields : fields.filter((f) => f.id === selected);
  const focus = shown[0];
  const done = tasks.filter((t) => t.done).length;
  const risks = fields.filter((f) => f.pest.level === 'high' || f.pest.level === 'medium').length;
  const rechecks = tasks.filter((t) => t.kind === 'recheck' && !t.done).length;
  const openOffers = offers.filter((o) => o.status === 'open').length;

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
          <Pressable onPress={() => { setMenu(false); showToast('The app is in English for now'); }} className="h-11 flex-row items-center gap-2.5 rounded-xl px-2.5">
            <Globe size={18} color={colors.ink} />
            <Text className="font-i6 text-ap-body text-ink">Language: English</Text>
          </Pressable>
        </View>
      ) : null}

      <View className="mt-2.5">
        <FieldChips fields={fields} selected={selected} onSelect={selectField} showAll />
      </View>

      <Card className="mt-2 h-10 flex-row items-center px-3">
        <CloudSun size={18} color={colors.warn} />
        <Text className="ml-2 font-i7 text-ap-body text-ink">{`${weather.temp}°C`}</Text>
        <Text className="ml-1.5 font-i5 text-ap-body text-muted">{weather.sky}</Text>
        <View className="mx-3 h-5 w-px bg-line" />
        <View className="flex-1 flex-row items-center justify-end gap-1.5">
          <Droplet size={16} color={colors.accent} />
          <Text className="font-i5 text-ap-body text-muted">{weather.next}</Text>
        </View>
      </Card>

      <View className="mt-2 rounded-[18px] bg-risk-soft p-3">
        <View className="flex-row items-center gap-1 self-start rounded-lg bg-white px-2 py-1">
          <MapPin size={12} color={colors.risk} />
          <Text className="font-i7 text-ap-small text-ink">{`${focus.name} · ${focus.trees} trees`}</Text>
        </View>
        <Text className="mt-2 font-i7 text-ap-small tracking-[1.2px] text-risk">FIELD CHECK</Text>
        <Text className="mt-0.5 max-w-[240px] font-i8 text-[20px] leading-[24px] text-ink">Peacock spot risk is high</Text>
        <Text className="mt-1 font-i5 text-ap-body text-[#5a5a5a]">Check the leaves in this field after the rain.</Text>
        <View className="absolute right-3 top-[44px] h-12 w-12 items-center justify-center rounded-full bg-[#F6CFC2]">
          <Leaf size={22} color={colors.risk} />
        </View>
        <View className="mt-2.5 flex-row items-center justify-between">
          <Button label="Take a photo" variant="risk" icon={<Camera size={18} color="#fff" />} onPress={() => openCamera(router, { fieldId: focus.id, treeId: trees[focus.id]?.find((t) => t.status === 'diseased')?.id, mode: 'leaf' })} />
          <Pressable onPress={() => router.push('/tasks')} className="h-8 justify-center">
            <Text className="font-i6 text-ap-small text-risk">{`${done} / ${tasks.length} tasks`}</Text>
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
        {shown.map((f) => (
          <FieldCard
            key={f.id}
            field={f}
            onPress={() => {
              selectField(f.id);
              router.push('/field');
            }}
          />
        ))}
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
