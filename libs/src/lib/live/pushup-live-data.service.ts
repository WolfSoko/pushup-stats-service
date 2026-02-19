import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, Signal, inject, signal } from '@angular/core';
import { io } from 'socket.io-client';
import type { PushupRecord } from '@pu-stats/models';

/**
 * Browser-only live data stream for pushups.
 *
 * SSR keeps using REST; this service is guarded via isPlatformBrowser.
 */
@Injectable({ providedIn: 'root' })
export class PushupLiveDataService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly connectedState = signal(false);
  private readonly entriesState = signal<PushupRecord[]>([]);

  readonly connected: Signal<boolean> = this.connectedState.asReadonly();
  readonly entries: Signal<PushupRecord[]> = this.entriesState.asReadonly();

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;

    const socket = io('/', {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    socket.on('connect', () => {
      this.connectedState.set(true);
    });

    socket.on('disconnect', () => {
      this.connectedState.set(false);
    });

    socket.on('pushups:initial', (rows: PushupRecord[] | null | undefined) => {
      this.entriesState.set(rows ?? []);
    });

    socket.on('pushups:changed', (rows: PushupRecord[] | null | undefined) => {
      this.entriesState.set(rows ?? []);
    });
  }
}
