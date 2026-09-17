/**
 * Shared Play Developer API plumbing: the credentials, the authorised fetch,
 * and the edit transaction every publishing tool wraps its work in.
 *
 * Split out of `publish-play-listing.mjs` once the release uploader needed the
 * same three pieces, so there is one answer to "how do we talk to Play" and a
 * fix to the auth or the error handling reaches both callers.
 *
 * Setup (service account, permissions, secret): docs/play-store-publishing.md
 */

import { GoogleAuth } from 'google-auth-library';

export const PACKAGE_NAME = 'com.pushupstats.app';
export const API_ROOT =
  'https://androidpublisher.googleapis.com/androidpublisher/v3';
/** Media uploads go to a separate host prefix; the edit id is the same. */
export const UPLOAD_ROOT =
  'https://androidpublisher.googleapis.com/upload/androidpublisher/v3';
export const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
export const CREDENTIALS_ENV = 'GOOGLE_PLAY_SERVICE_ACCOUNT_JSON';

export const editsUrl = `${API_ROOT}/applications/${PACKAGE_NAME}/edits`;

/**
 * Adds the bearer token and turns a non-OK response into an Error carrying
 * `status`, which callers read to tell an expected absence (404) from a real
 * failure such as a missing permission (403).
 *
 * `Content-Type` defaults to JSON but is overridable: a bundle upload sends
 * octet-stream with a binary body through this same path.
 */
export async function authorizedFetch(auth, url, init = {}) {
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

/**
 * The three calls that bracket every change: Play has no partial writes, only
 * an edit that is committed or thrown away.
 */
export function createEditsApi(auth) {
  return {
    createEdit: () => authorizedFetch(auth, editsUrl, { method: 'POST' }),
    commitEdit: (editId) =>
      authorizedFetch(auth, `${editsUrl}/${editId}:commit`, { method: 'POST' }),
    deleteEdit: (editId) =>
      authorizedFetch(auth, `${editsUrl}/${editId}`, { method: 'DELETE' }),
  };
}
