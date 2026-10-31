import { Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

/** AgroPulse mark (a rising chevron, like the app icon) in a black rounded square. */
export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <View className="items-center justify-center bg-ink" style={{ width: size, height: size, borderRadius: size * 0.3 }}>
      <Svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24">
        <Path d="M4 19 L12 5 L20 19" stroke="#B9E09A" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </Svg>
    </View>
  );
}

export function Logo({ size = 36, textClassName = 'text-ap-card' }: { size?: number; textClassName?: string }) {
  return (
    <View className="flex-row items-center gap-2.5">
      <LogoMark size={size} />
      <Text className={`font-i8 text-ink ${textClassName}`}>AgroPulse</Text>
    </View>
  );
}
