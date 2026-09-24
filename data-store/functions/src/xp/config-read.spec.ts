import { describe, expect, it } from '@jest/globals';

import { parseXpConfig } from './config-read';

describe('parseXpConfig', () => {
  it('should keep valid rates and drop invalid ones', () => {
    // when
    const config = parseXpConfig({
      rates: { pushup: 2, bad: -1, nan: Number.NaN, text: '3' },
    });

    // then
    expect(config).toEqual({ rates: { pushup: 2 } });
  });

  it('should return null without a rates map', () => {
    // then
    expect(parseXpConfig(undefined)).toBeNull();
    expect(parseXpConfig({ rates: 'x' })).toBeNull();
  });
});
