import { Redirect, Slot } from 'expo-router';
import { Platform } from 'react-native';
import { ProcessorShell } from '@/features/processor/ProcessorShell';

/** The processor panel is a website. On iOS and Android its routes send the user to the farmer app. */
export default function ProcessorLayout() {
  if (Platform.OS !== 'web') return <Redirect href="/farmer" />;
  return (
    <ProcessorShell>
      <Slot />
    </ProcessorShell>
  );
}
