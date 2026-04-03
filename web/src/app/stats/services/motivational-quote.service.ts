import { inject, Injectable, LOCALE_ID } from '@angular/core';

const MOTIVATIONAL_QUOTES_DE: string[] = [
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

const MOTIVATIONAL_QUOTES_EN: string[] = [
  "Every rep counts. Don't give up!",
  "Stronger than yesterday – that's the goal.",
  'Your body can do more than your mind believes.',
  'Small steps lead to great success.',
  "Today's sweat, tomorrow's pride.",
  'Discipline beats motivation.',
  'The best day to train is today.',
  'No excuses – only results.',
  'Progress, not perfection.',
  'You are stronger than you think.',
  'Every set brings you closer to your goal.',
  'Do it for your future self.',
  'Consistency is the key to success.',
  'One more push-up than yesterday is enough.',
  'Those who give up have already lost.',
  'Your only opponent is yourself.',
  'Invest today, profit tomorrow.',
  'Pain is temporary, pride is permanent.',
  'Every day is a new opportunity.',
  'Stay committed – the results will come.',
  'Start weak, become strong.',
  'Muscles grow through consistency.',
];

@Injectable({ providedIn: 'root' })
export class MotivationalQuoteService {
  private readonly locale = inject(LOCALE_ID);

  /**
   * Returns a motivational quote for today.
   * The quote is deterministic based on the current date,
   * so the same quote is returned for the entire day.
   * Uses the appropriate language list based on LOCALE_ID.
   */
  getTodayQuote(): string {
    const quotes = this.locale.startsWith('en')
      ? MOTIVATIONAL_QUOTES_EN
      : MOTIVATIONAL_QUOTES_DE;
    const today = new Date();
    const dayIndex =
      today.getFullYear() * 1000 +
      (today.getMonth() + 1) * 32 +
      today.getDate();
    return quotes[dayIndex % quotes.length];
  }
}
