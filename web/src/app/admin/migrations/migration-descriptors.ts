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
    id: 'orphaned-user-data-cleanup',
    title: $localize`:@@admin.migrations.orphanedUserData.title:Datenmüll gelöschter Konten entfernen`,
    description: $localize`:@@admin.migrations.orphanedUserData.description:Sucht Daten von Nutzern ohne Firebase-Auth-Konto (Einträge, Statistiken, Pläne, Workouts, Freundschaften, Push-Abos, Nachrichten, Profilfotos …) und löscht sie wie bei einer Kontolöschung. Bis zu 25 Konten pro Lauf — so oft wiederholen, bis „remaining“ 0 ist. Nicht umkehrbar — erst den Probelauf ausführen.`,
    migrate: { callable: 'cleanupOrphanedUserData' },
  },
  {
    id: 'xp-backfill',
    title: $localize`:@@admin.migrations.xpBackfill.title:XP für bisherige Einträge nachbuchen`,
    description: $localize`:@@admin.migrations.xpBackfill.description:Bucht XP für alle Einträge, die vor dem Punktesystem gespeichert wurden, zu den aktuellen Wertigkeiten, berechnet Level und Level-Abzeichen neu und baut die XP-Bestenliste auf. Bis zu 200 Nutzer pro Lauf — so oft wiederholen, bis „remaining“ 0 ist. Bereits gebuchte Einträge bleiben unverändert. Erst den Probelauf ausführen.`,
    migrate: { callable: 'backfillXp' },
  },
  {
    id: 'training-stats-backfill',
    title: $localize`:@@admin.migrations.trainingStatsBackfill.title:Trainings-Statistik über alle Übungen aufbauen`,
    description: $localize`:@@admin.migrations.trainingStatsBackfill.description:Baut für alle Nutzer mit Einträgen die übungsübergreifende Trainings-Statistik auf (Profil, Heatmap, Freunde-Board). Ohne sie rechnen diese Seiten bei jedem Aufruf alle Einträge durch. Bis zu 200 Nutzer pro Lauf — so oft wiederholen, bis „remaining“ 0 ist. Bestehende Statistiken bleiben unverändert. Erst den Probelauf ausführen.`,
    migrate: { callable: 'backfillTrainingStats' },
  },
];
