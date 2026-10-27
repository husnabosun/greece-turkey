import { useRouter } from 'expo-router';
import { Sprout } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Animated, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '@/state/store';

const VISIBLE_MS = 4000;
const SLIDE_MS = 300;

/** In-app banners that slide down from the top, disappear after 4 s, and open This week when tapped. */
export function NotificationBanners() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const banners = useStore((s) => s.banners);
  const hide = useStore((s) => s.hideBanners);
  const y = useRef(new Animated.Value(-220)).current;
  const native = Platform.OS !== 'web';

  useEffect(() => {
    if (!banners) return;
    y.setValue(-220);
    Animated.timing(y, { toValue: 0, duration: SLIDE_MS, useNativeDriver: native }).start();
    const t = setTimeout(() => {
      Animated.timing(y, { toValue: -220, duration: SLIDE_MS, useNativeDriver: native }).start(() => hide());
    }, VISIBLE_MS);
    return () => clearTimeout(t);
  }, [banners, hide, native, y]);

  if (!banners) return null;

  const open = () => {
    hide();
    router.push('/tasks');
  };

  return (
    <Animated.View pointerEvents="box-none" className="absolute left-3 right-3 z-[70] gap-2" style={{ top: insets.top + 4, transform: [{ translateY: y }] }}>
      {banners.map((n) => (
        <Pressable key={n.id} onPress={open} accessibilityRole="button" className="flex-row rounded-[18px] bg-[#E4E4D8] p-3" style={{ boxShadow: '0 6px 18px rgba(0,0,0,0.18)' }}>
          <View className="h-9 w-9 items-center justify-center rounded-[10px] bg-primary">
            <Sprout size={20} color="#fff" />
          </View>
          <View className="ml-2.5 flex-1">
            <View className="flex-row justify-between">
              <Text className="font-i6 text-ap-small tracking-[0.5px] text-muted">AGROPULSE</Text>
              <Text className="font-i5 text-ap-small text-muted">{n.when}</Text>
            </View>
            <Text className="font-i8 text-ap-body text-ink">{`${n.emoji} ${n.title}`}</Text>
            <Text className="font-i5 text-ap-small text-[#444]">{n.body}</Text>
          </View>
        </Pressable>
      ))}
    </Animated.View>
  );
}
