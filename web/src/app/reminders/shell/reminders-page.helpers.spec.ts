import {
  parseInputNumber,
  parseInputValue,
  resolveTimezone,
  shouldAutoSubscribePush,
} from './reminders-page.helpers';

function inputEvent(value: string): Event {
  return { target: { value } } as unknown as Event;
}

describe('reminders-page.helpers', () => {
  describe('parseInputValue', () => {
    it('should return the raw string value of the input', () => {
      // given
      const event = inputEvent('22:30');
      // when
      const result = parseInputValue(event);
      // then
      expect(result).toBe('22:30');
    });

    it('should return an empty string when the input is empty', () => {
      // given
      const event = inputEvent('');
      // when
      const result = parseInputValue(event);
      // then
      expect(result).toBe('');
    });
  });

  describe('parseInputNumber', () => {
    it('should parse a numeric input value', () => {
      // given
      const event = inputEvent('45');
      // when
      const result = parseInputNumber(event);
      // then
      expect(result).toBe(45);
    });

    it('should parse a fractional numeric input value', () => {
      // given
      const event = inputEvent('12.5');
      // when
      const result = parseInputNumber(event);
      // then
      expect(result).toBe(12.5);
    });

    it('should yield 0 for a blank input (Number("") === 0, matching the original asNumber)', () => {
      // given — blank coerces to 0, not NaN, so it is not the fallback path;
      // the form store then clamps it to the valid range on blur
      const event = inputEvent('');
      // when
      const result = parseInputNumber(event);
      // then
      expect(result).toBe(0);
    });

    it('should fall back to 100 for a non-numeric input', () => {
      // given
      const event = inputEvent('abc');
      // when
      const result = parseInputNumber(event);
      // then
      expect(result).toBe(100);
    });
  });

  describe('resolveTimezone', () => {
    it('should prefer the already-stored timezone', () => {
      // given
      const stored = 'America/New_York';
      // when
      const result = resolveTimezone(stored);
      // then
      expect(result).toBe('America/New_York');
    });

    it('should fall back to the browser-resolved timezone when none is stored', () => {
      // given
      const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      // when
      const result = resolveTimezone(undefined);
      // then
      expect(result).toBe(browserZone || 'Europe/Berlin');
    });

    it('should fall back to the browser zone for an empty stored string', () => {
      // given
      const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      // when
      const result = resolveTimezone('');
      // then
      expect(result).toBe(browserZone || 'Europe/Berlin');
    });
  });

  describe('shouldAutoSubscribePush', () => {
    it('should auto-subscribe when newly enabled and not subscribed', () => {
      // given
      const wasEnabled = false;
      // when
      const result = shouldAutoSubscribePush(wasEnabled, 'not-subscribed');
      // then
      expect(result).toBe(true);
    });

    it('should auto-subscribe when newly enabled and prior status is error', () => {
      // when
      const result = shouldAutoSubscribePush(false, 'error');
      // then
      expect(result).toBe(true);
    });

    it('should not auto-subscribe when reminders were already enabled', () => {
      // when
      const result = shouldAutoSubscribePush(true, 'not-subscribed');
      // then
      expect(result).toBe(false);
    });

    it('should not auto-subscribe when already subscribed', () => {
      // when
      const result = shouldAutoSubscribePush(false, 'subscribed');
      // then
      expect(result).toBe(false);
    });

    it('should not auto-subscribe when push is denied', () => {
      // when
      const result = shouldAutoSubscribePush(false, 'denied');
      // then
      expect(result).toBe(false);
    });

    it('should not auto-subscribe when push is unsupported', () => {
      // when
      const result = shouldAutoSubscribePush(false, 'unsupported');
      // then
      expect(result).toBe(false);
    });
  });
});
