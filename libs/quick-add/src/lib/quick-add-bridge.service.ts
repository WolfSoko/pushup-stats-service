import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class QuickAddBridgeService {
  readonly openDialog$ = new Subject<void>();

  requestOpenDialog(): void {
    this.openDialog$.next();
  }
}
