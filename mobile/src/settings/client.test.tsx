import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { render, waitFor } from '@testing-library/react-native';
import { Appearance, Text } from 'react-native';

import { fakeAuth, fakeProfiles, resetFakeAuth } from '@/account/fake-supabase';
import { ReadingProviders } from '@/providers';
import { resetSettingsForTests } from '@/settings/client';

/* eslint-disable @typescript-eslint/no-require-imports -- the mock factory cannot close over an import */
jest.mock('@/account/supabase', () => require('@/account/fake-supabase'));
/* eslint-enable @typescript-eslint/no-require-imports */

describe('SettingsSync', () => {
  beforeEach(async () => {
    resetFakeAuth();
    resetSettingsForTests();
    jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => {});
    await AsyncStorage.clear();
  });

  it('reads the account theme and translation from profiles on an untouched phone', async () => {
    fakeProfiles.row = { theme: 'dark', link_translation: 'KJV' };
    fakeAuth.session = { access_token: 'token', user: { id: 'user-1', email: 'reader@example.com' } };
    await render(
      <ReadingProviders>
        <Text>Ready</Text>
      </ReadingProviders>,
    );
    await waitFor(() => expect(Appearance.setColorScheme).toHaveBeenCalledWith('dark'));
    expect(fakeProfiles.saves).toEqual([]);
  });
});
