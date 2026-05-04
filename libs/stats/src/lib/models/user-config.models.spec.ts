import {
  DISPLAY_NAME_MAX_LENGTH,
  DISPLAY_NAME_MIN_LENGTH,
  validateDisplayName,
} from './user-config.models';

describe('validateDisplayName', () => {
  describe('Given a valid name', () => {
    it.each([
      'Wolf',
      'Anna-Lena',
      'Jean.Luc',
      'Carl Sagan',
      'a_b',
      'Über_99',
      'むぎ',
      '日本語',
      'AbCdEfGhIjKlMnOpQrStUvWxYz1234',
    ])('Then %s passes', (name) => {
      expect(validateDisplayName(name)).toBeNull();
    });

    it('trims surrounding whitespace before checking length and charset', () => {
      expect(validateDisplayName('  Wolf  ')).toBeNull();
    });

    it(`accepts the lower bound (${DISPLAY_NAME_MIN_LENGTH} chars)`, () => {
      expect(validateDisplayName('AB')).toBeNull();
    });

    it(`accepts the upper bound (${DISPLAY_NAME_MAX_LENGTH} chars)`, () => {
      expect(
        validateDisplayName('A'.repeat(DISPLAY_NAME_MAX_LENGTH))
      ).toBeNull();
    });
  });

  describe('Given a too-short name', () => {
    it.each(['', ' ', 'A', '   '])('Then %p is rejected', (name) => {
      expect(validateDisplayName(name)).toBe('too-short');
    });
  });

  describe('Given a too-long name', () => {
    it('rejects names beyond the max', () => {
      expect(validateDisplayName('A'.repeat(DISPLAY_NAME_MAX_LENGTH + 1))).toBe(
        'too-long'
      );
    });
  });

  describe('Given names with invalid characters', () => {
    it.each([
      'Wolf🚀',
      'with\nnewline',
      'wolf<script>',
      'a/b',
      'Wolf!',
      'foo@bar',
      '/u/admin',
    ])('Then %p is rejected', (name) => {
      expect(validateDisplayName(name)).toBe('invalid-characters');
    });
  });

  describe('Given a non-string value', () => {
    it.each([null, undefined, 42, true, [], {}])(
      'Then %p is rejected as invalid-characters',
      (raw) => {
        expect(validateDisplayName(raw)).toBe('invalid-characters');
      }
    );
  });
});
