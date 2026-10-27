import type { ReactNode } from 'react';
import { Platform, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';
import { useStore } from '@/state/store';
import { colors, PHONE } from '@/theme/tokens';

const BEZEL = 12;
const OUTER_W = PHONE.width + BEZEL * 2;
const OUTER_H = PHONE.height + BEZEL * 2;
export const FRAME_INSETS = { top: 54, bottom: 20, left: 0, right: 0 };

/** On wide web screens, shows the app inside an iPhone 15 style frame. Otherwise full screen. */
export function PhoneFrame({ children }: { children: ReactNode }) {
  const { width, height } = useWindowDimensions();
  const framed = Platform.OS === 'web' && width > PHONE.breakpoint;

  if (!framed) return <View className="flex-1 bg-bg">{children}</View>;

  const scale = Math.min(1, (height - 40) / OUTER_H, (width - 40) / OUTER_W);

  return (
    <View className="flex-1 items-center justify-center overflow-hidden bg-stage">
      <View
        style={{
          width: OUTER_W,
          height: OUTER_H,
          padding: BEZEL,
          borderRadius: 56,
          backgroundColor: '#111',
          transform: [{ scale }],
          boxShadow: '0 30px 60px rgba(40,60,90,0.3)',
        }}
      >
        <View style={{ flex: 1, borderRadius: 46, overflow: 'hidden', backgroundColor: colors.bg }}>
          <SafeAreaInsetsContext.Provider value={FRAME_INSETS}>{children}</SafeAreaInsetsContext.Provider>
          <FakeStatusBar />
          <View style={{ position: 'absolute', top: 11, alignSelf: 'center', width: 120, height: 34, borderRadius: 17, backgroundColor: '#000', zIndex: 60 }} />
          <View style={{ position: 'absolute', bottom: 8, alignSelf: 'center', width: 134, height: 5, borderRadius: 3, backgroundColor: '#1d1d1d', zIndex: 60 }} />
        </View>
      </View>
    </View>
  );
}

function FakeStatusBar() {
  const dark = useStore((s) => s.darkChrome);
  const ink = dark ? '#fff' : colors.ink;
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, height: FRAME_INSETS.top, zIndex: 50, backgroundColor: dark ? '#0B0B0B' : colors.bg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 34, paddingRight: 30 }}
    >
      <Text style={{ fontFamily: 'Inter_600SemiBold', fontSize: 16, color: ink }}>9:41</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Svg width={18} height={12} viewBox="0 0 18 12">
          <Rect x={0} y={8} width={3} height={4} rx={1} fill={ink} />
          <Rect x={5} y={5.5} width={3} height={6.5} rx={1} fill={ink} />
          <Rect x={10} y={3} width={3} height={9} rx={1} fill={ink} />
          <Rect x={15} y={0} width={3} height={12} rx={1} fill={ink} />
        </Svg>
        <Svg width={16} height={12} viewBox="0 0 16 12">
          <Path d="M8 11.5l2.2-2.6a3.2 3.2 0 00-4.4 0z M3.6 6.6a6.3 6.3 0 018.8 0l1.4-1.6a8.5 8.5 0 00-11.6 0z M.8 3.4a10.4 10.4 0 0114.4 0L16 2.4a12 12 0 00-16 0z" fill={ink} />
        </Svg>
        <Svg width={27} height={13} viewBox="0 0 27 13">
          <Rect x={0.5} y={0.5} width={23} height={12} rx={3.5} fill="none" stroke={ink} opacity={0.4} />
          <Rect x={2} y={2} width={20} height={9} rx={2} fill={ink} />
          <Rect x={24.5} y={4.5} width={2} height={4} rx={1} fill={ink} opacity={0.4} />
        </Svg>
      </View>
    </View>
  );
}
