import { useRouter } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { Logo } from '@/components/Logo';
import { colors } from '@/theme/tokens';

/** Small drawing of the farmer app: score ring, two cards and the tab bar. */
function PhoneArt() {
  return (
    <Svg width={104} height={172} viewBox="0 0 104 172" accessibilityLabel="Phone showing the farmer app">
      <Rect x={1} y={1} width={102} height={170} rx={20} fill={colors.dark} />
      <Rect x={5} y={5} width={94} height={162} rx={16} fill={colors.bg} />
      <Rect x={38} y={9} width={28} height={8} rx={4} fill={colors.dark} />
      <Rect x={13} y={26} width={46} height={7} rx={3.5} fill={colors.ink} />
      <Rect x={13} y={37} width={30} height={4} rx={2} fill={colors.line} />
      <Rect x={13} y={50} width={78} height={44} rx={10} fill="#fff" stroke={colors.line} />
      <Circle cx={34} cy={72} r={14} stroke={colors.goodSoft} strokeWidth={5} fill="none" />
      <Circle cx={34} cy={72} r={14} stroke={colors.good} strokeWidth={5} fill="none" strokeLinecap="round" strokeDasharray="62 88" transform="rotate(-90 34 72)" />
      <Rect x={56} y={62} width={26} height={5} rx={2.5} fill={colors.ink} />
      <Rect x={56} y={73} width={20} height={4} rx={2} fill={colors.line} />
      <Rect x={13} y={100} width={78} height={24} rx={8} fill={colors.riskSoft} />
      <Rect x={20} y={108} width={36} height={5} rx={2.5} fill={colors.risk} />
      <Rect x={13} y={130} width={78} height={18} rx={8} fill="#fff" stroke={colors.line} />
      <Rect x={5} y={150} width={94} height={17} rx={0} fill="#fff" />
      <Rect x={5} y={150} width={94} height={1} fill={colors.line} />
      <Circle cx={22} cy={159} r={4} fill={colors.line} />
      <Circle cx={42} cy={159} r={4} fill={colors.line} />
      <Circle cx={62} cy={159} r={4} fill={colors.line} />
      <Circle cx={82} cy={159} r={5.5} fill={colors.dark} />
    </Svg>
  );
}

/** Small drawing of the processor panel: sidebar with a black pill, stat cards and a list. */
function LaptopArt() {
  return (
    <Svg width={216} height={158} viewBox="0 0 216 158" accessibilityLabel="Laptop showing the processor panel">
      <Rect x={14} y={2} width={188} height={126} rx={10} fill={colors.dark} />
      <Rect x={19} y={7} width={178} height={116} rx={6} fill={colors.bg} />
      <Rect x={19} y={7} width={44} height={116} rx={6} fill="#fff" />
      <Rect x={63} y={7} width={1} height={116} fill={colors.line} />
      <Rect x={26} y={15} width={30} height={6} rx={3} fill={colors.ink} />
      <Rect x={25} y={30} width={32} height={9} rx={4.5} fill={colors.ink} />
      <Rect x={25} y={44} width={32} height={9} rx={4.5} fill={colors.soft} />
      <Rect x={25} y={58} width={32} height={9} rx={4.5} fill={colors.soft} />
      <Rect x={74} y={16} width={56} height={9} rx={4} fill={colors.ink} />
      <Rect x={74} y={30} width={34} height={14} rx={5} fill="#fff" stroke={colors.line} />
      <Rect x={112} y={30} width={34} height={14} rx={5} fill="#fff" stroke={colors.line} />
      <Rect x={150} y={30} width={38} height={14} rx={5} fill="#fff" stroke={colors.line} />
      <Rect x={74} y={52} width={114} height={62} rx={7} fill="#fff" stroke={colors.line} />
      {[0, 1, 2].map((i) => (
        <G key={i}>
          <Rect x={80} y={58 + i * 19} width={12} height={12} rx={3} fill={colors.goodSoft} />
          <Rect x={97} y={60 + i * 19} width={36} height={4} rx={2} fill={colors.ink} />
          <Rect x={97} y={67 + i * 19} width={24} height={3} rx={1.5} fill={colors.line} />
          <Rect x={150} y={59 + i * 19} width={13} height={10} rx={3} fill={colors.goodSoft} />
          <Rect x={168} y={59 + i * 19} width={14} height={10} rx={5} fill={colors.ink} />
        </G>
      ))}
      <Path d="M4 131 H212 L206 142 Q205 144 202 144 H14 Q11 144 10 142 Z" fill="#CFCFCB" />
      <Rect x={88} y={131} width={40} height={4} rx={2} fill="#B5B5B0" />
    </Svg>
  );
}

function ChoiceCard({ title, text, cta, art, onPress }: { title: string; text: string; cta: string; art: ReactNode; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={`${title}. ${text}`}
      className="min-w-[300px] flex-1 overflow-hidden rounded-[22px] border border-line bg-card hover:border-ink"
    >
      <View className="h-[220px] items-center justify-center bg-soft">{art}</View>
      <View className="p-6">
        <Text className="font-i8 text-[28px] leading-[34px] text-ink">{title}</Text>
        <Text className="mt-1.5 font-i5 text-ap-card text-muted">{text}</Text>
        <View className="mt-5 h-11 flex-row items-center gap-2 self-start rounded-full bg-ink px-5">
          <Text className="font-i7 text-ap-btn text-white">{cta}</Text>
          <ArrowRight size={16} color="#fff" />
        </View>
      </View>
    </Pressable>
  );
}

/** Web landing page: the demo viewer chooses the farmer app or the processor panel. */
export function LandingScreen() {
  const router = useRouter();
  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ alignItems: 'center', paddingHorizontal: 20, paddingVertical: 48 }}>
      <View className="w-full max-w-[980px] items-center">
        <Logo size={44} textClassName="text-[26px]" />
        <Text accessibilityRole="header" className="mt-8 text-center font-i8 text-[40px] leading-[46px] text-ink">From healthy groves to direct sales</Text>
        <Text className="mt-2 text-center font-i5 text-ap-card text-muted">Choose a view to open the demo.</Text>

        <View className="mt-10 w-full flex-row flex-wrap gap-5">
          <ChoiceCard
            title="Farmer app"
            text="Risks, leaf scan, logbook, quality score, market"
            cta="Open farmer app"
            art={<PhoneArt />}
            onPress={() => router.push('/farmer')}
          />
          <ChoiceCard
            title="Processor panel"
            text="Find quality olives, make offers, track deliveries"
            cta="Open processor panel"
            art={<LaptopArt />}
            onPress={() => router.push('/processor')}
          />
        </View>

        <Text className="mt-8 text-center font-i5 text-ap-body text-muted">Demo with sample data. Offers accepted in the farmer app appear in the processor panel.</Text>
      </View>
    </ScrollView>
  );
}
