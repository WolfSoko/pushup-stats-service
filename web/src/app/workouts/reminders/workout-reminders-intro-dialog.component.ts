import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';

interface IntroStep {
  readonly icon: string;
  readonly title: string;
  readonly body: string;
}

/**
 * The "what's new" walkthrough for session reminders: what they are, how
 * to set one, and a button onto the sessions list where the alarm icon
 * lives. Opened once per account by `FeatureAnnouncementService`.
 */
@Component({
  selector: 'app-workout-reminders-intro-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatDialogModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>
      <span class="badge" i18n="@@workouts.reminder.intro.badge">Neu</span>
      <span i18n="@@workouts.reminder.intro.title">Session-Erinnerungen</span>
    </h2>
    <mat-dialog-content class="content">
      <mat-icon class="step-icon" aria-hidden="true">{{
        current().icon
      }}</mat-icon>
      <h3 class="step-title" data-testid="intro-step-title">
        {{ current().title }}
      </h3>
      <p class="step-body">{{ current().body }}</p>
      <ol class="dots" aria-hidden="true">
        @for (step of steps; track $index) {
          <li [class.active]="$index === index()"></li>
        }
      </ol>
      <p class="step-count" i18n="@@workouts.reminder.intro.stepCount">
        Schritt {{ index() + 1 }} von {{ steps.length }}
      </p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button
        mat-button
        type="button"
        data-testid="intro-later"
        (click)="dialogRef.close('later')"
        i18n="@@workouts.reminder.intro.later"
      >
        Später
      </button>
      @if (index() > 0) {
        <button
          mat-button
          type="button"
          data-testid="intro-back"
          (click)="back()"
        >
          <span i18n="@@workouts.reminder.intro.back">Zurück</span>
        </button>
      }
      @if (isLast()) {
        <button
          mat-flat-button
          color="primary"
          type="button"
          data-testid="intro-start"
          (click)="start()"
        >
          <mat-icon>alarm_add</mat-icon>
          <span i18n="@@workouts.reminder.intro.start">Zu meinen Sessions</span>
        </button>
      } @else {
        <button
          mat-flat-button
          color="primary"
          type="button"
          data-testid="intro-next"
          (click)="next()"
        >
          <span i18n="@@workouts.reminder.intro.next">Weiter</span>
          <mat-icon iconPositionEnd>arrow_forward</mat-icon>
        </button>
      }
    </mat-dialog-actions>
  `,
  styles: `
    h2 {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .badge {
      font-size: 0.7rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      padding: 2px 8px;
      border-radius: 999px;
      background: var(--mat-sys-primary, #3f51b5);
      color: var(--mat-sys-on-primary, #fff);
    }
    .content {
      display: grid;
      justify-items: center;
      text-align: center;
      gap: 8px;
      max-width: 380px;
      padding-top: 8px;
    }
    .step-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: var(--mat-sys-primary, #3f51b5);
    }
    .step-title {
      margin: 0;
      font-size: 1.15rem;
    }
    .step-body {
      margin: 0;
      opacity: 0.85;
    }
    .dots {
      list-style: none;
      display: flex;
      gap: 6px;
      margin: 8px 0 0;
      padding: 0;
    }
    .dots li {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--mat-sys-outline-variant, rgba(128, 128, 128, 0.4));
    }
    .dots li.active {
      background: var(--mat-sys-primary, #3f51b5);
    }
    .step-count {
      margin: 0;
      font-size: 0.8rem;
      opacity: 0.7;
    }
  `,
})
export class WorkoutRemindersIntroDialogComponent {
  protected readonly dialogRef = inject(
    MatDialogRef<WorkoutRemindersIntroDialogComponent, 'later' | 'start'>
  );
  private readonly router = inject(Router);

  protected readonly steps: ReadonlyArray<IntroStep> = [
    {
      icon: 'alarm',
      title: $localize`:@@workouts.reminder.intro.step1.title:Erinnerungen für deine Sessions`,
      body: $localize`:@@workouts.reminder.intro.step1.body:Jede Session kann dich jetzt ans Training erinnern — zum Beispiel alle 2 Tage um 15:00 oder jeden Montag, Mittwoch und Freitag.`,
    },
    {
      icon: 'alarm_add',
      title: $localize`:@@workouts.reminder.intro.step2.title:So richtest du sie ein`,
      body: $localize`:@@workouts.reminder.intro.step2.body:Tippe auf der Session-Karte auf das Wecker-Symbol, wähle den Rhythmus und die Uhrzeit — fertig.`,
    },
    {
      icon: 'notifications_active',
      title: $localize`:@@workouts.reminder.intro.step3.title:Push aufs Handy`,
      body: $localize`:@@workouts.reminder.intro.step3.body:Zur gewählten Zeit kommt eine Push-Benachrichtigung, ein Tipp startet die Session. Ohne Push erinnert dich die App, solange sie geöffnet ist.`,
    },
  ];

  protected readonly index = signal(0);
  protected readonly current = computed(() => this.steps[this.index()]);
  protected readonly isLast = computed(
    () => this.index() === this.steps.length - 1
  );

  protected next(): void {
    this.index.update((i) => Math.min(i + 1, this.steps.length - 1));
  }

  protected back(): void {
    this.index.update((i) => Math.max(i - 1, 0));
  }

  protected start(): void {
    this.dialogRef.close('start');
    void this.router.navigateByUrl('/workouts');
  }
}
