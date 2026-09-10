import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import type { TrainingPlanDay } from '@pu-stats/models';

/** The plan list's summary of the plan the user is running. */
export interface ActivePlanView {
  slug: string;
  title: string;
  summary: string;
  totalDays: number;
}

/**
 * The card at the top of the plan list: where the user stands in their own
 * plan and the handful of actions they take on it daily.
 *
 * Renders for a paused plan too — that is the surface a user comes back to
 * after a break, so hiding it there would leave the plan only reachable
 * through the catalog.
 */
@Component({
  selector: 'app-active-plan-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressBarModule,
    RouterLink,
  ],
  template: `
    <mat-card class="active-plan" [class.paused]="paused()">
      <mat-card-header>
        @if (paused()) {
          <mat-card-title i18n="@@trainingPlans.paused.title">
            Pausierter Plan
          </mat-card-title>
        } @else {
          <mat-card-title i18n="@@trainingPlans.active.title">
            Aktiver Plan
          </mat-card-title>
        }
        <mat-card-subtitle>{{ view().title }}</mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        <p class="muted">{{ view().summary }}</p>

        @if (dayIndex(); as idx) {
          <div class="progress-row">
            <span i18n="@@trainingPlans.day">Tag</span>
            <strong>{{ idx }} / {{ view().totalDays }}</strong>
          </div>
          <mat-progress-bar mode="determinate" [value]="completionPercent()" />
        }

        @if (today(); as today) {
          <div class="today-card">
            <div class="today-kind">
              @if (today.kind === 'rest') {
                <mat-icon>self_improvement</mat-icon>
                <span i18n="@@trainingPlans.kind.rest">Ruhetag</span>
              } @else if (today.kind === 'light') {
                <mat-icon>directions_walk</mat-icon>
                <span i18n="@@trainingPlans.kind.light">Leichter Tag</span>
              } @else if (today.kind === 'test') {
                <mat-icon>local_fire_department</mat-icon>
                <span i18n="@@trainingPlans.kind.test">Maximaltest</span>
              } @else {
                <mat-icon>fitness_center</mat-icon>
                <span i18n="@@trainingPlans.kind.main">Trainingstag</span>
              }
            </div>
            @if (today.targetReps > 0) {
              <div class="today-target">
                @if (paused()) {
                  <span i18n="@@trainingPlans.onResumePlanned"
                    >Beim Fortsetzen:</span
                  >
                } @else {
                  <span i18n="@@trainingPlans.todayTarget">Heute geplant:</span>
                }
                <strong>{{ today.targetReps }}</strong>
                <span i18n="@@trainingPlans.reps">Wdh.</span>
              </div>
            }
            <p class="muted today-desc">{{ today.description }}</p>
          </div>
        }
      </mat-card-content>
      <mat-card-actions align="end">
        <button
          mat-stroked-button
          type="button"
          color="warn"
          (click)="abandon.emit()"
          i18n="@@trainingPlans.abandon"
        >
          <mat-icon>cancel</mat-icon>
          Plan beenden
        </button>
        @if (paused()) {
          <button
            mat-flat-button
            type="button"
            color="primary"
            (click)="resumePlan.emit()"
            i18n="@@trainingPlans.resume"
          >
            <mat-icon>play_arrow</mat-icon>
            Plan fortsetzen
          </button>
        } @else {
          <button
            mat-stroked-button
            type="button"
            (click)="pausePlan.emit()"
            i18n="@@trainingPlans.pause"
          >
            <mat-icon>pause</mat-icon>
            Plan pausieren
          </button>
          @if (today(); as today) {
            @if (
              today.kind !== 'rest' && today.targetReps > 0 && !todayDone()
            ) {
              <button
                mat-flat-button
                type="button"
                color="primary"
                (click)="logToday.emit()"
              >
                <mat-icon>play_circle</mat-icon>
                <span i18n="@@trainingPlans.logToday">Heute eintragen</span>
              </button>
            }
          }
        }
        <a mat-flat-button [routerLink]="['/training-plans', view().slug]">
          <mat-icon>open_in_full</mat-icon>
          <span i18n="@@trainingPlans.openDetail">Details öffnen</span>
        </a>
      </mat-card-actions>
    </mat-card>
  `,
  styles: `
    .muted {
      color: rgba(0, 0, 0, 0.6);
    }
    :host-context(.dark-theme) .muted {
      color: rgba(255, 255, 255, 0.6);
    }
    .active-plan {
      margin-bottom: 24px;
      border-left: 4px solid var(--mat-sys-primary, #3f51b5);
    }
    .active-plan.paused {
      border-left-color: var(--mat-sys-outline, #757575);
    }
    .progress-row {
      display: flex;
      gap: 8px;
      align-items: baseline;
      margin: 12px 0 4px;
    }
    .today-card {
      margin-top: 16px;
      padding: 12px 16px;
      border-radius: 8px;
      background: rgba(0, 0, 0, 0.04);
    }
    :host-context(.dark-theme) .today-card {
      background: rgba(255, 255, 255, 0.05);
    }
    .today-kind {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 500;
    }
    .today-target {
      margin-top: 8px;
      font-size: 1.2rem;
      display: flex;
      gap: 6px;
      align-items: baseline;
    }
    .today-desc {
      margin: 6px 0 0;
    }
  `,
})
export class ActivePlanCardComponent {
  readonly view = input.required<ActivePlanView>();
  readonly paused = input<boolean>(false);
  readonly dayIndex = input<number | null>(null);
  readonly completionPercent = input<number>(0);
  readonly today = input<TrainingPlanDay | null>(null);
  readonly todayDone = input<boolean>(false);
  readonly abandon = output<void>();
  readonly pausePlan = output<void>();
  readonly resumePlan = output<void>();
  readonly logToday = output<void>();
}
