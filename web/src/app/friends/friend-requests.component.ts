import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { RouterLink } from '@angular/router';

import type { FriendRow } from './friends-api.service';

/** Requests waiting for this user's answer — the only part of the friends screen that wants one. */
@Component({
  selector: 'app-friend-requests',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatCardModule, RouterLink],
  template: `
    <h2 i18n="@@friends.incoming">Anfragen an dich</h2>
    @for (row of rows(); track row.id) {
      <mat-card class="friend-card" data-testid="friend-incoming">
        <mat-card-content>
          <a [routerLink]="['/u', row.uid]">{{ name(row.displayName) }}</a>
        </mat-card-content>
        <mat-card-actions align="end">
          <button
            mat-stroked-button
            type="button"
            (click)="decline.emit(row.id)"
            i18n="@@friends.decline"
          >
            Ablehnen
          </button>
          <button
            mat-flat-button
            color="primary"
            type="button"
            data-testid="friend-accept"
            (click)="accept.emit(row.id)"
            i18n="@@friends.accept"
          >
            Annehmen
          </button>
        </mat-card-actions>
      </mat-card>
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
      gap: 10px;
      flex-wrap: wrap;
    }
    .friend-card mat-card-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
  `,
})
export class FriendRequestsComponent {
  readonly rows = input.required<ReadonlyArray<FriendRow>>();
  readonly accept = output<string>();
  readonly decline = output<string>();

  protected name(displayName: string | null): string {
    return displayName ?? $localize`:@@friends.anonymous:Ohne Namen`;
  }
}
