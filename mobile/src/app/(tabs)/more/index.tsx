import { router } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSession } from '@/account/session';
import { MoreHub } from '@/components/more-hub';
import { useColors } from '@/theme/colors';

export default function MoreScreen() {
  const session = useSession();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const detail = session.status === 'signed-in' ? (session.email ?? 'Signed in') : 'Not signed in';
  return (
    <View style={{ flex: 1, backgroundColor: colors.paper, paddingTop: insets.top }}>
      <MoreHub detail={detail} onAccount={() => router.push('/more/account')} />
    </View>
  );
}
