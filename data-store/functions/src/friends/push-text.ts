import type { ReminderLocale } from '@pu-stats/models';

/**
 * What the friend notifications say, per locale. Server-only strings —
 * they never reach a template, so they live here rather than in XLIFF.
 */

type Texts = {
  readonly anonymous: string;
  readonly requestTitle: string;
  readonly requestBody: (name: string) => string;
  readonly acceptedTitle: string;
  readonly acceptedBody: (name: string) => string;
  readonly cheerTitle: string;
  readonly cheerBody: (name: string) => string;
  readonly challengeTitle: string;
  readonly challengeBody: (
    name: string,
    target: number,
    exercise: string,
    days: number
  ) => string;
};

const TEXTS: Record<ReminderLocale, Texts> = {
  de: {
    anonymous: 'Jemand',
    requestTitle: '👋 Neue Freundschaftsanfrage',
    requestBody: (n) => `${n} möchte mit dir trainieren.`,
    acceptedTitle: '🤝 Anfrage angenommen',
    acceptedBody: (n) => `${n} ist jetzt dein Trainingspartner.`,
    cheerTitle: '🔥 Anfeuerung',
    cheerBody: (n) => `${n} feuert dich an – weiter so!`,
    challengeTitle: '🏁 Neue Challenge',
    challengeBody: (n, t, e, d) =>
      `${n} fordert dich heraus: ${t} ${e} in ${d} Tagen.`,
  },
  en: {
    anonymous: 'Someone',
    requestTitle: '👋 New friend request',
    requestBody: (n) => `${n} wants to train with you.`,
    acceptedTitle: '🤝 Request accepted',
    acceptedBody: (n) => `${n} is now your training partner.`,
    cheerTitle: '🔥 Cheer',
    cheerBody: (n) => `${n} is cheering you on – keep going!`,
    challengeTitle: '🏁 New challenge',
    challengeBody: (n, t, e, d) =>
      `${n} challenges you: ${t} ${e} in ${d} days.`,
  },
  fr: {
    anonymous: 'Quelqu’un',
    requestTitle: '👋 Nouvelle demande d’ami',
    requestBody: (n) => `${n} veut s’entraîner avec toi.`,
    acceptedTitle: '🤝 Demande acceptée',
    acceptedBody: (n) => `${n} est maintenant ton partenaire d’entraînement.`,
    cheerTitle: '🔥 Encouragement',
    cheerBody: (n) => `${n} t’encourage – continue !`,
    challengeTitle: '🏁 Nouveau défi',
    challengeBody: (n, t, e, d) =>
      `${n} te lance un défi : ${t} ${e} en ${d} jours.`,
  },
  es: {
    anonymous: 'Alguien',
    requestTitle: '👋 Nueva solicitud de amistad',
    requestBody: (n) => `${n} quiere entrenar contigo.`,
    acceptedTitle: '🤝 Solicitud aceptada',
    acceptedBody: (n) => `${n} ahora es tu compañero de entrenamiento.`,
    cheerTitle: '🔥 Ánimo',
    cheerBody: (n) => `${n} te anima – ¡sigue así!`,
    challengeTitle: '🏁 Nuevo reto',
    challengeBody: (n, t, e, d) => `${n} te reta: ${t} ${e} en ${d} días.`,
  },
  it: {
    anonymous: 'Qualcuno',
    requestTitle: '👋 Nuova richiesta di amicizia',
    requestBody: (n) => `${n} vuole allenarsi con te.`,
    acceptedTitle: '🤝 Richiesta accettata',
    acceptedBody: (n) => `${n} è ora il tuo partner di allenamento.`,
    cheerTitle: '🔥 Incoraggiamento',
    cheerBody: (n) => `${n} ti incoraggia – continua così!`,
    challengeTitle: '🏁 Nuova sfida',
    challengeBody: (n, t, e, d) => `${n} ti sfida: ${t} ${e} in ${d} giorni.`,
  },
  nl: {
    anonymous: 'Iemand',
    requestTitle: '👋 Nieuw vriendschapsverzoek',
    requestBody: (n) => `${n} wil met je trainen.`,
    acceptedTitle: '🤝 Verzoek geaccepteerd',
    acceptedBody: (n) => `${n} is nu je trainingspartner.`,
    cheerTitle: '🔥 Aanmoediging',
    cheerBody: (n) => `${n} moedigt je aan – ga zo door!`,
    challengeTitle: '🏁 Nieuwe challenge',
    challengeBody: (n, t, e, d) =>
      `${n} daagt je uit: ${t} ${e} in ${d} dagen.`,
  },
  el: {
    anonymous: 'Κάποιος',
    requestTitle: '👋 Νέο αίτημα φιλίας',
    requestBody: (n) => `Ο/Η ${n} θέλει να προπονηθεί μαζί σου.`,
    acceptedTitle: '🤝 Το αίτημα έγινε δεκτό',
    acceptedBody: (n) => `Ο/Η ${n} είναι τώρα συνεργάτης προπόνησής σου.`,
    cheerTitle: '🔥 Ενθάρρυνση',
    cheerBody: (n) => `Ο/Η ${n} σε ενθαρρύνει – συνέχισε!`,
    challengeTitle: '🏁 Νέα πρόκληση',
    challengeBody: (n, t, e, d) =>
      `Ο/Η ${n} σε προκαλεί: ${t} ${e} σε ${d} ημέρες.`,
  },
  no: {
    anonymous: 'Noen',
    requestTitle: '👋 Ny venneforespørsel',
    requestBody: (n) => `${n} vil trene med deg.`,
    acceptedTitle: '🤝 Forespørsel godtatt',
    acceptedBody: (n) => `${n} er nå treningspartneren din.`,
    cheerTitle: '🔥 Heiarop',
    cheerBody: (n) => `${n} heier på deg – fortsett sånn!`,
    challengeTitle: '🏁 Ny utfordring',
    challengeBody: (n, t, e, d) =>
      `${n} utfordrer deg: ${t} ${e} på ${d} dager.`,
  },
  zh: {
    anonymous: '有人',
    requestTitle: '👋 新的好友请求',
    requestBody: (n) => `${n} 想和你一起训练。`,
    acceptedTitle: '🤝 请求已接受',
    acceptedBody: (n) => `${n} 现在是你的训练伙伴。`,
    cheerTitle: '🔥 加油',
    cheerBody: (n) => `${n} 为你加油——继续！`,
    challengeTitle: '🏁 新挑战',
    challengeBody: (n, t, e, d) =>
      `${n} 向你发起挑战：${d} 天内完成 ${t} 个${e}。`,
  },
};

export function friendPushTexts(locale: ReminderLocale): Texts {
  return TEXTS[locale];
}
