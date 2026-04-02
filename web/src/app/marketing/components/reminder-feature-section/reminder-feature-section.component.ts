import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-reminder-feature-section',
  imports: [RouterLink, MatButtonModule, MatCardModule, MatIconModule],
  template: `
    <section class="reminder-section">
      <div class="reminder-content">
        <p class="eyebrow" i18n="@@reminder.feature.eyebrow">KI-Erinnerungen</p>
        <h2 i18n="@@reminder.feature.headline">
          Dein KI-Coach. Stündlich motiviert.
        </h2>
        <p class="reminder-desc" i18n="@@reminder.feature.desc">
          Lass dich automatisch ans Training erinnern – mit individuellen
          Motivationssprüchen direkt als Browser-Benachrichtigung, generiert von
          einer KI.
        </p>
        <a
          mat-flat-button
          color="primary"
          routerLink="/settings"
          i18n="@@reminder.feature.cta"
          >Jetzt einrichten</a
        >
      </div>

      <div class="notification-mock-wrap" aria-hidden="true">
        <mat-card class="notification-mock">
          <mat-card-header>
            <mat-icon mat-card-avatar>fitness_center</mat-icon>
            <mat-card-title i18n="@@reminder.feature.mock.title"
              >Pushups</mat-card-title
            >
            <mat-card-subtitle i18n="@@reminder.feature.mock.time"
              >Jetzt</mat-card-subtitle
            >
          </mat-card-header>
          <mat-card-content>
            <mat-icon class="quote-icon">format_quote</mat-icon>
            <p class="quote-text" i18n="@@reminder.feature.mock.quote">
              Jede Wiederholung bringt dich näher ans Ziel. Dein nächstes Set
              wartet auf dich!
            </p>
          </mat-card-content>
        </mat-card>
      </div>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .reminder-section {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 32px;
        align-items: center;
        border: 1px solid rgba(123, 159, 255, 0.25);
        border-radius: 20px;
        padding: clamp(18px, 3vw, 36px);
        background: linear-gradient(
          155deg,
          rgba(30, 43, 74, 0.78),
          rgba(14, 19, 33, 0.86)
        );
      }

      @media (max-width: 640px) {
        .reminder-section {
          grid-template-columns: 1fr;
        }
      }

      .eyebrow {
        margin: 0 0 8px;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: #93adea;
        font-size: 0.74rem;
      }

      h2 {
        margin: 0 0 12px;
        font-size: clamp(1.4rem, 3vw, 2rem);
        line-height: 1.2;
      }

      .reminder-desc {
        margin: 0 0 20px;
        color: #c4d2f2;
        max-width: 52ch;
      }

      .notification-mock-wrap {
        display: flex;
        justify-content: center;
      }

      .notification-mock {
        max-width: 340px;
        width: 100%;
        border: 1px solid rgba(123, 159, 255, 0.3);
        border-radius: 12px;
      }

      .quote-icon {
        color: #94b1ff;
        font-size: 1.6rem;
        height: 1.6rem;
        width: 1.6rem;
        margin-bottom: 4px;
      }

      .quote-text {
        margin: 0;
        font-style: italic;
        color: #d8e5ff;
        font-size: 0.95rem;
      }

      :host-context(html.light-theme) {
        .reminder-section {
          border-color: rgba(59, 130, 246, 0.25);
          background: linear-gradient(
            155deg,
            rgba(248, 250, 252, 0.95),
            rgba(255, 255, 255, 0.98)
          );
        }

        .eyebrow {
          color: #3b82f6;
        }

        .reminder-desc {
          color: #475569;
        }

        .notification-mock {
          border-color: rgba(59, 130, 246, 0.25);
        }

        .quote-icon {
          color: #3b82f6;
        }

        .quote-text {
          color: #334155;
        }
      }
    `,
  ],
})
export class ReminderFeatureSectionComponent {}
