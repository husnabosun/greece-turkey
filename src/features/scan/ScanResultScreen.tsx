import { useLocalSearchParams, useRouter } from 'expo-router';
import { Camera, Check, Leaf, RefreshCw, Scissors, User, type LucideIcon } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Screen } from '@/components/Screen';
import { AiTag, Button, Card, Pill, type PillTone } from '@/components/ui';
import type { ScanTone } from '@/data/mock';
import { actionsFor, explain, PHOTO_LABEL } from '@/lib/diagnosis';
import { useStore } from '@/state/store';
import { colors } from '@/theme/tokens';
import { openCamera } from './nav';
import { ScanPhoto } from './ScanPhoto';

const ICONS: LucideIcon[] = [Scissors, Leaf, RefreshCw];
const TONE: Record<ScanTone, { pill: PillTone; box: string; tag: string }> = {
  high: { pill: 'risk', box: 'bg-risk-soft', tag: 'bg-[#F2B731]' },
  medium: { pill: 'warn', box: 'bg-warn-soft', tag: 'bg-[#F2B731]' },
  watch: { pill: 'warn', box: 'bg-warn-soft', tag: 'bg-[#F2B731]' },
  healthy: { pill: 'good', box: 'bg-good-soft', tag: 'bg-[#B9E09A]' },
};

export function ScanResultScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const scan = useStore((s) => s.scans.find((x) => x.id === id) ?? (s.pendingScan?.id === id ? s.pendingScan : undefined));
  const pending = useStore((s) => s.pendingScan?.id === id);
  const field = useStore((s) => s.fields.find((f) => f.id === scan?.fieldId));
  const saveScan = useStore((s) => s.saveScan);
  const showToast = useStore((s) => s.showToast);

  if (!scan) {
    return (
      <Screen tabs={false}>
        <ScreenHeader back title="Scan result" subtitle="This scan was not found." />
      </Screen>
    );
  }

  const tone = TONE[scan.tone];
  const { headline, detail } = explain(scan);
  const where = [field?.name, scan.treeId ? `Tree #${scan.treeId}` : undefined, scan.when].filter(Boolean).join(' · ');
  const target = scan.treeId ? `Tree #${scan.treeId}` : field?.name;

  const save = () => {
    saveScan();
    router.navigate('/scan');
  };

  return (
    <Screen tabs={false}>
      <ScreenHeader back title="Scan result" subtitle={where} />

      <View className="mt-2.5 h-[170px] overflow-hidden rounded-[18px]">
        <ScanPhoto photo={scan.photo} spots={scan.spots} flies={scan.flies} uri={scan.uri} />
        <View className="absolute left-[38%] top-[14%] items-center">
          <View className={`h-6 justify-center rounded-full px-3 ${tone.tag}`}>
            <Text className="font-i7 text-ap-pill text-ink">{scan.title}</Text>
          </View>
          {scan.tone !== 'healthy' ? <View className="mt-1.5 h-[64px] w-[64px] rounded-lg border-2 border-white" /> : null}
        </View>
        <View className="absolute bottom-2 left-2 h-8 flex-row items-center gap-1.5 rounded-full bg-white px-3">
          <Camera size={16} color={colors.ink} />
          <Text className="font-i7 text-ap-pill text-ink">{PHOTO_LABEL[scan.mode]}</Text>
        </View>
      </View>

      <Card className="mt-2 p-3">
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-2">
            <Text className="font-i8 text-ap-card text-ink">{scan.title}</Text>
            {scan.latin ? <Text className="font-i5 text-ap-body italic text-muted">{scan.latin}</Text> : null}
          </View>
          <Pill tone={tone.pill}>{scan.pill}</Pill>
        </View>
        <View className={`mt-2 rounded-xl p-2.5 ${tone.box}`}>
          <Text className="font-i7 text-ap-body text-ink">{headline}</Text>
          <Text className="font-i5 text-ap-body text-muted">{detail}</Text>
        </View>
        {scan.source ? <AiTag source={scan.source} className="mt-2" /> : null}
      </Card>

      <View className="mt-3.5 flex-row items-center justify-between">
        <Text className="font-i8 text-ap-card text-ink">What you can do now</Text>
        {scan.mode === 'leaf' && scan.tone !== 'healthy' ? <Pill tone="good">No chemicals first</Pill> : null}
      </View>
      <View className="mt-2 flex-row gap-2">
        {actionsFor(scan).map((a, i) => {
          const Icon = ICONS[i];
          return (
            <Pressable key={a.title} onPress={() => showToast(a.title)} className="flex-1">
              <Card className="items-center p-2.5">
                <View className="h-9 w-9 items-center justify-center rounded-full bg-good-soft">
                  <Icon size={18} color={i === 2 ? colors.accent : colors.good} />
                </View>
                <Text className="mt-1.5 text-center font-i7 text-ap-body text-ink">{a.title}</Text>
                <Text className="text-center font-i5 text-ap-small text-muted">{a.hint}</Text>
              </Card>
            </Pressable>
          );
        })}
      </View>

      <View className="mt-2.5 flex-row gap-2">
        {pending ? (
          <Button compact className="flex-1" variant="primary" label={`Save to ${target}`} icon={<Check size={18} color="#fff" strokeWidth={2.6} />} onPress={save} />
        ) : (
          <Button
            compact
            className="flex-1"
            variant="primary"
            label="Re-check"
            icon={<Camera size={16} color="#fff" />}
            onPress={() => openCamera(router, { fieldId: scan.fieldId, treeId: scan.treeId, mode: scan.mode })}
          />
        )}
        <Button compact className="flex-1" variant="outline" label="Ask an agronomist" icon={<User size={16} color={colors.ink} />} onPress={() => showToast('An agronomist will call you today')} />
      </View>
    </Screen>
  );
}
