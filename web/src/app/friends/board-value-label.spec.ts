import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import { boardValueLabel } from './board-value-label';

registerLocaleData(localeDe);

describe('boardValueLabel', () => {
  it('should add the XP unit with locale grouping for the XP metric', () => {
    // then
    expect(boardValueLabel('xp', 1250, 'de')).toBe('1.250 XP');
  });

  it('should keep reps unitless', () => {
    // then
    expect(boardValueLabel('reps', 40, 'de')).toBe('40');
  });

  it('should pluralise training days', () => {
    // then
    expect(boardValueLabel('days', 1, 'de')).toBe('1 Tag');
    expect(boardValueLabel('days', 3, 'de')).toBe('3 Tage');
  });
});
