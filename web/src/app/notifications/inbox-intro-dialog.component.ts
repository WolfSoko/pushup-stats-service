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
  /** Where the final button lands; the last step decides. */
  readonly url: string;
}

/**
 * One walkthrough for both halves of the release: the inbox and the
 * badge collection. They are a single promise from a user's side —
 * nothing gets lost, and you can see what you achieved — so two dialogs
 * back to back would be a nuisance, not twice the news.
 */
@Component({
  selector: 'app-inbox-intro-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatDialogModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>
      <span class="badge" i18n="@@inboxIntro.badge">Neu</span>
      <span i18n="@@inboxIntro.title">Nachrichten und Abzeichen</span>
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
      <p class="step-count" i18n="@@inboxIntro.stepCount">
        Schritt {{ index() + 1 }} von {{ steps.length }}
      </p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button
        mat-button
        type="button"
        data-testid="intro-later"
        (click)="dialogRef.close('later')"
        i18n="@@inboxIntro.later"
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
          <span i18n="@@inboxIntro.back">Zurück</span>
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
          <mat-icon>military_tech</mat-icon>
          <span i18n="@@inboxIntro.start">Abzeichen ansehen</span>
        </button>
      } @else {
        <button
          mat-flat-button
          color="primary"
          type="button"
          data-testid="intro-next"
          (click)="next()"
        >
          <span i18n="@@inboxIntro.next">Weiter</span>
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
export class InboxIntroDialogComponent {
  protected readonly dialogRef = inject(
    MatDialogRef<InboxIntroDialogComponent, 'later' | 'start'>
  );
  private readonly router = inject(Router);

  protected readonly steps: ReadonlyArray<IntroStep> = [
    {
      icon: 'notifications',
      title: $localize`:@@inboxIntro.step1.title:Nichts geht mehr verloren`,
      body: $localize`:@@inboxIntro.step1.body:Anfeuerungen, Freundschaftsanfragen und Challenges landen in der Glocke oben — auch wenn du offline warst oder keine Push-Benachrichtigungen erlaubt hast.`,
      url: '/nachrichten',
    },
    {
      icon: 'military_tech',
      title: $localize`:@@inboxIntro.step2.title:Deine Abzeichen an einem Ort`,
      body: $localize`:@@inboxIntro.step2.body:Alle verdienten Abzeichen, die noch offenen und wie weit es bis zum nächsten ist — unter „Abzeichen" in der Navigation.`,
      url: '/abzeichen',
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
    void this.router.navigateByUrl(this.current().url);
  }
}
