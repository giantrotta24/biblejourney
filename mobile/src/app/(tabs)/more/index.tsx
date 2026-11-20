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
  let detail = '';
  if (session.status === 'signed-in') detail = session.email ?? 'Signed in';
  else if (session.status !== 'loading') detail = 'Not signed in';
  return (
    <View style={{ flex: 1, backgroundColor: colors.paper, paddingTop: insets.top }}>
      <MoreHub
        detail={detail}
        onTimeline={() => router.push('/more/timeline')}
        onWhosWho={() => router.push('/more/whos-who')}
        onAccount={() => router.push('/more/account')}
        onSettings={() => router.push('/more/settings')}
      />
    </View>
  );
}
