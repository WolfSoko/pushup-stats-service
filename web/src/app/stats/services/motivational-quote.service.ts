import { Injectable } from '@angular/core';

const MOTIVATIONAL_QUOTES: string[] = [
  'Jede Wiederholung zählt. Gib nicht auf!',
  'Stärker als gestern – das ist das Ziel.',
  'Dein Körper kann mehr, als dein Kopf glaubt.',
  'Kleine Schritte führen zu großen Erfolgen.',
  'Heute Schweiß, morgen Stolz.',
  'Disziplin schlägt Motivation.',
  'Der beste Tag zum Trainieren ist heute.',
  'Keine Ausreden – nur Ergebnisse.',
  'Fortschritt, nicht Perfektion.',
  'Du bist stärker, als du denkst.',
  'Jeder Satz bringt dich deinem Ziel näher.',
  'Mach es für dein zukünftiges Ich.',
  'Konstanz ist der Schlüssel zum Erfolg.',
  'Ein Liegestütz mehr als gestern reicht.',
  'Wer aufgibt, hat schon verloren.',
  'Dein einziger Gegner bist du selbst.',
  'Heute investieren, morgen profitieren.',
  'Schmerz ist temporär, Stolz ist dauerhaft.',
  'Jeder Tag ist eine neue Chance.',
  'Bleib dran – die Ergebnisse kommen.',
  'Starte schwach, werde stark.',
  'Muskeln wachsen durch Beständigkeit.',
];

@Injectable({ providedIn: 'root' })
export class MotivationalQuoteService {
  /**
   * Returns a motivational quote for today.
   * The quote is deterministic based on the current date,
   * so the same quote is returned for the entire day.
   */
  getTodayQuote(): string {
    const today = new Date();
    const dayIndex =
      today.getFullYear() * 1000 +
      (today.getMonth() + 1) * 32 +
      today.getDate();
    return MOTIVATIONAL_QUOTES[dayIndex % MOTIVATIONAL_QUOTES.length];
  }
}
