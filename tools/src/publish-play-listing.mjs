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
    if (arg === '--commit') {
      args.commit = true;
    } else if (arg === '--locale' || arg.startsWith('--locale=')) {
      const value =
        arg === '--locale' ? argv[++i] : arg.slice('--locale='.length);
      // A blank value must not silently widen the run to every locale — on
      // the --commit path that is the difference between publishing one
      // language and publishing all of them.
      if (!value || value.trim() === '') {
        throw new Error('--locale needs a value, e.g. --locale=de-DE');
      }
      args.locale = value.trim();
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
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

/**
 * `edits.listings.update` is a full replace: any field missing from the body
 * is cleared on the remote listing. The promo video is maintained by hand in
 * the Console and this tool has no source for it, so it has to be carried
 * over from the remote listing or a text change would silently wipe it.
 */
export function buildUpdateBody(local, remote) {
  const body = {
    language: local.language,
    title: local.title,
    shortDescription: local.shortDescription,
    fullDescription: local.fullDescription,
  };
  if (remote?.video) {
    body.video = remote.video;
  }
  return body;
}

function summarize(value) {
  if (value === '') return '(empty)';
  const firstLine = value.split('\n')[0];
  const suffix = value.includes('\n') ? ' …' : '';
  return `${JSON.stringify(firstLine.slice(0, 72))}${suffix} [${countCharacters(value)} chars]`;
}

/**
 * Drives one publish run against an injected `api`, so the transaction —
 * edit creation, per-locale diff, update, commit, and cleanup on failure —
 * is testable without talking to Google.
 *
 * Returns the number of locales that differed from the live listing.
 */
export async function publishListings({
  listings,
  commit,
  api,
  log = console.log,
}) {
  const edit = await api.createEdit();
  let changedLocales = 0;

  try {
    for (const listing of listings) {
      const remote = await api.getListing(edit.id, listing.language);
      const changes = diffListing(listing, remote);

      if (changes.length === 0) {
        log(`${listing.language}: unchanged`);
        continue;
      }

      changedLocales++;
      log(`${listing.language}: ${changes.length} field(s) changed`);
      for (const { field, before, after } of changes) {
        log(`  ${field}`);
        log(`    - ${summarize(before)}`);
        log(`    + ${summarize(after)}`);
      }

      if (commit) {
        await api.updateListing(edit.id, buildUpdateBody(listing, remote));
      }
    }

    if (!commit || changedLocales === 0) {
      await api.deleteEdit(edit.id);
      log(
        changedLocales === 0
          ? '\nNothing to do — the live listing already matches the sources.'
          : `\nDry run: ${changedLocales} locale(s) would change. Re-run with --commit to publish.`
      );
      return changedLocales;
    }

    await api.commitEdit(edit.id);
    log(
      `\nPublished ${changedLocales} locale(s). Google reviews store-listing changes before they go live.`
    );
    return changedLocales;
  } catch (error) {
    // Leaving an edit open blocks the next run with a conflict, so always
    // try to clean it up — but report the original failure, not the cleanup.
    await api.deleteEdit(edit.id).catch(() => undefined);
    throw error;
  }
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
    const error = new Error(
      `${init.method ?? 'GET'} ${url} → ${response.status}\n${body}`
    );
    error.status = response.status;
    throw error;
  }

  return response.status === 204 ? null : response.json();
}

function createPlayApi(auth) {
  const editsUrl = `${API_ROOT}/applications/${PACKAGE_NAME}/edits`;
  const listingUrl = (editId, language) =>
    `${editsUrl}/${editId}/listings/${language}`;

  return {
    createEdit: () => authorizedFetch(auth, editsUrl, { method: 'POST' }),
    getListing: async (editId, language) => {
      try {
        return await authorizedFetch(auth, listingUrl(editId, language));
      } catch (error) {
        // A locale with no listing yet 404s; that's a create, not a failure.
        if (error.status === 404) return null;
        throw error;
      }
    },
    updateListing: (editId, body) =>
      authorizedFetch(auth, listingUrl(editId, body.language), {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    commitEdit: (editId) =>
      authorizedFetch(auth, `${editsUrl}/${editId}:commit`, { method: 'POST' }),
    deleteEdit: (editId) =>
      authorizedFetch(auth, `${editsUrl}/${editId}`, { method: 'DELETE' }),
  };
}

export function buildAuth(env = process.env) {
  const raw = env[CREDENTIALS_ENV];
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

export function selectListings(all, locale) {
  if (!locale) return all;
  const selected = all.filter((listing) => listing.language === locale);
  if (selected.length === 0) {
    throw new Error(
      `No listing found for locale ${locale} — known locales: ${all.map((l) => l.language).join(', ')}`
    );
  }
  return selected;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  // Validation runs before any network call, so bad copy fails fast and
  // never leaves a dangling edit behind in the Console.
  const listings = selectListings(readListings(), args.locale);

  await publishListings({
    listings,
    commit: args.commit,
    api: createPlayApi(buildAuth()),
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
