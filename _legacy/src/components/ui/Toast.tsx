import { Sparkles } from 'lucide-react-native';
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '@/state/store';
import { colors } from '@/theme/tokens';

/** Renders the current toast from the store; hides itself after 2.5 s. */
export function Toast() {
  const toast = useStore((s) => s.toast);
  const hide = useStore((s) => s.hideToast);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(hide, 2500);
    return () => clearTimeout(t);
  }, [toast, hide]);

  if (!toast) return null;
  return (
    <View pointerEvents="none" className="absolute left-4 right-4 z-[55] items-center" style={{ top: insets.top + 6 }}>
      <View className="flex-row items-center gap-2 rounded-full bg-ink px-3.5 py-2.5">
        <Sparkles size={14} color={colors.lime} />
        <Text className="font-i6 text-ap-body text-white">{toast.text}</Text>
      </View>
    </View>
  );
}
