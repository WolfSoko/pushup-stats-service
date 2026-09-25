import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import { formatXp, levelPercent } from './xp-format';

registerLocaleData(localeDe);

describe('formatXp', () => {
  it('should group thousands for the locale and add the unit', () => {
    // when
    const label = formatXp(1234.4, 'de');

    // then
    expect(label).toBe('1.234 XP');
  });
});

describe('levelPercent', () => {
  it('should round the level fraction to a whole percentage', () => {
    // then
    expect(levelPercent({ fraction: 0.456 })).toBe(46);
    expect(levelPercent({ fraction: 0 })).toBe(0);
  });
});
