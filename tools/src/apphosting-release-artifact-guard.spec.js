const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { parse } = require('yaml');

const ROOT = resolve(__dirname, '../..');

/** Official semver 2.0.0 regex (semver.org), trimmed to what we need. */
const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

function load(file) {
  return parse(readFileSync(resolve(ROOT, file), 'utf-8'));
}

function envEntry(config, variable) {
  return (config.env ?? []).find(
    (entry) => entry && entry.variable === variable
  );
}

/**
 * Locks in the pre-built-artifact wiring for production App Hosting builds.
 *
 * The App Hosting builder (~8 GB RAM) can't reliably run the full production
 * web build, and separately could never get the Nx Cloud remote cache to
 * restore web:build:production on that environment either (see
 * docs/gotchas/build-and-tooling.md, docs/ci-cd.md). Structural fix: CI
 * builds once on a plain GitHub Actions runner and publishes the result as a
 * GitHub Release asset (.github/workflows/ci.yml publish-release job);
 * production's buildCommand only downloads and extracts it
 * (scripts/fetch-release-artifact.sh) — no Angular build, no Nx Cloud
 * dependency on this side at all.
 *
 * The release tag is derived the same way in both places
 * (`deploy-0.0.0-g<short-sha>`) so the fetch script can construct the
 * download URL without a git-tag lookup. This guard fails loudly if either
 * side drifts from that pattern.
 */
describe('App Hosting release-artifact configuration', () => {
  const prod = load('apphosting.yaml');
  const fetchScript = readFileSync(
    resolve(ROOT, 'scripts/fetch-release-artifact.sh'),
    'utf-8'
  );
  const ciWorkflow = readFileSync(
    resolve(ROOT, '.github/workflows/ci.yml'),
    'utf-8'
  );

  it("should invoke the fetch script from production's build command", () => {
    // given the builder must never run the real Angular build
    // when App Hosting resolves scripts.buildCommand
    // then it must only download + extract the pre-built artifact
    expect(prod.scripts?.buildCommand).toBe(
      'bash scripts/fetch-release-artifact.sh'
    );
  });

  it('should not bind NX_CLOUD_ACCESS_TOKEN or SENTRY_AUTH_TOKEN in production', () => {
    // given production no longer runs nx or the sourcemap upload at build time
    // when App Hosting resolves the build-time environment
    // then neither secret should be bound (dead config invites confusion,
    //   and a stale secret reference risks a future bind-time rollout failure)
    expect(envEntry(prod, 'NX_CLOUD_ACCESS_TOKEN')).toBeUndefined();
    expect(envEntry(prod, 'SENTRY_AUTH_TOKEN')).toBeUndefined();
  });

  it('should derive the same deploy tag pattern in the fetch script and the CI publish job', () => {
    // given both sides must agree on the tag without a lookup
    // when either computes the tag for the current commit
    // then both must use the identical `deploy-0.0.0-g<short-sha>` pattern,
    //   with the same 7-char short-SHA abbreviation length pinned explicitly
    expect(fetchScript).toMatch(/TAG="deploy-0\.0\.0-g\$\{SHA\}"/);
    expect(fetchScript).toMatch(/git rev-parse --short=7 HEAD/);
    expect(ciWorkflow).toMatch(/TAG="deploy-\$\{SPECIFIER\}"/);
    expect(ciWorkflow).toMatch(/git rev-parse --short=7 HEAD/);
  });

  it('should build a prerelease identifier that is valid semver for any short SHA', () => {
    // given — a 7-char short SHA that is all digits with a leading zero is
    //   invalid semver (numeric identifiers must not have leading zeroes),
    //   and `nx release version` rejects it. It happened on 0647328 and
    //   will recur about once every 268 commits without the letter prefix.
    const specifier = /SPECIFIER="([^"]+)"/.exec(ciWorkflow)?.[1];
    expect(specifier).toBeDefined();

    // when the workflow substitutes each adversarial SHA
    const shas = ['0647328', '0000000', '1234567', 'abcdef0', '0abcdef'];

    // then every resulting version parses as semver
    for (const sha of shas) {
      const version = specifier.replace('${SHA}', sha);
      expect({ sha, version, valid: SEMVER.test(version) }).toEqual({
        sha,
        version,
        valid: true,
      });
    }
  });
});

/**
 * Profile photos live in a dedicated, private bucket — the default
 * `.firebasestorage.app` name is reserved by Google and cannot be created
 * from the CLI. Two things follow that are easy to get wrong silently:
 * `firebase.json` must name the bucket (an entry without one targets the
 * default bucket, which does not exist here), and the deploy command must
 * actually include `storage` or the rules never ship.
 */
describe('Storage rules wiring', () => {
  const firebaseJson = load('data-store/firebase.json');
  const mergeWorkflow = readFileSync(
    resolve(ROOT, '.github/workflows/firebase-hosting-merge.yml'),
    'utf-8'
  );

  it('should name the bucket the rules belong to', () => {
    // then
    expect(firebaseJson.storage).toEqual([
      { bucket: 'pushup-stats-profile-photos', rules: 'storage.rules' },
    ]);
  });

  it('should include storage in the production deploy', () => {
    // then — rules that never deploy are worse than no rules: the app
    // would behave as if they were in force
    expect(mergeWorkflow).toContain(
      '--only hosting,functions,firestore,storage'
    );
  });

  it('should keep the bucket private to clients', () => {
    // given — a world-readable bucket would publish every uploaded photo,
    // including those of users who never made their profile public
    const rules = readFileSync(
      resolve(ROOT, 'data-store/storage.rules'),
      'utf-8'
    );

    // then
    expect(rules).toContain('allow read: if request.auth != null');
    expect(rules).not.toMatch(/allow read:\s*if true/);
  });
});
