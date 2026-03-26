import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class QuickAddBridgeService {
  private readonly openDialogSubject = new Subject<void>();
  readonly openDialog$: Observable<void> = this.openDialogSubject.asObservable();

  requestOpenDialog(): void {
    this.openDialogSubject.next();
  }
}
