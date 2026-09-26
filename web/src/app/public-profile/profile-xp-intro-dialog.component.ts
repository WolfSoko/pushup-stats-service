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
import { UserContextService } from '@pu-auth/auth';

import { ownProfilePath } from '../core/profile-share-url';

interface IntroStep {
  readonly icon: string;
  readonly title: string;
  readonly body: string;
}

/**
 * The "what's new" walkthrough for the profile's XP card and the stats
 * that now count every exercise, ending on the user's own profile —
 * where the XP card waits, switched off, for them to publish it.
 * Opened once per account by `FeatureAnnouncementService`.
 */
@Component({
  selector: 'app-profile-xp-intro-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatDialogModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>
      <span class="badge" i18n="@@profileXp.intro.badge">Neu</span>
      <span i18n="@@profileXp.intro.title">Level & XP auf deinem Profil</span>
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
      <p class="step-count" i18n="@@profileXp.intro.stepCount">
        Schritt {{ index() + 1 }} von {{ steps.length }}
      </p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button
        mat-button
        type="button"
        data-testid="intro-later"
        (click)="dialogRef.close('later')"
        i18n="@@profileXp.intro.later"
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
          <span i18n="@@profileXp.intro.back">Zurück</span>
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
          <mat-icon>person</mat-icon>
          <span i18n="@@profileXp.intro.start">Zu meinem Profil</span>
        </button>
      } @else {
        <button
          mat-flat-button
          color="primary"
          type="button"
          data-testid="intro-next"
          (click)="next()"
        >
          <span i18n="@@profileXp.intro.next">Weiter</span>
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
export class ProfileXpIntroDialogComponent {
  protected readonly dialogRef = inject(
    MatDialogRef<ProfileXpIntroDialogComponent, 'later' | 'start'>
  );
  private readonly router = inject(Router);
  private readonly user = inject(UserContextService);

  protected readonly steps: ReadonlyArray<IntroStep> = [
    {
      icon: 'bolt',
      title: $localize`:@@profileXp.intro.step1.title:Dein Level ganz oben`,
      body: $localize`:@@profileXp.intro.step1.body:Dein Profil zeigt jetzt oben dein Level und deine XP — im Gold deiner Abzeichen, dazu was diese Woche und diesen Monat dazukam.`,
    },
    {
      icon: 'functions',
      title: $localize`:@@profileXp.intro.step2.title:Jede Übung zählt`,
      body: $localize`:@@profileXp.intro.step2.body:Wiederholungen, Trainingszeit, Strecke, Trainingstage und Serie zählen jetzt alle Übungen, nicht nur Liegestütze — auf dem Profil und auf deinem Dashboard.`,
    },
    {
      icon: 'visibility',
      title: $localize`:@@profileXp.intro.step3.title:Du entscheidest, wer es sieht`,
      body: $localize`:@@profileXp.intro.step3.body:Die XP-Karte siehst erst einmal nur du. Tippe auf ihr Symbol, um sie deinen Freunden oder allen zu zeigen.`,
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
    void this.router.navigateByUrl(ownProfilePath(this.user.userIdSafe()));
  }
}
