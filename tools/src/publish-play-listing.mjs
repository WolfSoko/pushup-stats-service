/**
 * Pushes `store/play/<locale>/*.txt` to the Google Play Console via the
 * Play Developer API.
 *
 * Dry run by default — it reads the live listing, prints a diff and exits
 * without opening an edit. Writing requires an explicit `--commit`, because
 * a committed listing goes into Google's review queue and there is no undo
 * beyond publishing the previous text again.
 *
 * Setup (service account, permissions, secret): docs/play-store-publishing.md
 *
 * Usage:
 *   node tools/src/publish-play-listing.mjs               # diff only
 *   node tools/src/publish-play-listing.mjs --commit      # actually publish
 *   node tools/src/publish-play-listing.mjs --locale de-DE
 */

import { pathToFileURL } from 'node:url';
import { GoogleAuth } from 'google-auth-library';
import {
  FIELD_FILES,
  countCharacters,
  readListings,
} from './play-listing-source.mjs';

const PACKAGE_NAME = 'com.pushupstats.app';
const API_ROOT = 'https://androidpublisher.googleapis.com/androidpublisher/v3';
const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
const CREDENTIALS_ENV = 'GOOGLE_PLAY_SERVICE_ACCOUNT_JSON';

export function parseArgs(argv) {
  const args = { commit: false, locale: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--commit') args.commit = true;
    else if (arg === '--locale') args.locale = argv[++i] ?? null;
    else if (arg.startsWith('--locale='))
      args.locale = arg.slice('--locale='.length);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

/**
 * Field-level comparison between what's on disk and what's live. Only
 * changed fields are reported — Play accepts a full listing object on every
 * update, but showing unchanged copy in the diff buries the real change.
 */
export function diffListing(local, remote) {
  const changes = [];
  for (const field of Object.keys(FIELD_FILES)) {
    const before = remote?.[field] ?? '';
    const after = local[field];
    if (before !== after) {
      changes.push({ field, before, after });
    }
  }
  return changes;
}

function summarize(value) {
  if (value === '') return '(empty)';
  const firstLine = value.split('\n')[0];
  const suffix = value.includes('\n') ? ' …' : '';
  return `${JSON.stringify(firstLine.slice(0, 72))}${suffix} [${countCharacters(value)} chars]`;
}

async function authorizedFetch(auth, url, init = {}) {
  const client = await auth.getClient();
  const { token } = await client.getAccessToken();
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `${init.method ?? 'GET'} ${url} → ${response.status}\n${body}`
    );
  }

  return response.status === 204 ? null : response.json();
}

function buildAuth() {
  const raw = process.env[CREDENTIALS_ENV];
  if (!raw) {
    throw new Error(
      `${CREDENTIALS_ENV} is not set. See docs/play-store-publishing.md for how to create the service account and store its key.`
    );
  }

  let credentials;
  try {
    credentials = JSON.parse(raw);
  } catch {
    throw new Error(
      `${CREDENTIALS_ENV} is not valid JSON — paste the whole service-account key file.`
    );
  }

  return new GoogleAuth({ credentials, scopes: [SCOPE] });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Validation runs before any network call, so bad copy fails fast and
  // never leaves a dangling edit behind in the Console.
  let listings = readListings();
  if (args.locale) {
    listings = listings.filter((l) => l.language === args.locale);
    if (listings.length === 0) {
      throw new Error(`No listing found for locale ${args.locale}`);
    }
  }

  const auth = buildAuth();
  const editsUrl = `${API_ROOT}/applications/${PACKAGE_NAME}/edits`;
  const edit = await authorizedFetch(auth, editsUrl, { method: 'POST' });
  const editBase = `${editsUrl}/${edit.id}`;

  let changedLocales = 0;
  try {
    for (const listing of listings) {
      const { language, ...fields } = listing;

      let remote = null;
      try {
        remote = await authorizedFetch(
          auth,
          `${editBase}/listings/${language}`
        );
      } catch (error) {
        // A locale with no listing yet 404s; that's a create, not a failure.
        if (!/→ 404/.test(String(error.message))) throw error;
      }

      const changes = diffListing(listing, remote);
      if (changes.length === 0) {
        console.log(`${language}: unchanged`);
        continue;
      }

      changedLocales++;
      console.log(`${language}: ${changes.length} field(s) changed`);
      for (const { field, before, after } of changes) {
        console.log(`  ${field}`);
        console.log(`    - ${summarize(before)}`);
        console.log(`    + ${summarize(after)}`);
      }

      if (args.commit) {
        await authorizedFetch(auth, `${editBase}/listings/${language}`, {
          method: 'PUT',
          body: JSON.stringify({ language, ...fields }),
        });
      }
    }

    if (!args.commit) {
      await authorizedFetch(auth, editBase, { method: 'DELETE' });
      console.log(
        changedLocales === 0
          ? '\nDry run: live listing already matches the sources.'
          : `\nDry run: ${changedLocales} locale(s) would change. Re-run with --commit to publish.`
      );
      return;
    }

    if (changedLocales === 0) {
      await authorizedFetch(auth, editBase, { method: 'DELETE' });
      console.log(
        '\nNothing to publish — live listing already matches the sources.'
      );
      return;
    }

    await authorizedFetch(auth, `${editBase}:commit`, { method: 'POST' });
    console.log(
      `\nPublished ${changedLocales} locale(s). Google reviews store-listing changes before they go live.`
    );
  } catch (error) {
    // Leaving an edit open blocks the next run with a conflict, so always
    // try to clean it up — but report the original failure, not the cleanup.
    await authorizedFetch(auth, editBase, { method: 'DELETE' }).catch(
      () => undefined
    );
    throw error;
  }
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
