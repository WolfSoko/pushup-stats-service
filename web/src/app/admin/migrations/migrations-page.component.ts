import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { PageHeaderComponent } from '../../core/page-header/page-header.component';
import { CallableFunctionsService } from '../callable-functions.service';
import { MigrationCardComponent } from './migration-card.component';
import { DATA_MIGRATIONS, MigrationStatus } from './migration-descriptors';

@Component({
  selector: 'app-migrations-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatIconModule,
    RouterLink,
    PageHeaderComponent,
    MigrationCardComponent,
  ],
  template: `
    <div class="migrations-page">
      <app-page-header icon="sync_alt" variant="admin">
        <h1 page-title i18n="@@admin.migrations.title">Daten-Migrationen</h1>
        <p page-subtitle i18n="@@admin.migrations.subtitle">
          Einmalige Datenmigrationen ausführen, prüfen und als abgeschlossen
          markieren.
        </p>
      </app-page-header>

      <a mat-button routerLink="/admin">
        <mat-icon>arrow_back</mat-icon>
        <span i18n="@@admin.migrations.backToAdmin"
          >Zurück zum Admin-Bereich</span
        >
      </a>

      @if (error()) {
        <p class="error-text">{{ error() }}</p>
      }

      @for (migration of migrations; track migration.id) {
        <app-migration-card
          [migration]="migration"
          [status]="statuses()[migration.id]"
          [statusBusy]="busyId() === migration.id"
          (statusChange)="setStatus(migration.id, $event)"
        />
      }
    </div>
  `,
  styles: [
    `
      .migrations-page {
        max-width: 900px;
        margin: 0 auto;
        padding: 1rem;
      }
      .error-text {
        color: var(--mat-sys-error);
      }
    `,
  ],
})
export class MigrationsPageComponent {
  private readonly callables = inject(CallableFunctionsService);

  readonly migrations = DATA_MIGRATIONS;
  readonly statuses = signal<Record<string, MigrationStatus | undefined>>({});
  /** Id of the migration whose status is currently being persisted. */
  readonly busyId = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  constructor() {
    void this.loadStatuses();
  }

  private async loadStatuses(): Promise<void> {
    try {
      const fn = this.callables.call<
        void,
        { statuses: Record<string, MigrationStatus> }
      >('getMigrationStatuses');
      const response = await fn();
      this.statuses.set(response.data.statuses ?? {});
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    }
  }

  async setStatus(id: string, completed: boolean): Promise<void> {
    this.busyId.set(id);
    this.error.set(null);
    try {
      const fn = this.callables.call<
        { id: string; completed: boolean },
        MigrationStatus & { id: string }
      >('setMigrationStatus');
      const { data } = await fn({ id, completed });
      this.statuses.update((current) => ({
        ...current,
        [id]: {
          completed: data.completed,
          completedAt: data.completedAt,
          completedBy: data.completedBy,
        },
      }));
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : String(err));
    } finally {
      this.busyId.set(null);
    }
  }
}
