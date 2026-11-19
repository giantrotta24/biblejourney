import { Tabs } from 'expo-router/tabs';

import { PaperTabBar } from '@/components/tab-bar';

export default function TabLayout() {
  return (
    <Tabs tabBar={(props) => <PaperTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Today' }} />
      <Tabs.Screen name="plan" options={{ title: 'Plan' }} />
      <Tabs.Screen name="verses" options={{ title: 'Verses' }} />
      <Tabs.Screen name="notes" options={{ title: 'Notes' }} />
      <Tabs.Screen name="more" options={{ title: 'More' }} />
    </Tabs>
  );
}
