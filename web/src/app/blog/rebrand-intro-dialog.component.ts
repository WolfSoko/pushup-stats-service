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
 * Announces the coming rename. Unlike the other walkthroughs this one
 * promotes no feature — it prepares people for a change they did not ask
 * for, so the second step answers the question a rename actually raises
 * (does my data survive?) before sending anyone to the article.
 */
@Component({
  selector: 'app-rebrand-intro-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatDialogModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>
      <span class="badge" i18n="@@rebrandIntro.badge">Neu</span>
      <span i18n="@@rebrandIntro.title">Wir benennen uns um</span>
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
      <p class="step-count" i18n="@@rebrandIntro.stepCount">
        Schritt {{ index() + 1 }} von {{ steps.length }}
      </p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button
        mat-button
        type="button"
        data-testid="intro-later"
        (click)="dialogRef.close('later')"
        i18n="@@rebrandIntro.later"
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
          <span i18n="@@rebrandIntro.back">Zurück</span>
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
          <mat-icon>article</mat-icon>
          <span i18n="@@rebrandIntro.start">Beitrag lesen</span>
        </button>
      } @else {
        <button
          mat-flat-button
          color="primary"
          type="button"
          data-testid="intro-next"
          (click)="next()"
        >
          <span i18n="@@rebrandIntro.next">Weiter</span>
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
export class RebrandIntroDialogComponent {
  protected readonly dialogRef = inject(
    MatDialogRef<RebrandIntroDialogComponent, 'later' | 'start'>
  );
  private readonly router = inject(Router);

  protected readonly steps: ReadonlyArray<IntroStep> = [
    {
      icon: 'drive_file_rename_outline',
      title: $localize`:@@rebrandIntro.step1.title:Ein neuer Name kommt`,
      body: $localize`:@@rebrandIntro.step1.body:Angefangen hat alles mit Liegestützen. Inzwischen zählt die Kamera auch Kniebeugen und Klimmzüge, es gibt zehn Trainingspläne und ein Übungs-Wiki – der Name wird dem nicht mehr gerecht.`,
      url: '/blog/neuer-name-kommt',
    },
    {
      icon: 'verified_user',
      title: $localize`:@@rebrandIntro.step2.title:Dein Fortschritt bleibt`,
      body: $localize`:@@rebrandIntro.step2.body:Konto, Einträge, Streak und Abzeichen bleiben unverändert – du musst nichts tun. Welcher Name es wird, steht noch nicht fest; wir sagen rechtzeitig Bescheid.`,
      url: '/blog/neuer-name-kommt',
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
