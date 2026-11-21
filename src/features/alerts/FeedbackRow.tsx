import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { Assessment } from '@/lib/risk';
import { findFeedback } from '@/lib/feedback';
import { useStore } from '@/state/store';
import { useT } from '@/state/i18n';
import { colors } from '@/theme/tokens';

const REASONS = ['I checked, no signs', 'Already treated', 'Weather was different'];

/** "Was this right?" with 👍 / 👎 and an optional reason. The answer is saved as training data. */
export function FeedbackRow({ fieldId, assessment }: { fieldId: string; assessment: Assessment }) {
  const entries = useStore((s) => s.feedback);
  const answer = useStore((s) => s.answerFeedback);
  const saved = findFeedback(entries, fieldId, assessment.threat, assessment.day);
  const [askReason, setAskReason] = useState(false);
  const [reason, setReason] = useState('');
  const t = useT();

  const thumbsUp = () => {
    setAskReason(false);
    answer({ fieldId, assessment, answer: 'right' });
  };
  const send = () => {
    answer({ fieldId, assessment, answer: 'wrong', reason });
    setAskReason(false);
  };

  return (
    <View className="mt-1.5 pt-1">
      <View className="flex-row items-center">
        <Text className="flex-1 font-i5 text-ap-small text-muted">{t('Was this right?')}</Text>
        <Pressable
          onPress={thumbsUp}
          accessibilityLabel={t('Yes, this was right')}
          className={`mr-1.5 h-7 w-9 items-center justify-center rounded-full border ${saved?.answer === 'right' ? 'border-good bg-good-soft' : 'border-line bg-card'}`}
        >
          <Text className="text-[13px]">👍</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setAskReason(true);
            setReason(saved?.answer === 'wrong' ? (saved.reason ?? '') : '');
          }}
          accessibilityLabel={t('No, this was not right')}
          className={`h-7 w-9 items-center justify-center rounded-full border ${saved?.answer === 'wrong' ? 'border-risk bg-risk-soft' : 'border-line bg-card'}`}
        >
          <Text className="text-[13px]">👎</Text>
        </Pressable>
      </View>

      {askReason ? (
        <View className="mt-2">
          <Text className="font-i6 text-ap-small text-muted">{t('What did you see? (optional)')}</Text>
          <View className="mt-1.5 flex-row flex-wrap gap-1.5">
            {REASONS.map((r) => (
              <Pressable key={r} onPress={() => setReason(r)} className={`h-[30px] justify-center rounded-full border px-3 ${reason === r ? 'border-ink bg-ink' : 'border-line bg-card'}`}>
                <Text className={`font-i7 text-ap-pill ${reason === r ? 'text-white' : 'text-ink'}`}>{t(r)}</Text>
              </Pressable>
            ))}
          </View>
          <View className="mt-2 flex-row items-center gap-2">
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder={t('Write your own reason')}
              placeholderTextColor={colors.muted}
              maxLength={120}
              className="h-10 flex-1 rounded-xl border border-line bg-card px-3 font-i5 text-ap-body text-ink"
              style={{ outlineStyle: 'none' } as object}
            />
            <Pressable onPress={send} accessibilityRole="button" className="h-10 items-center justify-center rounded-full bg-ink px-4">
              <Text className="font-i7 text-ap-btn text-white">{t('Send')}</Text>
            </Pressable>
          </View>
        </View>
      ) : saved ? (
        <Text className="mt-1 font-i5 text-ap-small text-good">
          {saved.answer === 'right'
            ? t('Thanks! Your answer helps the forecast learn.')
            : saved.reason
              ? t('Thanks! We noted: not right ({reason}).', { reason: t(saved.reason) })
              : t('Thanks! We noted: not right.')}
        </Text>
      ) : null}
    </View>
  );
}
