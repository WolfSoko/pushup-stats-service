import { Injectable, PLATFORM_ID, Signal, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { io } from 'socket.io-client';

@Injectable({ providedIn: 'root' })
export class PushupLiveService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly tick = signal(0);

  readonly updateTick: Signal<number> = this.tick.asReadonly();

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;

    const socket = io('/', {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
    });

    socket.on('pushups:changed', () => {
      this.tick.update((v) => v + 1);
    });
  }
}
