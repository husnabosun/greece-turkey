import type { ReactNode } from 'react';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_BAR_HEIGHT } from '@/theme/tokens';

/**
 * Shared page wrapper for every screen: starts 10 px below the status bar, 20 px side padding,
 * and (with `tabs`) ends 12 px above the tab bar. Rows that should bleed to the screen edge
 * use `-mx-5` with `px-5` inside (see FieldChips).
 */
export function Screen({ children, tabs = true, topPadding = true }: { children: ReactNode; tabs?: boolean; topPadding?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      className="flex-1 bg-bg"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingTop: topPadding ? insets.top + 10 : 10,
        paddingHorizontal: 20,
        paddingBottom: tabs ? TAB_BAR_HEIGHT + insets.bottom + 12 : insets.bottom + 24,
      }}
    >
      {children}
    </ScrollView>
  );
}

/** Distance from the screen bottom to the top of the tab bar, for floating buttons and sheets. */
export function useTabBarOffset() {
  return TAB_BAR_HEIGHT + useSafeAreaInsets().bottom;
}
