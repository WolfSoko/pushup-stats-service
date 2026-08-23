/**
 * Build metadata of the deployment that is actually being served.
 *
 * `tools/src/write-build-info.mjs` writes `build-info.json` into the browser
 * bundle right after the production build; from there both serving paths pick
 * it up unchanged — Firebase App Hosting through `express.static` in
 * `server.ts`, Firebase Hosting through `hosting-public` (see
 * `.github/workflows/firebase-hosting-merge.yml`).
 *
 * Deliberately NOT baked into the JS bundle at build time: a per-commit
 * `define` would give every commit its own Nx build hash and defeat the cache
 * restore the `publish-release` CI job relies on (see `docs/ci-cd.md`).
 */

export interface BuildInfo {
  /** Short commit SHA of the deployed commit — same string as the Sentry release. */
  readonly release: string;
  /** Release version published by `nx release` (`0.0.0-<short-sha>`). */
  readonly version: string;
  /** ISO timestamp of when the artifact was built; empty when unknown. */
  readonly builtAt: string;
}

/** Stand-in when no build metadata is available (local dev, `nx serve`, 404). */
export const UNKNOWN_RELEASE = 'unknown';

export const UNKNOWN_BUILD_INFO: BuildInfo = {
  release: UNKNOWN_RELEASE,
  version: UNKNOWN_RELEASE,
  builtAt: '',
};

/** Root-relative so it resolves the same from every locale prefix. */
export const BUILD_INFO_URL = '/build-info.json';

export function parseBuildInfo(raw: unknown): BuildInfo | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { release, version, builtAt } = raw as Record<string, unknown>;
  if (typeof release !== 'string' || release === '') return null;
  if (typeof version !== 'string' || version === '') return null;
  return {
    release,
    version,
    builtAt: typeof builtAt === 'string' ? builtAt : '',
  };
}

/**
 * Resolve the build info for the SSR process: the JSON shipped inside the
 * artifact wins, a `GIT_SHA` env var is the fallback for environments that
 * inject the commit instead, and everything else is honestly `unknown`.
 */
export function resolveBuildInfo(
  rawJson: string | null,
  gitSha: string | undefined
): BuildInfo {
  const fromFile = rawJson ? parseJson(rawJson) : null;
  if (fromFile) return fromFile;
  if (gitSha) return { release: gitSha, version: gitSha, builtAt: '' };
  return UNKNOWN_BUILD_INFO;
}

/**
 * Release name for error reporting, or `undefined` when it can't be
 * determined — Sentry treats a missing release as "no release" rather than
 * lumping every unidentified deployment under a literal `unknown`.
 */
export function sentryRelease(info: BuildInfo): string | undefined {
  return info.release === UNKNOWN_RELEASE ? undefined : info.release;
}

/**
 * Fetch the build info of the running deployment. `no-store` keeps the
 * browser from answering from its own cache — the whole point of the file is
 * that it changes with every deploy. Any failure degrades to
 * {@link UNKNOWN_BUILD_INFO} rather than throwing: this is a diagnostic
 * readout, never a reason to break a page.
 */
export async function fetchBuildInfo(
  fetchImpl: typeof fetch = fetch
): Promise<BuildInfo> {
  try {
    const response = await fetchImpl(BUILD_INFO_URL, { cache: 'no-store' });
    if (!response.ok) return UNKNOWN_BUILD_INFO;
    return parseBuildInfo(await response.json()) ?? UNKNOWN_BUILD_INFO;
  } catch {
    return UNKNOWN_BUILD_INFO;
  }
}

function parseJson(rawJson: string): BuildInfo | null {
  try {
    return parseBuildInfo(JSON.parse(rawJson));
  } catch {
    return null;
  }
}
