import { describe, expect, it } from '@jest/globals';

import { createProfileSync } from './profile-sync';
import { createSettingsStore, type KeyValueStorage, type ProfileFields, type ProfileRemote } from './settings';

const LINK_KEY = 'biblejourney.settings-link.v1';

function memory(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

function remoteWith(row: ProfileFields | null) {
  const remote: ProfileRemote & { saves: ProfileFields[] } = {
    saves: [],
    async load() {
      return row;
    },
    async save(fields) {
      remote.saves.push(fields);
    },
  };
  return remote;
}

function setup(linked = false) {
  const storage = memory();
  if (linked) storage.setItem(LINK_KEY, JSON.stringify({ user: 'user-1', dirty: false }));
  const store = createSettingsStore(storage);
  const applied: string[] = [];
  const sync = createProfileSync({
    store,
    storage,
    applyTheme: (theme) => applied.push(theme),
  });
  const link = () => JSON.parse(storage.getItem(LINK_KEY) ?? 'null');
  return { store, sync, applied, link };
}

describe('profile sync', () => {
  it('takes the account theme and translation when this phone has not changed them', async () => {
    const { store, sync, applied, link } = setup(true);
    const remote = remoteWith({ theme: 'dark', link_translation: 'KJV' });
    await sync.signedIn('user-1', remote);
    expect(store.getSnapshot()).toEqual({ theme: 'dark', linkTranslation: 'KJV' });
    expect(applied).toEqual(['dark']);
    expect(remote.saves).toEqual([]);
    expect(link()).toEqual({ user: 'user-1', dirty: false });
  });

  it('writes a phone change instead of taking the account', async () => {
    const { store, sync, link } = setup(true);
    store.update({ theme: 'dark', linkTranslation: 'ESV' });
    await sync.changed();
    const remote = remoteWith({ theme: 'light', link_translation: 'NIV' });
    await sync.signedIn('user-1', remote);
    expect(remote.saves).toEqual([{ theme: 'dark', link_translation: 'ESV' }]);
    expect(store.getSnapshot()).toEqual({ theme: 'dark', linkTranslation: 'ESV' });
    expect(link()).toEqual({ user: 'user-1', dirty: false });
  });

  it('takes the account on a first link when this phone has not changed settings', async () => {
    const { store, sync, applied } = setup();
    const remote = remoteWith({ theme: 'dark', link_translation: 'KJV' });
    await sync.signedIn('user-1', remote);
    expect(store.getSnapshot()).toEqual({ theme: 'dark', linkTranslation: 'KJV' });
    expect(applied).toEqual(['dark']);
    expect(remote.saves).toEqual([]);
  });

  it('uploads the phone on a first link when settings were changed here', async () => {
    const { store, sync } = setup();
    store.update({ theme: 'light', linkTranslation: 'CSB' });
    const remote = remoteWith({ theme: 'dark', link_translation: 'KJV' });
    await sync.signedIn('user-1', remote);
    expect(store.getSnapshot()).toEqual({ theme: 'light', linkTranslation: 'CSB' });
    expect(remote.saves).toEqual([{ theme: 'light', link_translation: 'CSB' }]);
  });

  it('keeps a settings change made while the account profile is loading', async () => {
    const { store, sync, link } = setup(true);
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const remote = remoteWith({ theme: 'dark', link_translation: 'KJV' });
    const load = remote.load.bind(remote);
    let started: () => void = () => {};
    const startedGate = new Promise<void>((resolve) => {
      started = resolve;
    });
    remote.load = async () => {
      started();
      await gate;
      return load();
    };
    const pending = sync.signedIn('user-1', remote);
    await startedGate;
    store.update({ theme: 'light', linkTranslation: 'ESV' });
    release();
    await pending;
    expect(store.getSnapshot()).toEqual({ theme: 'light', linkTranslation: 'ESV' });
    expect(remote.saves).toEqual([{ theme: 'light', link_translation: 'ESV' }]);
    expect(link()).toEqual({ user: 'user-1', dirty: false });
  });

  it('keeps a settings change made while a save is in flight', async () => {
    const { store, sync, link } = setup(true);
    const remote = remoteWith({ theme: 'dark', link_translation: 'KJV' });
    await sync.signedIn('user-1', remote);
    let release: () => void = () => {};
    let started: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const startedGate = new Promise<void>((resolve) => {
      started = resolve;
    });
    remote.save = async (fields) => {
      remote.saves.push(fields);
      started();
      await gate;
    };
    const pending = sync.changed();
    await startedGate;
    store.update({ theme: 'light', linkTranslation: 'ESV' });
    release();
    await pending;
    expect(store.getSnapshot()).toEqual({ theme: 'light', linkTranslation: 'ESV' });
    expect(remote.saves.at(-1)).toEqual({ theme: 'light', link_translation: 'ESV' });
    expect(link()).toEqual({ user: 'user-1', dirty: false });
  });

  it('drops an unknown account theme and keeps an unknown translation off the phone', async () => {
    const { store, sync } = setup(true);
    store.update({ linkTranslation: 'NLT' });
    const remote = remoteWith({ theme: 'sepia', link_translation: 'BOGUS' });
    await sync.signedIn('user-1', remote);
    expect(store.getSnapshot()).toEqual({ theme: 'system', linkTranslation: 'NLT' });
    expect(remote.saves).toEqual([]);
  });

  it('clears the link on sign-out and takes the next account when this phone has not chosen settings', async () => {
    const { store, sync, link } = setup(true);
    await sync.signedIn('user-1', remoteWith({ theme: 'dark', link_translation: 'KJV' }));
    sync.signedOut();
    expect(link()).toEqual({ user: null, dirty: false });
    expect(store.getSnapshot()).toEqual({ theme: 'dark', linkTranslation: 'KJV' });
    const next = remoteWith({ theme: 'light', link_translation: 'NIV' });
    await sync.signedIn('user-2', next);
    expect(next.saves).toEqual([]);
    expect(store.getSnapshot()).toEqual({ theme: 'light', linkTranslation: 'NIV' });
  });

  it('uploads this phone to the next account when settings were changed here', async () => {
    const { store, sync } = setup(true);
    await sync.signedIn('user-1', remoteWith({ theme: 'dark', link_translation: 'KJV' }));
    sync.signedOut();
    store.update({ linkTranslation: 'ESV' });
    const next = remoteWith({ theme: 'light', link_translation: 'NIV' });
    await sync.signedIn('user-2', next);
    expect(next.saves).toEqual([{ theme: 'dark', link_translation: 'ESV' }]);
    expect(store.getSnapshot()).toEqual({ theme: 'dark', linkTranslation: 'ESV' });
  });
});
