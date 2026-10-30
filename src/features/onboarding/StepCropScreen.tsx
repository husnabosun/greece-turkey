import { useRouter } from 'expo-router';
import { ArrowRight, Check, FileText, Leaf, ShoppingBasket, Sparkles, Sprout, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '@/components/Screen';
import { Button, Card } from '@/components/ui';
import { farmerLocation, type Field } from '@/data/mock';
import {
  haFromTrees,
  PROOFS,
  proofLevel,
  startingScore,
  verifiedLevel,
  validProofs,
  type CropStage,
  type ProofLevel,
  type RecordsKind,
  type SprayCount,
} from '@/lib/onboarding';
import { useStore } from '@/state/store';
import { colors } from '@/theme/tokens';
import { OnboardingHeader } from './OnboardingHeader';

const STAGES: { key: CropStage; label: string; Icon: LucideIcon }[] = [
  { key: 'growing', label: 'Growing', Icon: Sprout },
  { key: 'almost', label: 'Almost ready', Icon: Leaf },
  { key: 'harvested', label: 'Harvested', Icon: ShoppingBasket },
];
const SPRAYS: { key: SprayCount; label: string }[] = [
  { key: '0', label: '0' },
  { key: '1-2', label: '1–2' },
  { key: '3+', label: '3+' },
];
const RECORDS: { key: RecordsKind; label: string }[] = [
  { key: 'none', label: 'None' },
  { key: 'paper', label: 'Paper' },
  { key: 'brecete', label: 'B-Reçete' },
];
const LEVELS: ProofLevel[] = ['Self-reported', 'Evidence-based', 'Lab verified'];
const STAGE_TITLE: Record<CropStage, string> = { growing: 'a growing crop', almost: 'an almost ready crop', harvested: 'a harvested crop' };

function Label({ children }: { children: string }) {
  return <Text className="mb-1.5 mt-3 font-i7 text-ap-small uppercase tracking-[1px] text-muted">{children}</Text>;
}

function Opt({ on, onPress, children }: { on: boolean; onPress: () => void; children: ReactNode }) {
  return (
    <Pressable onPress={onPress} className={`h-[30px] items-center justify-center rounded-full border px-3 ${on ? 'border-ink bg-ink' : 'border-line bg-card'}`}>
      <Text className={`font-i7 text-ap-pill ${on ? 'text-white' : 'text-ink'}`}>{children}</Text>
    </Pressable>
  );
}

function harvestFor(stage: CropStage): Field['harvest'] {
  if (stage === 'harvested') return { label: 'Harvested', badge: 'Now', ready: true };
  if (stage === 'almost') return { label: 'Almost ready', badge: '2 weeks', ready: false };
  return { label: 'Still growing', badge: 'Growing', ready: false };
}

export function StepCropScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const draft = useStore((s) => s.draft);
  const setDraft = useStore((s) => s.setDraft);
  const addField = useStore((s) => s.addField);
  const resetDraft = useStore((s) => s.resetDraft);
  const showToast = useStore((s) => s.showToast);

  const proofs = PROOFS[draft.stage];
  const added = validProofs(draft.stage, draft.proofs);
  const score = startingScore(draft.stage, draft.sprays, draft.records, draft.proofs);
  const sales = useStore((s) => s.sales);
  // A new field has no sales yet, so it can only be Self-reported or Evidence-based.
  const level = verifiedLevel({ id: 'new-field', proofLevel: proofLevel(draft.stage, draft.proofs) }, sales);

  const toggleProof = (id: string) =>
    setDraft({ proofs: draft.proofs.includes(id) ? draft.proofs.filter((p) => p !== id) : [...draft.proofs, id] });

  const start = () => {
    const missing = proofs.filter((p) => p.note === 'REQUIRED' && !added.includes(p.id));
    if (missing.length) {
      showToast(`Add this first: ${missing.map((m) => m.label).join(', ')}`);
      return;
    }
    const name = draft.name.trim() || 'New field';
    addField({
      name,
      proofLevel: level,
      lat: farmerLocation.lat,
      lon: farmerLocation.lon,
      trees: draft.trees,
      ha: haFromTrees(draft.trees),
      variety: draft.variety,
      score,
      pest: { name: 'Olive fly', level: 'low' },
      harvest: harvestFor(draft.stage),
      breakdown: { tree: score, spray: draft.sprays === '3+' ? 60 : 85, harvest: 80, records: draft.records === 'none' ? 40 : 85 },
      trend: { pct: 0, reason: 'This is a new field. We compare it with last month from next month.' },
      plan: [
        { text: 'Take a photo of the leaves to check tree health.', points: 3 },
        { text: 'Add your spray records to the logbook.', points: 2 },
      ],
    });
    resetDraft();
    router.replace('/');
    showToast(`${name} added. Starting score ${score}`);
  };

  return (
    <View className="flex-1">
      <Screen tabs={false}>
        <OnboardingHeader title="Add your field" step={2} />

        <Label>Where is your crop now?</Label>
        <View className="flex-row gap-2">
          {STAGES.map(({ key, label, Icon }) => {
            const on = draft.stage === key;
            return (
              <Pressable key={key} onPress={() => setDraft({ stage: key })} className={`h-[68px] flex-1 items-center justify-center gap-1 rounded-2xl border ${on ? 'border-good/40 bg-good-soft' : 'border-line bg-card'}`}>
                <Icon size={20} color={on ? colors.good : colors.ink} />
                <Text className={`font-i7 text-ap-body ${on ? 'text-good' : 'text-ink'}`}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Label>Last season</Label>
        <Card className="h-12 flex-row items-center justify-between px-3">
          <Text className="font-i8 text-ap-body text-ink">Sprays</Text>
          <View className="flex-row gap-1.5">
            {SPRAYS.map((s) => (
              <Opt key={s.key} on={draft.sprays === s.key} onPress={() => setDraft({ sprays: s.key })}>{s.label}</Opt>
            ))}
          </View>
        </Card>
        <Card className="mt-2 h-12 flex-row items-center justify-between px-3">
          <Text className="font-i8 text-ap-body text-ink">Records</Text>
          <View className="flex-row gap-1.5">
            {RECORDS.map((r) => (
              <Opt key={r.key} on={draft.records === r.key} onPress={() => setDraft({ records: r.key })}>{r.label}</Opt>
            ))}
          </View>
        </Card>

        <Label>{`Proof for ${STAGE_TITLE[draft.stage]}`}</Label>
        <View className="flex-row flex-wrap gap-2">
          {proofs.map((p) => {
            const on = added.includes(p.id);
            return (
              <Pressable
                key={p.id}
                onPress={() => toggleProof(p.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                className={`h-[52px] w-[171px] flex-row items-center gap-2 rounded-xl px-3 ${on ? 'border border-[#A9BE9C] bg-[#F2F8EE]' : 'border border-dashed border-[#C9C6BE] bg-card'}`}
              >
                {on ? <Check size={18} color={colors.good} strokeWidth={2.6} /> : <FileText size={18} color={colors.muted} />}
                <View className="flex-1">
                  <Text numberOfLines={1} className={`font-i7 text-ap-body ${on ? 'text-good' : 'text-[#555]'}`}>{p.label}</Text>
                  <Text className={`font-i7 text-[10px] tracking-[0.5px] ${on ? 'text-good' : p.note === 'REQUIRED' ? 'text-risk' : 'text-muted'}`}>{on ? 'ADDED' : p.note}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View className="mt-3 rounded-[18px] bg-good-soft p-3">
          <View className="flex-row items-center">
            <Text className="font-i8 text-[34px] leading-[38px] text-good">{score}</Text>
            <View className="ml-3 flex-1">
              <View className="flex-row items-center gap-2">
                <Text className="font-i8 text-ap-card text-ink">Starting score</Text>
                <View className="h-5 justify-center rounded-md bg-warn-soft px-1.5">
                  <Text className="font-i7 text-[10px] text-warn-text">ESTIMATED</Text>
                </View>
              </View>
              <Text className="font-i5 text-ap-small text-muted">From answers, photos and satellite history</Text>
            </View>
          </View>
          <View className="mt-2 flex-row gap-1.5">
            {LEVELS.map((l) => (
              <View key={l} className={`h-7 flex-1 flex-row items-center justify-center gap-1 rounded-lg ${l === level ? 'bg-warn-soft' : 'bg-black/5'}`}>
                {l === level ? <Check size={12} color={colors.warnText} strokeWidth={3} /> : null}
                <Text className={`font-i7 text-[10.5px] ${l === level ? 'text-warn-text' : 'text-muted'}`}>{l}</Text>
              </View>
            ))}
          </View>
          <View className="mt-2 flex-row items-center gap-1.5">
            <Sparkles size={13} color={colors.good} />
            <Text className="font-i5 text-ap-small text-good">Shown to buyers who can pick up within 48 h.</Text>
          </View>
        </View>
        <View className="h-14" />
      </Screen>

      <View className="absolute left-5 right-5" style={{ bottom: insets.bottom + 14 }}>
        <Button label="Start selling" icon={<ArrowRight size={18} color="#fff" />} className="h-12" onPress={start} />
      </View>
    </View>
  );
}
