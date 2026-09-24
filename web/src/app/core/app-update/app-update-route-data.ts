import type { ActivatedRouteSnapshot, Data } from '@angular/router';

/**
 * Route-data key for pages where a reload would throw away work in progress
 * (a running session, an unsaved editor). While such a page is active the
 * update banner stays hidden and the navigation fallback does not fire.
 */
export const BLOCKS_APP_UPDATE = 'blocksAppUpdate';

export const blocksAppUpdateData: Data = { [BLOCKS_APP_UPDATE]: true };

export function routeBlocksAppUpdate(
  snapshot: ActivatedRouteSnapshot
): boolean {
  if (snapshot.data[BLOCKS_APP_UPDATE] === true) return true;
  return snapshot.children.some(routeBlocksAppUpdate);
}
