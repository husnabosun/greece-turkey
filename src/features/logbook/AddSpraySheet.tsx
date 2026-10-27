import { Camera, Sparkles, TriangleAlert, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTabBarOffset } from '@/components/Screen';
import { Button, Chip } from '@/components/ui';
import { sprayProducts, type Field } from '@/data/mock';
import { formatDay } from '@/lib/dates';
import { useStore } from '@/state/store';
import { colors } from '@/theme/tokens';

const WHEN = [
  { label: 'Today', daysAgo: 0 },
  { label: 'Yesterday', daysAgo: 1 },
  { label: '3 days ago', daysAgo: 3 },
];
const AREAS = ['whole field', 'rows 1–6'];

/**
 * Bottom sheet drawn inside the screen (not a native Modal) so it stays inside the phone frame on web.
 * Sits just above the tab bar.
 */
export function AddSpraySheet({ field, onClose, labelScan = false }: { field: Field; onClose: () => void; labelScan?: boolean }) {
  const addSpray = useStore((s) => s.addSpray);
  const offset = useTabBarOffset();
  const [productName, setProductName] = useState<string | null>(null);
  const [daysAgo, setDaysAgo] = useState(0);
  const [area, setArea] = useState(AREAS[0]);

  const [reading, setReading] = useState(labelScan);
  const [fromLabel, setFromLabel] = useState(false);

  /** Mock label scan: reads the product name from the photo of the label after a moment. */
  const scanLabel = () => {
    setReading(true);
    setFromLabel(false);
  };

  useEffect(() => {
    if (!reading) return;
    const t = setTimeout(() => {
      setProductName(sprayProducts[0].name);
      setFromLabel(true);
      setReading(false);
    }, 1200);
    return () => clearTimeout(t);
  }, [reading]);

  const product = sprayProducts.find((p) => p.name === productName);

  const save = () => {
    if (!product) return;
    addSpray({
      fieldId: field.id,
      product: product.name,
      date: formatDay(daysAgo),
      area: area === 'whole field' ? area : `${field.name}, ${area}`,
      dose: product.dose,
      banned: product.banned,
      tag: product.tag,
      licence: product.licence,
      stage: product.stage,
    });
    onClose();
  };

  return (
    <View className="absolute inset-0 z-40 justify-end">
      <Pressable onPress={onClose} accessibilityLabel="Close" className="absolute inset-0 bg-black/40" />
      <View className="mx-3 rounded-[18px] bg-card p-4" style={{ marginBottom: offset + 8 }}>
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="font-i8 text-ap-title text-ink">Add a spray</Text>
            <Text className="font-i5 text-ap-body text-muted">{field.name}</Text>
          </View>
          <Pressable onPress={onClose} accessibilityLabel="Close" className="h-10 w-10 items-center justify-center rounded-full bg-soft">
            <X size={18} color={colors.ink} />
          </Pressable>
        </View>

        <Pressable onPress={scanLabel} accessibilityRole="button" className="mt-3 h-10 flex-row items-center justify-center gap-2 rounded-xl border border-dashed border-ink/40">
          <Camera size={16} color={colors.ink} />
          <Text className="font-i7 text-ap-body text-ink">{reading ? 'Reading the label…' : 'Scan the label'}</Text>
        </Pressable>
        {fromLabel && product ? (
          <View className="mt-2 flex-row items-center gap-2 rounded-lg bg-good-soft p-2.5">
            <Sparkles size={14} color={colors.good} />
            <Text className="flex-1 font-i6 text-ap-small text-good">{`Read from the label: ${product.name}`}</Text>
          </View>
        ) : null}

        <Label>Product</Label>
        <View className="gap-1.5">
          {sprayProducts.map((p) => {
            const on = p.name === productName;
            return (
              <Pressable
                key={p.name}
                onPress={() => setProductName(p.name)}
                className={`min-h-[40px] flex-row items-center justify-between rounded-xl border px-3 py-1.5 ${on ? 'border-primary bg-good-soft' : 'border-line bg-card'}`}
              >
                <Text className="flex-1 font-i6 text-ap-body text-ink">{p.name}</Text>
                <Text className="font-i5 text-ap-small text-muted">{p.dose}</Text>
              </Pressable>
            );
          })}
        </View>

        {product?.banned ? (
          <View className="mt-2 flex-row items-center gap-2 rounded-lg bg-risk-soft p-2.5">
            <TriangleAlert size={16} color={colors.risk} />
            <Text className="flex-1 font-i6 text-ap-small text-risk">This product is banned in the EU. Buyers will see it.</Text>
          </View>
        ) : null}

        <Label>When</Label>
        <View className="flex-row flex-wrap gap-2">
          {WHEN.map((w) => (
            <Chip key={w.label} on={daysAgo === w.daysAgo} onPress={() => setDaysAgo(w.daysAgo)}>
              <Text className={`font-i7 text-ap-pill ${daysAgo === w.daysAgo ? 'text-white' : 'text-ink'}`}>{w.label}</Text>
            </Chip>
          ))}
        </View>

        <Label>Where</Label>
        <View className="flex-row flex-wrap gap-2">
          {AREAS.map((a) => (
            <Chip key={a} on={area === a} onPress={() => setArea(a)}>
              <Text className={`font-i7 text-ap-pill capitalize ${area === a ? 'text-white' : 'text-ink'}`}>{a}</Text>
            </Chip>
          ))}
        </View>

        <View className={`mt-4 ${product ? '' : 'opacity-40'}`}>
          <Button label="Save spray" onPress={save} />
        </View>
      </View>
    </View>
  );
}

function Label({ children }: { children: string }) {
  return <Text className="mb-1.5 mt-3 font-i7 text-ap-small uppercase tracking-[1px] text-muted">{children}</Text>;
}
