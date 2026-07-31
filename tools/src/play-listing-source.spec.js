const { execFileSync } = require('node:child_process');
const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');

const SOURCE_MODULE = resolve(__dirname, 'play-listing-source.mjs');
const PUBLISH_MODULE = resolve(__dirname, 'publish-play-listing.mjs');

// Both modules are ESM; `tools/jest.config.cjs` only transforms `.ts`/`.js`,
// so exercise them in a throwaway node subprocess (same pattern as
// write-functions-workspace-allowbuilds.spec.js).
function runInModule(modulePath, expression) {
  const script = `
    import * as mod from ${JSON.stringify(modulePath)};
    const run = async () => (${expression});
    run().then(
      (value) => process.stdout.write(JSON.stringify({ ok: true, value })),
      (error) => process.stdout.write(JSON.stringify({ ok: false, message: error.message }))
    );
  `;
  return JSON.parse(
    execFileSync('node', ['--input-type=module', '-e', script], {
      encoding: 'utf-8',
    })
  );
}

function makeListingDir(fields) {
  const root = mkdtempSync(join(tmpdir(), 'play-listing-'));
  for (const [locale, files] of Object.entries(fields)) {
    mkdirSync(join(root, locale), { recursive: true });
    for (const [fileName, content] of Object.entries(files)) {
      writeFileSync(join(root, locale, fileName), content);
    }
  }
  return root;
}

const VALID_DE = {
  'title.txt': 'Pushup Stats\n',
  'short-description.txt': 'Reps zählen, Plänen folgen.\n',
  'full-description.txt': 'Eine ehrliche Trainings-App.\n',
};

describe('readListings', () => {
  let root;

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
    root = undefined;
  });

  it('should read every field and strip the trailing newline', () => {
    // given
    root = makeListingDir({ 'de-DE': VALID_DE });

    // when
    const result = runInModule(
      SOURCE_MODULE,
      `mod.readListings(${JSON.stringify(root)})`
    );

    // then
    expect(result.ok).toBe(true);
    expect(result.value).toEqual([
      {
        language: 'de-DE',
        title: 'Pushup Stats',
        shortDescription: 'Reps zählen, Plänen folgen.',
        fullDescription: 'Eine ehrliche Trainings-App.',
      },
    ]);
  });

  it('should reject a directory that is not a Play locale for this app', () => {
    // given — `de` is the app's locale code, but Play needs `de-DE`
    root = makeListingDir({ de: VALID_DE });

    // when
    const result = runInModule(
      SOURCE_MODULE,
      `mod.readListings(${JSON.stringify(root)})`
    );

    // then
    expect(result.ok).toBe(false);
    expect(result.message).toContain('de: not a Play locale');
  });

  it('should reject copy that exceeds a Play character limit', () => {
    // given
    root = makeListingDir({
      'de-DE': { ...VALID_DE, 'title.txt': `${'x'.repeat(31)}\n` },
    });

    // when
    const result = runInModule(
      SOURCE_MODULE,
      `mod.readListings(${JSON.stringify(root)})`
    );

    // then
    expect(result.ok).toBe(false);
    expect(result.message).toContain('title.txt: 31 characters, limit is 30');
  });

  it('should reject a missing field file', () => {
    // given
    root = makeListingDir({
      'de-DE': { 'title.txt': 'Pushup Stats\n' },
    });

    // when
    const result = runInModule(
      SOURCE_MODULE,
      `mod.readListings(${JSON.stringify(root)})`
    );

    // then
    expect(result.ok).toBe(false);
    expect(result.message).toContain('missing short-description.txt');
  });

  it('should reject a field that is present but blank', () => {
    // given
    root = makeListingDir({
      'de-DE': { ...VALID_DE, 'short-description.txt': '   \n' },
    });

    // when
    const result = runInModule(
      SOURCE_MODULE,
      `mod.readListings(${JSON.stringify(root)})`
    );

    // then
    expect(result.ok).toBe(false);
    expect(result.message).toContain('short-description.txt: is empty');
  });
});

