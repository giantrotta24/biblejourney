import type { SyncStatus } from './engine';

export type Arrival = {
  arm(): void;
  reset(): void;
  onStatus(status: SyncStatus): void;
  visible(): boolean;
  dismiss(): void;
  subscribe(listener: () => void): () => void;
};

/** One line after the first link. A restored session does not arm it. */
export function createArrival(): Arrival {
  let armed = false;
  let shown = false;
  let dismissed = false;
  const listeners = new Set<() => void>();

  function notify() {
    for (const listener of listeners) listener();
  }

  return {
    arm() {
      if (shown || dismissed) return;
      armed = true;
    },
    reset() {
      armed = false;
      shown = false;
      dismissed = false;
      notify();
    },
    onStatus(status) {
      if (!armed || dismissed || status !== 'synced' || shown) return;
      shown = true;
      notify();
    },
    visible: () => shown && !dismissed,
    dismiss() {
      if (!shown || dismissed) return;
      dismissed = true;
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
