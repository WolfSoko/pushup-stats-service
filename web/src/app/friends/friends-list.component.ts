import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { BusyDirective, SkeletonComponent } from '@pu-stats/ui';

import { FriendAvatarComponent } from './friend-avatar.component';
import type { FriendRow } from './friends-api.service';

/** Confirmed friends — or, for someone who has none yet, the way to get one. */
@Component({
  selector: 'app-friends-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BusyDirective,
    FriendAvatarComponent,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    RouterLink,
    SkeletonComponent,
  ],
  template: `
    <h2 i18n="@@friends.list">Deine Freunde</h2>
    @if (loading()) {
      <div aria-busy="true" data-testid="friends-loading">
        @for (row of skeletonRows; track row) {
          <mat-card class="friend-card">
            <mat-card-content>
              <pu-skeleton shape="circle" />
              <pu-skeleton width="140px" />
            </mat-card-content>
            <mat-card-actions align="end">
              <pu-skeleton shape="rect" width="110px" height="36px" />
            </mat-card-actions>
          </mat-card>
        }
      </div>
    } @else if (rows().length === 0) {
      <mat-card class="friends-empty">
        <mat-card-content>
          <p i18n="@@friends.empty">
            Noch keine Freunde. Lade jemanden ein — oder öffne ein Profil und
            schicke eine Anfrage.
          </p>
        </mat-card-content>
        <mat-card-actions align="end">
          <button
            mat-flat-button
            color="primary"
            type="button"
            (click)="invite.emit()"
          >
            <mat-icon>person_add</mat-icon>
            <span i18n="@@invite.action">Freunde einladen</span>
          </button>
        </mat-card-actions>
      </mat-card>
    } @else {
      @for (row of rows(); track row.id) {
        <mat-card class="friend-card" data-testid="friend-row">
          <mat-card-content>
            <app-friend-avatar
              [photoURL]="row.photoURL"
              [displayName]="row.displayName"
            />
            <a [routerLink]="['/u', row.uid]">{{ name(row.displayName) }}</a>
          </mat-card-content>
          <mat-card-actions align="end">
            <button
              mat-stroked-button
              type="button"
              data-testid="friend-remove"
              [puBusy]="busyKeys().has('remove:' + row.id)"
              (click)="remove.emit(row.id)"
              i18n="@@friends.remove"
            >
              Entfernen
            </button>
          </mat-card-actions>
        </mat-card>
      }
    }
  `,
  styles: `
    h2 {
      margin: 8px 0;
      font-size: 1.1rem;
    }
    .friend-card {
      margin-bottom: 8px;
    }
    .friend-card mat-card-content {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .friend-card mat-card-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
  `,
})
export class FriendsListComponent {
  readonly rows = input.required<ReadonlyArray<FriendRow>>();
  readonly loading = input(false);
  /** The store's busy keys: `remove:<id>` spins that row's button. */
  readonly busyKeys = input<ReadonlySet<string>>(new Set());
  readonly remove = output<string>();
  readonly invite = output<void>();

  protected readonly skeletonRows = [0, 1, 2];

  /** A friend who never set a display name still needs a label. */
  protected name(displayName: string | null): string {
    return displayName ?? $localize`:@@friends.anonymous:Ohne Namen`;
  }
}
