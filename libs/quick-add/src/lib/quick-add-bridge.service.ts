import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class QuickAddBridgeService {
  /** Incremented each time a dialog open is requested. Watch with effect(). */
  readonly openDialogTick = signal(0);

  requestOpenDialog(): void {
    this.openDialogTick.update((t) => t + 1);
  }
}
