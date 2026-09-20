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
 * Two escape hatches, both deliberate and both kept honest below:
 *
 * `TRANSLATABLE_COPY` lists files whose remaining mentions sit inside
 * `$localize` messages or `i18n`-marked template text. Those carry the brand
 * as part of a translated sentence; turning them into placeholders changes the
 * message source and re-seeds all eight locale targets, so it is its own step.
 * Until then the list is the inventory of what is left — and because a stale
 * entry fails the suite, it can only shrink.
 *
 * `NO_MODULE_SYSTEM` is for files that cannot import anything.
 *
 * `libs/sw-push` mirrors the name on purpose (the SW bundle takes no
 * cross-package imports); the drift test below pins the copy.
 */
const TRANSLATABLE_COPY = [
  'libs/auth/src/lib/ui/login/login.component.html',
  'web/src/app/achievements/achievement-dialog.component.ts',
  'web/src/app/ai/ai-assistant.routes.ts',
  'web/src/app/app.routes.ts',
  'web/src/app/app.ts',
  'web/src/app/core/android-test-invite-dialog.component.ts',
  'web/src/app/core/invite-banner.component.ts',
  'web/src/app/core/invite.service.ts',
  'web/src/app/core/page-header/page-header.component.ts',
  'web/src/app/marketing/about/ueber-uns-page.component.ts',
  'web/src/app/marketing/shell/landing-page.component.html',
  'web/src/app/public-profile/profile-labels.ts',
  'web/src/app/public-profile/public-profile-seo.ts',
  'web/src/app/stats/dashboard/dashboard-share.ts',
  'web/src/app/stats/shell/settings.facade.ts',
  'web/src/app/stats/shell/stats-dashboard.component.html',
  'web/src/app/training-plans/plan-share.ts',
  'web/src/app/wiki/exercise-detail.component.ts',
  'web/src/app/wiki/pushup-type-detail.component.ts',
];

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
