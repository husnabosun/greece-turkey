import { Image } from 'react-native';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import type { Scan } from '@/data/mock';

const SPOTS: [number, number][] = [[44, 30], [50, 26], [47, 34], [53, 31], [41, 35], [55, 38], [58, 27]];
const FLY_DOTS: [number, number][] = [
  [38, 22], [52, 30], [62, 20], [44, 40], [58, 44], [36, 52], [66, 36], [48, 14], [70, 50], [40, 34], [54, 52], [64, 28], [46, 24], [60, 38],
];

type Props = Pick<Scan, 'photo' | 'spots' | 'flies' | 'uri'>;

/** Sample photos drawn with SVG, so nothing heavy loads. A picked or captured photo replaces them. */
export function ScanPhoto({ photo, spots = 0, flies = 0, uri }: Props) {
  if (uri) return <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />;

  if (photo === 'trap') {
    return (
      <Svg width="100%" height="100%" viewBox="0 0 100 62" preserveAspectRatio="xMidYMid slice">
        <Rect width={100} height={62} fill="#5B7A3E" />
        <G transform="rotate(-8 50 31)">
          <Rect x={32} y={6} width={36} height={50} rx={3} fill="#F2D23C" />
          {FLY_DOTS.slice(0, Math.min(flies, FLY_DOTS.length)).map(([x, y], i) => (
            <Circle key={i} cx={x} cy={y} r={1.1} fill="#2B2A20" />
          ))}
        </G>
      </Svg>
    );
  }

  if (photo === 'fruit') {
    return (
      <Svg width="100%" height="100%" viewBox="0 0 100 62" preserveAspectRatio="xMidYMid slice">
        <Rect width={100} height={62} fill="#47663A" />
        <Ellipse cx={30} cy={12} rx={16} ry={4} fill="#5C7E48" transform="rotate(-25 30 12)" />
        <Ellipse cx={50} cy={34} rx={19} ry={22} fill="#8DA63C" />
        <Ellipse cx={44} cy={26} rx={5} ry={8} fill="#B6C95A" opacity={0.7} />
        <Circle cx={52} cy={30} r={2.2} fill="#3A2412" />
      </Svg>
    );
  }

  const shown = photo === 'leaf-spots' ? SPOTS.slice(0, Math.min(spots, SPOTS.length)) : [];
  return (
    <Svg width="100%" height="100%" viewBox="0 0 100 62" preserveAspectRatio="xMidYMid slice">
      <Rect width={100} height={62} fill="#5F7A45" />
      <Ellipse cx={18} cy={14} rx={15} ry={4.5} fill="#7C9660" transform="rotate(-20 18 14)" />
      <Ellipse cx={90} cy={52} rx={18} ry={5} fill="#4E6A3A" transform="rotate(-30 90 52)" />
      <G transform="rotate(-25 52 34)">
        <Ellipse cx={52} cy={34} rx={42} ry={13} fill="#6E8F45" />
        <Path d="M10 34 H94" stroke="#B7C98B" strokeWidth={0.8} />
      </G>
      {shown.map(([x, y], i) => (
        <G key={i}>
          <Circle cx={x} cy={y} r={2.4} fill="#8A5A2B" />
          <Circle cx={x} cy={y} r={1} fill="#3A2412" />
        </G>
      ))}
    </Svg>
  );
}
