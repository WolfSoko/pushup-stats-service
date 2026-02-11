import { Injectable, PLATFORM_ID, Signal, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { io } from 'socket.io-client';

@Injectable({ providedIn: 'root' })
export class PushupLiveService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly tick = signal(0);
  private readonly connectedState = signal(false);

  readonly updateTick: Signal<number> = this.tick.asReadonly();
  readonly connected: Signal<boolean> = this.connectedState.asReadonly();

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
      this.tick.update((v) => v + 1);
    });

    socket.on('disconnect', () => {
      this.connectedState.set(false);
    });

    socket.on('pushups:changed', () => {
      this.tick.update((v) => v + 1);
    });
  }
}
