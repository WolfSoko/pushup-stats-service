import { isPlatformBrowser } from '@angular/common';
import {
  computed,
  inject,
  Injectable,
  PLATFORM_ID,
  resource,
} from '@angular/core';
import {
  BuildInfo,
  UNKNOWN_BUILD_INFO,
  UNKNOWN_RELEASE,
  fetchBuildInfo,
} from '../../../build-info';

/**
 * Exposes the release the currently served deployment was built from — the
 * `build-info.json` that `tools/src/write-build-info.mjs` puts into the
 * browser bundle.
 *
 * Uses `fetch` rather than `HttpClient` so `main.ts` can reuse the exact same
 * code path to tag Sentry with the release before the SDK is initialised.
 */
@Injectable({ providedIn: 'root' })
export class BuildInfoService {
  private readonly platformId = inject(PLATFORM_ID);

  private readonly buildInfoResource = resource({
    loader: () =>
      isPlatformBrowser(this.platformId)
        ? fetchBuildInfo()
        : Promise.resolve(UNKNOWN_BUILD_INFO),
  });

  readonly buildInfo = computed<BuildInfo>(
    () => this.buildInfoResource.value() ?? UNKNOWN_BUILD_INFO
  );

  /** False while loading and whenever the deployment ships no build metadata. */
  readonly isKnown = computed(
    () => this.buildInfo().release !== UNKNOWN_RELEASE
  );
}
