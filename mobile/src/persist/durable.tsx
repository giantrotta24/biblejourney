import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { type KeyValueStore, type Loaded } from './document';

export type DurableValue<T> = {
  value: T | null;
  unavailable: boolean;
  /** A write is queued or in flight. A failed write stays pending for retry and is not saving. */
  saving: boolean;
  /** Set when a write throws, cleared when a write succeeds. */
  failed: boolean;
  read: () => T;
  isReady: () => boolean;
  isUnavailable: () => boolean;
  /** True after a payload that could not be parsed, until a later save replaces it. */
  isUnreadable: () => boolean;
  commit: (next: T) => void;
  beginRetry: () => void;
};

export function useDurableValue<T>({
  storage,
  load,
  save,
  empty,
  attempt,
}: {
  storage: KeyValueStore;
  load: (storage: KeyValueStore) => Promise<Loaded<T>>;
  save: (value: T, storage: KeyValueStore, backupRaw?: string | null) => Promise<void>;
  empty: () => T;
  attempt: number;
}): DurableValue<T> {
  const [value, setValue] = useState<T | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const failedRef = useRef(false);
  const valueRef = useRef<T>(empty());
  const backupRef = useRef<string | null>(null);
  const pendingRef = useRef<T | null>(null);
  const writingRef = useRef(false);
  const readyRef = useRef(false);
  const unavailableRef = useRef(false);
  const unreadableRef = useRef(false);
  const storageRef = useRef(storage);
  const saveRef = useRef(save);
  const emptyRef = useRef(empty);

  useEffect(() => {
    storageRef.current = storage;
    saveRef.current = save;
    emptyRef.current = empty;
  });

  const flush = useCallback(async () => {
    if (writingRef.current) return;
    writingRef.current = true;
    setSaving(true);
    try {
      while (pendingRef.current) {
        const snapshot = pendingRef.current;
        pendingRef.current = null;
        const backup = backupRef.current;
        try {
          await saveRef.current(snapshot, storageRef.current, backup);
          if (backupRef.current === backup) backupRef.current = null;
          unreadableRef.current = false;
          failedRef.current = false;
          setFailed(false);
        } catch {
          pendingRef.current = pendingRef.current ?? snapshot;
          failedRef.current = true;
          setFailed(true);
          break;
        }
      }
    } finally {
      writingRef.current = false;
      setSaving(pendingRef.current !== null && !failedRef.current);
    }
  }, []);

  const beginRetry = useCallback(() => {
    readyRef.current = false;
    unavailableRef.current = false;
    unreadableRef.current = false;
    valueRef.current = emptyRef.current();
    pendingRef.current = null;
    failedRef.current = false;
    setFailed(false);
    setSaving(false);
    setValue(null);
    setUnavailable(false);
  }, []);

  useEffect(() => {
    let live = true;
    readyRef.current = false;
    load(storage).then((result) => {
      if (!live) return;
      if (result.status === 'unavailable') {
        backupRef.current = null;
        pendingRef.current = null;
        valueRef.current = emptyRef.current();
        unreadableRef.current = false;
        readyRef.current = false;
        unavailableRef.current = true;
        setValue(null);
        setUnavailable(true);
        return;
      }
      const loaded = result.status === 'ready' ? result.value : emptyRef.current();
      backupRef.current = result.status === 'unreadable' ? result.raw : null;
      unreadableRef.current = result.status === 'unreadable';
      unavailableRef.current = false;
      valueRef.current = loaded;
      readyRef.current = true;
      setUnavailable(false);
      setValue(loaded);
    });
    return () => {
      live = false;
    };
  }, [storage, load, attempt]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && pendingRef.current) void flush();
    });
    return () => subscription.remove();
  }, [flush]);

  const read = useCallback(() => valueRef.current, []);
  const isReady = useCallback(() => readyRef.current, []);
  const isUnavailable = useCallback(() => unavailableRef.current, []);
  const isUnreadable = useCallback(() => unreadableRef.current, []);
  const commit = useCallback(
    (next: T) => {
      if (!readyRef.current) return;
      valueRef.current = next;
      setValue(next);
      pendingRef.current = next;
      setSaving(true);
      void flush();
    },
    [flush],
  );

  return {
    value,
    unavailable,
    saving,
    failed,
    read,
    isReady,
    isUnavailable,
    isUnreadable,
    commit,
    beginRetry,
  };
}
