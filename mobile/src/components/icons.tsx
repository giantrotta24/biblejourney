import Svg, { Circle, Path } from 'react-native-svg';

type IconName = 'today' | 'plan' | 'verses' | 'notes' | 'more';

export function TabIcon({
  name,
  color,
  size,
  strokeWidth,
}: {
  name: IconName;
  color: string;
  size: number;
  strokeWidth: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 26 26',
    fill: 'none' as const,
    stroke: color,
    strokeWidth,
  };
  if (name === 'today') {
    return (
      <Svg {...common}>
        <Path d="M6 4.5h14v17H6z" />
        <Path d="M6 8.5h14" strokeDasharray="1.6 1.6" />
        <Path d="M9.5 13h7M9.5 16.5h5" />
      </Svg>
    );
  }
  if (name === 'plan') {
    return (
      <Svg {...common}>
        <Path d="M5 6.5h16M5 11h16M5 15.5h16M5 20h10" />
      </Svg>
    );
  }
  if (name === 'verses') {
    return (
      <Svg {...common}>
        <Path d="M6 5h11a3 3 0 0 1 3 3v13H9a3 3 0 0 1-3-3z" />
        <Path d="M6 18a3 3 0 0 1 3-3h11" />
      </Svg>
    );
  }
  if (name === 'notes') {
    return (
      <Svg {...common} strokeLinejoin="round">
        <Path d="M5 9.5h8M5 13.5h6M5 17.5h4" />
        <Path d="M12.5 21.5l.6-3.4 8.2-8.2 2.8 2.8-8.2 8.2z" />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 26 26" fill={color}>
      <Circle cx="7" cy="13" r="1.7" />
      <Circle cx="13" cy="13" r="1.7" />
      <Circle cx="19" cy="13" r="1.7" />
    </Svg>
  );
}

export function Chevron({ open, color }: { open: boolean; color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18" fill="none" stroke={color} strokeWidth={1.6}>
      {open ? <Path d="M4 7l5 5 5-5" /> : <Path d="M7 4l5 5-5 5" />}
    </Svg>
  );
}
