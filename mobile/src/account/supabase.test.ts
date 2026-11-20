/* eslint-disable @typescript-eslint/no-require-imports -- isolateModules loads the client after the env is set */
import { afterEach, describe, expect, it, jest } from '@jest/globals';

const ORIGINAL_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ORIGINAL_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

function restore(name: 'EXPO_PUBLIC_SUPABASE_URL' | 'EXPO_PUBLIC_SUPABASE_ANON_KEY', value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

afterEach(() => {
  restore('EXPO_PUBLIC_SUPABASE_URL', ORIGINAL_URL);
  restore('EXPO_PUBLIC_SUPABASE_ANON_KEY', ORIGINAL_KEY);
  jest.dontMock('@supabase/supabase-js');
  jest.resetModules();
});

describe('supabase client', () => {
  it('stays unset when either variable is missing', () => {
    jest.isolateModules(() => {
      jest.doMock('@supabase/supabase-js', () => ({ createClient: jest.fn(() => ({ auth: {} })) }));
      process.env.EXPO_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
      delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      const { createClient } = require('@supabase/supabase-js') as { createClient: jest.Mock };
      const client = require('@/account/supabase') as typeof import('@/account/supabase');
      expect(client.accountsConfigured()).toBe(false);
      expect(client.supabase).toBeNull();
      expect(createClient).not.toHaveBeenCalled();
    });
  });

  it('keeps a persisted pkce session in app storage', () => {
    jest.isolateModules(() => {
      jest.doMock('@supabase/supabase-js', () => ({ createClient: jest.fn(() => ({ auth: {} })) }));
      process.env.EXPO_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
      const { createClient } = require('@supabase/supabase-js') as { createClient: jest.Mock };
      const storageModule = require('@react-native-async-storage/async-storage') as { default?: object };
      const AsyncStorage = storageModule.default ?? storageModule;
      require('@/account/supabase');
      expect(createClient).toHaveBeenCalledWith('http://127.0.0.1:54321', 'anon-key', {
        auth: {
          storage: AsyncStorage,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
          flowType: 'pkce',
        },
      });
    });
  });
});
