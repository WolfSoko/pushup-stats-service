import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { DestroyRef, inject, Injectable, PLATFORM_ID } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { filter, fromEvent, interval, merge } from 'rxjs';
import { routeBlocksAppUpdate } from './app-update-route-data';
import { AppUpdateStore } from './app-update.store';
import { PageReloadService } from './page-reload.service';

export const APP_UPDATE_POLL_INTERVAL_MS = 30 * 60 * 1000;
export const APP_UPDATE_CHECK_THROTTLE_MS = 5 * 60 * 1000;

/**
 * Wires ngsw into `AppUpdateStore`: detects new versions, polls for them in
 * long-lived sessions, and swaps the next safe navigation for a full page
 * load when the user ignored the banner.
 */
@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  private readonly swUpdate = inject(SwUpdate, { optional: true });
  private readonly store = inject(AppUpdateStore);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly reloader = inject(PageReloadService);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  // ngsw checks once on registration, so the first check of our own can wait.
  private lastCheckAt = Date.now();

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    this.trackRouteBlocking();

    const swUpdate = this.swUpdate;
    if (!swUpdate?.isEnabled) return;

    swUpdate.versionUpdates
      .pipe(
        // VERSION_DETECTED only means the download started; reloading then
        // would land on the old build again.
        filter((event) => event.type === 'VERSION_READY'),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => this.store.markReady());

    swUpdate.unrecoverable
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.store.markUnrecoverable());

    // ngsw never re-checks on its own, and installed PWA/TWA sessions are
    // resumed rather than restarted. Background tabs throttle timers, so the
    // visibility hook is what reaches an app resumed hours after a deploy.
    merge(
      interval(APP_UPDATE_POLL_INTERVAL_MS),
      fromEvent(this.document, 'visibilitychange').pipe(
        filter(() => this.document.visibilityState === 'visible')
      )
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.checkForUpdate());

    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationStart),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((event) => this.reloadInsteadOfNavigating(event.url));
  }

  private trackRouteBlocking(): void {
    const update = () =>
      this.store.setRouteBlocksUpdate(
        routeBlocksAppUpdate(this.router.routerState.snapshot.root)
      );
    update();
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(update);
  }

  private checkForUpdate(): void {
    if (this.store.updatePending()) return;
    const now = Date.now();
    if (now - this.lastCheckAt < APP_UPDATE_CHECK_THROTTLE_MS) return;
    this.lastCheckAt = now;
    this.swUpdate?.checkForUpdate().catch(() => undefined);
  }

  // At NavigationStart the router state still describes the page being left,
  // which is the one whose work a reload would destroy.
  private reloadInsteadOfNavigating(url: string): void {
    if (!this.store.updatePending()) return;
    if (this.store.routeBlocksUpdate()) return;
    if (this.dialog.openDialogs.length > 0) return;
    // Filters and tabs rewrite query params on the same page; reloading
    // there would feel like the page broke rather than moved on.
    if (pathOf(url) === pathOf(this.router.url)) return;
    void this.reloader.reload(url);
  }
}

function pathOf(url: string): string {
  return url.split(/[?#]/, 1)[0];
}
