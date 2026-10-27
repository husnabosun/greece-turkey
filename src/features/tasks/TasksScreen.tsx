import { useRouter } from 'expo-router';
import { Bell, Camera, Check, Droplet, RefreshCw, Sparkles } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { RoundButton, ScreenHeader } from '@/components/ScreenHeader';
import { Screen } from '@/components/Screen';
import { Button, Card } from '@/components/ui';
import type { Task } from '@/data/mock';
import { openCamera } from '@/features/scan/nav';
import { useStore } from '@/state/store';
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

  /** The task finishes when the scan is saved. */
  const takePhoto = () => openCamera(router, { fieldId: task.fieldId, mode: 'trap' });

  const yes = () => {
    completeTask(task.id, 'Spray noted. Add it to your logbook. Score +1');
    selectField(task.fieldId);
    router.push({ pathname: '/logbook', params: { add: '1' } });
  };

  return (
    <Card className={`mt-2 p-3 ${task.urgent ? 'border-[#EDBBAA] bg-[#FDF5F1]' : ''}`}>
      <View className="flex-row items-start">
        <View className={`h-9 w-9 items-center justify-center rounded-xl ${ICON[task.kind].bg}`}>{ICON[task.kind].node}</View>
        <View className="ml-2.5 flex-1">
          <Text className="font-i8 text-ap-body text-ink">{task.title}</Text>
          <Text className="font-i5 text-ap-small text-muted">{task.meta}</Text>
        </View>
        <View className="h-6 justify-center rounded-lg bg-good-soft px-2">
          <Text className="font-i8 text-ap-small text-good">+1</Text>
        </View>
      </View>
      {task.why ? (
        <View className="mt-2 flex-row items-start gap-1.5 rounded-lg bg-soft p-2">
          <Sparkles size={13} color={colors.good} />
          <Text className="flex-1 font-i5 text-ap-small text-ink">{task.why}</Text>
        </View>
      ) : null}
      <View className="mt-2 flex-row gap-2">
        {task.kind === 'photo' ? (
          <Button compact className="h-9 px-4" label="Take photo" icon={<Camera size={16} color="#fff" />} onPress={takePhoto} />
        ) : task.kind === 'spray' ? (
          <>
            <Button compact className="h-9 px-4" label="Yes, add it" onPress={yes} />
            <Button compact className="h-9 px-4" variant="outline" label="No" onPress={() => completeTask(task.id, 'Noted: no spray this week. Score +1')} />
          </>
        ) : task.kind === 'recheck' ? (
          <Button compact className="h-9 px-4" label="Re-check now" icon={<RefreshCw size={16} color="#fff" />} onPress={() => openCamera(router, { fieldId: task.fieldId, treeId: task.treeId, mode: 'leaf' })} />
        ) : (
          <Button compact className="h-9 px-4" label="Mark as done" onPress={() => completeTask(task.id)} />
        )}
      </View>
    </Card>
  );
}

export function TasksScreen() {
  const router = useRouter();
  const tasks = useStore((s) => s.tasks);
  const open = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);
  const fields = useStore((s) => s.fields);
  const fieldName = (id: string) => fields.find((f) => f.id === id)?.name ?? '';

  return (
    <Screen tabs={false}>
      <ScreenHeader
        back
        title="This week"
        right={
          <RoundButton label="Alerts" onPress={() => router.push('/alerts')}>
            <Bell size={18} color={colors.ink} />
          </RoundButton>
        }
      />

      <Card className="mt-2.5 flex-row items-center p-3">
        <View>
          <Text className="font-i5 text-ap-small text-muted">Checks done</Text>
          <Text className="font-i8 text-ap-card text-ink">{`${done.length} of ${tasks.length}`}</Text>
        </View>
        <View className="mx-3 h-2 flex-1 overflow-hidden rounded-full bg-[#ECEAE4]">
          <View className="h-full rounded-full bg-good" style={{ width: `${(done.length / Math.max(1, tasks.length)) * 100}%` }} />
        </View>
        <Text className="font-i8 text-ap-body text-good">{`+${done.length} score`}</Text>
      </Card>

      {open.length === 0 ? (
        <Card className="mt-2 items-center p-5">
          <Text className="font-i7 text-ap-body text-good">All checks done. Well done!</Text>
        </Card>
      ) : null}
      {open.map((t) => (
        <TaskCard key={t.id} task={t} />
      ))}

      {done.map((t) => (
        <View key={t.id} className="mt-2 h-11 flex-row items-center gap-2.5 rounded-2xl bg-[#F4F3EF] px-3">
          <Check size={14} color={colors.good} strokeWidth={3} />
          <Text className="font-i6 text-ap-body text-[#555] line-through">{t.title}</Text>
          <Text className="ml-auto font-i5 text-ap-small text-muted">{fieldName(t.fieldId)}</Text>
        </View>
      ))}
    </Screen>
  );
}
