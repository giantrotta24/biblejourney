import { useEffect, useState } from 'react';
import { Dimensions, PixelRatio, Platform } from 'react-native';

export const fonts = {
  numeral: 'ArchivoCondensedExtraBold',
  serif: 'SourceSerif4',
  serifItalic: 'SourceSerif4Italic',
  serifSemibold: 'SourceSerif4Semibold',
} as const;

export function useFontScale(): number {
  const [scale, setScale] = useState(() => PixelRatio.getFontScale());
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', () => {
      setScale(PixelRatio.getFontScale());
    });
    return () => subscription.remove();
  }, []);
  return scale;
}

/** xxxLarge and above: the numeral steps down so the reading keeps its room. */
export function useLargeText(): boolean {
  return useFontScale() >= 1.3;
}

export function hitSize(): number {
  return Platform.OS === 'android' ? 48 : 44;
}
