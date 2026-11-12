import { Slot } from 'expo-router';
import { MarketHeader } from '@/features/market/MarketHeader';
import { View } from 'react-native';

export default function MarketLayout() {
  return (
    <View className="flex-1">
      <MarketHeader />
      <Slot />
    </View>
  );
}
