"use client";

import { useSyncExternalStore } from "react";
import { currentDay, eras } from "@/content/plan";
import { currentEraIndex, weekMask } from "@/lib/progress";
import { createProgressSync, type ProgressSync } from "@/sync/engine";
import { localQueue } from "@/sync/queue";
import { localPersistence } from "./persistence";
import type { ProgressSnapshot } from "./rows";
import { createProgressStore, LOADING_SNAPSHOT, type ProgressStore } from "./store";

let store: ProgressStore | null = null;
let sync: ProgressSync | null = null;

function boot(): { store: ProgressStore; sync: ProgressSync } {
  if (!store || !sync) {
    const factory = typeof indexedDB === "undefined" ? null : indexedDB;
    sync = createProgressSync(localPersistence(factory), localQueue(factory));
    store = createProgressStore(sync.persistence);
    sync.attach(store);
    void store.load();
    if (typeof window !== "undefined") {
      const retry = () => void store?.flush();
      window.addEventListener("online", retry);
      document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && retry());
    }
  }
  return { store, sync };
}

export const progressStore = (): ProgressStore => boot().store;
export const progressSync = (): ProgressSync => boot().sync;

const subscribe = (listener: () => void) => progressStore().subscribe(listener);

type Derived = { currentIndex: number | null; currentWeek: number | null };
const derivedCache = new WeakMap<ProgressSnapshot, Derived>();

function derived(snapshot: ProgressSnapshot): Derived {
  let value = derivedCache.get(snapshot);
  if (!value) {
    const day = snapshot.ready ? currentDay(snapshot.days) : null;
    value = { currentIndex: day?.index ?? null, currentWeek: day?.week ?? null };
    derivedCache.set(snapshot, value);
  }
  return value;
}

function useSelect<T>(select: (snapshot: ProgressSnapshot) => T, serverValue: T): T {
  return useSyncExternalStore(
    subscribe,
    () => select(progressStore().getSnapshot()),
    () => serverValue,
  );
}

export function useProgress(): ProgressSnapshot {
  return useSyncExternalStore(subscribe, () => progressStore().getSnapshot(), () => LOADING_SNAPSHOT);
}

export const useProgressUnsaved = () => useSelect((s) => s.ready && !s.saved, false);
export const useProgressReady = () => useSelect((s) => s.ready, false);
export const useDayDone = (dayIndex: number) => useSelect((s) => s.days.has(dayIndex), false);
export const useVerseLearned = (week: number) => useSelect((s) => s.verses.has(week), false);
export const useWeekMask = (week: number) => useSelect((s) => weekMask(s.days, week), 0);
export const useCurrentDayIndex = () => useSelect((s) => derived(s).currentIndex, null);
export const useCurrentEraIndex = () => useSelect((s) => (s.ready ? currentEraIndex(s.days, eras) : null), null);
export const useCurrentWeek = () => useSelect((s) => derived(s).currentWeek, null);

let persistRequested = false;

function requestPersistentStorage() {
  if (persistRequested) return;
  persistRequested = true;
  try {
    void navigator.storage?.persist?.().catch(() => undefined);
  } catch {}
}

export function setDayDone(dayIndex: number, done: boolean) {
  if (done) requestPersistentStorage();
  return done ? progressStore().addDay(dayIndex) : progressStore().removeDay(dayIndex);
}

export function setVerseLearned(week: number, learned: boolean) {
  return learned ? progressStore().addVerse(week) : progressStore().removeVerse(week);
}
