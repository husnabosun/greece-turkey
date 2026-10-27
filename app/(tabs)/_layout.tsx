import { Tabs } from 'expo-router';
import { TabBar } from '@/components/TabBar';

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false, lazy: true, sceneStyle: { backgroundColor: '#FAFAF8' } }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="field" />
      <Tabs.Screen name="scan" />
      <Tabs.Screen name="logbook" />
      <Tabs.Screen name="market" />
    </Tabs>
  );
}
