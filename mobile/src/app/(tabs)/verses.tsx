import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { VersesView } from '@/components/verses-view';
import { useColors } from '@/theme/colors';

export default function VersesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.paper, paddingTop: insets.top }}>
      <VersesView />
    </View>
  );
}
