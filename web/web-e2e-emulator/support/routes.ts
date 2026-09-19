import { TARGET } from './backend';

/**
 * What every in-app path has to be prefixed with on the backend under
 * test.
 *
 * Hosting serves the app only under a locale folder: `firebase.json`
 * rewrites `/de{,/**}` … `/zh{,/**}` and redirects `/` to `/de`, so a
 * locale-less path is a plain 404 on the staging preview. The dev
 * server used against the emulators builds a single locale and serves
 * it at the root, so there the prefix is empty.
 *
 * This cannot live in `baseURL`: Playwright resolves a leading-slash
 * `goto()` against the origin and drops whatever path the base URL
 * carried.
 */
export const ROUTE_PREFIX = TARGET === 'staging' ? '/de' : '';

/**
 * The prefixed path for an app route. `/` keeps its trailing slash,
 * which the localized build's `<base href="/de/">` needs to recognise
 * the URL as the app root.
 */
export function appPath(path: string): string {
  if (!ROUTE_PREFIX) return path;
  return path === '/' ? `${ROUTE_PREFIX}/` : `${ROUTE_PREFIX}${path}`;
}
