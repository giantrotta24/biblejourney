import { describe, expect, it } from '@jest/globals';
import { render } from '@testing-library/react-native';

import { TornStubs } from './marks';

const RAGGED = 'M0 0 100 0 100 40 82 100 64 30 40 90 18 35 0 80z';

describe('TornStubs', () => {
  it('clips each stub to the ragged edge', async () => {
    const view = await render(<TornStubs count={3} color="#f7f7f3" />);
    const matches = JSON.stringify(view.toJSON()).match(new RegExp(RAGGED, 'g'));
    expect(matches).toHaveLength(3);
  });
});
