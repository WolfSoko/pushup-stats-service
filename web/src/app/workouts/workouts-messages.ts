import type { WorkoutActionReason } from './workouts.store';

/**
 * Turns a refusal into something a person can act on. The union is
 * exhaustive, so a code added to the model or the callable without a
 * line here fails to compile rather than showing the raw token.
 */
export function workoutRejectionMessage(
  reason: WorkoutActionReason
): string | null {
  switch (reason) {
    case undefined:
      return null;
    case 'title':
      return $localize`:@@workouts.error.title:Gib der Session einen Namen (höchstens 60 Zeichen).`;
    case 'description':
      return $localize`:@@workouts.error.description:Die Beschreibung ist zu lang (höchstens 300 Zeichen).`;
    case 'no-exercises':
      return $localize`:@@workouts.error.noExercises:Füge mindestens eine Übung hinzu.`;
    case 'too-many-exercises':
      return $localize`:@@workouts.error.tooManyExercises:Höchstens 20 Übungen pro Session.`;
    case 'exercise':
      return $localize`:@@workouts.error.exercise:Eine Übung ist ungültig. Wähle eine aus der Liste.`;
    case 'target':
      return $localize`:@@workouts.error.target:Jede Übung braucht ein Ziel größer als 0.`;
    case 'sets':
      return $localize`:@@workouts.error.sets:Die Sätze müssen zusammen das Ziel ergeben, z. B. 10, 10, 10.`;
    case 'limit':
      return $localize`:@@workouts.error.limit:Du hast schon 50 Sessions. Lösche eine, um Platz zu machen.`;
    case 'not-found':
      return $localize`:@@workouts.error.notFound:Diese Session gibt es nicht mehr.`;
    case 'no-friends':
      return $localize`:@@workouts.error.noFriends:Wähle mindestens einen Freund aus.`;
    case 'too-many':
      return $localize`:@@workouts.error.tooMany:Zu viele Empfänger auf einmal.`;
    case 'not-friends':
      return $localize`:@@friends.error.notFriends:Das geht nur unter bestätigten Freunden.`;
    case 'invalid':
      return $localize`:@@workouts.error.invalid:Diese Session ist nicht mehr gültig. Bearbeite sie zuerst.`;
    case 'failed':
      return $localize`:@@friends.error.failed:Das hat nicht funktioniert. Bitte später erneut versuchen.`;
  }
}
