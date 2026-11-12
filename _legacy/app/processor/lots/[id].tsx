import { useLocalSearchParams } from 'expo-router';
import { LotDetailPage } from '@/features/processor/LotDetailPage';

export default function ProcessorLot() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <LotDetailPage key={id} id={id} />;
}
