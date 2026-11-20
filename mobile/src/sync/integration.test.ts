import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, jest } from '@jest/globals';

import { createSync } from './engine';
import { createMemoryStore } from './memory-store';
import { memoryQueue } from './queue';
import { supabaseRemote, type SyncClient } from './supabase-remote';

// The jest-expo environment's fetch goes through React Native's XMLHttpRequest stand-in, which never reaches a server.
const nodeFetch = (jest.requireActual('node-fetch') as { default: typeof fetch }).default;
const enabled = process.env.SYNC_INTEGRATION === '1';
const suite = enabled ? describe : describe.skip;

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} is required when SYNC_INTEGRATION=1`);
  return value;
}

suite('two phones, one account', () => {
  jest.setTimeout(30_000);

  it('carries progress, verses and notes, keeps the later note, and deletes across phones', async () => {
    const url = required('EXPO_PUBLIC_SUPABASE_URL', process.env.EXPO_PUBLIC_SUPABASE_URL);
    const anonKey = required('EXPO_PUBLIC_SUPABASE_ANON_KEY', process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
    const email = required('SYNC_TEST_EMAIL', process.env.SYNC_TEST_EMAIL);
    const password = required('SYNC_TEST_PASSWORD', process.env.SYNC_TEST_PASSWORD);
    let minute = 0;
    const now = () => new Date(Date.UTC(2026, 10, 20, 12, minute));

    async function phone() {
      const client = createClient(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch: nodeFetch },
      });
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const userId = (await client.auth.getSession()).data.session?.user.id;
      if (!userId) throw new Error('Sign in returned no user');
      const sync = createSync(memoryQueue(), { debounceMs: 0 });
      const store = createMemoryStore(sync, now);
      sync.attach(store);
      await sync.start(userId, supabaseRemote(client as unknown as SyncClient, userId));
      await sync.idle();
      return { client, sync, store, userId };
    }

    async function clear(client: SupabaseClient, userId: string) {
      const days = await client.from('day_progress').delete().eq('user_id', userId);
      const verses = await client.from('verse_progress').delete().eq('user_id', userId);
      const notes = await client.from('notes').delete().eq('user_id', userId);
      if (days.error) throw days.error;
      if (verses.error) throw verses.error;
      if (notes.error) throw notes.error;
    }

    const first = await phone();
    const second = await phone();
    try {
      await clear(first.client, first.userId);
      await first.sync.resync();
      await first.sync.idle();
      await second.sync.resync();
      await second.sync.idle();

      minute = 1;
      await first.store.addDay(4);
      await first.store.addVerse(2);
      await first.store.addNote(3, 'From the first phone');
      await first.sync.idle();
      await second.sync.resync();
      await second.sync.idle();

      expect(second.store.rows().days.map((row) => row.day_index)).toEqual([4]);
      expect(second.store.rows().verses.map((row) => row.week)).toEqual([2]);
      expect(second.store.rows().notes.map((row) => row.body)).toEqual(['From the first phone']);

      minute = 2;
      await first.store.addNote(3, 'Earlier edit');
      minute = 3;
      await second.store.addNote(3, 'Later edit');
      await first.sync.idle();
      await second.sync.idle();
      await first.sync.resync();
      await second.sync.resync();
      await first.sync.idle();
      await second.sync.idle();
      expect(first.store.rows().notes.map((row) => row.body)).toEqual(['Later edit']);
      expect(second.store.rows().notes.map((row) => row.body)).toEqual(['Later edit']);

      await first.store.removeNote(3);
      await first.sync.recordLocal({ kind: 'delete-note', day_index: 3 });
      await first.sync.idle();
      await second.sync.resync();
      await second.sync.idle();
      expect(second.store.rows().notes).toEqual([]);
      expect(second.store.rows().days.map((row) => row.day_index)).toEqual([4]);
    } finally {
      await clear(first.client, first.userId);
      await first.sync.stop();
      await second.sync.stop();
    }
  });
});
