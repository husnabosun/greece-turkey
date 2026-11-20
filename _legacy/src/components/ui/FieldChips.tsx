import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { Field } from '@/data/mock';
import { useFieldColors } from '@/state/risk';

interface Props {
  fields: Field[];
  selected: string | 'all';
  onSelect: (id: string | 'all') => void;
  showAll?: boolean;
  /** Text of the "all" chip. */
  allLabel?: string;
  /** Selected chip colour: the PNGs use dark green on most screens and black on Logbook and Quality score. */
  tone?: 'green' | 'black';
  /** Extra chip(s) after the fields, e.g. "+ Add". */
  trailing?: ReactNode;
}

export function FieldChips({ fields, selected, onSelect, showAll = false, allLabel, tone = 'green', trailing }: Props) {
  const colorOf = useFieldColors();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-5" contentContainerClassName="gap-2 px-5">
      {showAll ? (
        <Chip on={selected === 'all'} tone={tone} onPress={() => onSelect('all')}>
          <Text className={`font-i7 text-ap-pill ${selected === 'all' ? 'text-white' : 'text-ink'}`}>
            {allLabel ?? `All fields · ${fields.length}`}
          </Text>
        </Chip>
      ) : null}
      {fields.map((f) => {
        const on = selected === f.id;
        return (
          <Chip key={f.id} on={on} tone={tone} onPress={() => onSelect(f.id)}>
            <View className="h-2 w-2 rounded-full" style={{ backgroundColor: colorOf[f.id] ?? f.color }} />
            <Text className={`font-i7 text-ap-pill ${on ? 'text-white' : 'text-ink'}`}>{f.name}</Text>
          </Chip>
        );
      })}
      {trailing}
    </ScrollView>
  );
}

export function Chip({ on, onPress, children, tone = 'green' }: { on: boolean; onPress: () => void; children: ReactNode; tone?: 'green' | 'black' }) {
  return (
    <Pressable
      onPress={onPress}
      className={`h-[30px] flex-row items-center gap-1.5 rounded-full border px-3 ${on ? (tone === 'black' ? 'border-ink bg-ink' : 'border-primary bg-primary') : 'border-line bg-card'}`}
    >
      {children}
    </Pressable>
  );
}
