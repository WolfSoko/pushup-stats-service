/**
 * Registry of admin-triggerable data migrations rendered by the admin page's
 * "Daten-Migrationen" section (one {@link MigrationCardComponent} per entry).
 *
 * Each entry binds a human title/description to the deployed `onCall` Cloud
 * Function(s) that perform the migration. The migration runner contract is
 * deliberately uniform — every callable takes `{ dryRun: boolean }` and
 * returns a flat object of numeric counters — so the card can drive any
 * future migration without bespoke UI. Adding a migration is a descriptor
 * entry here plus its callable; no component changes required.
 */

export type MigrationActionKind = 'migrate' | 'rollback';

export interface MigrationAction {
  /**
   * Name of the deployed `onCall` Cloud Function. Invoked as
   * `httpsCallable(functions, callable)({ dryRun })` and expected to return a
   * flat record of numeric counters (rendered generically by the card).
   */
  callable: string;
}

export interface MigrationDescriptor {
  /** Stable identifier; used as the list `track` key. */
  id: string;
  /** Card heading (German source — admin-only internal tooling). */
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
    id: 'pushup-unification',
    title: 'Liegestütze vereinheitlichen (pushups → exerciseEntries)',
    description:
      'Kopiert die Legacy-„pushups“-Collection nach „exerciseEntries“ ' +
      '(exerciseId:"pushup", migratedFrom:"pushups"). Idempotent, lässt die ' +
      'Quelle unangetastet und ist über „Rückgängig“ reversibel. Immer erst ' +
      'den Probelauf ausführen und die Zahlen gegen das Runbook prüfen.',
    migrate: { callable: 'migratePushupsToExerciseEntries' },
    rollback: { callable: 'rollbackPushupUnification' },
  },
];
