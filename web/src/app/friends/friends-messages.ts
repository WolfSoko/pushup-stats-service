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
    default:
      return $localize`:@@friends.error.failed:Das hat nicht funktioniert. Bitte später erneut versuchen.`;
  }
}
