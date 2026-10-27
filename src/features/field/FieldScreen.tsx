import { useRouter } from 'expo-router';
import { Calendar, Camera, ChevronRight, Droplet, Layers, Leaf, RefreshCw, Star } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { RoundButton, ScreenHeader } from '@/components/ScreenHeader';
import { Screen } from '@/components/Screen';
import { Card, Chip, FieldChips, Pill } from '@/components/ui';
import type { Tree } from '@/data/mock';
import { openCamera } from '@/features/scan/nav';
import { currentRisk, LEVEL_COLOR, useRisk } from '@/state/risk';
import { useActiveField, useStore } from '@/state/store';
import { colors } from '@/theme/tokens';
import { FieldMap } from './FieldMap';

const NO_TREES: Tree[] = [];

export function FieldScreen() {
  const router = useRouter();
  const field = useActiveField();
  const fields = useStore((s) => s.fields);
  const selectField = useStore((s) => s.selectField);
  const showToast = useStore((s) => s.showToast);
  const trees = useStore((s) => s.trees[field.id]) ?? NO_TREES;
  const selectedTreeId = useStore((s) => s.selectedTreeId);
  const selectTree = useStore((s) => s.selectTree);
  const [showHealth, setShowHealth] = useState(true);
  const now = currentRisk(useRisk()[field.id]);

  const followUp = trees.filter((t) => t.status === 'diseased');
  const tree = trees.find((t) => t.id === selectedTreeId) ?? followUp[0] ?? null;
  const low = field.score < 70;

  return (
    <Screen>
      <ScreenHeader
        title="My Field"
        back
        right={
          <RoundButton label="Map layers" onPress={() => showToast('Satellite view is on')}>
            <Layers size={18} color={colors.ink} />
          </RoundButton>
        }
      />

      <View className="mt-2.5">
        <FieldChips
          fields={fields}
          selected={field.id}
          onSelect={selectField}
          trailing={
            <Chip on={false} onPress={() => router.push('/onboarding')}>
              <Text className="font-i7 text-ap-pill text-ink">+ Add</Text>
            </Chip>
          }
        />
      </View>

      <Card className="mt-2 flex-row items-center p-2.5">
        <View className="flex-1 items-center">
          <Text className="font-i8 text-ap-card text-ink">{`${field.trees} trees`}</Text>
          <Text className="font-i5 text-ap-small text-muted">Tree count</Text>
        </View>
        <View className="h-8 w-px bg-line" />
        <View className="flex-1 items-center">
          <Text className="font-i8 text-ap-card text-ink">{`${field.ha} ha`}</Text>
          <Text className="font-i5 text-ap-small text-muted">Field size</Text>
        </View>
        <Pressable
          onPress={() => router.push('/quality')}
          className={`flex-[1.4] flex-row items-center justify-center gap-2 rounded-xl py-1.5 ${low ? 'bg-risk-soft' : 'bg-good-soft'}`}
        >
          <Star size={20} color={low ? colors.risk : colors.good} fill={low ? colors.risk : colors.good} />
          <View>
            <Text className="font-i6 text-ap-small text-ink">Quality score</Text>
            <Text className="font-i8 text-ap-card text-ink">
              {field.score}
              <Text className="font-i5 text-ap-small text-muted">{' / 100'}</Text>
            </Text>
          </View>
        </Pressable>
      </Card>

      <View className="mt-2">
        <FieldMap
          trees={trees}
          selectedId={tree?.id ?? null}
          onSelect={selectTree}
          showHealth={showHealth}
          onToggleHealth={setShowHealth}
          onLocate={() => showToast('Showing your location')}
          ringColor={LEVEL_COLOR[now?.level ?? 'Low']}
        />
      </View>

      <Pressable onPress={() => followUp[0] && selectTree(followUp[0].id)} className="mt-2 h-10 flex-row items-center rounded-xl bg-risk-soft px-3">
        <RefreshCw size={18} color={colors.risk} />
        <Text className="ml-2.5 flex-1 font-i7 text-ap-body text-ink">{`${followUp.length} trees need follow up`}</Text>
        <Text className="font-i7 text-ap-body text-risk">View</Text>
        <ChevronRight size={16} color={colors.risk} />
      </Pressable>

      {tree ? (
        <Card className="mt-2 p-3">
          <View className="flex-row">
            <View className="h-12 w-12 items-center justify-center rounded-[10px] bg-good-soft">
              <Leaf size={22} color={colors.good} />
            </View>
            <View className="ml-2.5 flex-1">
              <View className="flex-row items-center justify-between">
                <Text className="font-i8 text-ap-card text-ink">{`Tree #${tree.id}`}</Text>
                {tree.level ? <Pill tone={tree.level === 'high' ? 'risk' : 'warn'}>{tree.level === 'high' ? 'High risk' : 'Medium risk'}</Pill> : null}
              </View>
              <View className="mt-0.5 flex-row items-center gap-1.5">
                <View className="h-2 w-2 rounded-full" style={{ backgroundColor: tree.status === 'diseased' ? colors.risk : tree.status === 'suspicious' ? colors.warn : colors.good }} />
                <Text className="font-i6 text-ap-body text-ink">{tree.issue ?? (tree.status === 'healthy' ? 'Healthy' : 'Suspicious')}</Text>
              </View>
            </View>
          </View>
          <View className="mt-2 flex-row items-center gap-1">
            <Calendar size={12} color={colors.muted} />
            <Text className="flex-1 font-i5 text-ap-small text-muted">{`Last photo: ${tree.lastPhoto}`}</Text>
            <Droplet size={12} color={colors.accent} />
            <Text className="font-i5 text-ap-small text-muted">{`Last spray: ${tree.lastSpray}`}</Text>
          </View>
          {tree.recheckDays ? (
            <Pressable onPress={() => openCamera(router, { fieldId: field.id, treeId: tree.id, mode: 'leaf' })} className="mt-2 h-9 flex-row items-center rounded-lg bg-accent-soft px-3">
              <Calendar size={16} color={colors.accent} />
              <Text className="ml-2 flex-1 font-i6 text-ap-body text-accent">{`Re-check in ${tree.recheckDays} days`}</Text>
              <ChevronRight size={16} color={colors.accent} />
            </Pressable>
          ) : null}
          <View className="mt-2 flex-row gap-2">
            <Pressable
              onPress={() => openCamera(router, { fieldId: field.id, treeId: tree.id, mode: 'leaf' })}
              accessibilityRole="button"
              className="h-9 flex-1 flex-row items-center justify-center gap-1.5 rounded-full bg-primary"
            >
              <Camera size={15} color="#fff" />
              <Text className="font-i7 text-ap-pill text-white">Scan this tree</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push({ pathname: '/scan', params: { fieldId: field.id } })}
              accessibilityRole="button"
              className="h-9 flex-1 items-center justify-center rounded-full border border-ink"
            >
              <Text className="font-i7 text-ap-pill text-ink">See all scans</Text>
            </Pressable>
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}
