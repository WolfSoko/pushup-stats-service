import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

export type PageHeaderVariant =
  | 'default'
  | 'analysis'
  | 'history'
  | 'leaderboard'
  | 'settings'
  | 'reminders'
  | 'admin';

@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    <header class="page-header" [attr.data-variant]="variant()">
      @if (icon()) {
        <span class="page-header-icon" aria-hidden="true">
          <mat-icon>{{ icon() }}</mat-icon>
        </span>
      }
      <div class="page-header-text">
        <p class="page-header-eyebrow" i18n="@@eyebrowTitle">Pushup Stats</p>
        <ng-content select="[page-title]" />
        <ng-content select="[page-subtitle]" />
      </div>
      <div class="page-header-actions">
        <ng-content select="[page-actions]" />
      </div>
    </header>
  `,
  styles: `
    :host {
      display: block;
    }

    .page-header {
      position: relative;
      padding: clamp(16px, 2vw, 24px);
      border: 1px solid rgba(123, 159, 255, 0.25);
      border-radius: 20px;
      background: linear-gradient(
        150deg,
        rgba(26, 35, 58, 0.9),
        rgba(13, 18, 32, 0.9)
      );
      backdrop-filter: blur(6px);
      display: flex;
      align-items: center;
      gap: 16px;
      overflow: hidden;
    }

    .page-header::before {
      content: '';
      position: absolute;
      inset: -40% -20% auto auto;
      width: 60%;
      height: 200%;
      background: radial-gradient(
        circle at top right,
        rgba(123, 159, 255, 0.18),
        transparent 60%
      );
      pointer-events: none;
    }

    .page-header[data-variant='analysis'] {
      background: linear-gradient(
        150deg,
        rgba(33, 28, 78, 0.92),
        rgba(15, 19, 38, 0.92)
      );
      border-color: rgba(149, 122, 255, 0.35);
    }
    .page-header[data-variant='analysis']::before {
      background: radial-gradient(
        circle at top right,
        rgba(149, 122, 255, 0.28),
        transparent 60%
      );
    }

    .page-header[data-variant='history'] {
      background: linear-gradient(
        150deg,
        rgba(15, 49, 56, 0.92),
        rgba(11, 23, 30, 0.92)
      );
      border-color: rgba(94, 214, 195, 0.32);
    }
    .page-header[data-variant='history']::before {
      background: radial-gradient(
        circle at top right,
        rgba(94, 214, 195, 0.25),
        transparent 60%
      );
    }

    .page-header[data-variant='leaderboard'] {
      background: linear-gradient(
        150deg,
        rgba(60, 40, 18, 0.92),
        rgba(26, 17, 11, 0.92)
      );
      border-color: rgba(255, 184, 28, 0.4);
    }
    .page-header[data-variant='leaderboard']::before {
      background: radial-gradient(
        circle at top right,
        rgba(255, 184, 28, 0.28),
        transparent 60%
      );
    }

    .page-header[data-variant='settings'] {
      background: linear-gradient(
        150deg,
        rgba(28, 36, 52, 0.92),
        rgba(13, 17, 26, 0.92)
      );
      border-color: rgba(141, 162, 200, 0.32);
    }

    .page-header[data-variant='reminders'] {
      background: linear-gradient(
        150deg,
        rgba(20, 56, 38, 0.92),
        rgba(11, 22, 16, 0.92)
      );
      border-color: rgba(94, 214, 134, 0.36);
    }
    .page-header[data-variant='reminders']::before {
      background: radial-gradient(
        circle at top right,
        rgba(94, 214, 134, 0.25),
        transparent 60%
      );
    }

    .page-header[data-variant='admin'] {
      background: linear-gradient(
        150deg,
        rgba(60, 22, 30, 0.92),
        rgba(26, 11, 14, 0.92)
      );
      border-color: rgba(255, 138, 138, 0.36);
    }
    .page-header[data-variant='admin']::before {
      background: radial-gradient(
        circle at top right,
        rgba(255, 138, 138, 0.25),
        transparent 60%
      );
    }

    .page-header-icon {
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: clamp(48px, 7vw, 64px);
      height: clamp(48px, 7vw, 64px);
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.14);
      color: #e6edf9;
      box-shadow: 0 6px 18px rgba(15, 23, 42, 0.35);
    }

    .page-header-icon mat-icon {
      font-size: clamp(26px, 3vw, 32px);
      width: clamp(26px, 3vw, 32px);
      height: clamp(26px, 3vw, 32px);
    }

    .page-header-text {
      flex: 1 1 auto;
      min-width: 0;
      position: relative;
    }

    .page-header-eyebrow {
      margin: 0 0 6px;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-size: 0.72rem;
      color: #8ca8e8;
    }

    .page-header-text ::ng-deep [page-title] {
      display: block;
      margin: 0;
      font-size: clamp(1.6rem, 3vw, 2.15rem);
      line-height: 1.15;
      color: #f4f8ff;
    }

    .page-header-text ::ng-deep [page-subtitle] {
      display: block;
      margin: 10px 0 0;
      color: #b3c0de;
      max-width: 68ch;
    }

    .page-header-actions {
      flex-shrink: 0;
      display: flex;
      gap: 8px;
      align-items: center;
      align-self: flex-start;
      position: relative;
    }

    .page-header-actions:empty {
      display: none;
    }

    @media (max-width: 680px) {
      .page-header {
        flex-direction: column;
        align-items: flex-start;
      }

      .page-header-actions {
        align-self: stretch;
        justify-content: flex-end;
      }
    }

    :host-context(html.light-theme) {
      .page-header {
        border-color: rgba(59, 130, 246, 0.25);
        background: linear-gradient(
          150deg,
          rgba(248, 250, 252, 0.95),
          rgba(241, 245, 249, 0.95)
        );
      }

      .page-header[data-variant='analysis'] {
        background: linear-gradient(
          150deg,
          rgba(243, 240, 255, 0.96),
          rgba(232, 226, 252, 0.96)
        );
        border-color: rgba(124, 77, 255, 0.3);
      }

      .page-header[data-variant='history'] {
        background: linear-gradient(
          150deg,
          rgba(232, 248, 244, 0.96),
          rgba(214, 240, 233, 0.96)
        );
        border-color: rgba(20, 152, 124, 0.32);
      }

      .page-header[data-variant='leaderboard'] {
        background: linear-gradient(
          150deg,
          rgba(255, 248, 224, 0.96),
          rgba(255, 236, 196, 0.96)
        );
        border-color: rgba(214, 118, 12, 0.4);
      }

      .page-header[data-variant='settings'] {
        background: linear-gradient(
          150deg,
          rgba(248, 250, 252, 0.96),
          rgba(232, 238, 248, 0.96)
        );
        border-color: rgba(59, 130, 246, 0.28);
      }

      .page-header[data-variant='reminders'] {
        background: linear-gradient(
          150deg,
          rgba(232, 248, 232, 0.96),
          rgba(214, 240, 220, 0.96)
        );
        border-color: rgba(20, 152, 70, 0.32);
      }

      .page-header[data-variant='admin'] {
        background: linear-gradient(
          150deg,
          rgba(254, 232, 232, 0.96),
          rgba(252, 218, 218, 0.96)
        );
        border-color: rgba(220, 38, 38, 0.32);
      }

      .page-header-icon {
        background: rgba(255, 255, 255, 0.7);
        border-color: rgba(15, 23, 42, 0.08);
        color: #1e293b;
      }

      .page-header-eyebrow {
        color: #3b82f6;
      }

      .page-header-text ::ng-deep [page-title] {
        color: #0f172a;
      }

      .page-header-text ::ng-deep [page-subtitle] {
        color: #475569;
      }
    }
  `,
})
export class PageHeaderComponent {
  readonly icon = input<string | null>(null);
  readonly variant = input<PageHeaderVariant>('default');
}
