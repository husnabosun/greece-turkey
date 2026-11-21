import { usePathname, useRouter } from 'expo-router';
import { Search } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RoundButton, ScreenHeader } from '@/components/ScreenHeader';
import { useT } from '@/state/i18n';
import { useStore } from '@/state/store';
import { colors } from '@/theme/tokens';

const TABS = [
  { label: 'Overview', path: '/farmer/market' },
  { label: 'Requests', path: '/farmer/market/requests' },
  { label: 'Offers', path: '/farmer/market/offers' },
  { label: 'Sales', path: '/farmer/market/sales' },
] as const;

/** Title and sub-tabs shared by the four Market screens. Switching only swaps the content below. */
export function MarketHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const t = useT();
  const openOffers = useStore((s) => s.offers.filter((o) => o.status === 'open').length);
  const showToast = useStore((s) => s.showToast);

  return (
    <View className="bg-bg px-5" style={{ paddingTop: insets.top + 10 }}>
      <ScreenHeader
        title={t('Market')}
        right={
          <RoundButton label={t('Search')} onPress={() => showToast('Search is coming soon')}>
            <Search size={18} color={colors.ink} />
          </RoundButton>
        }
      />
      <View className="mt-2.5 h-10 flex-row rounded-full bg-soft p-1">
        {TABS.map((tab) => {
          const on = pathname === tab.path || (tab.path === '/farmer/market' && pathname === '/farmer/market/');
          return (
            <Pressable
              key={tab.path}
              onPress={() => !on && router.replace(tab.path)}
              accessibilityRole="tab"
              className={`flex-1 flex-row items-center justify-center gap-1 rounded-full ${on ? 'bg-ink' : ''}`}
            >
              <Text className={`font-i7 text-ap-pill ${on ? 'text-white' : 'text-muted'}`}>{t(tab.label)}</Text>
              {tab.label === 'Offers' && openOffers > 0 ? (
                <View className="h-4 min-w-[16px] items-center justify-center rounded-full bg-risk px-1">
                  <Text className="font-i7 text-[10px] text-white">{openOffers}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
