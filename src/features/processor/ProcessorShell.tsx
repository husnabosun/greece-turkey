import { usePathname, useRouter } from 'expo-router';
import { ClipboardList, LayoutDashboard, Search, Truck, type LucideIcon } from 'lucide-react-native';
import { useEffect, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Logo } from '@/components/Logo';
import { SwitchViewLink } from '@/components/SwitchViewLink';
import { Toast } from '@/components/ui';
import { processor } from '@/data/mock';
import { useStore } from '@/state/store';
import { CONTENT_MAX, Initials, useWide } from './kit';

const NAV: { label: string; path: string; Icon: LucideIcon }[] = [
  { label: 'Overview', path: '/processor', Icon: LayoutDashboard },
  { label: 'Find olives', path: '/processor/lots', Icon: Search },
  { label: 'My requests', path: '/processor/requests', Icon: ClipboardList },
  { label: 'Deliveries', path: '/processor/deliveries', Icon: Truck },
];

const isActive = (pathname: string, path: string) => (path === '/processor' ? pathname === '/processor' || pathname === '/processor/' : pathname === path || pathname.startsWith(`${path}/`));

function NavPill({ item, active, onPress, badge }: { item: (typeof NAV)[number]; active: boolean; onPress: () => void; badge?: number }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityState={{ selected: active }}
      className={`h-11 shrink-0 flex-row items-center gap-2.5 rounded-full px-3.5 ${active ? 'bg-ink' : 'hover:bg-soft'}`}
    >
      <item.Icon size={18} color={active ? '#fff' : '#151515'} strokeWidth={active ? 2.2 : 1.9} />
      <Text className={`font-i7 text-ap-btn ${active ? 'text-white' : 'text-ink'}`}>{item.label}</Text>
      {badge ? (
        <View className="h-4 min-w-[16px] items-center justify-center rounded-full bg-risk px-1">
          <Text className="font-i7 text-[10px] text-white">{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** Web only. Wide: white sidebar on the left. Narrow: a top bar with the menu as pills. Content is at most 1200 px wide. */
export function ProcessorShell({ children }: { children: ReactNode }) {
  const wide = useWide();
  const router = useRouter();
  const pathname = usePathname();
  const loadAreaWeather = useStore((s) => s.loadAreaWeather);
  useEffect(() => {
    void loadAreaWeather();
    const t = setInterval(() => void loadAreaWeather(), 15 * 60 * 1000);
    return () => clearInterval(t);
  }, [loadAreaWeather]);
  const openIncoming = useStore((s) => s.incomingOffers.filter((o) => o.status === 'open').length);
  const badgeFor = (path: string) => (path === '/processor' ? openIncoming : undefined);

  return (
    <View className={`flex-1 bg-bg ${wide ? 'flex-row' : ''}`}>
      {wide ? (
        <View className="w-[240px] border-r border-line bg-card px-4 py-5" accessibilityRole="navigation">
          <Logo />
          <View className="mt-6 flex-row items-center gap-2.5 rounded-2xl bg-bg p-2.5">
            <Initials text={processor.initials} size={40} />
            <View className="flex-1">
              <Text numberOfLines={1} className="font-i8 text-ap-body text-ink">{processor.name}</Text>
              <Text className="font-i5 text-ap-small text-muted">Processor panel</Text>
            </View>
          </View>
          <View className="mt-5 gap-1">
            {NAV.map((item) => (
              <NavPill key={item.path} item={item} active={isActive(pathname, item.path)} badge={badgeFor(item.path)} onPress={() => router.navigate(item.path)} />
            ))}
          </View>
          <View className="flex-1" />
          <SwitchViewLink className="self-start px-0" />
          <Text className="mt-1 font-i5 text-ap-small text-muted">Demo with sample data</Text>
        </View>
      ) : (
        <View className="border-b border-line bg-card px-4 pb-3 pt-3" accessibilityRole="navigation">
          <View className="flex-row items-center justify-between">
            <Logo size={30} />
            <SwitchViewLink className="px-2" />
          </View>
          <Text numberOfLines={1} className="mt-1 font-i5 text-ap-small text-muted">{`${processor.name} · Processor panel`}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4 mt-2.5" contentContainerClassName="gap-1.5 px-4">
            {NAV.map((item) => (
              <NavPill key={item.path} item={item} active={isActive(pathname, item.path)} badge={badgeFor(item.path)} onPress={() => router.navigate(item.path)} />
            ))}
          </ScrollView>
        </View>
      )}

      <ScrollView className="flex-1" contentContainerStyle={{ alignItems: 'center' }}>
        <View style={{ width: '100%', maxWidth: CONTENT_MAX, padding: wide ? 32 : 16, paddingBottom: 56 }}>{children}</View>
      </ScrollView>
      <Toast />
    </View>
  );
}
