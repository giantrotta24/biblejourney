import { router } from 'expo-router';

import { AccountBody } from '@/components/account-body';

export default function AccountRoute() {
  return (
    <AccountBody
      onBack={() => router.back()}
      onSignIn={() => router.push('/sign-in')}
      onDeleted={() => {
        router.dismissAll();
        router.navigate('/');
      }}
    />
  );
}
