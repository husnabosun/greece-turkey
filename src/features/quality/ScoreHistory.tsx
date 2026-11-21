import { useState } from 'react';
import { Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { Card, Pill } from '@/components/ui';
import { historyChange, scoreHistory } from '@/lib/history';
import { useLocale, useT } from '@/state/i18n';
import { colors } from '@/theme/tokens';

const H = 120;
/** Left padding leaves room for the grid labels. */
const PAD_LEFT = 30;
const PAD_RIGHT = 16;
const PAD_TOP = 26;
const PAD_BOTTOM = 8;

/** A line chart may zoom in: the axis spans the field's own scores in steps of 10, so a 6-point change is visible. */
function yRange(scores: number[]): [number, number] {
  const lo = Math.max(0, Math.floor((Math.min(...scores) - 4) / 10) * 10);
  const hi = Math.min(100, Math.ceil((Math.max(...scores) + 4) / 10) * 10);
  return [lo, Math.max(hi, lo + 20)];
}

/** Line chart of the quality score over the last 6 months. Tap a month to see its score. */
export function ScoreHistory({ field }: { field: { score: number; history?: number[] } }) {
  const t = useT();
  const locale = useLocale();
  const [w, setW] = useState(0);
  const points = scoreHistory(field);
  const [picked, setPicked] = useState<number | null>(null);
  const sel = picked !== null && picked < points.length ? picked : points.length - 1;
  const change = historyChange(points);

  const [lo, hi] = yRange(points.map((p) => p.score));
  const grid = Array.from({ length: (hi - lo) / 10 + 1 }, (_, i) => lo + i * 10);
  const x = (i: number) => (points.length < 2 ? w / 2 : PAD_LEFT + (i * (w - PAD_LEFT - PAD_RIGHT)) / (points.length - 1));
  const y = (s: number) => PAD_TOP + ((hi - s) / (hi - lo)) * (H - PAD_TOP - PAD_BOTTOM);
  const step = points.length < 2 ? w : (w - PAD_LEFT - PAD_RIGHT) / (points.length - 1);
  const month = (d: Date) => d.toLocaleDateString(locale, { month: 'short' });

  return (
    <Card className="mt-2 p-3">
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <Text className="font-i8 text-ap-card text-ink">{t('Score history')}</Text>
          <Text className="font-i5 text-ap-body text-muted">{t('Last {n} months', { n: points.length })}</Text>
        </View>
        {points.length > 1 ? (
          <Pill tone={change < 0 ? 'risk' : change > 0 ? 'good' : 'neutral'}>
            {t(change === 1 || change === -1 ? '{n} point' : '{n} points', { n: change > 0 ? `+${change}` : change })}
          </Pill>
        ) : null}
      </View>

      {points.length < 2 ? (
        <Text className="mt-2 font-i5 text-ap-body text-muted">{t('This is a new field. Its history starts next month.')}</Text>
      ) : (
        <>
          <View className="mt-2" style={{ height: H }} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}>
            {w > 0 ? (
              <Svg width={w} height={H}>
                {grid.map((g) => (
                  <Line key={g} x1={PAD_LEFT - 8} x2={w} y1={y(g)} y2={y(g)} stroke={colors.line} strokeWidth={1} />
                ))}
                <Line x1={x(sel)} x2={x(sel)} y1={PAD_TOP - 6} y2={H - PAD_BOTTOM} stroke={colors.line} strokeWidth={1} strokeDasharray="3 3" />
                <Polyline
                  points={points.map((p, i) => `${x(i)},${y(p.score)}`).join(' ')}
                  fill="none"
                  stroke={colors.accent}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {points.map((p, i) => (
                  <Circle key={i} cx={x(i)} cy={y(p.score)} r={i === sel ? 5 : 4} fill={i === sel ? colors.accent : colors.card} stroke={i === sel ? colors.card : colors.accent} strokeWidth={2} />
                ))}
              </Svg>
            ) : null}
            {w > 0
              ? grid.map((g) => (
                  <Text key={g} pointerEvents="none" className="absolute left-0 w-5 text-right font-i5 text-[10px] text-muted" style={{ top: y(g) - 7 }}>
                    {g}
                  </Text>
                ))
              : null}
            {w > 0 ? (
              <View pointerEvents="none" className="absolute rounded-md bg-ink px-1.5 py-0.5" style={{ left: Math.min(Math.max(0, x(sel) - 18), w - 36), top: y(points[sel].score) - 24, minWidth: 36 }}>
                <Text className="text-center font-i8 text-ap-small text-white">{points[sel].score}</Text>
              </View>
            ) : null}
            {/* Hit targets: one full-height column per month, much bigger than the dot. */}
            {w > 0
              ? points.map((p, i) => (
                  <Pressable
                    key={i}
                    onPress={() => setPicked(i)}
                    accessibilityRole="button"
                    accessibilityLabel={t('{month}: score {n}', { month: month(p.month), n: p.score })}
                    className="absolute bottom-0 top-0"
                    style={{ left: x(i) - step / 2, width: step }}
                  />
                ))
              : null}
          </View>
          <View className="mt-1 h-4">
            {w > 0
              ? points.map((p, i) => (
                  <Text
                    key={i}
                    numberOfLines={1}
                    className={`absolute text-center text-ap-small ${i === sel ? 'font-i7 text-ink' : 'font-i5 text-muted'}`}
                    style={{ left: x(i) - step / 2, width: step }}
                  >
                    {p.current ? t('Now') : month(p.month)}
                  </Text>
                ))
              : null}
          </View>
        </>
      )}
    </Card>
  );
}
