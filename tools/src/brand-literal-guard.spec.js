const { readFileSync, readdirSync, statSync } = require('node:fs');
const { join, relative, resolve, sep } = require('node:path');

const ROOT = resolve(__dirname, '../..');
const BRAND_MODULE = resolve(ROOT, 'libs/stats/src/lib/models/brand.ts');
const SW_HANDLERS = resolve(ROOT, 'libs/sw-push/src/handlers.ts');
const SCAN_ROOTS = ['web/src', 'libs'];

/**
 * Keeps the product name and domain in `@pu-stats/models#brand` instead of
 * scattered across production sources, so a rebrand edits one file.
 *
 * One escape hatch: `NO_MODULE_SYSTEM`, for files that cannot import anything.
 * `TRANSLATABLE_COPY` is empty — translatable text now carries the brand as an
 * `$localize` placeholder or a template binding, so a rename no longer touches
 * a single message source.
 *
 * `libs/sw-push` mirrors the name on purpose (the SW bundle takes no
 * cross-package imports); the drift test below pins the copy.
 */
const TRANSLATABLE_COPY = [];

const NO_MODULE_SYSTEM = [
  // Served as-is before Angular boots; nothing to import a constant from.
  'web/src/index.html',
];

const MIRRORED = ['libs/sw-push/src/handlers.ts'];

const EXEMPT = new Set([
  ...TRANSLATABLE_COPY,
  ...NO_MODULE_SYSTEM,
  ...MIRRORED,
  'libs/stats/src/lib/models/brand.ts',
]);

function readConstant(source, name, where) {
  const match = source.match(new RegExp(`const ${name} = '([^']*)'`));
  if (!match) throw new Error(`${where} is missing ${name}`);
  return match[1];
}

const brandSource = readFileSync(BRAND_MODULE, 'utf-8');
const BRAND_NAME = readConstant(brandSource, 'BRAND_NAME', 'brand.ts');
const BRAND_DOMAIN = readConstant(brandSource, 'BRAND_DOMAIN', 'brand.ts');

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
      continue;
    }
    if (!/\.(ts|html)$/.test(entry)) continue;
    if (entry.endsWith('.spec.ts')) continue;
    if (entry.endsWith('.generated.ts')) continue;
    if (full.split(sep).includes('generated')) continue;
    out.push(full);
  }
  return out;
}

function productionSources() {
  return SCAN_ROOTS.flatMap((root) => walk(resolve(ROOT, root))).map((file) =>
    relative(ROOT, file).split(sep).join('/')
  );
}

function literalsIn(file) {
  const source = readFileSync(resolve(ROOT, file), 'utf-8');
  return source
    .split('\n')
    .map((line, index) => ({ line: line.trim(), number: index + 1 }))
    .filter(
      ({ line }) => line.includes(BRAND_NAME) || line.includes(BRAND_DOMAIN)
    );
}

describe('brand literals', () => {
  it('should keep the brand out of production sources', () => {
    // given every production source that is not exempt
    const files = productionSources().filter((file) => !EXEMPT.has(file));

    // when scanning them for the name or the domain
    const offenders = files
      .map((file) => ({ file, hits: literalsIn(file) }))
      .filter(({ hits }) => hits.length > 0)
      .map(
        ({ file, hits }) =>
          `${file}:${hits[0].number} — ${hits[0].line.slice(0, 80)}`
      );

    // then nothing hard-codes it; import from '@pu-stats/models' instead
    expect(offenders).toEqual([]);
  });

  it.each([...TRANSLATABLE_COPY, ...NO_MODULE_SYSTEM])(
    'should still need the exemption for %s',
    (file) => {
      // given a file on an exemption list
      // when scanning it
      const hits = literalsIn(file);

      // then it genuinely still carries a literal — an entry that stopped
      // being needed is removed here, so the lists shrink as work lands
      expect(hits.length).toBeGreaterThan(0);
    }
  );

  it('should derive the URL and contact address from the domain', () => {
    // given the brand module
    // when reading the derived constants
    // then they are composed, not spelled out a second time
    expect(brandSource).toContain('`https://${BRAND_DOMAIN}`');
    expect(brandSource).toContain('`contact@${BRAND_DOMAIN}`');
  });

  it.each(['tools/src/generate-feeds.js', 'tools/src/generate-sitemap.js'])(
    'should keep the BASE_URL in %s in sync with the brand domain',
    (file) => {
      // given a build-time generator — plain Node, so it cannot import the TS
      // constant and states the origin itself
      const source = readFileSync(resolve(ROOT, file), 'utf-8');

      // when reading its BASE_URL
      const baseUrl = readConstant(source, 'BASE_URL', file);

      // then it matches the canonical origin
      expect(baseUrl).toBe(`https://${BRAND_DOMAIN}`);
    }
  );

  it('should keep the sw-push mirror in sync with the brand name', () => {
    // given the service worker's inlined copy
    const mirrored = readConstant(
      readFileSync(SW_HANDLERS, 'utf-8'),
      'SW_BRAND_NAME',
      'sw-push/handlers.ts'
    );

    // when comparing it to the canonical constant
    // then they match — the SW takes no cross-package import, so this is the
    // only thing stopping the two from drifting apart
    expect(mirrored).toBe(BRAND_NAME);
  });
});
