import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { Field } from '@/data/mock';

interface Props {
  fields: Field[];
  selected: string | 'all';
  onSelect: (id: string | 'all') => void;
  showAll?: boolean;
  /** Text of the "all" chip. */
  allLabel?: string;
  /** Extra chip(s) after the fields, e.g. "+ Add". */
  trailing?: ReactNode;
}

export function FieldChips({ fields, selected, onSelect, showAll = false, allLabel, trailing }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5" contentContainerClassName="gap-2 px-5">
      {showAll ? (
        <Chip on={selected === 'all'} onPress={() => onSelect('all')}>
          <Text className={`font-i7 text-ap-pill ${selected === 'all' ? 'text-white' : 'text-ink'}`}>
            {allLabel ?? `All fields · ${fields.length}`}
          </Text>
        </Chip>
      ) : null}
      {fields.map((f) => {
        const on = selected === f.id;
        return (
          <Chip key={f.id} on={on} onPress={() => onSelect(f.id)}>
            <View className="h-2 w-2 rounded-full" style={{ backgroundColor: f.color }} />
            <Text className={`font-i7 text-ap-pill ${on ? 'text-white' : 'text-ink'}`}>{f.name}</Text>
          </Chip>
        );
      })}
      {trailing}
    </ScrollView>
  );
}

export function Chip({ on, onPress, children }: { on: boolean; onPress: () => void; children: ReactNode }) {
  return (
    <Pressable
      onPress={onPress}
      className={`h-[30px] flex-row items-center gap-1.5 rounded-full border px-3 ${on ? 'border-primary bg-primary' : 'border-line bg-card'}`}
    >
      {children}
    </Pressable>
  );
}
