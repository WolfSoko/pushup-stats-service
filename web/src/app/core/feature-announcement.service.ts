import { isPlatformBrowser } from '@angular/common';
import {
  effect,
  inject,
  Injectable,
  PLATFORM_ID,
  type Type,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { NavigationEnd, Router } from '@angular/router';
import { UserContextService } from '@pu-auth/auth';
import { filter, map } from 'rxjs';

import { UserConfigStore } from './user-config.store';

/**
 * One "what's new" entry: a stable id, its inbox row and, for a feature
 * that earns a walkthrough, the dialog that shows it. Without `load` it is
 * a plain inbox message — for improvements too small to interrupt anyone.
 */
export interface FeatureAnnouncement {
  /** Persisted per account once read or the dialog closes; never reused. */
  readonly id: string;
  readonly load?: () => Promise<Type<unknown>>;
  /** One line for the message inbox, which lists unseen announcements. */
  readonly label: string;
  /** Where the inbox row goes, without locale prefix. */
  readonly url: string;
}

export const WORKOUTS_ANNOUNCEMENT = 'workouts-2026-09';
export const INBOX_ANNOUNCEMENT = 'inbox-achievements-2026-09';
export const REBRAND_ANNOUNCEMENT = 'rebrand-2026-09';
export const EXERCISE_SEARCH_ANNOUNCEMENT = 'exercise-search-2026-09';
export const WORKOUT_REMINDERS_ANNOUNCEMENT = 'workout-reminders-2026-09';

/**
 * Every announcement, oldest first. A new feature adds an entry with a
 * fresh id and its own dialog; the first one the user has not seen yet
 * opens on their next dashboard visit, one per app session.
 */
export const ANNOUNCEMENTS: ReadonlyArray<FeatureAnnouncement> = [
  {
    id: WORKOUTS_ANNOUNCEMENT,
    load: () =>
      import('../workouts/workouts-intro-dialog.component').then(
        (m) => m.WorkoutsIntroDialogComponent
      ),
    label: $localize`:@@announcements.workouts:Neu: eigene Sessions zusammenstellen`,
    url: '/workouts',
  },
  {
    id: INBOX_ANNOUNCEMENT,
    load: () =>
      import('../notifications/inbox-intro-dialog.component').then(
        (m) => m.InboxIntroDialogComponent
      ),
    label: $localize`:@@announcements.inbox:Neu: Nachrichten und deine Abzeichen`,
    url: '/nachrichten',
  },
  {
    id: REBRAND_ANNOUNCEMENT,
    load: () =>
      import('../blog/rebrand-intro-dialog.component').then(
        (m) => m.RebrandIntroDialogComponent
      ),
    label: $localize`:@@announcements.rebrand:Diese App bekommt einen neuen Namen`,
    url: '/blog/neuer-name-kommt',
  },
  {
    id: EXERCISE_SEARCH_ANNOUNCEMENT,
    label: $localize`:@@announcements.exerciseSearch:Neu: Übungssuche und Anleitungen direkt in deinen Sessions`,
    url: '/wiki/uebungen?suche',
  },
  {
    id: WORKOUT_REMINDERS_ANNOUNCEMENT,
    load: () =>
      import('../workouts/reminders/workout-reminders-intro-dialog.component').then(
        (m) => m.WorkoutRemindersIntroDialogComponent
      ),
    label: $localize`:@@announcements.workoutReminders:Neu: Erinnerungen für deine Sessions`,
    url: '/workouts',
  },
];

/**
 * Opens the first unseen walkthrough on the dashboard (inbox-only
 * announcements are skipped), once per app
 * session, for a signed-in user. Waits for the dashboard rather than
 * firing on the first page after login: a dialog over the login or
 * register form, or over a shared profile the user just landed on, would
 * interrupt what they came for. Guests are left alone: a walkthrough is
 * for someone coming back, and a guest's account does not outlive the
 * session. The id lands in `ui.seenAnnouncements` when the dialog closes,
 * so the walkthrough follows the account, not the device.
 *
 * Inject once in the app root, like `AndroidTestInviteOrchestrationService`.
 */
@Injectable({ providedIn: 'root' })
export class FeatureAnnouncementService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly dialog = inject(MatDialog);
  private readonly userConfig = inject(UserConfigStore);
  private readonly router = inject(Router);
  private readonly user = inject(UserContextService);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects)
    ),
    { initialValue: this.router.url }
  );

  private shown = false;

  private readonly _effect = effect(() => {
    if (!isPlatformBrowser(this.platformId) || this.shown) return;
    const config = this.userConfig.config();
    const url = this.url();
    if (!config || !isDashboard(url) || this.user.isGuest()) return;
    const seen = config.ui?.seenAnnouncements ?? [];
    const next = ANNOUNCEMENTS.find((a) => a.load && !seen.includes(a.id));
    if (!next?.load) return;

    this.shown = true;
    void this.open(next.id, next.load);
  });

  private async open(
    id: string,
    load: () => Promise<Type<unknown>>
  ): Promise<void> {
    const component = await load();
    const ref = this.dialog.open(component, {
      width: 'min(92vw, 440px)',
      maxWidth: '92vw',
      autoFocus: 'dialog',
    });
    ref.afterClosed().subscribe(() => {
      void this.userConfig.markAnnouncementSeen(id).catch(() => undefined);
    });
  }
}

/** `/app`, with or without a locale prefix or query string. */
export function isDashboard(url: string): boolean {
  return /^(\/[a-z]{2})?\/app(\/|\?|#|$)/.test(url);
}
