/**
 * Uploads a signed Android App Bundle to the Play Console and assigns it to a
 * track.
 *
 * Dry run by default — it validates the bundle and prints what it would do
 * without opening an edit. Writing requires an explicit `--commit`, matching
 * `publish-play-listing.mjs`; unlike a store listing, a release cannot be
 * taken back by re-publishing the previous one, only superseded by a higher
 * versionCode.
 *
 * Setup (service account, permissions, secrets): docs/play-store-publishing.md
 *
 * Usage:
 *   node tools/src/publish-play-release.mjs --bundle=path/to/app.aab
 *   node tools/src/publish-play-release.mjs --bundle=… --track=internal --commit
 */

import { readFileSync, statSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import {
  authorizedFetch,
  buildAuth,
  createEditsApi,
  editsUrl,
  PACKAGE_NAME,
  UPLOAD_ROOT,
} from './play-api.mjs';

/**
 * `internal` is first because it is the only one that reaches no real user:
 * it skips Google's review, is live within minutes, and is where an R8
 * runtime failure is supposed to surface.
 */
export const TRACKS = ['internal', 'alpha', 'beta', 'production'];
const DEFAULT_TRACK = 'internal';

export function parseArgs(argv) {
  const args = { commit: false, track: DEFAULT_TRACK, bundle: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--commit') {
      args.commit = true;
    } else if (arg === '--track' || arg.startsWith('--track=')) {
      const value =
        arg === '--track' ? argv[++i] : arg.slice('--track='.length);
      if (!TRACKS.includes(value)) {
        throw new Error(
          `--track must be one of: ${TRACKS.join(', ')} (got ${JSON.stringify(value ?? '')})`
        );
      }
      args.track = value;
    } else if (arg === '--bundle' || arg.startsWith('--bundle=')) {
      const value =
        arg === '--bundle' ? argv[++i] : arg.slice('--bundle='.length);
      // An empty value must not fall through to a "missing bundle" message
      // that reads like the flag was never passed.
      if (!value || value.trim() === '') {
        throw new Error('--bundle needs a path to the .aab file');
      }
      args.bundle = value.trim();
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!args.bundle) {
    throw new Error(
      '--bundle is required, e.g. --bundle=app/build/…/app-release.aab'
    );
  }
  return args;
}

/**
 * Fails before any network call if the path is not a plausible bundle. Play
 * answers a wrong file with a generic 400 several seconds into an open edit,
 * which then has to be cleaned up — cheaper to catch here.
 */
export function readBundle(
  path,
  { read = readFileSync, stat = statSync } = {}
) {
  if (!path.endsWith('.aab')) {
    throw new Error(
      `${path} is not an .aab — Play takes App Bundles, not APKs, for this app.`
    );
  }
  let size;
  try {
    size = stat(path).size;
  } catch {
    throw new Error(`Bundle not found: ${path}`);
  }
  if (size === 0) {
    throw new Error(`Bundle is empty: ${path}`);
  }
  return { bytes: read(path), size };
}

export function formatSize(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Drives one release against an injected `api`, so the transaction — edit,
 * upload, track assignment, commit, and cleanup on failure — is testable
 * without talking to Google.
 *
 * Returns the versionCode Play recorded for the uploaded bundle.
 */
export async function publishRelease({
  bundle,
  track,
  commit,
  api,
  log = console.log,
}) {
  if (!commit) {
    log(
      `Dry run: would upload ${formatSize(bundle.size)} to the "${track}" track.`
    );
    log('Re-run with --commit to upload for real.');
    return null;
  }

  const edit = await api.createEdit();

  try {
    const uploaded = await api.uploadBundle(edit.id, bundle.bytes);
    log(`Uploaded versionCode ${uploaded.versionCode}.`);

    await api.assignTrack(edit.id, track, uploaded.versionCode);
    await api.commitEdit(edit.id);

    log(
      `Released versionCode ${uploaded.versionCode} to the "${track}" track.`
    );
    return uploaded.versionCode;
  } catch (error) {
    // Leaving an edit open blocks the next run with a conflict, so always try
    // to clean it up — but report the original failure, not the cleanup.
    await api.deleteEdit(edit.id).catch(() => undefined);
    throw error;
  }
}

export function createReleaseApi(auth) {
  return {
    ...createEditsApi(auth),
    uploadBundle: (editId, bytes) =>
      authorizedFetch(
        auth,
        `${UPLOAD_ROOT}/applications/${PACKAGE_NAME}/edits/${editId}/bundles?uploadType=media`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: bytes,
        }
      ),
    assignTrack: (editId, track, versionCode) =>
      authorizedFetch(auth, `${editsUrl}/${editId}/tracks/${track}`, {
        method: 'PUT',
        body: JSON.stringify({
          track,
          releases: [
            { versionCodes: [String(versionCode)], status: 'completed' },
          ],
        }),
      }),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const bundle = readBundle(args.bundle);

  await publishRelease({
    bundle,
    track: args.track,
    commit: args.commit,
    api: createReleaseApi(buildAuth()),
  });
}

// Only run when invoked as a script, so the spec can import the helpers
// without triggering a network call.
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
