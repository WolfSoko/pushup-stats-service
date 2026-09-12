import { describe, expect, it } from '@jest/globals';

import { pushLocaleFromConfig } from './user-locale';

describe('push/user-locale', () => {
  it('should prefer the top-level locale', () => {
    // when / then
    expect(
      pushLocaleFromConfig({ locale: 'en-US', reminder: { language: 'fr' } })
    ).toBe('en');
  });

  it('should fall back to the legacy reminder language', () => {
    // when / then
    expect(pushLocaleFromConfig({ reminder: { language: 'fr' } })).toBe('fr');
  });

  it('should land on the default without either', () => {
    // when / then
    expect(pushLocaleFromConfig(undefined)).toBe('de');
    expect(pushLocaleFromConfig({})).toBe('de');
  });
});
