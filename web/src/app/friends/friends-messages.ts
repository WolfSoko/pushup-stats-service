/**
 * Turns the server's refusal code into something a person can act on.
 *
 * The codes come from `friendRequestRejection` / `respondRejection` in the
 * Cloud Functions; anything unmapped falls back to a generic line rather
 * than showing the raw token.
 */
export function friendRejectionMessage(
  reason: string | undefined
): string | null {
  switch (reason) {
    case undefined:
      return null;
    case 'self':
      return $localize`:@@friends.error.self:Das ist dein eigenes Profil.`;
    case 'exists':
      return $localize`:@@friends.error.exists:Ihr seid schon Freunde.`;
    case 'pending':
      return $localize`:@@friends.error.pending:Die Anfrage läuft schon.`;
    case 'declined':
      return $localize`:@@friends.error.declined:Die Anfrage wurde abgelehnt. Warte, bis die andere Seite sich meldet.`;
    case 'limit':
      return $localize`:@@friends.error.limit:Deine Freundesliste ist voll.`;
    case 'unauthenticated':
      return $localize`:@@friends.error.unauthenticated:Dafür brauchst du ein Konto.`;
    case 'invalid':
      return $localize`:@@friends.error.invalid:Dieses Profil gibt es nicht.`;
    case 'not-found':
    case 'settled':
    case 'not-yours':
      return $localize`:@@friends.error.gone:Diese Anfrage ist nicht mehr offen.`;
    case 'already':
      return $localize`:@@friends.error.cheeredAlready:Heute schon angefeuert – morgen wieder.`;
    case 'not-friends':
      return $localize`:@@friends.error.notFriends:Das geht nur unter bestätigten Freunden.`;
    default:
      return $localize`:@@friends.error.failed:Das hat nicht funktioniert. Bitte später erneut versuchen.`;
  }
}

/** The challenge callables' refusal codes (`challengeRejection`). */
export function challengeRejectionMessage(
  reason: string | undefined
): string | null {
  switch (reason) {
    case undefined:
      return null;
    case 'no-friends':
      return $localize`:@@challenge.error.noFriends:Wähle mindestens einen Freund aus.`;
    case 'too-many':
      return $localize`:@@challenge.error.tooMany:Zu viele Teilnehmer für eine Challenge.`;
    case 'not-friends':
      return $localize`:@@friends.error.notFriends:Das geht nur unter bestätigten Freunden.`;
    case 'exercise':
      return $localize`:@@challenge.error.exercise:Für diese Übung geht keine Challenge.`;
    case 'target':
      return $localize`:@@challenge.error.target:Das Ziel muss zwischen 10 und 100.000 liegen.`;
    case 'duration':
      return $localize`:@@challenge.error.duration:Diese Dauer gibt es nicht.`;
    case 'limit':
      return $localize`:@@challenge.error.limit:Du hast schon genug Challenges laufen. Warte, bis eine endet.`;
    case 'not-found':
      return $localize`:@@challenge.error.gone:Diese Challenge gibt es nicht mehr.`;
    default:
      return $localize`:@@friends.error.failed:Das hat nicht funktioniert. Bitte später erneut versuchen.`;
  }
}
