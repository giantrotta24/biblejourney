import { router } from 'expo-router';

import { SignInForm } from '@/components/sign-in-form';

export default function SignInRoute() {
  return (
    <SignInForm
      onCancel={() => router.dismissAll()}
      onSent={(email) => router.push({ pathname: '/sign-in/code', params: { email } })}
      onSignedIn={() => router.dismissAll()}
    />
  );
}
