"use client";

import { useSyncExternalStore } from "react";

const KEY = "bible-journey:sunday-seen";
const listeners = new Set<() => void>();
let memory: number | null = null;

function read(): number | null {
  try {
    const value = Number.parseInt(window.localStorage.getItem(KEY) ?? "", 10);
    return Number.isInteger(value) ? value : memory;
  } catch {
    return memory;
  }
}

function write(week: number): boolean {
  try {
    window.localStorage.setItem(KEY, String(week));
    return true;
  } catch {
    return false;
  }
}

export function markSundaySeen(week: number) {
  memory = week;
  write(week);
  for (const listener of listeners) listener();
}

export function clearSundaySeen() {
  memory = null;
  try {
    window.localStorage.removeItem(KEY);
  } catch {}
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSundaySeen(): number | null {
  return useSyncExternalStore(subscribe, read, () => null);
}
