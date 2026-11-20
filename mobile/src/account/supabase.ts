import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function readPublic(name: 'EXPO_PUBLIC_SUPABASE_URL' | 'EXPO_PUBLIC_SUPABASE_ANON_KEY'): string | undefined {
  // A static process.env.EXPO_PUBLIC_* read is inlined when the file is bundled, so a test
  // cannot set the variable before the client loads and a missing value is frozen in.
  // eslint-disable-next-line expo/no-dynamic-env-var
  const value = process.env[name];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

const url = readPublic('EXPO_PUBLIC_SUPABASE_URL');
const anonKey = readPublic('EXPO_PUBLIC_SUPABASE_ANON_KEY');

export function accountsConfigured(): boolean {
  return Boolean(url && anonKey);
}

export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          storage: AsyncStorage,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
          flowType: 'pkce',
        },
      })
    : null;
