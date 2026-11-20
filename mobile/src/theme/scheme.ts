import { useSyncExternalStore } from 'react';
import { Appearance, useColorScheme } from 'react-native';

import type { Theme } from '@/settings/settings';

let override: 'light' | 'dark' | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function applyColorScheme(theme: Theme) {
  Appearance.setColorScheme(theme === 'system' ? 'unspecified' : theme);
  const next = theme === 'system' ? null : theme;
  if (override === next) return;
  override = next;
  emit();
}

export function forcedScheme(): 'light' | 'dark' | null {
  return override;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Light or dark, following a saved choice, or the phone when the choice is Match the phone. */
export function useResolvedScheme(): 'light' | 'dark' {
  const system = useColorScheme();
  const forced = useSyncExternalStore(subscribe, forcedScheme, forcedScheme);
  if (forced) return forced;
  return system === 'dark' ? 'dark' : 'light';
}
