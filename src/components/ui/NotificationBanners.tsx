import { usePathname, useRouter } from 'expo-router';
import { Sprout } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Animated, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useT } from '@/state/i18n';
import { useStore } from '@/state/store';

const VISIBLE_MS = 4000;
const SLIDE_MS = 300;
/** Far enough up to hide three banners. */
const HIDDEN_Y = -400;

/**
 * In-app banners that slide down from the top, disappear after 4 s, and open their screen (This week by default) when tapped.
 * They wait while the farmer app is not on screen (e.g. the processor panel is open on top of it), so a new offer is not missed.
 */
export function NotificationBanners() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useT();
  const banners = useStore((s) => s.banners);
  const hide = useStore((s) => s.hideBanners);
  // The farmer layout can stay mounted under the processor panel: only show banners while a farmer screen is open.
  const visible = usePathname().startsWith('/farmer');
  const y = useRef(new Animated.Value(HIDDEN_Y)).current;
  const native = Platform.OS !== 'web';

  useEffect(() => {
    if (!banners || !visible) return;
    y.setValue(HIDDEN_Y);
    Animated.timing(y, { toValue: 0, duration: SLIDE_MS, useNativeDriver: native }).start();
    const t = setTimeout(() => {
      Animated.timing(y, { toValue: HIDDEN_Y, duration: SLIDE_MS, useNativeDriver: native }).start(() => hide());
    }, VISIBLE_MS);
    return () => clearTimeout(t);
  }, [banners, visible, hide, native, y]);

  if (!banners || !visible) return null;

  const open = (href?: string) => {
    hide();
    router.push((href ?? '/farmer/tasks') as never);
  };

  return (
    // Layout in `style`, not className: NativeWind does not style Animated.View, which put the banners in the page flow.
    <Animated.View pointerEvents="box-none" style={{ position: 'absolute', left: 12, right: 12, zIndex: 70, gap: 8, top: insets.top + 4, transform: [{ translateY: y }] }}>
      {banners.map((n) => (
        <Pressable key={n.id} onPress={() => open(n.href)} accessibilityRole="button" className="flex-row rounded-[18px] bg-[#E4E4D8] p-3" style={{ boxShadow: '0 6px 18px rgba(0,0,0,0.18)' }}>
          <View className="h-9 w-9 items-center justify-center rounded-[10px] bg-primary">
            <Sprout size={20} color="#fff" />
          </View>
          <View className="ml-2.5 flex-1">
            <View className="flex-row justify-between">
              <Text className="font-i6 text-ap-small tracking-[0.5px] text-muted">AGROPULSE</Text>
              <Text className="font-i5 text-ap-small text-muted">{t(n.when)}</Text>
            </View>
            <Text className="font-i8 text-ap-body text-ink">{`${n.emoji} ${t(n.title)}`}</Text>
            <Text className="font-i5 text-ap-small text-[#444]">{t(n.body)}</Text>
          </View>
        </Pressable>
      ))}
    </Animated.View>
  );
}
