export type GoalKind = 'daily' | 'weekly' | 'monthly' | 'plan';

export interface GoalCopy {
  readonly icon: string;
  readonly title: string;
  readonly note: string;
  readonly shareTitle: string;
  readonly shareText: string;
}

export function goalReachedCopy(
  kind: GoalKind,
  total: number,
  goal: number
): GoalCopy {
  switch (kind) {
    case 'weekly':
      return {
        icon: 'military_tech',
        title: $localize`:@@goalReached.weekly.title:Wochenziel erreicht!`,
        note: $localize`:@@goalReached.weekly.note:Sieben Tage, ein Sieg. Du bist on fire.`,
        shareTitle: $localize`:@@goalReached.share.weekly.title:Wochenziel geknackt!`,
        shareText: $localize`:@@goalReached.share.weekly.text:Wochenziel von ${goal}:goal: Liegestützen geschafft – ${total}:total: insgesamt! 💪 Tracke deine Stats kostenlos:`,
      };
    case 'monthly':
      return {
        icon: 'workspace_premium',
        title: $localize`:@@goalReached.monthly.title:Monatsziel erreicht!`,
        note: $localize`:@@goalReached.monthly.note:Ein ganzer Monat Disziplin. Legendär.`,
        shareTitle: $localize`:@@goalReached.share.monthly.title:Monatsziel geknackt!`,
        shareText: $localize`:@@goalReached.share.monthly.text:Monatsziel von ${goal}:goal: Liegestützen geschafft – ${total}:total: insgesamt! 💪 Tracke deine Stats kostenlos:`,
      };
    case 'plan':
      return {
        icon: 'fitness_center',
        title: $localize`:@@goalReached.plan.title:Trainingsplan-Ziel erreicht!`,
        note: $localize`:@@goalReached.plan.note:Heutiges Plan-Pensum geschafft. Stark!`,
        shareTitle: $localize`:@@goalReached.share.plan.title:Plan-Ziel geknackt!`,
        shareText: $localize`:@@goalReached.share.plan.text:Heute mein Trainingsplan-Ziel von ${goal}:goal: Liegestützen erreicht – ${total}:total: insgesamt! 💪 Tracke deine Stats kostenlos:`,
      };
    default:
      return {
        icon: 'emoji_events',
        title: $localize`:@@goalReached.daily.title:Tagesziel erreicht!`,
        note: $localize`:@@goalReached.daily.note:Heute hast du dein Versprechen gehalten.`,
        shareTitle: $localize`:@@goalReached.share.daily.title:Tagesziel geknackt!`,
        shareText: $localize`:@@goalReached.share.daily.text:Heute mein Tagesziel von ${goal}:goal: Liegestützen geschafft! 💪 Tracke deine Stats kostenlos:`,
      };
  }
}
