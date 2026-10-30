import { Sparkles } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { SOURCE_LABEL, type AiSource } from '@/lib/ai/schemas';
import { colors } from '@/theme/tokens';

/** Marks AI content and says where it came from: "✦ AI · Gemini", "✦ AI · Our model" or "Demo result". */
export function AiTag({ source, className = '' }: { source: AiSource; className?: string }) {
  if (source === 'demo') {
    return (
      <View className={`h-6 flex-row items-center self-start rounded-full bg-soft px-2.5 ${className}`}>
        <Text className="font-i7 text-ap-small text-muted">Demo result</Text>
      </View>
    );
  }
  return (
    <View className={`h-6 flex-row items-center gap-1 self-start rounded-full bg-good-soft px-2.5 ${className}`}>
      <Sparkles size={11} color={colors.good} />
      <Text className="font-i7 text-ap-small text-good">{`AI · ${SOURCE_LABEL[source]}`}</Text>
    </View>
  );
}

/** Small tag on a form field that was filled in from a label photo. */
export function FromLabelTag() {
  return (
    <View className="h-5 flex-row items-center gap-1 self-start rounded-full bg-good-soft px-2">
      <Sparkles size={10} color={colors.good} />
      <Text className="font-i7 text-[11px] text-good">Read from label</Text>
    </View>
  );
}

/** Shown under every photo upload. */
export function PrivacyLine({ dark = false }: { dark?: boolean }) {
  return <Text className={`text-center font-i5 text-ap-small ${dark ? 'text-white/60' : 'text-muted'}`}>Photos are sent to an AI service only to analyse them.</Text>;
}
