/**
 * Locale handling shared between client (in-app reminders) and Cloud
 * Functions (server-side push). The server has no `LOCALE_ID`, so the
 * client persists `userConfigs/{uid}.locale` and the dispatcher reads
 * it back here.
 */

export const SUPPORTED_REMINDER_LOCALES = [
  'de',
  'en',
  'fr',
  'es',
  'it',
  'nl',
  'el',
  'la',
  'no',
  'zh',
] as const;

export type ReminderLocale = (typeof SUPPORTED_REMINDER_LOCALES)[number];

export const DEFAULT_REMINDER_LOCALE: ReminderLocale = 'de';

/**
 * BCP-47 primary-subtag aliases. Norwegian is a macrolanguage: `nb`
 * (Bokmål) and `nn` (Nynorsk) are distinct primary subtags but both
 * map to our single `no` reminder locale. Without this map a user with
 * `LOCALE_ID = 'nb-NO'` would silently fall back to the default locale.
 */
const LOCALE_ALIAS: Readonly<Record<string, ReminderLocale>> = {
  nb: 'no',
  nn: 'no',
};

/**
 * Normalises any locale string to a supported primary subtag.
 * `en-US` → `en`, `zh-Hant` → `zh`, `nb-NO` → `no`,
 * unknown → `DEFAULT_REMINDER_LOCALE`.
 */
export function normalizeReminderLocale(raw: unknown): ReminderLocale {
  if (typeof raw !== 'string') return DEFAULT_REMINDER_LOCALE;
  const primary = raw.trim().toLowerCase().split(/[-_]/)[0];
  const aliased = LOCALE_ALIAS[primary] ?? primary;
  return (SUPPORTED_REMINDER_LOCALES as ReadonlyArray<string>).includes(aliased)
    ? (aliased as ReminderLocale)
    : DEFAULT_REMINDER_LOCALE;
}

const REMINDER_TITLES: Record<ReminderLocale, string> = {
  de: '💪 Zeit für Liegestütze!',
  en: '💪 Time for push-ups!',
  fr: '💪 L’heure des pompes !',
  es: '💪 ¡Hora de flexiones!',
  it: '💪 Ora dei push-up!',
  nl: '💪 Tijd voor push-ups!',
  el: '💪 Ώρα για push-ups!',
  la: '💪 Tempus flexionis!',
  no: '💪 Tid for push-ups!',
  zh: '💪 做俯卧撑的时间!',
};

const REMINDER_BODIES: Record<ReminderLocale, ReadonlyArray<string>> = {
  de: [
    'Zeit für Liegestütze! 💪',
    'Kurze Pause? Perfekt für Liegestütze!',
    'Du schaffst das – ein paar Liegestütze!',
    'Beweg dich! Liegestütze warten auf dich. 🔥',
    'Dein Körper ruft: Liegestütze, los!',
  ],
  en: [
    'Time for push-ups! 💪',
    'Quick break? Perfect for push-ups!',
    'You got this – a few push-ups!',
    'Move it! Push-ups are waiting for you. 🔥',
    'Your body calls: push-ups, go!',
  ],
  fr: [
    'L’heure des pompes ! 💪',
    'Petite pause ? Parfait pour des pompes !',
    'Tu peux le faire – quelques pompes !',
    'Bouge-toi ! Les pompes t’attendent. 🔥',
    'Ton corps t’appelle : des pompes, vas-y !',
  ],
  es: [
    '¡Hora de flexiones! 💪',
    '¿Pausa rápida? ¡Perfecta para flexiones!',
    'Tú puedes – ¡unas flexiones!',
    '¡Muévete! Las flexiones te esperan. 🔥',
    'Tu cuerpo te llama: ¡flexiones, vamos!',
  ],
  it: [
    'Ora dei push-up! 💪',
    'Pausa veloce? Perfetta per i push-up!',
    'Ce la fai – qualche push-up!',
    'Muoviti! I push-up ti aspettano. 🔥',
    'Il corpo chiama: push-up, vai!',
  ],
  nl: [
    'Tijd voor push-ups! 💪',
    'Korte pauze? Perfect voor push-ups!',
    'Jij kunt dit – een paar push-ups!',
    'Kom op! Push-ups wachten op je. 🔥',
    'Je lichaam roept: push-ups, gaan!',
  ],
  el: [
    'Ώρα για push-ups! 💪',
    'Σύντομο διάλειμμα; Ιδανικό για push-ups!',
    'Τα καταφέρνεις – λίγα push-ups!',
    'Κουνήσου! Τα push-ups σε περιμένουν. 🔥',
    'Το σώμα σου καλεί: push-ups, πάμε!',
  ],
  la: [
    'Tempus flexionis! 💪',
    'Brevis pausa? Aptissima flexionibus!',
    'Potes id facere – paucae flexiones!',
    'Move te! Flexiones te exspectant. 🔥',
    'Corpus vocat: flexiones, age!',
  ],
  no: [
    'Tid for push-ups! 💪',
    'Kort pause? Perfekt for push-ups!',
    'Du klarer det – noen push-ups!',
    'Kom igjen! Push-ups venter på deg. 🔥',
    'Kroppen roper: push-ups, kjør!',
  ],
  zh: [
    '做俯卧撑的时间到了！💪',
    '短暂休息？正好做俯卧撑！',
    '你可以的——来几个俯卧撑！',
    '动起来！俯卧撑在等你。🔥',
    '身体在呼唤：俯卧撑，加油！',
  ],
};

