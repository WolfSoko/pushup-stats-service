import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * A friend's picture, with the same fallbacks the profile page uses: the
 * photo, else the first letter of their name, else a neutral icon.
 *
 * Decorative — the name it sits next to is the label, so a screen reader
 * gains nothing from reading it twice.
 */
@Component({
  selector: 'app-friend-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    <span class="avatar" aria-hidden="true">
      @if (photoURL() && !failed()) {
        <img
          [src]="photoURL()"
          alt=""
          loading="lazy"
          referrerpolicy="no-referrer"
          data-testid="friend-avatar-photo"
          (error)="failed.set(true)"
        />
      } @else if (initial()) {
        <span class="initial" data-testid="friend-avatar-initial">{{
          initial()
        }}</span>
      } @else {
        <mat-icon>person</mat-icon>
      }
    </span>
  `,
  styles: `
    .avatar {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex: 0 0 auto;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      overflow: hidden;
      background: var(--mat-sys-surface-container-highest, rgba(0, 0, 0, 0.08));
      color: var(--mat-sys-on-surface-variant, inherit);
    }
    .avatar img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .initial {
      font-size: 1.1rem;
      font-weight: 600;
      line-height: 1;
    }
  `,
})
export class FriendAvatarComponent {
  readonly photoURL = input<string | null>(null);
  readonly displayName = input<string | null>(null);

  /** A broken picture is per picture: a new URL gets its own try. */
  protected readonly failed = linkedSignal<string | null, boolean>({
    source: this.photoURL,
    computation: () => false,
  });

  // Spread, not `charAt(0)`: a name starting with an emoji is a surrogate
  // pair, and half of one renders as a replacement character.
  protected readonly initial = computed(
    () => [...(this.displayName() ?? '').trim()][0]?.toUpperCase() ?? ''
  );
}
