import { Pressable, Text, View } from 'react-native';

import { useColors } from '@/theme/colors';
import { hitSize } from '@/theme/fonts';

export function StorageRetry({ message, onRetry }: { message: string; onRetry: () => void }) {
  const colors = useColors();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.paper,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 22,
      }}>
      <Text style={{ fontSize: 17, lineHeight: 24, color: colors.ink, textAlign: 'center' }}>{message}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Try again"
        onPress={onRetry}
        style={{ minHeight: hitSize(), justifyContent: 'center' }}>
        <Text
          style={{
            fontSize: 17,
            color: colors.ink,
            textDecorationLine: 'underline',
            textDecorationColor: colors.ink3,
          }}>
          Try again
        </Text>
      </Pressable>
    </View>
  );
}

export function StorageBlank() {
  const colors = useColors();
  return <View style={{ flex: 1, backgroundColor: colors.paper }} />;
}
