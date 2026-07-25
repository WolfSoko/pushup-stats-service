/**
 * The pushup entry dialog names its variant `type` (the free-text "Typ"
 * autocomplete); every other exercise emits `variantId`. Both persist to
 * the same `ExerciseEntry.variantId` field, so the two shapes are
 * normalized here instead of at each store call site.
 */
export interface VariantSource {
  kind: 'pushup' | 'exercise';
  type?: string;
  variantId?: string | null;
}

function rawVariant(payload: VariantSource): string | null | undefined {
  return payload.kind === 'pushup' ? payload.type : payload.variantId;
}

/** A new entry either carries a variant or none — nothing to clear yet. */
export function createVariantPatch(payload: VariantSource): {
  variantId?: string;
} {
  const value = rawVariant(payload)?.trim();
  return value ? { variantId: value } : {};
}

/**
 * `null` is the explicit clear sentinel the data-access layer maps to a
 * Firestore `deleteField()`; an omitted field means "no change".
 */
export function updateVariantPatch(payload: VariantSource): {
  variantId?: string | null;
} {
  const value = rawVariant(payload);
  if (value === undefined) return {};
  return { variantId: value?.trim() || null };
}
