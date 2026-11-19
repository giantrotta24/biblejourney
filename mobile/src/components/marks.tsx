import { useState } from 'react';
import { View } from 'react-native';

export function Perforation({ color }: { color: string }) {
  const [width, setWidth] = useState(0);
  const count = Math.max(0, Math.floor((width - 8) / 8));
  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{ height: 8 }}
      pointerEvents="none"
      accessibilityElementsHidden>
      {Array.from({ length: count }, (_, index) => (
        <View
          key={index}
          style={{
            position: 'absolute',
            left: 6 + index * 8,
            top: 0,
            width: 3.2,
            height: 3.2,
            borderRadius: 1.6,
            backgroundColor: color,
          }}
        />
      ))}
    </View>
  );
}

export function DottedCut({ color }: { color: string }) {
  const [width, setWidth] = useState(0);
  const count = Math.max(0, Math.floor(width / 7));
  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{ height: 3 }}
      pointerEvents="none"
      accessibilityElementsHidden>
      {Array.from({ length: count }, (_, index) => (
        <View
          key={index}
          style={{
            position: 'absolute',
            left: index * 7,
            top: 0.3,
            width: 2.4,
            height: 2.4,
            borderRadius: 1.2,
            backgroundColor: color,
          }}
        />
      ))}
    </View>
  );
}

const STUBS = [
  { left: '2%', width: '9%' },
  { left: '14%', width: '6%' },
  { left: '24%', width: '12%' },
  { left: '41%', width: '7%' },
  { left: '52%', width: '10%' },
  { left: '66%', width: '5%' },
  { left: '74%', width: '11%' },
  { left: '89%', width: '8%' },
] as const;

export function TornStubs({ count, color }: { count: number; color: string }) {
  const shown = Math.min(count, STUBS.length);
  if (shown === 0) return null;
  return (
    <View style={{ height: 8, marginHorizontal: 12 }} pointerEvents="none" accessibilityElementsHidden>
      {STUBS.slice(0, shown).map((stub, index) => (
        <View
          key={index}
          style={{
            position: 'absolute',
            top: 0,
            height: 6,
            backgroundColor: color,
            opacity: 0.92,
            left: stub.left,
            width: stub.width,
          }}
        />
      ))}
    </View>
  );
}

export function PageEdges({ paper, rule }: { paper: string; rule: string }) {
  const layers = [
    { bottom: 0, left: 7, right: 7 },
    { bottom: 4, left: 5, right: 5 },
    { bottom: 8, left: 3, right: 3 },
    { bottom: 12, left: 2, right: 2 },
  ];
  return (
    <View style={{ height: 16 }} pointerEvents="none" accessibilityElementsHidden>
      {layers.map((layer, index) => (
        <View
          key={index}
          style={{
            position: 'absolute',
            height: 2,
            backgroundColor: paper,
            borderBottomWidth: 0.5,
            borderBottomColor: rule,
            ...layer,
          }}
        />
      ))}
    </View>
  );
}
