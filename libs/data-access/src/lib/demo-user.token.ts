import { InjectionToken } from '@angular/core';

export const DEMO_USER_ID = new InjectionToken<string>('DEMO_USER_ID', {
  providedIn: 'root',
  factory: () => 'aqgzwSbhudRLrluz1zBSW3XQx013',
});
