import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
}

const emptyConfig: FirebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  appId: '',
};

export function resolveFirebaseConfig(): FirebaseConfig {
  const platformId = inject(PLATFORM_ID);
  if (!isPlatformBrowser(platformId)) return emptyConfig;

  const config = (globalThis as { __PUS_FIREBASE__?: Partial<FirebaseConfig> })
    .__PUS_FIREBASE__;

  return {
    apiKey: config?.apiKey ?? '',
    authDomain: config?.authDomain ?? '',
    projectId: config?.projectId ?? '',
    appId: config?.appId ?? '',
  };
}

export function isFirebaseConfigured(config: FirebaseConfig): boolean {
  return Boolean(config.apiKey && config.authDomain && config.projectId);
}
