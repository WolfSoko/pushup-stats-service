const { execFileSync } = require('node:child_process');
const {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} = require('node:fs');
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

/**
 * Runs `publishListings` against a fake API inside the subprocess and returns
 * the recorded call sequence, so the publish transaction can be asserted
 * without touching Google.
 *
 * `remoteByLocale` seeds what `getListing` returns; `failOn` lists API methods
 * that should throw, to exercise the cleanup path. Each throws a
 * `boom:<method>` error so the test can tell which failure surfaced.
 */
function runPublish({ listings, commit, remoteByLocale = {}, failOn = [] }) {
  const expression = `(async () => {
    const calls = [];
    const failing = ${JSON.stringify([].concat(failOn))};
    const record = (name) => (...args) => {
      calls.push([name, ...args]);
      if (failing.includes(name)) throw new Error('boom:' + name);
      return undefined;
    };
    const api = {
      createEdit: async (...a) => { record('createEdit')(...a); return { id: 'edit-1' }; },
      getListing: async (editId, language) => {
        calls.push(['getListing', editId, language]);
        if (failing.includes('getListing')) throw new Error('boom:getListing');
        return ${JSON.stringify(remoteByLocale)}[language] ?? null;
      },
      updateListing: async (...a) => record('updateListing')(...a),
      commitEdit: async (...a) => record('commitEdit')(...a),
      deleteEdit: async (...a) => record('deleteEdit')(...a),
    };
    try {
      const changed = await mod.publishListings({
        listings: ${JSON.stringify(listings)},
        commit: ${JSON.stringify(commit)},
        api,
        log: () => {},
      });
      return { calls, changed };
    } catch (error) {
      return { calls, failed: error.message };
    }
  })()`;
  return runInModule(PUBLISH_MODULE, expression).value;
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
  // Play enforces its limits on UTF-16 code units (its backend is a JVM), so
  // an emoji costs more than the one character it looks like. Counting code
  // points would undercount and let copy through that Play then rejects.
  it.each([
    ['a plain ASCII string', 'abc', 3],
    ['a surrogate-pair emoji', '📷', 2],
    ['an emoji with a variation selector', '🏋️', 3],
    ['a ZWJ sequence', '👨‍👩‍👧', 8],
  ])('should count %s as its UTF-16 length', (_name, text, expected) => {
    // given / when
    const result = runInModule(
      SOURCE_MODULE,
      `mod.countCharacters(${JSON.stringify(text)})`
    );

    // then
    expect(result.value).toBe(expected);
  });

  it('should match the checked-in description, which sits close to the limit', () => {
    // given — the real copy is emoji-heavy; code-point counting reported ~10
    // fewer characters and put an over-limit description under the cap
    const description = readFileSync(
      resolve(__dirname, '../../store/play/de-DE/full-description.txt'),
      'utf-8'
    ).replace(/\n+$/, '');

    // when
    const result = runInModule(
      SOURCE_MODULE,
      `mod.countCharacters(${JSON.stringify(description)})`
    );

    // then
    expect(result.value).toBe(description.length);
    expect(result.value).toBeGreaterThan([...description].length);
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

describe('the tools:test Nx wiring', () => {
  // The two guards below assert against files outside the `tools` project.
  // Nx has no way to infer that, so without these inputs `nx affected` would
  // skip the run — or replay a stale cached pass — when a PR only touches
  // the store copy or the locale list. That is exactly the case the guards
  // exist for.
  it.each([
    ['the listing sources', '{workspaceRoot}/store/play/**/*'],
    ['the app locale list', '{workspaceRoot}/web/project.json'],
  ])('should declare %s as a test input', (_name, input) => {
    // given
    const project = JSON.parse(
      readFileSync(resolve(__dirname, '../project.json'), 'utf-8')
    );

    // when
    const inputs = project.targets.test.inputs;

    // then
    expect(inputs).toContain(input);
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

  it.each([
    ['--locale with no value', "['--commit', '--locale']"],
    ['--locale= with an empty value', "['--commit', '--locale=']"],
    ['--locale with only whitespace', "['--commit', '--locale=  ']"],
  ])(
    'should reject %s rather than widening the run to every locale',
    (_name, argv) => {
      // given / when
      const result = runInModule(PUBLISH_MODULE, `mod.parseArgs(${argv})`);

      // then
      expect(result.ok).toBe(false);
      expect(result.message).toContain('--locale needs a value');
    }
  );
});

describe('buildAuth', () => {
  it('should point at the setup doc when the credentials env var is unset', () => {
    // given / when
    const result = runInModule(PUBLISH_MODULE, 'mod.buildAuth({})');

    // then
    expect(result.ok).toBe(false);
    expect(result.message).toContain(
      'GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not set'
    );
    expect(result.message).toContain('docs/play-store-publishing.md');
  });

  it('should say so when the env var holds a path instead of the key itself', () => {
    // given — the likely mistake is exporting the filename, not its contents
    const env = { GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: '~/keys/play.json' };

    // when
    const result = runInModule(
      PUBLISH_MODULE,
      `mod.buildAuth(${JSON.stringify(env)})`
    );

    // then
    expect(result.ok).toBe(false);
    expect(result.message).toContain('not valid JSON');
  });
});

/**
 * `authorizedFetch` and `createPlayApi` are the only pieces that touch the
 * network, so they are exercised with `fetch` stubbed inside the subprocess.
 * These are the paths the very first real run hits.
 */
function runWithStubbedFetch({ status, body = '', expression }) {
  return runInModule(
    PUBLISH_MODULE,
    `(async () => {
      const requests = [];
      globalThis.fetch = async (url, init) => {
        requests.push({ url, method: init?.method ?? 'GET' });
        return {
          ok: ${status} >= 200 && ${status} < 300,
          status: ${status},
          text: async () => ${JSON.stringify(body)},
          json: async () => JSON.parse(${JSON.stringify(body || '{}')}),
        };
      };
      const auth = {
        getClient: async () => ({
          getAccessToken: async () => ({ token: 'stub-token' }),
        }),
      };
      try {
        const value = await (${expression});
        return { value, requests };
      } catch (error) {
        return { failed: error.message, status: error.status, requests };
      }
    })()`
  ).value;
}

describe('authorizedFetch', () => {
  it('should attach the status so callers can tell 404 from a real failure', () => {
    // given / when
    const result = runWithStubbedFetch({
      status: 403,
      body: 'The caller does not have permission',
      expression: "mod.authorizedFetch(auth, 'https://example.test/x')",
    });

    // then
    expect(result.status).toBe(403);
    expect(result.failed).toContain('403');
    // The body matters: it is what tells the operator the permission is
    // missing rather than the request being malformed.
    expect(result.failed).toContain('The caller does not have permission');
  });

  it('should return null for 204, which has no body to parse', () => {
    // given / when — deleting an edit answers 204
    const result = runWithStubbedFetch({
      status: 204,
      expression:
        "mod.authorizedFetch(auth, 'https://example.test/x', { method: 'DELETE' })",
    });

    // then
    expect(result.value).toBeNull();
  });
});

describe('createPlayApi', () => {
  it('should treat a 404 listing as "not created yet" rather than an error', () => {
    // given — the locale exists on disk but not yet in the Console
    // when
    const result = runWithStubbedFetch({
      status: 404,
      body: 'not found',
      expression: "mod.createPlayApi(auth).getListing('edit-1', 'en-US')",
    });

    // then
    expect(result.failed).toBeUndefined();
    expect(result.value).toBeNull();
  });

  it('should propagate a 403 instead of silently reporting no listing', () => {
    // given — the most likely first-run failure: permissions not propagated
    // when
    const result = runWithStubbedFetch({
      status: 403,
      body: 'forbidden',
      expression: "mod.createPlayApi(auth).getListing('edit-1', 'de-DE')",
    });

    // then
    expect(result.value).toBeUndefined();
    expect(result.status).toBe(403);
  });

  it('should address the listing endpoint by the language in the body', () => {
    // given / when
    const result = runWithStubbedFetch({
      status: 200,
      body: '{}',
      expression:
        "mod.createPlayApi(auth).updateListing('edit-1', { language: 'de-DE', title: 'x' })",
    });

    // then
    expect(result.requests[0].method).toBe('PUT');
    expect(result.requests[0].url).toContain(
      '/applications/com.pushupstats.app/edits/edit-1/listings/de-DE'
    );
  });

  it('should commit through the :commit sub-resource', () => {
    // given / when
    const result = runWithStubbedFetch({
      status: 200,
      body: '{}',
      expression: "mod.createPlayApi(auth).commitEdit('edit-1')",
    });

    // then
    expect(result.requests[0].method).toBe('POST');
    expect(result.requests[0].url).toContain('/edits/edit-1:commit');
  });
});

describe('selectListings', () => {
  const all = [{ language: 'de-DE' }, { language: 'en-US' }];

  it('should return every listing when no locale is given', () => {
    // given / when
    const result = runInModule(
      PUBLISH_MODULE,
      `mod.selectListings(${JSON.stringify(all)}, null)`
    );

    // then
    expect(result.value).toHaveLength(2);
  });

  it('should narrow to the requested locale', () => {
    // given / when
    const result = runInModule(
      PUBLISH_MODULE,
      `mod.selectListings(${JSON.stringify(all)}, 'en-US')`
    );

    // then
    expect(result.value).toEqual([{ language: 'en-US' }]);
  });

  it('should fail loudly for a locale that has no listing on disk', () => {
    // given / when
    const result = runInModule(
      PUBLISH_MODULE,
      `mod.selectListings(${JSON.stringify(all)}, 'fr-FR')`
    );

    // then
    expect(result.ok).toBe(false);
    expect(result.message).toContain('No listing found for locale fr-FR');
  });

  it('should reject a locale that smuggles a second flag in its value', () => {
    // given — the workflow passes the operator's locale as a single argv
    // element, so an injected flag arrives as part of the locale string.
    // This is the last line of defence behind the quoting in the workflow.
    const argv = "['--locale=de-DE --commit']";

    // when
    const parsed = runInModule(PUBLISH_MODULE, `mod.parseArgs(${argv})`);
    const selected = runInModule(
      PUBLISH_MODULE,
      `mod.selectListings(${JSON.stringify(all)}, ${JSON.stringify('de-DE --commit')})`
    );

    // then — it never becomes a commit, and it never matches a real locale
    expect(parsed.value.commit).toBe(false);
    expect(selected.ok).toBe(false);
    expect(selected.message).toContain('No listing found');
  });
});

describe('publishListings', () => {
  const de = {
    language: 'de-DE',
    title: 'Pushup Stats',
    shortDescription: 'kurz',
    fullDescription: 'lang',
  };
  const names = (calls) => calls.map(([name]) => name);

  it('should never write or commit on a dry run', () => {
    // given — the live listing differs from the source
    // when
    const result = runPublish({
      listings: [de],
      commit: false,
      remoteByLocale: { 'de-DE': { ...de, shortDescription: 'alt' } },
    });

    // then
    expect(names(result.calls)).toEqual([
      'createEdit',
      'getListing',
      'deleteEdit',
    ]);
    expect(result.changed).toBe(1);
  });

  it('should update and commit when --commit is set', () => {
    // given
    // when
    const result = runPublish({
      listings: [de],
      commit: true,
      remoteByLocale: { 'de-DE': { ...de, title: 'alt' } },
    });

    // then
    expect(names(result.calls)).toEqual([
      'createEdit',
      'getListing',
      'updateListing',
      'commitEdit',
    ]);
  });

  it('should discard the edit instead of committing when nothing changed', () => {
    // given — live listing already matches, so a commit would be an empty
    // edit and would still cost a review cycle
    // when
    const result = runPublish({
      listings: [de],
      commit: true,
      remoteByLocale: { 'de-DE': de },
    });

    // then
    expect(names(result.calls)).toEqual([
      'createEdit',
      'getListing',
      'deleteEdit',
    ]);
    expect(result.changed).toBe(0);
  });

  it('should treat a locale with no live listing as a create', () => {
    // given — `getListing` resolves to null for an unknown locale
    // when
    const result = runPublish({
      listings: [de],
      commit: true,
      remoteByLocale: {},
    });

    // then
    expect(names(result.calls)).toContain('updateListing');
    expect(result.changed).toBe(1);
  });

  it('should send the full listing body on update', () => {
    // given
    // when
    const result = runPublish({
      listings: [de],
      commit: true,
      remoteByLocale: { 'de-DE': { ...de, title: 'alt' } },
    });

    // then
    const [, editId, body] = result.calls.find(
      ([name]) => name === 'updateListing'
    );
    expect(editId).toBe('edit-1');
    expect(body).toEqual(de);
  });

  it('should clean up the edit when a call fails mid-transaction', () => {
    // given — an open edit blocks the next run with a conflict
    // when
    const result = runPublish({
      listings: [de],
      commit: true,
      remoteByLocale: { 'de-DE': { ...de, title: 'alt' } },
      failOn: ['updateListing'],
    });

    // then
    expect(names(result.calls)).toEqual([
      'createEdit',
      'getListing',
      'updateListing',
      'deleteEdit',
    ]);
    expect(result.failed).toBe('boom:updateListing');
  });

  it('should report the original failure, not a failure from the cleanup', () => {
    // given — the update throws, and so does the cleanup that follows it
    // when
    const result = runPublish({
      listings: [de],
      commit: true,
      remoteByLocale: { 'de-DE': { ...de, title: 'alt' } },
      failOn: ['updateListing', 'deleteEdit'],
    });

    // then — the surfaced error is the one that actually broke the run
    expect(result.failed).toBe('boom:updateListing');
  });
});

describe('buildUpdateBody', () => {
  const local = {
    language: 'de-DE',
    title: 'Pushup Stats',
    shortDescription: 'kurz',
    fullDescription: 'lang',
  };

  it('should carry the promo video over so a text update cannot wipe it', () => {
    // given — `edits.listings.update` is a full replace, and the video is
    // maintained in the Console with no source in this repo
    const remote = { video: 'https://youtu.be/abc123' };

    // when
    const result = runInModule(
      PUBLISH_MODULE,
      `mod.buildUpdateBody(${JSON.stringify(local)}, ${JSON.stringify(remote)})`
    );

    // then
    expect(result.value.video).toBe('https://youtu.be/abc123');
  });

  it('should omit the video field when the live listing has none', () => {
    // given / when
    const result = runInModule(
      PUBLISH_MODULE,
      `mod.buildUpdateBody(${JSON.stringify(local)}, null)`
    );

    // then
    expect(result.value).toEqual(local);
    expect('video' in result.value).toBe(false);
  });
});

describe('summarize', () => {
  it('should show a short single-line value in full, with no ellipsis', () => {
    // given / when
    const result = runInModule(PUBLISH_MODULE, "mod.summarize('Pushup Stats')");

    // then
    expect(result.value).toBe('"Pushup Stats" [12 chars]');
  });

  it('should mark a value cut off mid-line as shortened', () => {
    // given — 80 characters, longer than the 72-character preview
    const value = 'x'.repeat(80);

    // when
    const result = runInModule(
      PUBLISH_MODULE,
      `mod.summarize(${JSON.stringify(value)})`
    );

    // then
    expect(result.value).toContain(' … [80 chars]');
  });

  it('should mark a multi-line value as shortened even when line one is short', () => {
    // given
    const value = 'kurz\nzweite Zeile';

    // when
    const result = runInModule(
      PUBLISH_MODULE,
      `mod.summarize(${JSON.stringify(value)})`
    );

    // then
    expect(result.value).toBe('"kurz" … [17 chars]');
  });

  it('should render an absent value as (empty) rather than empty quotes', () => {
    // given / when — the "before" side for a locale Play does not have yet
    const result = runInModule(PUBLISH_MODULE, "mod.summarize('')");

    // then
    expect(result.value).toBe('(empty)');
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
