import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { supabase } from '@/account/supabase';

import { createArrival, type Arrival } from './arrival';
import { createSync, type Sync, type SyncStatus } from './engine';
import { createPortStore, type RegisterBook } from './port-store';
import { createStorageQueue } from './queue';
import type { RemoteAccount } from './remote';
import { canSync, supabaseRemote } from './supabase-remote';

export type Runtime = {
  sync: Sync;
  arrival: Arrival;
  register: RegisterBook;
  resolveRemote: (userId: string) => RemoteAccount | null;
};

const RuntimeContext = createContext<Runtime | null>(null);

function defaultRemote(userId: string): RemoteAccount | null {
  if (!canSync(supabase)) return null;
  return supabaseRemote(supabase, userId);
}

export function createRuntime(options?: {
  remoteFor?: (userId: string) => RemoteAccount | null | undefined;
}): Runtime {
  const sync = createSync(createStorageQueue(AsyncStorage), { unrecordedStore: AsyncStorage });
  const ports = createPortStore({
    onReady() {
      if (sync.userId()) void sync.resync();
    },
  });
  sync.attach(ports.store);
  const arrival = createArrival();
  sync.onFirstLink(() => arrival.arm());
  const engineStop = sync.stop.bind(sync);
  sync.stop = () => engineStop().then(() => arrival.reset());
  const remotes = new Map<string, RemoteAccount>();
  return {
    sync,
    arrival,
    register: ports.register,
    resolveRemote(userId) {
      const cached = remotes.get(userId);
      if (cached) return cached;
      const custom = options?.remoteFor?.(userId);
      const remote = custom === undefined ? defaultRemote(userId) : custom;
      if (remote) remotes.set(userId, remote);
      return remote;
    },
  };
}

export function SyncRuntimeProvider({ runtime, children }: { runtime: Runtime; children: ReactNode }) {
  useEffect(() => {
    return runtime.sync.subscribeStatus(() => {
      runtime.arrival.onStatus(runtime.sync.getStatus());
    });
  }, [runtime]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void runtime.sync.resync();
    });
    return () => subscription.remove();
  }, [runtime]);

  return <RuntimeContext.Provider value={runtime}>{children}</RuntimeContext.Provider>;
}

export function useRuntime(): Runtime | null {
  return useContext(RuntimeContext);
}

function emptySubscribe() {
  return () => undefined;
}

function offStatus(): SyncStatus {
  return 'off';
}

function hidden() {
  return false;
}

function noneRejected() {
  return 0;
}

export function useSyncStatus(): SyncStatus {
  const runtime = useRuntime();
  const subscribe = useCallback(
    (listener: () => void) => (runtime ? runtime.sync.subscribeStatus(listener) : emptySubscribe()),
    [runtime],
  );
  const get = useCallback(() => (runtime ? runtime.sync.getStatus() : offStatus()), [runtime]);
  return useSyncExternalStore(subscribe, get, get);
}

export function useRejectedCount(): number {
  const runtime = useRuntime();
  const subscribe = useCallback(
    (listener: () => void) => (runtime ? runtime.sync.subscribeStatus(listener) : emptySubscribe()),
    [runtime],
  );
  const get = useCallback(() => (runtime ? runtime.sync.rejectedCount() : noneRejected()), [runtime]);
  return useSyncExternalStore(subscribe, get, get);
}

export function useSignedInNote(): { visible: boolean; dismiss: () => void } {
  const runtime = useRuntime();
  const visible = useSyncExternalStore(
    runtime ? runtime.arrival.subscribe : emptySubscribe,
    runtime ? runtime.arrival.visible : hidden,
    runtime ? runtime.arrival.visible : hidden,
  );
  return { visible, dismiss: () => runtime?.arrival.dismiss() };
}

export function useRecord() {
  const runtime = useRuntime();
  return useCallback(
    (change: Parameters<Sync['recordLocal']>[0]) => {
      if (!runtime) return;
      void runtime.sync.recordLocal(change).catch(() => undefined);
    },
    [runtime],
  );
}
