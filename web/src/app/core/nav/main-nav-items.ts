import type { Type } from '@angular/core';

import { FriendRequestBadgeComponent } from '../../friends/friend-request-badge.component';

export interface MainNavItem {
  readonly path: string;
  readonly icon: string;
  readonly label: string;
  /** Match only the exact route (the dashboard, whose path is a prefix of nothing but itself). */
  readonly exact?: boolean;
  /** A self-loading counter rendered on the icon's corner. */
  readonly badge?: Type<unknown>;
}

/**
 * The bottom arc nav's entries, in order. Friends needs an account, so it
 * only appears for a signed-in user; everything else is open to guests.
 */
export function mainNavItems(loggedIn: boolean): MainNavItem[] {
  return [
    {
      path: '/app',
      icon: 'dashboard',
      label: $localize`:@@nav.dashboard:Dashboard`,
      exact: true,
    },
    {
      path: '/analysis',
      icon: 'insights',
      label: $localize`:@@nav.analysis:Analyse`,
    },
    {
      path: '/leaderboard',
      icon: 'leaderboard',
      label: $localize`:@@nav.leaderboard:Bestenliste`,
    },
    ...(loggedIn
      ? [
          {
            path: '/freunde',
            icon: 'group',
            label: $localize`:@@nav.friends:Freunde`,
            badge: FriendRequestBadgeComponent,
          },
        ]
      : []),
    {
      path: '/training-plans',
      icon: 'fitness_center',
      label: $localize`:@@nav.trainingPlans:Trainingspläne`,
    },
    { path: '/blog', icon: 'article', label: $localize`:@@nav.blog:Blog` },
    {
      path: '/history',
      icon: 'list',
      label: $localize`:@@nav.history:Historie`,
    },
    {
      path: '/wiki/uebungen',
      icon: 'auto_stories',
      label: $localize`:@@nav.exercises:Übungen`,
    },
    {
      path: '/wiki/liegestuetz-typen',
      icon: 'menu_book',
      label: $localize`:@@nav.pushupTypes:Liegestütztypen`,
    },
  ];
}
