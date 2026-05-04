import { InjectionToken } from '@angular/core';

export const DEMO_USER_ID = new InjectionToken<string>('DEMO_USER_ID', {
  providedIn: 'root',
  factory: () => '9CrETSHzoKcPPw0ctHKM1OiyRrp2',
});