const SNOOZE_LABELS: Record<ReminderLocale, string> = {
  de: '⏰ 30 Min snoozen',
  en: '⏰ Snooze 30 min',
  fr: '⏰ Reporter 30 min',
  es: '⏰ Aplazar 30 min',
  it: '⏰ Posticipa 30 min',
  nl: '⏰ Uitstellen 30 min',
  el: '⏰ Αναβολή 30 λεπτά',
  la: '⏰ Differre 30 min',
  no: '⏰ Utsett 30 min',
  zh: '⏰ 推迟30分钟',
};

const LOG_LABELS: Record<ReminderLocale, string> = {
  de: '✅ Eintragen',
  en: '✅ Log push-ups',
  fr: '✅ Enregistrer',
  es: '✅ Registrar',
  it: '✅ Registra',
  nl: '✅ Registreren',
  el: '✅ Καταχώριση',
  la: '✅ Inscribere',
  no: '✅ Registrer',
  zh: '✅ 记录',
};

const QUICK_LOG_LABELS: Record<ReminderLocale, (n: number) => string> = {
  de: (n) => `✅ ${n} eintragen`,
  en: (n) => `✅ Log ${n}`,
  fr: (n) => `✅ Enregistrer ${n}`,
  es: (n) => `✅ Registrar ${n}`,
  it: (n) => `✅ Registra ${n}`,
  nl: (n) => `✅ Logg ${n}`,
  el: (n) => `✅ Καταχώριση ${n}`,
  la: (n) => `✅ Inscribere ${n}`,
  no: (n) => `✅ Logg ${n}`,
  zh: (n) => `✅ 记录 ${n}`,
};

export function reminderTitle(locale: unknown): string {
  return REMINDER_TITLES[normalizeReminderLocale(locale)];
}

export function reminderBodyChoices(locale: unknown): ReadonlyArray<string> {
  // Defensive copy so a caller that .push()es into the result can't
  // mutate the module-level dictionary and leak across notifications.
  return [...REMINDER_BODIES[normalizeReminderLocale(locale)]];
}

export function reminderSnoozeLabel(locale: unknown): string {
  return SNOOZE_LABELS[normalizeReminderLocale(locale)];
}

export function reminderLogLabel(locale: unknown): string {
  return LOG_LABELS[normalizeReminderLocale(locale)];
}

export function reminderQuickLogLabel(locale: unknown, reps: number): string {
  return QUICK_LOG_LABELS[normalizeReminderLocale(locale)](reps);
}
