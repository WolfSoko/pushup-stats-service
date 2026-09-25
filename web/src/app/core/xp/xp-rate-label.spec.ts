import { registerLocaleData } from '@angular/common';
import localeDe from '@angular/common/locales/de';
import {
  xpPreviewLabel,
  xpRateLabel,
  xpRateLabelFor,
  xpRateUnitLabel,
} from './xp-rate-label';

registerLocaleData(localeDe);

describe('xpRateLabel', () => {
  it('should label a rep exercise per repetition', () => {
    // when
    const label = xpRateLabel('pushup', 1, 'de');

    // then
    expect(label).toBe('1 XP / Wdh.');
  });

  it('should label a time exercise per minute', () => {
    // when
    const label = xpRateLabel('plank.standard', 8, 'de');

    // then
    expect(label).toBe('8 XP / Min.');
  });

  it('should label a distance exercise per kilometre with locale decimals', () => {
    // when
    const label = xpRateLabel('cardio.running', 62.5, 'de');

    // then
    expect(label).toBe('62,5 XP / km');
  });

  it('should return null for an unknown exercise', () => {
    // when
    const label = xpRateLabel('nope', 1, 'de');

    // then
    expect(label).toBeNull();
  });
});

describe('xpRateLabelFor', () => {
  it('should fall back to the shipped default without a config', () => {
    // when
    const label = xpRateLabelFor('pull.pullups', null, 'de');

    // then
    expect(label).toBe('3 XP / Wdh.');
  });

  it('should use the admin override when present', () => {
    // when
    const label = xpRateLabelFor(
      'pull.pullups',
      { rates: { 'pull.pullups': 4 } },
      'de'
    );

    // then
    expect(label).toBe('4 XP / Wdh.');
  });
});

describe('xpRateUnitLabel', () => {
  it('should name every rate unit', () => {
    // then
    expect(xpRateUnitLabel('rep')).toBe('Wdh.');
    expect(xpRateUnitLabel('minute')).toBe('Min.');
    expect(xpRateUnitLabel('km')).toBe('km');
  });
});

describe('xpPreviewLabel', () => {
  it('should render a rounded preview', () => {
    // when
    const label = xpPreviewLabel(1234, 'de');

    // then
    expect(label).toBe('≈ 1.234 XP');
  });
});
