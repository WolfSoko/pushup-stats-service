import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  doc,
  getDoc,
  setDoc,
  DocumentReference,
} from '@angular/fire/firestore';
import { UserConfig, UserConfigUpdate } from '@pu-stats/models';
import { Observable, from, map } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class UserConfigFirestoreService {
  private readonly firestore = inject(Firestore);

  getConfig(userId: string): Observable<UserConfig | undefined> {
    const ref = doc(
      this.firestore,
      'userConfigs',
      userId
    ) as DocumentReference<UserConfig>;
    return from(getDoc(ref)).pipe(
      map((snapshot) =>
        snapshot.exists() ? (snapshot.data() as UserConfig) : undefined
      )
    );
  }

  updateConfig(userId: string, patch: UserConfigUpdate): Promise<void> {
    const ref = doc(
      this.firestore,
      'userConfigs',
      userId
    ) as DocumentReference<UserConfig>;
    return setDoc(ref, patch as Partial<UserConfig>, { merge: true });
  }

  setConfig(userId: string, config: UserConfig): Promise<void> {
    const ref = doc(
      this.firestore,
      'userConfigs',
      userId
    ) as DocumentReference<UserConfig>;
    return setDoc(ref, config);
  }
}
