import {
  DEFAULT_REMINDER_LOCALE,
  normalizeReminderLocale,
  reminderBodyChoices,
  reminderLogLabel,
  reminderQuickLogLabel,
  reminderSnoozeLabel,
  reminderTitle,
  SUPPORTED_REMINDER_LOCALES,
} from './reminder-i18n.models';

describe('reminder-i18n.models', () => {
  describe('normalizeReminderLocale', () => {
    it.each(SUPPORTED_REMINDER_LOCALES)(
      'keeps supported locale "%s" as-is',
      (locale) => {
        expect(normalizeReminderLocale(locale)).toBe(locale);
      }
    );

    it('strips region tag (en-US → en)', () => {
      expect(normalizeReminderLocale('en-US')).toBe('en');
    });

    it('strips script tag (zh-Hant → zh)', () => {
      expect(normalizeReminderLocale('zh-Hant')).toBe('zh');
    });

    it('lower-cases the primary subtag', () => {
      expect(normalizeReminderLocale('FR')).toBe('fr');
    });

    it('trims surrounding whitespace before normalising', () => {
      expect(normalizeReminderLocale('  en  ')).toBe('en');
    });

    it('maps Norwegian Bokmål (nb-NO) to "no"', () => {
      // BCP-47 treats `nb`/`nn` as distinct primary subtags; the previous
      // implementation silently fell back to the default for either,
      // which gave Bokmål users German notifications.
      expect(normalizeReminderLocale('nb-NO')).toBe('no');
      expect(normalizeReminderLocale('nb')).toBe('no');
    });

    it('maps Norwegian Nynorsk (nn-NO) to "no"', () => {
      expect(normalizeReminderLocale('nn-NO')).toBe('no');
      expect(normalizeReminderLocale('nn')).toBe('no');
    });

    it('falls back to default for unsupported locales', () => {
      expect(normalizeReminderLocale('xx')).toBe(DEFAULT_REMINDER_LOCALE);
      expect(normalizeReminderLocale('')).toBe(DEFAULT_REMINDER_LOCALE);
      expect(normalizeReminderLocale(undefined)).toBe(DEFAULT_REMINDER_LOCALE);
      expect(normalizeReminderLocale(null)).toBe(DEFAULT_REMINDER_LOCALE);
      expect(normalizeReminderLocale(42)).toBe(DEFAULT_REMINDER_LOCALE);
    });
  });

  describe('localised strings', () => {
    it.each(SUPPORTED_REMINDER_LOCALES)(
      'has a non-empty title for "%s"',
      (locale) => {
        const title = reminderTitle(locale);
        expect(title.length).toBeGreaterThan(0);
        // every supported title carries the muscle emoji as a visual hook
        expect(title).toContain('💪');
      }
    );

    it.each(SUPPORTED_REMINDER_LOCALES)(
      'has at least one body candidate for "%s"',
      (locale) => {
        expect(reminderBodyChoices(locale).length).toBeGreaterThan(0);
      }
    );

    it.each(SUPPORTED_REMINDER_LOCALES)(
      'has snooze + log + quickLog labels for "%s"',
      (locale) => {
        expect(reminderSnoozeLabel(locale)).toMatch(/⏰/);
        expect(reminderLogLabel(locale)).toMatch(/✅/);
        const quick = reminderQuickLogLabel(locale, 42);
        expect(quick).toMatch(/✅/);
        expect(quick).toContain('42');
      }
    );

    it('falls back to the default locale for unsupported tags', () => {
      expect(reminderTitle('xx')).toBe(reminderTitle(DEFAULT_REMINDER_LOCALE));
      expect(reminderSnoozeLabel('xx')).toBe(
        reminderSnoozeLabel(DEFAULT_REMINDER_LOCALE)
      );
    });
  });
});
