import type { ReminderGoalState } from './reminder-goal.models';

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

const LOG_LABELS: Record<ReminderLocale, string> = {
  de: '✅ Eintragen',
  en: '✅ Log push-ups',
  fr: '✅ Enregistrer',
  es: '✅ Registrar',
  it: '✅ Registra',
  nl: '✅ Registreren',
  el: '✅ Καταχώριση',
  no: '✅ Registrer',
  zh: '✅ 记录',
};

const QUICK_LOG_LABELS: Record<ReminderLocale, (n: number) => string> = {
  de: (n) => `✅ ${n} eintragen`,
  en: (n) => `✅ Log ${n}`,
  fr: (n) => `✅ Enregistrer ${n}`,
  es: (n) => `✅ Registrar ${n}`,
  it: (n) => `✅ Registra ${n}`,
  nl: (n) => `✅ Registreer ${n}`,
  el: (n) => `✅ Καταχώριση ${n}`,
  no: (n) => `✅ Logg ${n}`,
  zh: (n) => `✅ 记录 ${n}`,
};

const QUICK_LOG_DONE_LABELS: Record<ReminderLocale, (n: number) => string> = {
  de: (n) => `✅ ${n} Liegestütze eingetragen`,
  en: (n) => `✅ ${n} push-ups logged`,
  fr: (n) => `✅ ${n} pompes enregistrées`,
  es: (n) => `✅ ${n} flexiones registradas`,
  it: (n) => `✅ ${n} flessioni registrate`,
  nl: (n) => `✅ ${n} push-ups geregistreerd`,
  el: (n) => `✅ ${n} κάμψεις καταχωρήθηκαν`,
  no: (n) => `✅ ${n} push-ups logget`,
  zh: (n) => `✅ 已记录 ${n} 个俯卧撑`,
};

const ACTION_FAILED_LABELS: Record<ReminderLocale, string> = {
  de: 'Aktion fehlgeschlagen – bitte in der App erneut versuchen',
  en: 'Action failed – please try again in the app',
  fr: "Échec de l'action – réessayez dans l'application",
  es: 'La acción falló – inténtalo de nuevo en la app',
  it: "Azione non riuscita – riprova nell'app",
  nl: 'Actie mislukt – probeer het opnieuw in de app',
  el: 'Η ενέργεια απέτυχε – δοκιμάστε ξανά στην εφαρμογή',
  no: 'Handlingen mislyktes – prøv igjen i appen',
  zh: '操作失败 – 请在应用中重试',
};

/**
 * Progress line prefixed to a reminder body so the notification names what
 * is still open instead of only cheering. Three shapes, because a plan day
 * with several exercises has no single unit to count
 * (see `ReminderGoalState.counts`).
 */
const GOAL_DAILY_LINES: Record<
  ReminderLocale,
  (done: number, target: number) => string
> = {
  de: (d, t) => `Tagesziel: ${d}/${t} – noch ${t - d}`,
  en: (d, t) => `Daily goal: ${d}/${t} – ${t - d} to go`,
  fr: (d, t) => `Objectif du jour : ${d}/${t} – encore ${t - d}`,
  es: (d, t) => `Objetivo diario: ${d}/${t} – faltan ${t - d}`,
  it: (d, t) => `Obiettivo giornaliero: ${d}/${t} – ancora ${t - d}`,
  nl: (d, t) => `Dagdoel: ${d}/${t} – nog ${t - d}`,
  el: (d, t) => `Στόχος ημέρας: ${d}/${t} – μένουν ${t - d}`,
  no: (d, t) => `Dagsmål: ${d}/${t} – ${t - d} igjen`,
  zh: (d, t) => `今日目标：${d}/${t} – 还差 ${t - d}`,
};

const GOAL_PLAN_VALUE_LINES: Record<
  ReminderLocale,
  (day: number, done: number, target: number) => string
> = {
  de: (day, d, t) => `Plan-Tag ${day}: ${d}/${t} – noch ${t - d}`,
  en: (day, d, t) => `Plan day ${day}: ${d}/${t} – ${t - d} to go`,
  fr: (day, d, t) => `Jour ${day} du plan : ${d}/${t} – encore ${t - d}`,
  es: (day, d, t) => `Día ${day} del plan: ${d}/${t} – faltan ${t - d}`,
  it: (day, d, t) => `Giorno ${day} del piano: ${d}/${t} – ancora ${t - d}`,
  nl: (day, d, t) => `Plandag ${day}: ${d}/${t} – nog ${t - d}`,
  el: (day, d, t) => `Ημέρα ${day} του πλάνου: ${d}/${t} – μένουν ${t - d}`,
  no: (day, d, t) => `Plandag ${day}: ${d}/${t} – ${t - d} igjen`,
  zh: (day, d, t) => `计划第 ${day} 天：${d}/${t} – 还差 ${t - d}`,
};

const GOAL_PLAN_ITEM_LINES: Record<
  ReminderLocale,
  (day: number, done: number, target: number) => string
> = {
  de: (day, d, t) => `Plan-Tag ${day}: ${d}/${t} Übungen geschafft`,
  en: (day, d, t) => `Plan day ${day}: ${d}/${t} exercises done`,
  fr: (day, d, t) => `Jour ${day} du plan : ${d}/${t} exercices faits`,
  es: (day, d, t) => `Día ${day} del plan: ${d}/${t} ejercicios hechos`,
  it: (day, d, t) => `Giorno ${day} del piano: ${d}/${t} esercizi fatti`,
  nl: (day, d, t) => `Plandag ${day}: ${d}/${t} oefeningen gedaan`,
  el: (day, d, t) => `Ημέρα ${day} του πλάνου: ${d}/${t} ασκήσεις έτοιμες`,
  no: (day, d, t) => `Plandag ${day}: ${d}/${t} øvelser ferdig`,
  zh: (day, d, t) => `计划第 ${day} 天：已完成 ${d}/${t} 个动作`,
};

export function reminderTitle(locale: unknown): string {
  return REMINDER_TITLES[normalizeReminderLocale(locale)];
}

export function reminderBodyChoices(locale: unknown): ReadonlyArray<string> {
  // Defensive copy so a caller that .push()es into the result can't
  // mutate the module-level dictionary and leak across notifications.
  return [...REMINDER_BODIES[normalizeReminderLocale(locale)]];
}

export function reminderLogLabel(locale: unknown): string {
  return LOG_LABELS[normalizeReminderLocale(locale)];
}

export function reminderQuickLogLabel(locale: unknown, reps: number): string {
  return QUICK_LOG_LABELS[normalizeReminderLocale(locale)](reps);
}

export function reminderQuickLogDoneLabel(
  locale: unknown,
  reps: number
): string {
  return QUICK_LOG_DONE_LABELS[normalizeReminderLocale(locale)](reps);
}

export function reminderActionFailedLabel(locale: unknown): string {
  return ACTION_FAILED_LABELS[normalizeReminderLocale(locale)];
}

/**
 * The progress line for a reminder, or `''` when there is no goal to
 * report. Callers prepend it to the motivational body.
 */
export function reminderGoalLine(
  locale: unknown,
  goal: ReminderGoalState | null
): string {
  if (!goal) return '';
  const resolved = normalizeReminderLocale(locale);
  if (goal.kind === 'daily') {
    return GOAL_DAILY_LINES[resolved](goal.done, goal.target);
  }
  const day = goal.dayIndex ?? 1;
  const lines =
    goal.counts === 'items' ? GOAL_PLAN_ITEM_LINES : GOAL_PLAN_VALUE_LINES;
  return lines[resolved](day, goal.done, goal.target);
}
