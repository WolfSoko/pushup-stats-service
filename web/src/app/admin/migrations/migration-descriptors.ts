/**
 * Registry of admin-triggerable data migrations rendered by the admin page's
 * "Daten-Migrationen" section (one {@link MigrationCardComponent} per entry).
 *
 * Each entry binds a human title/description to the deployed `onCall` Cloud
 * Function(s) that perform the migration. The migration runner contract is
 * deliberately uniform — every callable takes `{ dryRun: boolean }` and
 * returns a flat {@link MigrationResult} of primitive counters/flags — so the
 * card can drive any future migration without bespoke UI. Adding a migration
 * is a descriptor entry here plus its callable; no component changes required.
 */

export type MigrationActionKind = 'migrate' | 'rollback';

/**
 * Uniform return shape of a migration callable: a flat record of primitives —
 * numeric counters (e.g. `wouldCopy`/`copied`/`deleted`) plus the echoed
 * `dryRun` flag. Open over keys so any future migration's counters render
 * generically, but pinned to primitives so the card never renders a nested
 * object.
 */
export type MigrationResult = Record<string, number | boolean>;

/**
 * Persisted completion status of a migration (Firestore `migrationStatus/{id}`,
 * written by the `setMigrationStatus` admin callable). Lets the team mark a
 * migration as run + verified in this environment.
 */
export interface MigrationStatus {
  completed: boolean;
  /** ISO timestamp of the last completion, or null when not completed. */
  completedAt: string | null;
  /** Admin uid that marked it completed. */
  completedBy: string;
}

export interface MigrationAction {
  /**
   * Name of the deployed `onCall` Cloud Function. Invoked as
   * `httpsCallable(functions, callable)({ dryRun })` and expected to return a
   * flat {@link MigrationResult} (rendered generically by the card).
   */
  callable: string;
}

export interface MigrationDescriptor {
  /** Stable identifier; used as the list `track` key. */
  id: string;
  /** Card heading. */
  title: string;
  /** One-line summary of what the forward migration does. */
  description: string;
  /** Forward migration callable. */
  migrate: MigrationAction;
  /** Optional reverse callable that undoes the forward run. */
  rollback?: MigrationAction;
}

export const DATA_MIGRATIONS: readonly MigrationDescriptor[] = [
  {
    id: 'reminder-snooze-cleanup',
    title: $localize`:@@admin.migrations.reminderSnoozeCleanup.title:Snooze-Reste aus reminderDispatchState entfernen`,
    description: $localize`:@@admin.migrations.reminderSnoozeCleanup.description:Löscht „snoozedUntil“, „snoozedAt“ und „snoozeMinutes“ aus „reminderDispatchState/{uid}“. Die Snooze-Aktion der Erinnerung wurde entfernt, die Felder werden von niemandem mehr gelesen. Idempotent, nicht umkehrbar — erst den Probelauf ausführen.`,
    migrate: { callable: 'cleanupReminderSnoozeState' },
  },
];
