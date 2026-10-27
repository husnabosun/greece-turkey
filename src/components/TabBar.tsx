import type { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Camera, House, ScrollText, ShoppingBasket, Sprout, type LucideIcon } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_BAR_HEIGHT } from '@/theme/tokens';

type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const TABS: Record<string, { label: string; Icon: LucideIcon }> = {
  index: { label: 'Home', Icon: House },
  field: { label: 'Field', Icon: Sprout },
  scan: { label: 'Scan', Icon: Camera },
  logbook: { label: 'Logbook', Icon: ScrollText },
  market: { label: 'Market', Icon: ShoppingBasket },
};

/** Solid bar fixed to the bottom edge: full width, white, 1 px top border, safe area added below. */
export function TabBar({ state, navigateToTab }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      className="absolute bottom-0 left-0 right-0 flex-row items-start justify-around border-t border-line bg-white"
      style={{ height: TAB_BAR_HEIGHT + insets.bottom, paddingTop: 6 }}
    >
      {state.routes.map((route, i) => {
        const tab = TABS[route.name];
        if (!tab) return null;
        const focused = state.index === i;
        return (
          <Pressable
            key={route.key}
            onPress={() => !focused && navigateToTab(route.key)}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            className="w-16 items-center"
          >
            <View className={`h-9 w-9 items-center justify-center rounded-full ${focused ? 'bg-primary' : ''}`}>
              <tab.Icon size={22} strokeWidth={focused ? 2.2 : 1.8} color={focused ? '#fff' : '#444'} />
            </View>
            <Text className={`mt-0.5 text-ap-small ${focused ? 'font-i7 text-ink' : 'font-i5 text-muted'}`}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
