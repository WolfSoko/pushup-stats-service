import { describe, expect, it } from '@jest/globals';

import { inChunks } from './rebuild';

describe('inChunks', () => {
  it('should keep at most the chunk size in flight and preserve order', async () => {
    // given
    let inFlight = 0;
    let peak = 0;
    const task = async (n: number) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await Promise.resolve();
      inFlight--;
      return n * 2;
    };

    // when
    const results = await inChunks([1, 2, 3, 4, 5], 2, task);

    // then
    expect(results).toEqual([2, 4, 6, 8, 10]);
    expect(peak).toBe(2);
  });
});
