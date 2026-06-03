import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  RULE_FUNCTION_BY_MEASUREMENT,
  catalogIdsForMeasurement,
  groupedCatalogIdsForMeasurement,
  renderRulesAllowlists,
} from './exercise-rules-codegen';

/**
 * Drift guard for the generated allowlists in `data-store/firestore.rules`.
 * `exercise-rules-sync.spec.ts` proves the committed rules match the catalog;
 * this proves they are reproducible from the catalog via
 * `renderRulesAllowlists`, so editing the catalog without rerunning
 * `nx run cloud-functions:generate-exercise-rules` fails CI here.
 */

const RULES_PATH = join(__dirname, '..', '..', 'firestore.rules');

function quotedIdsInGeneratedBlock(rules: string, fnName: string): string[] {
  const begin = `BEGIN GENERATED ${fnName}`;
  const end = `END GENERATED ${fnName}`;
  const start = rules.indexOf(begin);
  const stop = rules.indexOf(end);
  if (start < 0 || stop < 0 || stop < start) {
    throw new Error(`generated block for "${fnName}" not found`);
  }
  return [...rules.slice(start, stop).matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

describe('exercise-rules-codegen', () => {
  const committed = readFileSync(RULES_PATH, 'utf8');

  it('should reproduce the committed firestore.rules from itself', () => {
    // given the committed rules file
    // when the allowlists are regenerated against it
    const regenerated = renderRulesAllowlists(committed);
    // then nothing changes — the catalog and the committed rules agree
    expect(regenerated).toBe(committed);
  });

  it('should be idempotent when run twice', () => {
    // given one regeneration pass
    const once = renderRulesAllowlists(committed);
    // when regenerated again
    const twice = renderRulesAllowlists(once);
    // then the output is byte-for-byte stable
    expect(twice).toBe(once);
  });

  it('should preserve the rules file header and the hasAny scaffold', () => {
    // given a regenerated rules file
    // when inspecting the parts outside the generated id lists
    const regenerated = renderRulesAllowlists(committed);
    // then the header and every function's scaffold survive verbatim
    expect(regenerated.startsWith("rules_version = '2';")).toBe(true);
    for (const fnName of Object.values(RULE_FUNCTION_BY_MEASUREMENT)) {
      expect(regenerated).toContain(`function ${fnName}(id) {`);
      expect(regenerated).toContain('].hasAny([id]);');
    }
  });

  it('should not emit a trailing comma after the final id in any allowlist', () => {
    // given regenerated rules — Firestore Rules list literals are not
    // reliably trailing-comma tolerant, so the last id before `]` must be bare
    const regenerated = renderRulesAllowlists(committed);
    // when scanning each generated block's final id line
    // then no id line immediately preceding END GENERATED ends with a comma
    expect(regenerated).not.toMatch(/',\s*\n\s*\/\/ END GENERATED/);
  });

  it.each(
    Object.entries(RULE_FUNCTION_BY_MEASUREMENT) as [
      'reps' | 'time' | 'distance-time',
      string,
    ][]
  )('should emit exactly the catalog %s ids in %s', (measurement, fnName) => {
    // given the catalog ids for this measurement
    const expected = catalogIdsForMeasurement(measurement);
    // when reading the generated block from the rendered rules
    const generated = renderRulesAllowlists(committed);
    const ids = quotedIdsInGeneratedBlock(generated, fnName).sort();
    // then the generated allowlist is exactly the catalog set
    expect(ids).toEqual(expected);
  });

  it('should throw when a target allowlist function is missing', () => {
    // given rules whose reps function has been renamed away
    const broken = committed.replace(
      'function isRepsExerciseId(id)',
      'function isRenamedExerciseId(id)'
    );
    // when regenerating against the broken rules
    // then it fails loudly rather than silently skipping the allowlist
    expect(() => renderRulesAllowlists(broken)).toThrow(/isRepsExerciseId/);
  });

  it('should group ids without dropping or duplicating any catalog id', () => {
    // given the flat and grouped views of reps ids
    const flat = catalogIdsForMeasurement('reps');
    // when flattening the grouped buckets
    const grouped = groupedCatalogIdsForMeasurement('reps')
      .flatMap((g) => g.ids)
      .sort();
    // then grouping is a lossless partition of the catalog ids
    expect(grouped).toEqual(flat);
  });

  it('should regenerate rules with CRLF line endings preserved', () => {
    // given the committed rules converted to a CRLF checkout
    const crlf = committed.replace(/\n/g, '\r\n');
    // when regenerating against the CRLF rules
    const out = renderRulesAllowlists(crlf);
    // then it doesn't throw, every generated block survives, and the
    // output stays CRLF (no lone LF leaks in from the '\n'-hardcoded body)
    for (const fnName of Object.values(RULE_FUNCTION_BY_MEASUREMENT)) {
      expect(out).toContain(`BEGIN GENERATED ${fnName}`);
    }
    expect(out.includes('\r\n')).toBe(true);
    expect(out).not.toMatch(/[^\r]\n/);
  });
});
