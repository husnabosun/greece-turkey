import { ChevronRight, ClipboardCheck, FlaskConical, ShieldCheck, Truck, TriangleAlert, X, type LucideIcon } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View, type KeyboardTypeOptions } from 'react-native';
import { Button, Card, Chip } from '@/components/ui';
import { rowBadges, type LotBadge, type LotBadgeId } from '@/lib/processor';
import { colors } from '@/theme/tokens';

/** Below this width the sidebar becomes a top bar and cards stack. */
export const WIDE = 900;
export const CONTENT_MAX = 1200;

export const useWide = () => useWindowDimensions().width >= WIDE;

/** Large title, one muted line, and the main action on the right. */
export function PageHeader({ title, subtitle, action }: { title: string; subtitle: string; action?: ReactNode }) {
  return (
    <View className="mb-5 flex-row flex-wrap items-end justify-between gap-3">
      <View className="min-w-[240px] shrink">
        <Text accessibilityRole="header" className="font-i8 text-[32px] leading-[38px] text-ink">{title}</Text>
        <Text className="mt-1 font-i5 text-ap-card text-muted">{subtitle}</Text>
      </View>
      {action}
    </View>
  );
}

export function StatCard({ label, value, hint, icon, compact = false }: { label: string; value: string; hint?: string; icon: ReactNode; compact?: boolean }) {
  return (
    <Card className={`min-w-[160px] flex-1 ${compact ? 'p-3' : 'p-4'}`}>
      <View className="flex-row items-center justify-between">
        <Text className="font-i6 text-ap-body text-muted">{label}</Text>
        <View className={`items-center justify-center rounded-full bg-soft ${compact ? 'h-7 w-7' : 'h-9 w-9'}`}>{icon}</View>
      </View>
      <Text className={`font-i8 text-ink ${compact ? 'mt-1 text-ap-title' : 'mt-2 text-[32px] leading-[38px]'}`}>{value}</Text>
      {hint ? <Text className="mt-0.5 font-i5 text-ap-small text-muted">{hint}</Text> : null}
    </Card>
  );
}

/** One card with a header and rows separated by thin lines, like the lists in the app. */
export function Panel({ title, subtitle, right, children }: { title?: string; subtitle?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <Card>
      {title ? (
        <View className="flex-row flex-wrap items-center justify-between gap-2 px-4 pb-2 pt-4">
          <View className="shrink">
            <Text className="font-i8 text-ap-card text-ink">{title}</Text>
            {subtitle ? <Text className="font-i5 text-ap-body text-muted">{subtitle}</Text> : null}
          </View>
          {right}
        </View>
      ) : null}
      {children}
    </Card>
  );
}

/**
 * Badge, text with muted sub-text, then whatever comes in `children` (score, price, actions).
 * With `onPress` the whole row is clickable, but only the text block is the keyboard link:
 * the buttons in `children` must not sit inside another button (invalid HTML).
 */
export function Row({ lead, title, sub, children, onPress, first = false, raised = false }: { lead?: ReactNode; title: string; sub?: ReactNode; children?: ReactNode; onPress?: () => void; first?: boolean; raised?: boolean }) {
  const text = (
    <>
      {lead}
      <View className="flex-1">
        <Text className="font-i8 text-ap-card text-ink">{title}</Text>
        {sub ? <Text className="font-i5 text-ap-body text-muted">{sub}</Text> : null}
      </View>
    </>
  );
  // `raised` puts the row above the next rows, so a popover of this row is not covered.
  const line = (
    <View className={`flex-row flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 ${first ? '' : 'border-t border-line'}`} style={raised ? { zIndex: 20 } : undefined}>
      {onPress ? (
        <Pressable onPress={onPress} accessibilityRole="link" accessibilityLabel={title} className="min-w-[220px] flex-1 flex-row items-center gap-3">
          {text}
        </Pressable>
      ) : (
        <View className="min-w-[220px] flex-1 flex-row items-center gap-3">{text}</View>
      )}
      {children}
    </View>
  );
  // A row that is not clickable must not be a (disabled) Pressable: that would disable the buttons inside it.
  if (!onPress) return line;
  return (
    <Pressable onPress={onPress} accessible={false} className="hover:bg-bg" style={raised ? { zIndex: 20 } : undefined}>
      {line}
    </Pressable>
  );
}

/** Initials in place of a company or farmer logo. */
export function Initials({ text, size = 44 }: { text: string; size?: number }) {
  return (
    <View className="items-center justify-center rounded-xl bg-good-soft" style={{ width: size, height: size }}>
      <Text className="font-i8 text-good" style={{ fontSize: size * 0.34 }}>{text}</Text>
    </View>
  );
}

export const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toLocaleUpperCase('tr-TR'))
    .join('');

