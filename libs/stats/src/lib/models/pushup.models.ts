export interface PushupRecord {
  _id: string;
  timestamp: string;
  reps: number;
  sets?: number[];
  source: string;
  /**
   * Push-up variation. New writes use the language-agnostic catalog
   * `id` from `PUSHUP_TYPES` (e.g. `'diamond'`, `'one-arm'`); older docs
   * still carry the legacy English `entryLabel` (e.g. `'Diamond'`, `'One-Arm'`)
   * or a free-form custom string the user typed in the entry dialog.
   * Use `findPushupTypeByStoredValue`, `canonicalizePushupType`, or
   * `displayPushupType` from `pushup-type.models.ts` at every read site
   * so all three formats resolve to the same bucket / label.
   */
  type?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PushupCreate {
  timestamp: string;
  reps: number;
  sets?: number[];
  source?: string;
  type?: string;
}

export interface PushupUpdate {
  timestamp?: string;
  reps?: number;
  sets?: number[];
  source?: string;
  type?: string;
}
