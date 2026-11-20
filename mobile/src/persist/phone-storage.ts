import AsyncStorage from '@react-native-async-storage/async-storage';

import type { KeyValueStorage } from '@/settings/settings';

export type PhoneStorage = KeyValueStorage & {
  remember(key: string, value: string | null): void;
  clear(): void;
  flush(key: string): Promise<void>;
};

export function createPhoneStorage(): PhoneStorage {
  const memory = new Map<string, string>();
  let chain: Promise<void> = Promise.resolve();

  function enqueue(task: () => Promise<void>): Promise<void> {
    const run = chain.then(task, task);
    chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  return {
    getItem(key) {
      return memory.get(key) ?? null;
    },
    setItem(key, value) {
      memory.set(key, value);
      void enqueue(() => AsyncStorage.setItem(key, value).then(() => undefined)).catch(() => undefined);
    },
    removeItem(key) {
      memory.delete(key);
      void enqueue(() => AsyncStorage.removeItem(key).then(() => undefined)).catch(() => undefined);
    },
    remember(key, value) {
      if (value == null) memory.delete(key);
      else memory.set(key, value);
    },
    clear() {
      memory.clear();
    },
    flush(key) {
      const value = memory.get(key) ?? null;
      return enqueue(async () => {
        if (value == null) await AsyncStorage.removeItem(key);
        else await AsyncStorage.setItem(key, value);
      });
    },
  };
}
