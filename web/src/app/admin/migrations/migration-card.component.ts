import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  signal,
} from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  MigrationActionKind,
  MigrationDescriptor,
} from './migration-descriptors';

interface ActionState {
  busy: boolean;
  /**
   * A live (non-dry) run stays disabled until a dry-run for the same action
   * has completed in this session — the runbook mandates "dry-run first", so
   * the UI enforces it rather than relying on the operator to remember.
   */
  dryRunDone: boolean;
  result: Record<string, unknown> | null;
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
    MatButtonModule,
    MatCardModule,
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
  private readonly functions = inject(Functions);

  readonly migration = input.required<MigrationDescriptor>();

  private readonly state = signal<Record<MigrationActionKind, ActionState>>({
    migrate: { ...IDLE },
    rollback: { ...IDLE },
  });

  /** Reactive per-action state; reads the signal so the template stays live. */
  actionState(kind: MigrationActionKind): ActionState {
    return this.state()[kind];
  }

  resultEntries(kind: MigrationActionKind): { key: string; value: unknown }[] {
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
      const fn = httpsCallable<{ dryRun: boolean }, Record<string, unknown>>(
        this.functions,
        action.callable
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
