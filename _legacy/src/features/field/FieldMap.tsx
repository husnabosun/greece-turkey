import { Crosshair, Leaf, Minus, Plus } from 'lucide-react-native';
import { memo, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle, Polygon, Rect } from 'react-native-svg';
import type { Tree, TreeStatus } from '@/data/mock';
import { colors } from '@/theme/tokens';

const statusColor: Record<TreeStatus, string> = { healthy: colors.good, suspicious: colors.warn, diseased: colors.risk };
const GREENS = ['#3F6B2F', '#4B7A36', '#35602A', '#56883E'];

/** Static aerial look: rows of tree crowns drawn with SVG. Works on web and native. */
const Aerial = memo(function Aerial() {
  const crowns = [];
  for (let r = 0; r < 13; r++) {
    for (let c = 0; c < 21; c++) {
      crowns.push(<Circle key={`${r}-${c}`} cx={3 + c * 4.8 + (r % 2 ? 2.4 : 0)} cy={3 + r * 6.2} r={2.1} fill={GREENS[(r * 3 + c) % GREENS.length]} />);
    }
  }
  return (
    <Svg width="100%" height="100%" viewBox="0 0 100 80" preserveAspectRatio="xMidYMid slice">
      <Rect width={100} height={80} fill="#7A8F4F" />
      {crowns}
      <Polygon points="8,16 82,10 88,40 99,50 98,76 14,78" fill="none" stroke="#fff" strokeWidth={0.7} strokeLinejoin="round" />
    </Svg>
  );
});

interface Props {
  trees: Tree[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  showHealth: boolean;
  onToggleHealth: (v: boolean) => void;
  onLocate: () => void;
  /** Ring colour of healthy trees: follows the field's highest current risk. */
  ringColor?: string;
}

export function FieldMap({ trees, selectedId, onSelect, showHealth, onToggleHealth, onLocate, ringColor = colors.good }: Props) {
  const [zoom, setZoom] = useState(1);
  return (
    <View className="h-[300px] overflow-hidden rounded-[18px] bg-[#4B7A36]">
      <View className="absolute inset-0" style={{ transform: [{ scale: zoom }] }}>
        <Aerial />
        {showHealth
          ? trees.map((t) => {
              const sel = t.id === selectedId;
              const size = sel ? 22 : 16;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => onSelect(t.id)}
                  accessibilityLabel={`Tree #${t.id}, ${t.status}`}
                  hitSlop={8}
                  style={{ position: 'absolute', left: `${t.x}%`, top: `${t.y}%`, marginLeft: -size / 2, marginTop: -size / 2, width: size, height: size }}
                  className="items-center justify-center"
                >
                  <View
                    style={{
                      width: size - 2,
                      height: size - 2,
                      borderRadius: size,
                      borderWidth: t.status === 'healthy' ? 3 : 2,
                      borderColor: t.status === 'healthy' ? ringColor : '#fff',
                      backgroundColor: t.status === 'healthy' ? '#fff' : statusColor[t.status],
                    }}
                  />
                  {sel ? (
                    <View className="absolute -top-7 rounded-full bg-ink px-2 py-0.5">
                      <Text className="font-i7 text-ap-small text-white">{`#${t.id}`}</Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })
          : null}
      </View>

      <Pressable
        onPress={() => onToggleHealth(!showHealth)}
        accessibilityRole="switch"
        accessibilityState={{ checked: showHealth }}
        className="absolute left-2 top-2 h-8 flex-row items-center gap-1.5 rounded-full bg-white px-2.5"
      >
        <Leaf size={14} color={colors.good} />
        <Text className="font-i6 text-ap-small text-ink">AI health layer</Text>
        <View className={`h-5 w-8 justify-center rounded-full px-0.5 ${showHealth ? 'items-end bg-primary' : 'items-start bg-line'}`}>
          <View className="h-4 w-4 rounded-full bg-white" />
        </View>
      </Pressable>

      <View className="absolute right-2 top-2 gap-1 rounded-xl bg-white px-2.5 py-2">
        {(['healthy', 'suspicious', 'diseased'] as const).map((s) => (
          <View key={s} className="flex-row items-center gap-1.5">
            <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: statusColor[s] }} />
            <Text className="font-i6 text-ap-small capitalize text-ink">{s}</Text>
          </View>
        ))}
      </View>

      <View className="absolute bottom-2 right-2 gap-1.5">
        <MapBtn label="My location" onPress={onLocate}>
          <Crosshair size={18} color={colors.ink} />
        </MapBtn>
        <View className="rounded-xl bg-white">
          <MapBtn label="Zoom in" onPress={() => setZoom((z) => Math.min(2, z + 0.25))}>
            <Plus size={18} color={colors.ink} />
          </MapBtn>
          <MapBtn label="Zoom out" onPress={() => setZoom((z) => Math.max(1, z - 0.25))}>
            <Minus size={18} color={colors.ink} />
          </MapBtn>
        </View>
      </View>
    </View>
  );
}

function MapBtn({ children, onPress, label }: { children: ReactNode; onPress: () => void; label: string }) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} className="h-9 w-9 items-center justify-center rounded-xl bg-white">
      {children}
    </Pressable>
  );
}
