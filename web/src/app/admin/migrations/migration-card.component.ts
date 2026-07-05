import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CallableFunctionsService } from '../callable-functions.service';
import {
  MigrationActionKind,
  MigrationDescriptor,
  MigrationResult,
  MigrationStatus,
} from './migration-descriptors';

/**
 * Migration callables can read the whole source collection and write in
 * batches; the server functions allow up to 540s. The Functions SDK default
 * (70s) would abort a real run client-side, so match the server budget.
 */
const MIGRATION_CALLABLE_TIMEOUT_MS = 540_000;

interface ActionState {
  busy: boolean;
  /**
   * A live (non-dry) run stays disabled until a dry-run for the same action
   * has completed in this session — the runbook mandates "dry-run first", so
   * the UI enforces it rather than relying on the operator to remember.
   */
  dryRunDone: boolean;
  result: MigrationResult | null;
  error: string | null;
}

const IDLE: ActionState = {
  busy: false,
  dryRunDone: false,
  result: null,
  error: null,
};

@Component({
  selector: 'app-migration-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <mat-card class="migration-card">
      <mat-card-header>
        <mat-card-title>{{ migration().title }}</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <p class="migration-description">{{ migration().description }}</p>

        <div class="migration-status">
          @if (status()?.completed) {
            <mat-chip-set>
              <mat-chip highlighted color="primary">
                <mat-icon matChipAvatar>check_circle</mat-icon>
                <span i18n="@@admin.migrations.status.completed"
                  >Abgeschlossen</span
                >
                @if (status()?.completedAt; as completedAt) {
                  · {{ completedAt | date: 'short' }}
                }
              </mat-chip>
            </mat-chip-set>
            <button
              mat-stroked-button
              [disabled]="statusBusy()"
              (click)="statusChange.emit(false)"
            >
              <span i18n="@@admin.migrations.status.reopen">Wieder öffnen</span>
            </button>
          } @else {
            <mat-chip-set>
              <mat-chip>
                <span i18n="@@admin.migrations.status.open">Offen</span>
              </mat-chip>
            </mat-chip-set>
            <button
              mat-flat-button
              color="primary"
              [disabled]="statusBusy()"
              (click)="statusChange.emit(true)"
            >
              <mat-icon>check</mat-icon>
              <span i18n="@@admin.migrations.status.markComplete"
                >Als abgeschlossen markieren</span
              >
            </button>
          }
          @if (statusBusy()) {
            <mat-spinner diameter="20" />
          }
        </div>

        <div class="migration-action">
          <h4 i18n="@@admin.migrations.action.migrate">Migrieren</h4>
          @let migrateState = actionState('migrate');
          <div class="migration-buttons">
            <button
              mat-stroked-button
              [disabled]="migrateState.busy"
              (click)="run('migrate', true)"
            >
              <mat-icon>science</mat-icon>
              <span i18n="@@admin.migrations.dryRun">Probelauf</span>
            </button>
            <button
              mat-flat-button
              color="warn"
              [disabled]="migrateState.busy || !migrateState.dryRunDone"
              (click)="run('migrate', false)"
            >
              <mat-icon>play_arrow</mat-icon>
              <span i18n="@@admin.migrations.run">Ausführen</span>
            </button>
            @if (migrateState.busy) {
              <mat-spinner diameter="20" />
            }
          </div>
          @if (resultEntries('migrate'); as entries) {
            @if (entries.length) {
              <ul class="migration-result">
                @for (entry of entries; track entry.key) {
                  <li>
                    <code>{{ entry.key }}</code
                    >: {{ entry.value }}
                  </li>
                }
              </ul>
            }
          }
          @if (migrateState.error) {
            <p class="error-text">{{ migrateState.error }}</p>
          }
        </div>

        @if (migration().rollback) {
          <div class="migration-action">
            <h4 i18n="@@admin.migrations.action.rollback">Rückgängig</h4>
            @let rollbackState = actionState('rollback');
            <div class="migration-buttons">
              <button
                mat-stroked-button
                [disabled]="rollbackState.busy"
                (click)="run('rollback', true)"
              >
                <mat-icon>science</mat-icon>
                <span i18n="@@admin.migrations.dryRun">Probelauf</span>
              </button>
              <button
                mat-flat-button
                color="warn"
                [disabled]="rollbackState.busy || !rollbackState.dryRunDone"
                (click)="run('rollback', false)"
              >
                <mat-icon>undo</mat-icon>
                <span i18n="@@admin.migrations.run">Ausführen</span>
              </button>
              @if (rollbackState.busy) {
                <mat-spinner diameter="20" />
              }
            </div>
            @if (resultEntries('rollback'); as entries) {
              @if (entries.length) {
                <ul class="migration-result">
                  @for (entry of entries; track entry.key) {
                    <li>
                      <code>{{ entry.key }}</code
                      >: {{ entry.value }}
                    </li>
                  }
                </ul>
              }
            }
            @if (rollbackState.error) {
              <p class="error-text">{{ rollbackState.error }}</p>
            }
          </div>
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: [
    `
      .migration-card {
        margin-bottom: 1rem;
      }
      .migration-description {
        color: var(--mat-sys-on-surface-variant);
      }
      .migration-status {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex-wrap: wrap;
        margin: 0.75rem 0;
      }
      .migration-action {
        margin-top: 1rem;
      }
      .migration-action h4 {
        margin: 0 0 0.5rem;
      }
      .migration-buttons {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      .migration-result {
        margin: 0.5rem 0 0;
        padding-left: 1.25rem;
      }
      .error-text {
        color: var(--mat-sys-error);
      }
    `,
  ],
})
export class MigrationCardComponent {
  private readonly callables = inject(CallableFunctionsService);

  readonly migration = input.required<MigrationDescriptor>();
  /** Persisted completion status; undefined until the page loads it. */
  readonly status = input<MigrationStatus | undefined>(undefined);
  /** True while the parent is persisting a status toggle. */
  readonly statusBusy = input(false);
  /** Emits the desired `completed` value when the operator toggles status. */
  readonly statusChange = output<boolean>();

  private readonly state = signal<Record<MigrationActionKind, ActionState>>({
    migrate: { ...IDLE },
    rollback: { ...IDLE },
  });

  /** Reactive per-action state; reads the signal so the template stays live. */
  actionState(kind: MigrationActionKind): ActionState {
    return this.state()[kind];
  }

  resultEntries(
    kind: MigrationActionKind
  ): { key: string; value: number | boolean }[] {
    const result = this.state()[kind].result;
    if (!result) return [];
    return Object.entries(result).map(([key, value]) => ({ key, value }));
  }

  async run(kind: MigrationActionKind, dryRun: boolean): Promise<void> {
    const action =
      kind === 'migrate' ? this.migration().migrate : this.migration().rollback;
    if (!action) return;

    this.patch(kind, { busy: true, error: null, result: null });
    try {
      const fn = this.callables.call<{ dryRun: boolean }, MigrationResult>(
        action.callable,
        { timeout: MIGRATION_CALLABLE_TIMEOUT_MS }
      );
      const response = await fn({ dryRun });
      this.patch(kind, {
        busy: false,
        result: response.data,
        // Unlock the live run only after a successful dry-run.
        ...(dryRun ? { dryRunDone: true } : {}),
      });
    } catch (err) {
      this.patch(kind, {
        busy: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private patch(
    kind: MigrationActionKind,
    partial: Partial<ActionState>
  ): void {
    this.state.update((current) => ({
      ...current,
      [kind]: { ...current[kind], ...partial },
    }));
  }
}
