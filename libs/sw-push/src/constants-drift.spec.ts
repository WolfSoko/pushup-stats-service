import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SW_QUICK_LOG_MAX, SW_SUPPORTED_LOCALES } from './handlers';

/**
 * `sw-push` is an isolated service-worker bundle (eslint `scope:sw-push` →
 * `onlyDependOnLibsWithTags: []`), so it cannot import `@pu-stats/models` at
 * runtime — the quick-log cap and locale list are inlined in `handlers.ts`.
 *
 * This guard reads the canonical model source as text (no module import, so no
 * module-boundary violation) and fails CI if the inlined SW copies drift,
 * mirroring how `firestore.rules` is pinned to the exercise catalog.
 */
const MODELS_DIR = join(__dirname, '..', '..', 'stats', 'src', 'lib', 'models');

function readModelSource(file: string): string {
  return readFileSync(join(MODELS_DIR, file), 'utf8');
}

describe('sw-push constants drift guard', () => {
  it('should keep SW_QUICK_LOG_MAX in sync with QUICK_LOG_REPS_MAX', () => {
    // given
    const src = readModelSource('reminder-config.models.ts');
    const match = src.match(/QUICK_LOG_REPS_MAX\s*=\s*(\d+)/);

    // then
    expect(match).not.toBeNull();
    expect(SW_QUICK_LOG_MAX).toBe(match ? Number(match[1]) : NaN);
  });

  it('should keep SW_SUPPORTED_LOCALES in sync with SUPPORTED_REMINDER_LOCALES', () => {
    // given
    const src = readModelSource('reminder-i18n.models.ts');
    const block = src.match(/SUPPORTED_REMINDER_LOCALES\s*=\s*\[([\s\S]*?)\]/);

    // when
    const canonical = [...(block?.[1].matchAll(/'([a-z-]+)'/g) ?? [])].map(
      (m) => m[1]
    );

    // then
    expect(canonical.length).toBeGreaterThan(0);
    expect([...SW_SUPPORTED_LOCALES]).toEqual(canonical);
  });
});
