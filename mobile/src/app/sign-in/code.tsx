import { Redirect, router, useLocalSearchParams } from 'expo-router';

import { CodeStep } from '@/components/code-step';

export default function CodeRoute() {
  const { email } = useLocalSearchParams<{ email?: string | string[] }>();
  const address = Array.isArray(email) ? email[0] : email;
  if (!address) return <Redirect href="/sign-in" />;
  return (
    <CodeStep
      email={address}
      onCancel={() => router.dismissAll()}
      onBack={() => router.back()}
      onSignedIn={() => router.dismissAll()}
    />
  );
}
