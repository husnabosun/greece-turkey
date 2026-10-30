import { Camera, TriangleAlert, X } from 'lucide-react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useTabBarOffset } from '@/components/Screen';
import { AiTag, Button, Chip, FromLabelTag, PrivacyLine } from '@/components/ui';
import { sprayProducts, type Field } from '@/data/mock';
import { daysAgoAt, formatDay } from '@/lib/dates';
import { labelToDraft, type LabelDraft } from '@/lib/ai/mappers';
import type { AiSource } from '@/lib/ai/schemas';
import { euCheck } from '@/lib/euCheck';
import { readLabelAi, takeOrPickPhoto } from '@/state/ai';
import { useStore } from '@/state/store';
import { colors } from '@/theme/tokens';

const WHEN = [
  { label: 'Today', daysAgo: 0 },
  { label: 'Yesterday', daysAgo: 1 },
  { label: '3 days ago', daysAgo: 3 },
];
const AREAS = ['whole field', 'rows 1–6'];

const splitList = (s: string) => s.split(/[,;]/).map((x) => x.trim()).filter(Boolean);

interface LabelForm {
  product: string;
  substances: string;
  licence: string;
  dose: string;
  preHarvest: string;
}

const formOf = (d: LabelDraft): LabelForm => ({
  product: d.product,
  substances: d.activeSubstances.join(', '),
  licence: d.licence ?? '',
  dose: d.dose ?? '',
  preHarvest: d.preHarvestDays !== undefined ? String(d.preHarvestDays) : '',
});

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

  const [reading, setReading] = useState(false);
  const [demo, setDemo] = useState(false);
  /** What the label reader found, and the (editable) form filled with it. Null until a label was read. */
  const [read, setRead] = useState<{ draft: LabelDraft; form: LabelForm; source: AiSource } | null>(null);
  const [form, setForm] = useState<LabelForm | null>(null);
  const started = useRef(false);

  /** Takes a photo of the label and reads it with the AI server. Without the server it fills a demo product. */
  const scanLabel = async () => {
    const uri = await takeOrPickPhoto();
    if (!uri) return;
    setReading(true);
    const result = await readLabelAi(uri);
    if (result) {
      const draft = labelToDraft(result);
      setRead({ draft, form: formOf(draft), source: 'gemini' });
      setForm(formOf(draft));
      setProductName(null);
      setDemo(false);
    } else {
      setRead(null);
      setForm(null);
      setProductName(sprayProducts[0].name);
      setDemo(true);
    }
    setReading(false);
  };

  useEffect(() => {
    if (labelScan && !started.current) {
      started.current = true;
      void scanLabel();
    }
    // Opens the label photo once when the sheet was opened from the Scan tab.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const product = sprayProducts.find((p) => p.name === productName);
  const substances = form ? splitList(form.substances) : [];
  const eu = euCheck(substances);
  const tagged = (key: keyof LabelForm) => (read && form && form[key].trim() !== '' && form[key] === read.form[key] ? <FromLabelTag /> : null);

  const save = () => {
    const base = { fieldId: field.id, ts: daysAgoAt(daysAgo, new Date().getHours()), date: formatDay(daysAgo), area: area === 'whole field' ? area : `${field.name}, ${area}` };
    if (form && read) {
      // A product we already know (same first word of the name as one of the active substances) lends its protection data.
      const known = sprayProducts.find((p) => !p.banned && substances.join(' ').toLowerCase().includes(p.name.toLowerCase().split(' ')[0]));
      const days = parseInt(form.preHarvest, 10);
      addSpray({
        ...base,
        product: form.product.trim(),
        dose: form.dose.trim() || 'not on the label',
        banned: eu.banned,
        targets: known?.targets,
        protectionDays: known?.protectionDays,
        licence: form.licence.trim() || undefined,
        activeSubstances: substances,
        preHarvestDays: Number.isFinite(days) ? days : undefined,
        fromLabel: true,
      });
    } else if (product) {
      addSpray({
        ...base,
        product: product.name,
        targets: product.targets,
        protectionDays: product.protectionDays,
        dose: product.dose,
        banned: product.banned,
        tag: product.tag,
        licence: product.licence,
        stage: product.stage,
      });
    } else {
      return;
    }
    onClose();
  };

  const canSave = form ? form.product.trim().length > 0 : !!product;
  const banned = form ? eu.banned : !!product?.banned;

  return (
    <View className="absolute inset-0 z-40 justify-end">
      <Pressable onPress={onClose} accessibilityLabel="Close" className="absolute inset-0 bg-black/40" />
      <View className="mx-3 rounded-[18px] bg-card p-4" style={{ marginBottom: offset + 8, maxHeight: '88%' }}>
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="font-i8 text-ap-title text-ink">Add a spray</Text>
            <Text className="font-i5 text-ap-body text-muted">{field.name}</Text>
          </View>
          <Pressable onPress={onClose} accessibilityLabel="Close" className="h-10 w-10 items-center justify-center rounded-full bg-soft">
            <X size={18} color={colors.ink} />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => void scanLabel()} disabled={reading} accessibilityRole="button" className="mt-3 h-11 flex-row items-center justify-center gap-2 rounded-xl border border-dashed border-ink/40">
            <Camera size={16} color={colors.ink} />
            <Text className="font-i7 text-ap-body text-ink">{reading ? 'Reading the label…' : 'Scan the label'}</Text>
          </Pressable>
          <View className="mt-1">
            <PrivacyLine />
          </View>
          {read ? <AiTag source={read.source} className="mt-1.5" /> : demo && product ? <AiTag source="demo" className="mt-1.5" /> : null}
          {read?.draft.unsure ? (
            <View className="mt-2 flex-row items-center gap-2 rounded-lg bg-warn-soft p-2.5">
              <TriangleAlert size={16} color={colors.warnText} />
              <Text className="flex-1 font-i6 text-ap-small text-ink">We could not read the label well. Please check every field, or take a clearer photo.</Text>
            </View>
          ) : null}

          {form ? (
            <>
              <Field2 label="Product" tag={tagged('product')}>
                <Input value={form.product} onChange={(v) => setForm({ ...form, product: v })} />
              </Field2>
              <Field2 label="Active substance" tag={tagged('substances')}>
                <Input value={form.substances} onChange={(v) => setForm({ ...form, substances: v })} placeholder="not found on the label" />
              </Field2>
              <Field2 label="Licence number" tag={tagged('licence')}>
                <Input value={form.licence} onChange={(v) => setForm({ ...form, licence: v })} placeholder="not found on the label" />
              </Field2>
              <Field2 label="Max dose per hectare" tag={tagged('dose')}>
                <Input value={form.dose} onChange={(v) => setForm({ ...form, dose: v })} placeholder="not found on the label" />
              </Field2>
              <Field2 label="Days before harvest" tag={tagged('preHarvest')}>
                <Input value={form.preHarvest} onChange={(v) => setForm({ ...form, preHarvest: v.replace(/[^0-9]/g, '') })} placeholder="not found on the label" keyboardType="number-pad" />
              </Field2>
            </>
          ) : (
            <>
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
            </>
          )}

          {banned ? (
            <View className="mt-2 flex-row items-center gap-2 rounded-lg bg-risk-soft p-2.5">
              <TriangleAlert size={16} color={colors.risk} />
              <Text className="flex-1 font-i6 text-ap-small text-risk">
                {form && eu.hits.length ? `${eu.hits.join(', ')} is not approved in the EU. Buyers will see it.` : 'This product is banned in the EU. Buyers will see it.'}
              </Text>
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
        </ScrollView>

        <View className={`mt-4 ${canSave ? '' : 'opacity-40'}`}>
          <Button label="Save spray" onPress={save} />
        </View>
      </View>
    </View>
  );
}

function Label({ children }: { children: string }) {
  return <Text className="mb-1.5 mt-3 font-i7 text-ap-small uppercase tracking-[1px] text-muted">{children}</Text>;
}

/** A form row: label, the "Read from label" tag when the value came from the photo, and the input. */
function Field2({ label, tag, children }: { label: string; tag: ReactNode; children: ReactNode }) {
  return (
    <View>
      <View className="mb-1.5 mt-3 flex-row items-center justify-between">
        <Text className="font-i7 text-ap-small uppercase tracking-[1px] text-muted">{label}</Text>
        {tag}
      </View>
      {children}
    </View>
  );
}

function Input({ value, onChange, placeholder, keyboardType }: { value: string; onChange: (v: string) => void; placeholder?: string; keyboardType?: 'number-pad' }) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={colors.muted}
      keyboardType={keyboardType}
      className="h-11 rounded-xl border border-line bg-card px-3 font-i6 text-ap-body text-ink"
    />
  );
}
