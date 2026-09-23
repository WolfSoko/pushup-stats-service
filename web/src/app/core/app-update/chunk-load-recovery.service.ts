import { isPlatformBrowser } from '@angular/common';
import { DestroyRef, inject, Injectable, PLATFORM_ID } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationError, Router } from '@angular/router';
import { filter } from 'rxjs';
import { PageReloadService } from './page-reload.service';

export const CHUNK_RELOAD_STORAGE_KEY = 'pu.chunkReloadAt';
export const CHUNK_RELOAD_MIN_INTERVAL_MS = 60 * 1000;

const CHUNK_LOAD_ERROR =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk [\w-]+ failed/i;

export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const text =
    error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return CHUNK_LOAD_ERROR.test(text);
}

/**
 * Without an active service worker (first visit, private mode) nothing keeps
 * the old build's lazy chunks around, so the first lazy route after a deploy
 * fails to load. A full page load of the target URL fetches the new build.
 */
@Injectable({ providedIn: 'root' })
export class ChunkLoadRecoveryService {
  private readonly reloader = inject(PageReloadService);

  constructor() {
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;
    inject(Router)
      .events.pipe(
        filter((event) => event instanceof NavigationError),
        filter((event) => isChunkLoadError(event.error)),
        takeUntilDestroyed(inject(DestroyRef))
      )
      .subscribe((event) => this.recover(event.url));
  }

  private recover(url: string): void {
    // A chunk that is still missing after a fresh load is a broken deploy,
    // not a stale page — reloading again would loop.
    const now = Date.now();
    if (now - readLastReloadAt() < CHUNK_RELOAD_MIN_INTERVAL_MS) return;
    // Without a stored timestamp nothing would stop the next page from
    // reloading again, so an unprotected reload is worse than none.
    if (!writeLastReloadAt(now)) return;
    void this.reloader.reload(url);
  }
}

function readLastReloadAt(): number {
  try {
    return Number(sessionStorage.getItem(CHUNK_RELOAD_STORAGE_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeLastReloadAt(at: number): boolean {
  try {
    sessionStorage.setItem(CHUNK_RELOAD_STORAGE_KEY, String(at));
    return true;
  } catch {
    return false;
  }
}
