import { Text, View } from 'react-native';
import { SEASON_RISK, SEASON_RISK_YEARS } from '@/data/seasonRisk';
import { colors } from '@/theme/tokens';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SERIES = [
  { key: 'peacock', label: 'Peacock spot', color: colors.risk },
  { key: 'fly', label: 'Olive fly', color: colors.warn },
] as const;
const HEIGHT = 120;
const MAX_DAYS = 31;

/** Average days per month with medium or high risk for the weather near a lot, from the app's risk engine (5-year backtest). */
export function SeasonChart({ place }: { place: string }) {
  const data = SEASON_RISK[place];
  if (!data) return <Text className="font-i5 text-ap-body text-muted">No risk history for this place yet.</Text>;
  const summary = SERIES.map((s) => `${s.label}: ${data[s.key].join(', ')}`).join('. ');

  return (
    <View accessible accessibilityLabel={`Average days per month with medium or high risk. ${summary}`}>
      <View className="mb-2 flex-row gap-4">
        {SERIES.map((s) => (
          <View key={s.key} className="flex-row items-center gap-1.5">
            <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
            <Text className="font-i6 text-ap-small text-muted">{s.label}</Text>
          </View>
        ))}
      </View>
      <View className="flex-row" style={{ height: HEIGHT }}>
        <View className="w-7 justify-between pb-0.5">
          {[30, 15, 0].map((n) => (
            <Text key={n} className="font-i5 text-[10px] leading-[10px] text-muted">{n}</Text>
          ))}
        </View>
        <View className="flex-1 flex-row items-end border-b border-line">
          {MONTHS.map((m, i) => (
            <View key={m} className="h-full flex-1 flex-row items-end justify-center gap-[2px]">
              {SERIES.map((s) => (
                <View key={s.key} className="w-[38%] max-w-[12px] rounded-t-[3px]" style={{ height: Math.max(2, (Math.min(data[s.key][i], MAX_DAYS) / MAX_DAYS) * HEIGHT), backgroundColor: s.color }} />
              ))}
            </View>
          ))}
        </View>
      </View>
      <View className="ml-7 flex-row">
        {MONTHS.map((m) => (
          <Text key={m} className="flex-1 text-center font-i5 text-[10px] text-muted">{m}</Text>
        ))}
      </View>
      <Text className="mt-2 font-i5 text-ap-small text-muted">{`Days per month with medium or high risk, average of ${SEASON_RISK_YEARS} seasons (2021–2025). Weather near ${place}. Calculated by the AgroPulse risk engine.`}</Text>
    </View>
  );
}
