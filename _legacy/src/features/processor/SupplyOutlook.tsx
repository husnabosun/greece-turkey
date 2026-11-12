import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { Pill, type PillTone } from '@/components/ui';
import { areas } from '@/data/mock';
import { weekLabel, weeklySupply } from '@/lib/processor';
import { colors } from '@/theme/tokens';
import { Panel, useWide } from './kit';
import { useAreaRisk } from './useLotInfo';
import { useLots } from './useLots';

const WEEKS = 4;
// Same tones as the risk levels in the farmer app.
const TONE: Record<string, PillTone> = { High: 'risk', Medium: 'warn', Low: 'good' };
const REGION_W = 110;
const RISK_W = 420;

/** Tonnes ready to harvest per region and week (from the harvest dates of the lots) and the pest risk this week. */
export function SupplyOutlook() {
  const wide = useWide();
  const lots = useLots();
  const risk = useAreaRisk();
  const regions = areas.map((a) => a.region);
  const supply = useMemo(() => weeklySupply(lots, regions, WEEKS), [lots]); // eslint-disable-line react-hooks/exhaustive-deps
  const max = Math.max(1, ...Object.values(supply).flat());
  const weeks = Array.from({ length: WEEKS }, (_, w) => weekLabel(w));

  return (
    <Panel title="Supply outlook" subtitle="Tonnes ready to harvest in the next 4 weeks, from the harvest dates of the lots. Risk comes from the AgroPulse risk engine.">
      {wide ? (
        <View className="flex-row items-center gap-4 border-t border-line px-4 py-2">
          <View style={{ width: REGION_W }} />
          <View className="flex-1 flex-row gap-3">
            {weeks.map((w, i) => (
              <View key={w} className="flex-1 items-center">
                <Text className="font-i7 text-ap-small text-ink">{i === 0 ? 'This week' : `Week ${i + 1}`}</Text>
                <Text className="font-i5 text-ap-small text-muted">{w}</Text>
              </View>
            ))}
          </View>
          <View style={{ width: RISK_W }}>
            <Text className="font-i6 text-ap-small text-muted">Pest risk this week</Text>
          </View>
        </View>
      ) : null}
      {regions.map((region) => {
        const r = risk[region];
        const total = supply[region].reduce((t, n) => t + n, 0);
        return (
          <View key={region} className="min-h-[64px] flex-row flex-wrap items-center gap-x-4 gap-y-2 border-t border-line px-4 py-3">
            <View className={wide ? '' : 'w-full'} style={wide ? { width: REGION_W } : undefined}>
              <Text className="font-i8 text-ap-card text-ink">{region}</Text>
              {wide ? null : <Text className="font-i5 text-ap-small text-muted">{`${Math.round(total * 10) / 10} t in 4 weeks`}</Text>}
            </View>
            <View className={`flex-row gap-3 ${wide ? 'flex-1' : 'w-full'}`}>
              {supply[region].map((t, i) => (
                <View key={weeks[i]} className="flex-1 items-center" accessible accessibilityLabel={`${region}, ${weeks[i]}: ${t > 0 ? `${t} tonnes` : 'nothing'}`}>
                  <Text className={`text-center font-i8 text-ap-card ${t > 0 ? 'text-ink' : 'text-muted'}`}>{t > 0 ? `${t} t` : '–'}</Text>
                  <View className="mt-1 h-1.5 w-full rounded-full bg-soft">
                    <View className="h-1.5 rounded-full" style={{ width: `${Math.round((t / max) * 100)}%`, backgroundColor: colors.good }} />
                  </View>
                  {wide ? null : <Text className="mt-0.5 font-i5 text-[10px] text-muted">{`W${i + 1}`}</Text>}
                </View>
              ))}
            </View>
            <View className={`flex-row items-center gap-2 ${wide ? '' : 'w-full'}`} style={wide ? { width: RISK_W } : undefined}>
              <View className="w-[104px]">
                <Pill tone={TONE[r.level]}>{`${r.level} risk`}</Pill>
              </View>
              {r.level === 'Low' || !r.threat ? null : (
                <Text numberOfLines={1} className="flex-1 font-i6 text-ap-body text-ink">
                  {r.threat}
                  {r.level === 'High' ? <Text className="font-i5 text-muted">{' · Check lots before buying'}</Text> : null}
                </Text>
              )}
            </View>
          </View>
        );
      })}
    </Panel>
  );
}
