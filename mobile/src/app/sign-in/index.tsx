import { router } from 'expo-router';
import { useState } from 'react';

import { CodeStep } from '@/components/code-step';
import { SignInForm } from '@/components/sign-in-form';

type Step = { kind: 'email' } | { kind: 'code'; email: string };

export default function SignInRoute() {
  const [step, setStep] = useState<Step>({ kind: 'email' });
  if (step.kind === 'code') {
    return (
      <CodeStep
        email={step.email}
        onCancel={() => router.back()}
        onBack={() => setStep({ kind: 'email' })}
        onSignedIn={() => router.back()}
      />
    );
  }
  return (
    <SignInForm
      onCancel={() => router.back()}
      onSent={(email) => setStep({ kind: 'code', email })}
      onSignedIn={() => router.back()}
    />
  );
}
