import { DOCUMENT, Location } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';

@Injectable({ providedIn: 'root' })
export class PageReloadService {
  private readonly swUpdate = inject(SwUpdate, { optional: true });
  private readonly document = inject(DOCUMENT);
  private readonly location = inject(Location);
  private reloading = false;

  /**
   * Loads `url` (app-relative, e.g. a router URL) or the current page on the
   * newest cached build.
   *
   * A waiting ngsw version only takes over once every client of the old one
   * is gone — a plain reload is just another navigation against the old
   * worker. `activateUpdate()` has to run first.
   */
  async reload(url?: string): Promise<void> {
    if (this.reloading) return;
    this.reloading = true;
    if (this.swUpdate?.isEnabled) {
      try {
        await this.swUpdate.activateUpdate();
      } catch {
        // Nothing to activate (e.g. the cached version is gone) — the reload
        // then fetches the current build from the network.
      }
    }
    const location = this.document.location;
    if (url === undefined) location.reload();
    else location.assign(this.location.prepareExternalUrl(url));
  }
}