describe('countCharacters', () => {
  it('should count emoji as one character each, like the Play Console does', () => {
    // given — naive `String.length` reports 4 for these two surrogate pairs
    const text = '📷🏋';

    // when
    const result = runInModule(
      SOURCE_MODULE,
      `mod.countCharacters(${JSON.stringify(text)})`
    );

    // then
    expect(result.value).toBe(2);
  });
});

describe('the checked-in listing sources', () => {
  it('should be valid and within every Play limit', () => {
    // given / when — no argument: reads the real store/play directory
    const result = runInModule(SOURCE_MODULE, 'mod.readListings()');

    // then
    expect(result.ok).toBe(true);
    expect(result.value.length).toBeGreaterThan(0);
  });

  it('should include the German listing, which is the source locale', () => {
    // given / when
    const result = runInModule(
      SOURCE_MODULE,
      'mod.readListings().map((l) => l.language)'
    );

    // then
    expect(result.value).toContain('de-DE');
  });
});

describe('PLAY_LOCALE_BY_APP_LOCALE', () => {
  it('should cover every locale the web app is built for', () => {
    // given — the app's localize list is the authority on shipped languages
    const project = require(resolve(__dirname, '../../web/project.json'));
    const appLocales =
      project.targets.build.configurations.production.localize ??
      project.targets.build.options.localize;

    // when
    const result = runInModule(SOURCE_MODULE, 'mod.PLAY_LOCALE_BY_APP_LOCALE');

    // then
    expect(Object.keys(result.value).sort()).toEqual([...appLocales].sort());
  });
});

describe('parseArgs', () => {
  it('should default to a dry run so publishing is always explicit', () => {
    // given / when
    const result = runInModule(PUBLISH_MODULE, 'mod.parseArgs([])');

    // then
    expect(result.value).toEqual({ commit: false, locale: null });
  });

  it('should accept --commit and both --locale spellings', () => {
    // given / when
    const spaced = runInModule(
      PUBLISH_MODULE,
      "mod.parseArgs(['--commit', '--locale', 'de-DE'])"
    );
    const equals = runInModule(
      PUBLISH_MODULE,
      "mod.parseArgs(['--locale=en-US'])"
    );

    // then
    expect(spaced.value).toEqual({ commit: true, locale: 'de-DE' });
    expect(equals.value).toEqual({ commit: false, locale: 'en-US' });
  });

  it('should reject an unknown flag instead of silently ignoring it', () => {
    // given / when
    const result = runInModule(PUBLISH_MODULE, "mod.parseArgs(['--publish'])");

    // then
    expect(result.ok).toBe(false);
    expect(result.message).toContain('Unknown argument: --publish');
  });
});

describe('diffListing', () => {
  const local = {
    language: 'de-DE',
    title: 'Pushup Stats',
    shortDescription: 'neu',
    fullDescription: 'gleich',
  };

  it('should report only the fields that actually differ', () => {
    // given
    const remote = {
      title: 'Pushup Stats',
      shortDescription: 'alt',
      fullDescription: 'gleich',
    };

    // when
    const result = runInModule(
      PUBLISH_MODULE,
      `mod.diffListing(${JSON.stringify(local)}, ${JSON.stringify(remote)})`
    );

    // then
    expect(result.value).toEqual([
      { field: 'shortDescription', before: 'alt', after: 'neu' },
    ]);
  });

  it('should treat a missing remote listing as every field being new', () => {
    // given — a locale that has no listing in the Console yet
    // when
    const result = runInModule(
      PUBLISH_MODULE,
      `mod.diffListing(${JSON.stringify(local)}, null)`
    );

    // then
    expect(result.value.map((c) => c.field)).toEqual([
      'title',
      'shortDescription',
      'fullDescription',
    ]);
    expect(result.value.every((c) => c.before === '')).toBe(true);
  });

  it('should report nothing when the live listing already matches', () => {
    // given
    const remote = {
      title: 'Pushup Stats',
      shortDescription: 'neu',
      fullDescription: 'gleich',
    };

    // when
    const result = runInModule(
      PUBLISH_MODULE,
      `mod.diffListing(${JSON.stringify(local)}, ${JSON.stringify(remote)})`
    );

    // then
    expect(result.value).toEqual([]);
  });
});
