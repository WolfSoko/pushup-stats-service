import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';

/**
 * The badge row above the dashboard: everything the user ever logged as
 * push-ups.
 *
 * Four bare numbers in a row said nothing about what they count. The
 * heading names the exercise — these aggregate `perExercise/pushup`, not
 * the sit-ups and runs logged right below them — and each badge carries
 * the sentence that spells out its own arithmetic.
 */
@Component({
  selector: 'app-all-time-badges',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, MatTooltipModule, RouterLink],
  template: `
    <section class="all-time">
      <h2 class="all-time-heading">
        <mat-icon aria-hidden="true">fitness_center</mat-icon>
        <span i18n="@@dashboard.allTime.heading"
          >Alle Liegestütze seit Beginn</span
        >
      </h2>
      <a
        class="mini-badges mini-badges--link"
        routerLink="/analysis"
        data-testid="dashboard-all-time-badges-link"
      >
        <span class="badge" [matTooltip]="hints.total">
          <small i18n="@@allTimeTotal">Gesamt</small><b>{{ total() }}</b>
        </span>
        <span class="badge" [matTooltip]="hints.days">
          <small i18n="@@allTimeDays">Tage</small><b>{{ days() }}</b>
        </span>
        <span class="badge" [matTooltip]="hints.entries">
          <small i18n="@@allTimeEntries">Einträge</small><b>{{ entries() }}</b>
        </span>
        <span class="badge" [matTooltip]="hints.avg">
          <small i18n="@@allTimeAvg">Ø pro Tag</small><b>{{ avg() }}</b>
        </span>
        <span class="badges-cta">
          <mat-icon aria-hidden="true">insights</mat-icon>
          <span i18n="@@dashboard.allTimeBadges.cta">Zur Analyse</span>
        </span>
      </a>
    </section>
  `,
  styles: `
    .all-time-heading {
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 0 0 6px;
      font-size: 0.82rem;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #9fb3de;

      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }
    }

    .mini-badges {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }

    .mini-badges--link {
      text-decoration: none;
      color: inherit;
      border-radius: 999px;
      transition:
        transform 0.15s ease,
        filter 0.2s ease;

      &:hover,
      &:focus-visible {
        transform: translateY(-1px);
        filter: brightness(1.1);
      }

      &:focus-visible {
        outline: 2px solid var(--mat-sys-primary, #8fb4ff);
        outline-offset: 4px;
      }
    }

    .badges-cta {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-left: auto;
      padding: 6px 10px;
      font-size: 0.78rem;
      color: var(--mat-sys-primary, #8fb4ff);

      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .mini-badges--link {
        transition: filter 0.2s ease;

        &:hover,
        &:focus-visible {
          transform: none;
        }
      }
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      border-radius: 999px;
      border: 1px solid rgba(128, 160, 230, 0.32);
      background: rgba(31, 47, 84, 0.45);
      color: #dbe7ff;

      small {
        color: #9fb3de;
        font-size: 0.74rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }

      b {
        font-variant-numeric: tabular-nums;
        font-size: 0.86rem;
      }
    }

    :host-context(html.light-theme) {
      .all-time-heading {
        color: #64748b;
      }

      .badge {
        border-color: rgba(59, 130, 246, 0.25);
        background: rgba(241, 245, 249, 0.8);
        color: #1e293b;

        small {
          color: #64748b;
        }
      }
    }
  `,
})
export class AllTimeBadgesComponent {
  readonly total = input.required<number | string>();
  readonly days = input.required<number | string>();
  readonly entries = input.required<number | string>();
  readonly avg = input.required<number | string>();

  protected readonly hints = {
    total: $localize`:@@dashboard.allTime.hint.total:Alle Liegestütze, die du je eingetragen hast. Andere Übungen zählen hier nicht mit.`,
    days: $localize`:@@dashboard.allTime.hint.days:Tage, an denen du mindestens einen Liegestütz eingetragen hast.`,
    entries: $localize`:@@dashboard.allTime.hint.entries:Anzahl deiner Liegestütz-Einträge – jede erfasste Serie zählt als einer.`,
    avg: $localize`:@@dashboard.allTime.hint.avg:Liegestütze pro Trainingstag im Schnitt: Gesamt geteilt durch Tage.`,
  } as const;
}
