import { useRouter } from 'expo-router';
import { Bell, Camera, Check, ChevronRight, Droplet, RefreshCw, Sparkles } from 'lucide-react-native';
import { useMemo, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { RoundButton, ScreenHeader } from '@/components/ScreenHeader';
import { Screen } from '@/components/Screen';
import { Button, Card } from '@/components/ui';
import { factories, type AppNotification, type Task } from '@/data/mock';
import { openCamera } from '@/features/scan/nav';
import { activeInbox } from '@/lib/notifications';
import { useStore } from '@/state/store';
import { useT } from '@/state/i18n';
import { colors } from '@/theme/tokens';

const ICON: Record<Task['kind'], { bg: string; node: ReactNode }> = {
  photo: { bg: 'bg-risk-soft', node: <Camera size={18} color={colors.risk} /> },
  spray: { bg: 'bg-warn-soft', node: <Droplet size={18} color="#A9831F" /> },
  recheck: { bg: 'bg-accent-soft', node: <RefreshCw size={18} color={colors.accent} /> },
  plain: { bg: 'bg-good-soft', node: <Check size={18} color={colors.good} /> },
};

function TaskCard({ task }: { task: Task }) {
  const router = useRouter();
  const completeTask = useStore((s) => s.completeTask);
  const selectField = useStore((s) => s.selectField);
  const showToast = useStore((s) => s.showToast);
  const field = useStore((s) => s.fields.find((f) => f.id === task.fieldId)?.name ?? '');
  const t = useT();

  /** The task finishes when the scan is saved. */
  const takePhoto = () => openCamera(router, { fieldId: task.fieldId, mode: 'trap' });

  const yes = () => {
    completeTask(task.id, 'Spray noted. Add it to your logbook. Score +1');
    selectField(task.fieldId);
    router.push({ pathname: '/farmer/logbook', params: { add: '1' } });
  };

  return (
    <Card className={`mt-2 p-3 ${task.urgent ? 'border-[#EDBBAA] bg-[#FDF5F1]' : ''}`}>
      <View className="flex-row items-start">
        <View className={`h-9 w-9 items-center justify-center rounded-xl ${ICON[task.kind].bg}`}>{ICON[task.kind].node}</View>
        <View className="ml-2.5 flex-1">
          <Text className="font-i8 text-ap-body text-ink">{t(task.title)}</Text>
          <Text className="font-i5 text-ap-small text-muted">{[field, task.meta ? t(task.meta) : ''].filter(Boolean).join(' · ')}</Text>
        </View>
        <View className="h-6 justify-center rounded-lg bg-good-soft px-2">
          <Text className="font-i8 text-ap-small text-good">+1</Text>
        </View>
      </View>
      {task.why ? (
        <View className="mt-2 flex-row items-start gap-1.5 rounded-lg bg-soft p-2">
          <Sparkles size={13} color={colors.good} />
          <Text className="flex-1 font-i5 text-ap-small text-ink">{t(task.why)}</Text>
        </View>
      ) : null}
      <View className="mt-2 flex-row gap-2">
        {task.kind === 'photo' ? (
          <Button compact className="h-9 px-4" label={t('Take photo')} icon={<Camera size={16} color="#fff" />} onPress={takePhoto} />
        ) : task.kind === 'spray' ? (
          <>
            <Button compact className="h-9 px-4" label={t('Yes, add it')} onPress={yes} />
            <Button compact className="h-9 px-4" variant="outline" label={t('No')} onPress={() => completeTask(task.id, 'Noted: no spray this week. Score +1')} />
          </>
        ) : task.kind === 'recheck' ? (
          <Button compact className="h-9 px-4" label={t('Re-check now')} icon={<RefreshCw size={16} color="#fff" />} onPress={() => openCamera(router, { fieldId: task.fieldId, treeId: task.treeId, mode: 'leaf' })} />
        ) : (
          <Button compact className="h-9 px-4" label={t('Mark as done')} onPress={() => completeTask(task.id)} />
        )}
      </View>
    </Card>
  );
}

export function TasksScreen() {
  const router = useRouter();
  const t = useT();
  const tasks = useStore((s) => s.tasks);
  const open = tasks.filter((x) => !x.done);
  const done = tasks.filter((x) => x.done);
  const fields = useStore((s) => s.fields);
  const fieldName = (id: string) => fields.find((f) => f.id === id)?.name ?? '';
  const inboxIds = useStore((s) => s.inbox);
  const listings = useStore((s) => s.listings);
  const offers = useStore((s) => s.offers);
  const inbox = useMemo(
    () => activeInbox(inboxIds, { fields, listings, offers, factoryName: (id) => factories.find((f) => f.id === id)?.name ?? '' }),
    [inboxIds, fields, listings, offers],
  );

  return (
    <Screen tabs={false}>
      <ScreenHeader
        back
        title={t('This week')}
        right={
          <RoundButton label={t('Alerts')} onPress={() => router.push('/farmer/alerts')}>
            <Bell size={18} color={colors.ink} />
          </RoundButton>
        }
      />

      {inbox.length ? (
        <>
          <Text className="mt-3 font-i8 text-ap-card text-ink">{t('Notifications')}</Text>
          {inbox.map((n) => (
            <NotificationRow key={n.id} n={n} />
          ))}
        </>
      ) : null}

      <Card className="mt-2.5 flex-row items-center p-3">
        <View>
          <Text className="font-i5 text-ap-small text-muted">{t('Checks done')}</Text>
          <Text className="font-i8 text-ap-card text-ink">{t('{done} of {total}', { done: done.length, total: tasks.length })}</Text>
        </View>
        <View className="mx-3 h-2 flex-1 overflow-hidden rounded-full bg-[#ECEAE4]">
          <View className="h-full rounded-full bg-good" style={{ width: `${(done.length / Math.max(1, tasks.length)) * 100}%` }} />
        </View>
        <Text className="font-i8 text-ap-body text-good">{t('+{n} score', { n: done.length })}</Text>
      </Card>

      {open.length === 0 ? (
        <Card className="mt-2 items-center p-5">
          <Text className="font-i7 text-ap-body text-good">{t('All checks done. Well done!')}</Text>
        </Card>
      ) : null}
      {open.map((x) => (
        <TaskCard key={x.id} task={x} />
      ))}

      {done.map((x) => (
        <View key={x.id} className="mt-2 h-11 flex-row items-center gap-2.5 rounded-2xl bg-[#F4F3EF] px-3">
          <Check size={14} color={colors.good} strokeWidth={3} />
          <Text className="font-i6 text-ap-body text-[#555] line-through">{t(x.title)}</Text>
          <Text className="ml-auto font-i5 text-ap-small text-muted">{fieldName(x.fieldId)}</Text>
        </View>
      ))}
    </Screen>
  );
}

/** A notification that stays here after its banner is gone, e.g. a harvest reminder or a new offer. Tapping it opens its screen. */
function NotificationRow({ n }: { n: AppNotification }) {
  const router = useRouter();
  const t = useT();
  return (
    <Pressable onPress={() => n.href && router.push(n.href as never)} accessibilityRole="link" className="mt-2">
      <Card className="flex-row items-center border-good/30 bg-good-soft/60 p-3">
        <View className="h-9 w-9 items-center justify-center rounded-xl bg-white">
          <Text className="text-[18px]">{n.emoji}</Text>
        </View>
        <View className="ml-2.5 flex-1">
          <Text className="font-i8 text-ap-body text-ink">{t(n.title)}</Text>
          <Text className="font-i5 text-ap-small text-muted">{t(n.body)}</Text>
        </View>
        <ChevronRight size={16} color={colors.muted} />
      </Card>
    </Pressable>
  );
}
