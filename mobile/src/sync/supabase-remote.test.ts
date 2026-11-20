import { describe, expect, it } from '@jest/globals';

import { RemoteRefusedError } from './remote';
import { broadcastChange, remoteError } from './supabase-remote';

const userId = 'user-1';

describe('progress broadcast', () => {
  it('turns a note edit into a note change and ignores other tables', () => {
    expect(
      broadcastChange(
        {
          table: 'notes',
          operation: 'UPDATE',
          record: {
            user_id: userId,
            day_index: 3,
            body: 'Later',
            updated_at: '2026-11-20T12:04:00.000Z',
          },
        },
        userId,
      ),
    ).toEqual({
      kind: 'put-note',
      row: { day_index: 3, body: 'Later', updated_at: '2026-11-20T12:04:00.000Z' },
    });
    expect(
      broadcastChange(
        { table: 'notes', operation: 'DELETE', old_record: { user_id: userId, day_index: 3 } },
        userId,
      ),
    ).toEqual({ kind: 'delete-note', day_index: 3, deleted_at: '1970-01-01T00:00:00.000Z' });
    expect(broadcastChange({ table: 'profiles', operation: 'UPDATE', record: { user_id: userId } }, userId)).toBeNull();
  });

  it('drops a refused write and leaves a retryable error to try again', () => {
    expect(remoteError({ message: 'check' }, 400)).toBeInstanceOf(RemoteRefusedError);
    const retryable = { message: 'unauthorized' };
    expect(remoteError(retryable, 401)).toBe(retryable);
  });
});
