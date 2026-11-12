import { Camera, ListFilter, Share2 } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';
import { RoundButton, ScreenHeader } from '@/components/ScreenHeader';
import { Screen, useTabBarOffset } from '@/components/Screen';
import { Card, FieldChips } from '@/components/ui';
import { nearbyFarms, type Spray } from '@/data/mock';
import { useActiveField, useStore } from '@/state/store';
import { colors } from '@/theme/tokens';
import { AddSpraySheet } from './AddSpraySheet';
import { SprayCard, sprayColor, useWashoff } from './SprayCard';

function EuFlag() {
  const stars = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    return <Circle key={i} cx={20 + Math.cos(a) * 11} cy={20 + Math.sin(a) * 11} r={1.5} fill="#F7D117" />;
  });
  return (
    <Svg width={36} height={36} viewBox="0 0 40 40">
      <Rect width={40} height={40} rx={20} fill="#1F4FA3" />
      {stars}
    </Svg>
  );
}

export function LogbookScreen() {
  const field = useActiveField();
  const fields = useStore((s) => s.fields);
  const selectField = useStore((s) => s.selectField);
  const allSprays = useStore((s) => s.sprays);
  const showToast = useStore((s) => s.showToast);
  const offset = useTabBarOffset();
  const router = useRouter();
  const { add, label } = useLocalSearchParams<{ add?: string; label?: string }>();
  const [labelScan, setLabelScan] = useState(false);
  const [adding, setAdding] = useState(false);
  const [onlyIssues, setOnlyIssues] = useState(false);

  useEffect(() => {
    if (add === '1') {
      setLabelScan(label === '1');
      setAdding(true);
      router.setParams({ add: undefined, label: undefined });
    }
  }, [add, label, router]);

  const sprays = allSprays.filter((s) => s.fieldId === field.id);
  const issues = sprays.filter((s) => s.banned);
  const shown = onlyIssues ? issues : sprays;

  return (
    <View className="flex-1">
      <Screen>
        <ScreenHeader
          title="Logbook"
          right={
            <RoundButton label="Show only issues" active={onlyIssues} onPress={() => setOnlyIssues((v) => !v)}>
              <ListFilter size={18} color={onlyIssues ? '#fff' : colors.ink} />
            </RoundButton>
          }
        />
        <View className="mt-2.5">
          <FieldChips fields={fields} selected={field.id} onSelect={selectField} tone="black" />
        </View>

        <View className="mt-2 flex-row gap-2">
          <View className="flex-1 rounded-[18px] border border-line bg-soft px-3 py-1.5">
            <Text className="font-i5 text-ap-body text-muted">Safe to harvest</Text>
            <Text className="font-i8 text-ap-title text-ink">{field.harvest.ready ? 'Now' : field.harvest.badge}</Text>
          </View>
          <View className="flex-1 rounded-[18px] border border-line bg-card px-3 py-1.5">
            <Text className="font-i5 text-ap-body text-muted">Sprays this year</Text>
            <View className="flex-row items-baseline gap-2">
              <Text className="font-i8 text-ap-title text-ink">{sprays.length}</Text>
              <Text className="font-i5 text-ap-small text-muted">{`Nearby farms: ${nearbyFarms}`}</Text>
            </View>
          </View>
        </View>

        <Card className="mt-2 flex-row items-center p-2.5">
          <EuFlag />
          <View className="ml-2.5 flex-1">
            <Text className="font-i8 text-ap-body text-ink">EU spray record: complete</Text>
            <Text className="font-i5 text-ap-small text-muted">Kept for you, as the EU requires.</Text>
            {issues.length ? (
              <Text className="font-i5 text-ap-small text-risk">{`${issues.length} issue${issues.length > 1 ? 's' : ''}: banned product on ${issues[0].date}`}</Text>
            ) : (
              <Text className="font-i5 text-ap-small text-good">No issues</Text>
            )}
          </View>
          <Pressable onPress={() => showToast('Spray record is ready to share')} className="h-8 flex-row items-center gap-1.5 rounded-full bg-soft px-3">
            <Share2 size={14} color={colors.ink} />
            <Text className="font-i7 text-ap-pill text-ink">Share</Text>
          </Pressable>
        </Card>

        <View className="mt-3 flex-row items-baseline justify-between">
          <Text className="font-i8 text-ap-card text-ink">Your sprays</Text>
          <Text className="font-i5 text-ap-body text-muted">2026 season</Text>
        </View>

        {shown.length === 0 ? (
          <Card className="mt-2 items-center p-5">
            <Text className="font-i6 text-ap-body text-muted">{onlyIssues ? 'No issues in this field.' : 'No sprays yet in this field.'}</Text>
          </Card>
        ) : (
          <View className="mt-1.5">
            {shown.map((s, i) => (
              <TimelineRow key={s.id} spray={s} first={i === 0} last={i === shown.length - 1} />
            ))}
          </View>
        )}
      </Screen>

      <Pressable
        onPress={() => setAdding(true)}
        accessibilityRole="button"
        className="absolute right-5 z-30 h-11 flex-row items-center gap-2 rounded-full bg-ink px-4"
        style={{ bottom: offset + 12, boxShadow: '0 6px 16px rgba(0,0,0,0.2)' }}
      >
        <Camera size={18} color="#fff" />
        <Text className="font-i7 text-ap-btn text-white">Add a spray</Text>
      </Pressable>

      {adding ? <AddSpraySheet field={field} labelScan={labelScan} onClose={() => { setAdding(false); setLabelScan(false); }} /> : null}
    </View>
  );
}

function TimelineRow({ spray, first, last }: { spray: Spray; first: boolean; last: boolean }) {
  const washoff = useWashoff(spray);
  return (
    <View className="flex-row">
      <View className="w-6 items-center">
        <View className="absolute w-px bg-line" style={last ? { top: 0, height: 18 } : { top: first ? 18 : 0, bottom: 0 }} />
        <View className="mt-4 h-3 w-3 rounded-full" style={{ backgroundColor: sprayColor(spray, washoff) }} />
      </View>
      <View className="flex-1 pb-1.5">
        <SprayCard spray={spray} />
      </View>
    </View>
  );
}
