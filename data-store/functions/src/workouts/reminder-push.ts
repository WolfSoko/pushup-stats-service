import type { ReminderLocale } from '@pu-stats/models';

import type { PushSendOptions } from '../push/deliver';

/**
 * What a session reminder says, per locale. Server-only strings, like the
 * friend notifications in `friends/push-text.ts`, and the same word for
 * "session" as there.
 */
const TEXTS: Record<
  ReminderLocale,
  { readonly title: (t: string) => string; readonly body: string }
> = {
  de: {
    title: (t) => `⏰ ${t}`,
    body: 'Zeit für deine Session. Tippe, um direkt loszulegen.',
  },
  en: {
    title: (t) => `⏰ ${t}`,
    body: 'Time for your session. Tap to start right away.',
  },
  fr: {
    title: (t) => `⏰ ${t}`,
    body: 'C’est l’heure de ta séance. Touche pour commencer tout de suite.',
  },
  es: {
    title: (t) => `⏰ ${t}`,
    body: 'Es hora de tu sesión. Toca para empezar ya.',
  },
  it: {
    title: (t) => `⏰ ${t}`,
    body: 'È ora della tua sessione. Tocca per iniziare subito.',
  },
  nl: {
    title: (t) => `⏰ ${t}`,
    body: 'Tijd voor je sessie. Tik om meteen te beginnen.',
  },
  el: {
    title: (t) => `⏰ ${t}`,
    body: 'Ώρα για την προπόνησή σου. Πάτα για να ξεκινήσεις αμέσως.',
  },
  no: {
    title: (t) => `⏰ ${t}`,
    body: 'Tid for økten din. Trykk for å starte med en gang.',
  },
  zh: {
    title: (t) => `⏰ ${t}`,
    body: '该进行你的训练了。点按即可立即开始。',
  },
};

/**
 * A reminder that arrives after its time is no use — the same half hour
 * the dispatcher allows for a late tick. One collapse topic per workout,
 * so two sessions due at once both show up. Web Push topics allow at
 * most 32 URL-safe characters; Firestore auto-ids are 20.
 */
export function workoutReminderPushOptions(workoutId: string): PushSendOptions {
  return {
    urgency: 'high',
    TTL: 1800,
    topic: `wr-${workoutId.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 29)}`,
  };
}

export interface WorkoutReminderPushInput {
  readonly locale: ReminderLocale;
  readonly workoutId: string;
  readonly title: string;
}

export function buildWorkoutReminderPayload(
  input: WorkoutReminderPushInput
): string {
  const text = TEXTS[input.locale];
  return JSON.stringify({
    title: text.title(input.title),
    body: text.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: `workout-reminder-${input.workoutId}`,
    renotify: true,
    data: {
      url: `/${input.locale}/workouts/${input.workoutId}/run`,
      locale: input.locale,
    },
    actions: [],
  });
}
