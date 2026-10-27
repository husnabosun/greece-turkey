import { useRouter } from 'expo-router';
import { ArrowRight, MapPin, Mic, Minus, Plus, Sparkles } from 'lucide-react-native';
import { memo, type ReactNode } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, G, Path, Polygon, Rect } from 'react-native-svg';
import { Screen } from '@/components/Screen';
import { Button, Card } from '@/components/ui';
import { farmer } from '@/data/mock';
import { haFromTrees } from '@/lib/onboarding';
import { useStore } from '@/state/store';
import { colors } from '@/theme/tokens';
import { OnboardingHeader } from './OnboardingHeader';

const SATELLITE_TREES = 80;
const AGES = ['5–20 years', '20–50 years', '50+ years'];
const VARIETIES = ['Ayvalık', 'Memecik', 'Gemlik', 'Other'];

/** Static aerial image with the field outline and four corner handles. */
const DrawMap = memo(function DrawMap() {
  const crowns = [];
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 9; c++) {
      crowns.push(<Circle key={`${r}-${c}`} cx={59 + c * 24.5 + (r % 2) * 3} cy={48 + r * 22} r={7} fill="#6E8B4A" />);
    }
  }
  return (
    <Svg width="100%" height="100%" viewBox="0 0 362 170" preserveAspectRatio="xMidYMid slice">
      <Rect width={362} height={170} fill="#C9B58C" />
      <Path d="M0 150 Q150 120 362 160" stroke="#A8966C" strokeWidth={10} fill="none" />
      <G opacity={0.55}>{crowns}</G>
      <Polygon points="48,34 270,26 284,140 56,150" fill="rgba(63,107,47,0.18)" stroke="#fff" strokeWidth={3} />
      <G fill="#fff" stroke="#151515" strokeWidth={2}>
        <Circle cx={48} cy={34} r={6} />
        <Circle cx={270} cy={26} r={6} />
        <Circle cx={284} cy={140} r={6} />
        <Circle cx={56} cy={150} r={6} />
      </G>
    </Svg>
  );
});

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

function RoundStep({ children, onPress, label }: { children: ReactNode; onPress: () => void; label: string }) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} className="h-9 w-9 items-center justify-center rounded-full bg-soft">
      {children}
    </Pressable>
  );
}

export function StepFieldScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const draft = useStore((s) => s.draft);
  const setDraft = useStore((s) => s.setDraft);
  const showToast = useStore((s) => s.showToast);

  const next = () => {
    if (!draft.name.trim()) {
      showToast('Give your field a name first');
      return;
    }
    router.push('/onboarding/crop');
  };

  return (
    <View className="flex-1">
      <Screen tabs={false}>
        <OnboardingHeader title="Add your field" step={1} />

        <Label>Field name</Label>
        <View className="h-12 flex-row items-center rounded-[14px] border-[1.5px] border-ink bg-card px-3.5">
          <TextInput
            value={draft.name}
            onChangeText={(name) => setDraft({ name })}
            placeholder="For example: Hill"
            placeholderTextColor={colors.muted}
            maxLength={24}
            className="flex-1 font-i7 text-ap-card text-ink"
            style={{ outlineStyle: 'none' } as object}
          />
          <Pressable onPress={() => showToast('Voice input is coming soon')} accessibilityLabel="Say the name" className="h-9 w-9 items-center justify-center">
            <Mic size={18} color={colors.muted} />
          </Pressable>
        </View>

        <Label>Draw your field on the map</Label>
        <View className="h-[170px] overflow-hidden rounded-[18px] border border-line">
          <DrawMap />
          <View className="absolute bottom-2.5 left-2.5 flex-row items-center gap-1.5 rounded-xl bg-white px-2.5 py-1.5">
            <MapPin size={13} color={colors.risk} />
            <Text className="font-i7 text-ap-small text-ink">{`${farmer.place} · ${haFromTrees(draft.trees)} ha`}</Text>
          </View>
          <Pressable onPress={() => showToast('Using your location')} className="absolute right-2.5 top-2.5 h-8 justify-center rounded-xl bg-ink px-2.5">
            <Text className="font-i7 text-ap-small text-white">Use my location</Text>
          </Pressable>
        </View>
        <View className="mt-1.5 flex-row items-center gap-1.5">
          <Sparkles size={13} color={colors.good} />
          <Text className="font-i5 text-ap-small text-good">{`Satellite found about ${SATELLITE_TREES} trees inside your field.`}</Text>
        </View>

        <View className="mt-3 flex-row gap-2">
          <Card className="flex-1 p-3">
            <Text className="font-i6 text-ap-small text-muted">Number of trees</Text>
            <View className="mt-1 flex-row items-center justify-between">
              <RoundStep label="Fewer trees" onPress={() => setDraft({ trees: Math.max(10, draft.trees - 10) })}>
                <Minus size={16} color={colors.ink} />
              </RoundStep>
              <Text className="font-i8 text-ap-card text-ink">{draft.trees}</Text>
              <RoundStep label="More trees" onPress={() => setDraft({ trees: Math.min(2000, draft.trees + 10) })}>
                <Plus size={16} color={colors.ink} />
              </RoundStep>
            </View>
          </Card>
          <Pressable className="flex-1" onPress={() => setDraft({ age: AGES[(AGES.indexOf(draft.age) + 1) % AGES.length] })}>
            <Card className="p-3">
              <Text className="font-i6 text-ap-small text-muted">Tree age</Text>
              <Text className="mt-3 font-i8 text-ap-body text-ink">{draft.age}</Text>
            </Card>
          </Pressable>
        </View>

        <Card className="mt-2 p-3">
          <Text className="font-i7 text-ap-body text-ink">Olive variety</Text>
          <View className="mt-2 flex-row flex-wrap gap-2">
            {VARIETIES.map((v) => (
              <Opt key={v} on={draft.variety === v} onPress={() => setDraft({ variety: v })}>{v}</Opt>
            ))}
          </View>
        </Card>
        <Card className="mt-2 p-3">
          <Text className="font-i7 text-ap-body text-ink">Is the field irrigated?</Text>
          <View className="mt-2 flex-row gap-2">
            <Opt on={draft.irrigated} onPress={() => setDraft({ irrigated: true })}>Yes</Opt>
            <Opt on={!draft.irrigated} onPress={() => setDraft({ irrigated: false })}>No</Opt>
          </View>
        </Card>
        <View className="h-14" />
      </Screen>

      <View className="absolute left-5 right-5" style={{ bottom: insets.bottom + 14 }}>
        <Button label="Next" icon={<ArrowRight size={18} color="#fff" />} className="h-12" onPress={next} />
      </View>
    </View>
  );
}
