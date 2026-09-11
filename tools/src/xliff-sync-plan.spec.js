const { execFileSync } = require('node:child_process');
const { resolve } = require('node:path');

const MODULE = resolve(__dirname, 'xliff-sync-plan.mjs');

// The module is ESM and `tools/jest.config.cjs` only transforms `.ts`/`.js`,
// so exercise it in a throwaway node subprocess — same pattern as
// play-listing-source.spec.js.
function run(expression) {
  const script = `
    import * as mod from ${JSON.stringify(MODULE)};
    const run = async () => (${expression});
    run().then(
      (value) => process.stdout.write(JSON.stringify({ ok: true, value })),
      (error) => process.stdout.write(JSON.stringify({ ok: false, message: error.message }))
    );
  `;
  const result = JSON.parse(
    execFileSync('node', ['--input-type=module', '-e', script], {
      encoding: 'utf-8',
    })
  );
  if (!result.ok) throw new Error(result.message);
  return result.value;
}

function unit(id, { source, target, state = 'translated' }) {
  const sourceTag =
    source === null ? '<source/>' : `<source>${source}</source>`;
  const targetTag =
    target === undefined ? '' : `\n        <target>${target}</target>`;
  return `    <unit id="${id}">\n      <segment state="${state}">\n        ${sourceTag}${targetTag}\n      </segment>\n    </unit>`;
}

describe('comparableText', () => {
  it('should ignore whitespace so re-wrapping is not a change', () => {
    // given the extractor re-wrapped a long string
    const a = run(`mod.comparableText('  Hallo\\n  Welt ')`);
    const b = run(`mod.comparableText('Hallo Welt')`);

    // then
    expect(a).toBe(b);
  });

  it('should ignore the expression behind a placeholder', () => {
    // given a refactor renamed the bound expression
    const before = run(
      `mod.comparableText('Reps: <ph id="0" equiv="INTERPOLATION" disp="{{ reps }}"/>')`
    );
    const after = run(
      `mod.comparableText('Reps: <ph id="0" equiv="INTERPOLATION" disp="{{ cfg.reps }}"/>')`
    );

    // then — a translator has nothing to do here
    expect(before).toBe(after);
  });

  it('should see a changed placeholder identity', () => {
    // when / then
    expect(
      run(`mod.comparableText('<ph id="0" equiv="START_TAG_B"/>')`)
    ).not.toBe(run(`mod.comparableText('<ph id="0" equiv="START_TAG_I"/>')`));
  });
});

describe('planUnit', () => {
  it('should seed a unit the locale does not have', () => {
    // when
    const plan = run(`mod.planUnit('x', 'Hallo', undefined)`);

    // then — the build treats a missing translation as an error
    expect(plan.action).toBe('missing');
    expect(plan.xml).toContain('state="initial"');
    expect(plan.xml).toContain('<source>Hallo</source>');
    expect(plan.xml).toContain('<target>Hallo</target>');
  });

  it('should leave an up-to-date translation alone', () => {
    // given
    const localeUnit = unit('x', { source: 'Hallo', target: 'Ciao' });

    // when
    const plan = run(
      `mod.planUnit('x', 'Hallo', ${JSON.stringify(localeUnit)})`
    );

    // then
    expect(plan.action).toBe('same');
  });

  it('should refresh an untouched fallback of older German', () => {
    // given a seeded fallback, never translated
    const localeUnit = unit('x', {
      source: 'Alt',
      target: 'Alt',
      state: 'initial',
    });

    // when
    const plan = run(`mod.planUnit('x', 'Neu', ${JSON.stringify(localeUnit)})`);

    // then
    expect(plan.action).toBe('refresh');
    expect(plan.xml).toContain('<target>Neu</target>');
  });

  it('should flag a real translation of changed German as stale', () => {
    // given — this is the case that used to go unnoticed
    const localeUnit = unit('x', { source: 'Alt', target: 'Vecchio' });

    // when
    const plan = run(`mod.planUnit('x', 'Neu', ${JSON.stringify(localeUnit)})`);

    // then: source updated, translation kept live, state back to initial
    expect(plan.action).toBe('stale');
    expect(plan.xml).toContain('<source>Neu</source>');
    expect(plan.xml).toContain('<target>Vecchio</target>');
    expect(plan.xml).toContain('state="initial"');
  });

  it('should repair a unit that lost its source without touching the translation', () => {
    // given an artefact of earlier hand edits
    const localeUnit = unit('x', { source: null, target: 'Ciao' });

    // when
    const plan = run(
      `mod.planUnit('x', 'Hallo', ${JSON.stringify(localeUnit)})`
    );

    // then — nothing about the translation is stale
    expect(plan.action).toBe('repair');
    expect(plan.xml).toContain('<source>Hallo</source>');
    expect(plan.xml).toContain('<target>Ciao</target>');
    expect(plan.xml).toContain('state="translated"');
  });

  it('should not flag a unit whose German only got re-wrapped', () => {
    // given
    const localeUnit = unit('x', { source: 'Hallo Welt', target: 'Ciao' });

    // when
    const plan = run(
      `mod.planUnit('x', '  Hallo\\n  Welt ', ${JSON.stringify(localeUnit)})`
    );

    // then
    expect(plan.action).toBe('same');
  });
});

describe('planLocale', () => {
  it('should count every outcome for a locale', () => {
    // given one of each case
    const source = `<unit id="a"><segment><source>A neu</source></segment></unit>
${unit('b', { source: 'B', target: 'B' })}`;
    const locale = [
      unit('a', { source: 'A alt', target: 'A tradotto' }),
      unit('b', { source: 'B', target: 'B tradotto' }),
      unit('c', { source: 'C', target: 'C tradotto' }),
    ].join('\n');

    // when
    const counts = run(
      `mod.countActions(mod.planLocale(mod.extractUnits(${JSON.stringify(
        source
      )}), mod.extractUnits(${JSON.stringify(locale)})))`
    );

    // then — 'c' is not in the source any more and simply is not planned
    expect(counts).toEqual({
      missing: 0,
      refresh: 0,
      repair: 0,
      stale: 1,
      same: 1,
    });
  });
});
