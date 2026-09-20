import {
  notificationCategory,
  type NotificationCategory,
  type UserNotification,
} from '@pu-stats/models';

/**
 * What an inbox row says.
 *
 * Texts are built here rather than stored on the document, so switching
 * language re-renders the whole inbox instead of leaving old entries in
 * the language they were written in.
 */

export interface NotificationView {
  readonly icon: string;
  readonly text: string;
  readonly category: NotificationCategory;
}

function actor(notification: UserNotification): string {
  return (
    notification.actorName ?? $localize`:@@notifications.actor.anonymous:Jemand`
  );
}

function text(notification: UserNotification): string {
  const name = actor(notification);
  switch (notification.type) {
    case 'cheer':
      return $localize`:@@notifications.text.cheer:${name}:name: feuert dich an`;
    case 'friendRequest':
      return $localize`:@@notifications.text.friendRequest:${name}:name: möchte mit dir befreundet sein`;
    case 'friendAccepted':
      return $localize`:@@notifications.text.friendAccepted:${name}:name: hat deine Anfrage angenommen`;
    case 'challenge':
      return $localize`:@@notifications.text.challenge:${name}:name: fordert dich heraus`;
    case 'challengeAccepted':
      return $localize`:@@notifications.text.challengeAccepted:${name}:name: macht bei deiner Challenge mit`;
    case 'workoutShared':
      return $localize`:@@notifications.text.workoutShared:${name}:name: hat dir eine Session geschickt`;
    case 'achievement':
      return $localize`:@@notifications.text.achievement:Du hast ein neues Abzeichen verdient`;
    case 'goalReached':
      return $localize`:@@notifications.text.goalReached:Tagesziel geschafft`;
  }
}

const ICONS: Readonly<Record<NotificationCategory, string>> = {
  motivation: 'local_fire_department',
  social: 'group',
  achievement: 'military_tech',
  system: 'auto_awesome',
};

export function notificationView(
  notification: UserNotification
): NotificationView {
  const category = notificationCategory(notification.type);
  return { icon: ICONS[category], text: text(notification), category };
}
