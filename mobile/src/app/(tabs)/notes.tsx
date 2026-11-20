import { router } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NotesView } from '@/components/notes-view';
import { useColors } from '@/theme/colors';

export default function NotesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.paper, paddingTop: insets.top }}>
      <NotesView onOpen={(index) => router.push({ pathname: '/note/[day]', params: { day: String(index) } })} />
    </View>
  );
}