/** The "Quality score" box of the Market screens. */
export function ScoreBox({ score, large = false }: { score: number; large?: boolean }) {
  const low = score < 70;
  return (
    <View className={`items-center ${large ? 'rounded-xl px-3 py-2' : 'rounded-lg px-2 py-1'} ${low ? 'bg-risk-soft' : 'bg-good-soft'}`}>
      <Text className={`font-i6 text-[10px] ${low ? 'text-risk' : 'text-good'}`}>Quality score</Text>
      <Text className={`font-i8 ${large ? 'text-ap-title' : 'text-ap-card'} ${low ? 'text-risk' : 'text-good'}`}>{score}</Text>
    </View>
  );
}

/** Price or amount with a small unit, like "€0.95 /kg". */
export function Amount({ value, unit, large = false }: { value: string; unit?: string; large?: boolean }) {
  return (
    <Text className={`font-i8 text-ink ${large ? 'text-ap-title' : 'text-ap-card'}`}>
      {value}
      {unit ? <Text className="font-i5 text-ap-small text-muted">{` ${unit}`}</Text> : null}
    </Text>
  );
}

/** Same segmented control as the Market sub-tabs. */
export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string; badge?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View className="h-10 flex-row self-start rounded-full bg-soft p-1">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} accessibilityRole="tab" accessibilityState={{ selected: on }} className={`min-w-[96px] flex-row items-center justify-center gap-1 rounded-full px-4 ${on ? 'bg-ink' : ''}`}>
            <Text className={`font-i7 text-ap-pill ${on ? 'text-white' : 'text-muted'}`}>{o.label}</Text>
            {o.badge ? (
              <View className="h-4 min-w-[16px] items-center justify-center rounded-full bg-risk px-1">
                <Text className="font-i7 text-[10px] text-white">{o.badge}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** A label and a row of chips: pick one. */
export function ChipGroup({ label, options, value, onChange }: { label: string; options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <View className="gap-1.5">
      <Text className="font-i7 text-ap-small text-muted">{label.toUpperCase()}</Text>
      <View className="flex-row flex-wrap gap-2">
        {options.map((o) => (
          <Chip key={o.value} tone="black" on={o.value === value} onPress={() => onChange(o.value)}>
            <Text className={`font-i7 text-ap-pill ${o.value === value ? 'text-white' : 'text-ink'}`}>{o.label}</Text>
          </Chip>
        ))}
      </View>
    </View>
  );
}

export function TextField({ label, value, onChangeText, suffix, keyboardType, placeholder }: { label: string; value: string; onChangeText: (v: string) => void; suffix?: string; keyboardType?: KeyboardTypeOptions; placeholder?: string }) {
  const [focus, setFocus] = useState(false);
  return (
    <View className="gap-1.5">
      <Text className="font-i7 text-ap-small text-muted">{label.toUpperCase()}</Text>
      <View className={`h-11 flex-row items-center rounded-xl border bg-card px-3 ${focus ? 'border-ink' : 'border-line'}`}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType={keyboardType}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          accessibilityLabel={label}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          className="h-full flex-1 font-i6 text-ap-btn text-ink"
          style={{ outlineStyle: 'none' } as object}
        />
        {suffix ? <Text className="font-i5 text-ap-body text-muted">{suffix}</Text> : null}
      </View>
    </View>
  );
}

/** Centered dialog with a title, a close button and a footer with the actions. */
export function Dialog({ open, onClose, title, subtitle, children, actionLabel, onAction, actionDisabled = false }: { open: boolean; onClose: () => void; title: string; subtitle?: string; children: ReactNode; actionLabel: string; onAction: () => void; actionDisabled?: boolean }) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} accessibilityLabel="Close" className="flex-1 items-center justify-center bg-ink/40 p-4">
        <Pressable onPress={() => {}} className="max-h-full w-full max-w-[480px] rounded-[22px] border border-line bg-card" style={{ boxShadow: '0 24px 60px rgba(0,0,0,0.22)' }}>
          <ScrollView contentContainerClassName="p-5" keyboardShouldPersistTaps="handled">
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1">
                <Text accessibilityRole="header" className="font-i8 text-ap-title text-ink">{title}</Text>
                {subtitle ? <Text className="mt-0.5 font-i5 text-ap-body text-muted">{subtitle}</Text> : null}
              </View>
              <Pressable onPress={onClose} accessibilityLabel="Close dialog" className="h-10 w-10 items-center justify-center rounded-full border border-line bg-card">
                <X size={18} color={colors.ink} />
              </Pressable>
            </View>
            <View className="mt-4 gap-3">{children}</View>
            <View className="mt-5 flex-row justify-end gap-2">
              <Button label="Cancel" variant="outline" onPress={onClose} />
              <View className={actionDisabled ? 'opacity-40' : ''} pointerEvents={actionDisabled ? 'none' : 'auto'}>
                <Button label={actionLabel} onPress={onAction} />
              </View>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** "12.5" or "12,5" to a number. NaN for anything else. */
export const parseNumber = (text: string) => Number(text.replace(',', '.').trim());

const BADGE_ICON: Record<LotBadgeId, LucideIcon> = { 'lab-suggested': FlaskConical, banned: TriangleAlert, 'no-banned': ShieldCheck, 'reliable-delivery': Truck, 'complete-records': ClipboardCheck };
const BADGE_TONE: Record<LotBadgeId, { bg: string; text: string; icon: string }> = {
  'lab-suggested': { bg: 'bg-warn-soft', text: 'text-warn-text', icon: colors.warnText },
  banned: { bg: 'bg-risk-soft', text: 'text-risk', icon: colors.risk },
  'no-banned': { bg: 'bg-good-soft', text: 'text-good', icon: colors.good },
  'reliable-delivery': { bg: 'bg-good-soft', text: 'text-good', icon: colors.good },
  'complete-records': { bg: 'bg-good-soft', text: 'text-good', icon: colors.good },
};

/**
 * Small pills (same height as the pills in the farmer app) for the badges of a lot, most important first.
 * In a list `max` is 2 and the rest is a "+1" pill, always on one line. In the lot page leave `max` out: all badges, wrapping.
 */
export function LotBadges({ badges, max }: { badges: LotBadge[]; max?: number }) {
  const wide = useWide();
  // On a phone the row is narrow: one badge and the "+N" pill, so nothing is cut off.
  const { shown, more } = rowBadges(badges, max === undefined ? badges.length : wide ? max : Math.min(max, 1));
  if (shown.length === 0) return null;
  return (
    <View className={`flex-row gap-1 ${max === undefined ? 'flex-wrap' : 'overflow-hidden'}`}>
      {shown.map((b) => {
        const Icon = BADGE_ICON[b.id];
        const tone = BADGE_TONE[b.id];
        return (
          <View key={b.id} accessible accessibilityLabel={b.why ? `${b.label}. ${b.why}` : b.label} className={`h-6 shrink-0 flex-row items-center gap-1 rounded-full px-2 ${tone.bg}`}>
            <Icon size={11} color={tone.icon} strokeWidth={2.4} />
            <Text numberOfLines={1} className={`font-i7 text-ap-small ${tone.text}`}>{b.label}</Text>
          </View>
        );
      })}
      {more > 0 ? (
        <View accessible accessibilityLabel={`${more} more badge${more === 1 ? '' : 's'}`} className="h-6 shrink-0 justify-center rounded-full bg-soft px-2">
          <Text className="font-i7 text-ap-small text-ink">{`+${more}`}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Why a lab test is suggested, one line per reason. Nothing when no test is suggested. */
export function LabReason({ reasons }: { reasons: string[] }) {
  if (reasons.length === 0) return null;
  return (
    <View className="gap-0.5">
      {reasons.map((r) => (
        <Text key={r} className="font-i6 text-ap-body text-warn-text">{r}</Text>
      ))}
    </View>
  );
}

// Fixed columns of the lot rows (Overview and Find olives). Same widths everywhere, so score, price and actions line up.
export const SCORE_W = 84;
export const VALUE_W = 124;
export const ACTIONS_W = 176;
const LOT_ROW_H = 92;

/**
 * One lot row: [icon] [title, sub-text, badges] [quality score] [price or status] [actions] [chevron].
 * On a wide screen every row has the same height and the same column widths. On a narrow screen the columns wrap under the text.
 */
export function LotRow({ lead, title, sub, badges, score, value, actions, onPress, first = false }: { lead: ReactNode; title: string; sub: string; badges: ReactNode; score: ReactNode; value: ReactNode; actions?: ReactNode; onPress: () => void; first?: boolean }) {
  const wide = useWide();
  const text = (
    <>
      {lead}
      <View className="min-w-0 flex-1 gap-0.5">
        <Text numberOfLines={1} className="font-i8 text-ap-card text-ink">{title}</Text>
        <Text numberOfLines={1} className="font-i5 text-ap-body text-muted">{sub}</Text>
        <View className="mt-0.5 h-6">{badges}</View>
      </View>
    </>
  );
  return (
    <Pressable onPress={onPress} accessible={false} className="hover:bg-bg">
      <View className={`flex-row items-center gap-4 px-4 ${wide ? '' : 'flex-wrap gap-y-2 py-3'} ${first ? '' : 'border-t border-line'}`} style={wide ? { height: LOT_ROW_H } : undefined}>
        <Pressable onPress={onPress} accessibilityRole="link" accessibilityLabel={title} className={`min-w-0 flex-row items-center gap-3 ${wide ? 'flex-1' : 'w-full'}`}>
          {text}
        </Pressable>
        <View className="items-center" style={{ width: SCORE_W }}>{score}</View>
        <View className="items-end" style={{ width: VALUE_W }}>{value}</View>
        {wide ? <View className="flex-row items-center justify-end gap-2" style={{ width: ACTIONS_W }}>{actions}</View> : actions ? <View className="flex-row gap-2">{actions}</View> : null}
        {wide ? <ChevronRight size={16} color={colors.muted} /> : null}
      </View>
    </Pressable>
  );
}
