import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Check, Sparkles } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Scan, ScanMode } from '@/data/mock';
import { diagnose } from '@/lib/diagnosis';
import { useStore } from '@/state/store';
import { colors } from '@/theme/tokens';
import { ScanPhoto } from './ScanPhoto';

const STEPS: Record<Exclude<ScanMode, 'label'>, string[]> = {
  leaf: ['Checking the photo is clear', 'Looking for spots on the leaf', 'Comparing with known olive problems', 'Preparing your result'],
  fruit: ['Checking the photo is clear', 'Looking for marks on the fruit', 'Comparing with known olive problems', 'Preparing your result'],
  trap: ['Checking the photo is clear', 'Counting the flies on the trap', 'Comparing with last week', 'Preparing your result'],
};
const TOTAL_MS = 1500;
const STEP_MS = 330;

const whenLabel = (d = new Date()) => `Today, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** Shows the steps one by one for about 1.5 s, then replaces itself with the result. */
export function AnalysingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ fieldId?: string; treeId?: string; mode?: string }>();
  const captureUri = useStore((s) => s.captureUri);
  const setPendingScan = useStore((s) => s.setPendingScan);
  const setDarkChrome = useStore((s) => s.setDarkChrome);
  const scans = useStore((s) => s.scans);

  const mode = (params.mode === 'fruit' || params.mode === 'trap' ? params.mode : 'leaf') as Exclude<ScanMode, 'label'>;
  const treeId = params.treeId ? Number(params.treeId) : undefined;
  const fieldId = params.fieldId ?? 'north';

  const [shown, setShown] = useState(0);
  const line = useRef(new Animated.Value(0)).current;
  const started = useRef(false);
  const id = useRef(`sc${Date.now()}`).current;

  const previousSpots = treeId
    ? scans.filter((s) => s.fieldId === fieldId && s.treeId === treeId && s.spots !== undefined).sort((a, b) => b.ts - a.ts)[0]?.spots
    : undefined;
  const dx = diagnose(mode, { previousSpots });
  const preview = { photo: dx.photo, spots: dx.spots, flies: dx.flies, uri: captureUri ?? undefined };

  useEffect(() => {
    setDarkChrome(true);
    return () => setDarkChrome(false);
  }, [setDarkChrome]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    Animated.loop(
      Animated.sequence([
        Animated.timing(line, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(line, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: Platform.OS !== 'web' }),
      ]),
    ).start();

    const timers = STEPS[mode].map((_, i) => setTimeout(() => setShown(i + 1), i * STEP_MS + 120));
    timers.push(
      setTimeout(() => {
        const scan: Scan = {
          id,
          fieldId,
          treeId,
          mode,
          ...dx,
          date: 'Today',
          when: whenLabel(),
          ts: Date.now(),
          uri: captureUri ?? undefined,
          recheckDue: false,
        };
        setPendingScan(scan);
        router.replace(`/scan/result/${id}`);
      }, TOTAL_MS),
    );
    return () => timers.forEach(clearTimeout);
    // Runs once; the values are read from the first render on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View className="flex-1 items-center bg-[#0B0B0B] px-6" style={{ paddingTop: insets.top + 40 }}>
      <StatusBar style="light" />
      <View className="h-[220px] w-[220px] overflow-hidden rounded-[24px] border-2 border-white/80">
        <ScanPhoto {...preview} />
        <View className="absolute inset-0 bg-black/25" />
        <Animated.View
          className="absolute left-0 right-0 top-0 h-[3px] bg-lime"
          style={{ transform: [{ translateY: line.interpolate({ inputRange: [0, 1], outputRange: [0, 214] }) }] }}
        />
      </View>

      <View className="mt-6 flex-row items-center gap-2">
        <Sparkles size={18} color={colors.lime} />
        <Text className="font-i8 text-ap-card text-white">Analysing your photo</Text>
      </View>
      <Text className="mt-1 font-i5 text-ap-body text-white/60">This takes a few seconds.</Text>

      <View className="mt-6 w-full gap-3">
        {STEPS[mode].map((label, i) => (
          <View key={label} className="h-6 flex-row items-center gap-2.5" style={{ opacity: i < shown ? 1 : 0 }}>
            <View className="h-5 w-5 items-center justify-center rounded-full bg-lime">
              <Check size={12} color={colors.ink} strokeWidth={3} />
            </View>
            <Text className="font-i6 text-ap-body text-white">{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
