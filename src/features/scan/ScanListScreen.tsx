import { useLocalSearchParams, useRouter } from 'expo-router';
import { Camera, ChevronRight, ListFilter } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { RoundButton, ScreenHeader } from '@/components/ScreenHeader';
import { Screen, useTabBarOffset } from '@/components/Screen';
import { Card, FieldChips, Pill, type PillTone } from '@/components/ui';
import type { Scan, ScanTone } from '@/data/mock';
import { scanTitle } from '@/lib/diagnosis';
import { beforeAfter, groupScans, isDue, type BeforeAfter } from '@/lib/scans';
import { useStore } from '@/state/store';
import { colors } from '@/theme/tokens';
import { openCamera } from './nav';
import { ScanPhoto } from './ScanPhoto';

const TONE: Record<ScanTone, PillTone> = { healthy: 'good', medium: 'warn', high: 'risk', watch: 'warn' };

function BeforeAfterCard({ card, fieldName }: { card: BeforeAfter; fieldName: string }) {
  const router = useRouter();
  const trend = { improving: { label: 'Improving', tone: 'good' as const }, worse: { label: 'Getting worse', tone: 'risk' as const }, same: { label: 'No change', tone: 'neutral' as const } }[card.trend];
  const shot = (s: Scan) => (
    <View className="h-[104px] flex-1 overflow-hidden rounded-xl">
      <ScanPhoto photo={s.photo} spots={s.spots} flies={s.flies} uri={s.uri} />
      <View className="absolute bottom-1.5 left-1.5 h-6 justify-center rounded-full bg-white px-2">
        <Text className="font-i7 text-ap-small text-ink">{`${s.date}${s.spots !== undefined ? ` · ${s.spots} spot${s.spots === 1 ? '' : 's'}` : ''}`}</Text>
      </View>
    </View>
  );
  return (
    <Pressable onPress={() => router.push(`/scan/result/${card.after.id}`)} accessibilityRole="button">
      <Card className="mt-2 p-3">
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <Text className="font-i8 text-ap-card text-ink">{`Tree #${card.treeId} · ${card.after.title}`}</Text>
            <Text className="font-i5 text-ap-body text-muted">{`${fieldName} · ${card.before.date} to ${card.after.date}`}</Text>
          </View>
          <Pill tone={trend.tone}>{trend.label}</Pill>
        </View>
        <View className="mt-2 flex-row gap-2">
          {shot(card.before)}
          {shot(card.after)}
        </View>
      </Card>
    </Pressable>
  );
}

function ScanRow({ scan, due }: { scan: Scan; due: boolean }) {
  const router = useRouter();
  const sub = due ? `Due today · ${scan.date}` : scan.mode === 'trap' ? `${scan.date} · counted by AI` : `${scan.date} · ${scan.confidence}% sure`;
  return (
    <Pressable onPress={() => router.push(`/scan/result/${scan.id}`)} accessibilityLabel={scanTitle(scan)} className="mt-2">
      <Card className="flex-row items-center p-2.5">
        <View className="h-12 w-12 overflow-hidden rounded-[10px]">
          <ScanPhoto photo={scan.photo} spots={scan.spots} flies={scan.flies} uri={scan.uri} />
        </View>
        <View className="ml-2.5 mr-2 flex-1">
          <Text className="font-i8 text-ap-body text-ink">{scanTitle(scan)}</Text>
          <Text className={`font-i5 text-ap-small ${due ? 'text-risk' : 'text-muted'}`}>{sub}</Text>
        </View>
        {due ? (
          <Pressable
            onPress={() => openCamera(router, { fieldId: scan.fieldId, treeId: scan.treeId, mode: scan.mode })}
            accessibilityRole="button"
            className="h-9 flex-row items-center gap-1.5 rounded-full bg-risk px-3"
          >
            <Camera size={14} color="#fff" />
            <Text className="font-i7 text-ap-pill text-white">Re-check</Text>
          </Pressable>
        ) : (
          <Pill tone={TONE[scan.tone]}>{scan.pill}</Pill>
        )}
        <ChevronRight size={16} color={colors.muted} />
      </Card>
    </Pressable>
  );
}

export function ScanListScreen() {
  const router = useRouter();
  const offset = useTabBarOffset();
  const scans = useStore((s) => s.scans);
  const fields = useStore((s) => s.fields);
  const lastSaved = useStore((s) => s.lastSavedScanId);
  const { fieldId } = useLocalSearchParams<{ fieldId?: string }>();
  const [filter, setFilter] = useState<string | 'all'>('all');
  const [onlyDue, setOnlyDue] = useState(false);

  useEffect(() => {
    if (fieldId) {
      setFilter(fieldId);
      router.setParams({ fieldId: undefined });
    }
  }, [fieldId, router]);

  const cards = useMemo(() => beforeAfter(scans).filter((c) => filter === 'all' || c.fieldId === filter), [scans, filter]);
  const groups = useMemo(() => groupScans(scans, filter, onlyDue, lastSaved ?? undefined), [scans, filter, onlyDue, lastSaved]);
  const fieldName = (id: string) => fields.find((f) => f.id === id)?.name ?? '';
  const filterField = filter === 'all' ? undefined : filter;

  return (
    <View className="flex-1">
      <Screen>
        <ScreenHeader
          title="Your scans"
          right={
            <RoundButton label="Show only re-checks" active={onlyDue} onPress={() => setOnlyDue((v) => !v)}>
              <ListFilter size={18} color={onlyDue ? '#fff' : colors.ink} />
            </RoundButton>
          }
        />
        <View className="mt-2.5">
          <FieldChips fields={fields} selected={filter} onSelect={setFilter} showAll allLabel={`All · ${scans.length}`} />
        </View>

        {onlyDue ? null : cards.map((c) => <BeforeAfterCard key={`${c.fieldId}-${c.treeId}`} card={c} fieldName={fieldName(c.fieldId)} />)}

        {groups.length === 0 && (onlyDue || cards.length === 0) ? (
          <Card className="mt-2 items-center p-5">
            <Text className="font-i6 text-ap-body text-muted">{onlyDue ? 'No re-checks are due.' : 'No scans yet. Tap New scan.'}</Text>
          </Card>
        ) : null}

        {groups.map((g) => {
          const dueCount = g.scans.filter((s) => isDue(s, scans)).length;
          return (
            <View key={g.fieldId}>
              <View className="mt-3.5 flex-row items-center justify-between">
                <Text className="font-i8 text-ap-card text-ink">{fieldName(g.fieldId)}</Text>
                {dueCount ? <Text className="font-i7 text-ap-body text-risk">{`${dueCount} re-check due`}</Text> : null}
              </View>
              {g.scans.map((s) => (
                <ScanRow key={s.id} scan={s} due={isDue(s, scans)} />
              ))}
            </View>
          );
        })}
      </Screen>

      <Pressable
        onPress={() => openCamera(router, { fieldId: filterField })}
        accessibilityRole="button"
        className="absolute right-5 z-30 h-12 flex-row items-center gap-2 rounded-full bg-primary px-5"
        style={{ bottom: offset + 12, boxShadow: '0 6px 16px rgba(0,0,0,0.2)' }}
      >
        <Camera size={18} color="#fff" />
        <Text className="font-i7 text-ap-btn text-white">New scan</Text>
      </Pressable>
    </View>
  );
}
