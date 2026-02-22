import { inject, InjectionToken, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface FirebaseAuthConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

const defaultConfig: FirebaseAuthConfig = {
  apiKey: 'AIzaSyBKJuLP0MfxgZLg96Ik7BcM2WduzhabYVw',
  authDomain: 'pushup-stats.firebaseapp.com',
  projectId: 'pushup-stats',
  storageBucket: 'pushup-stats.firebasestorage.app',
  messagingSenderId: '1037629324370',
  appId: '1:1037629324370:web:12382b21590a4fba71738b',
  measurementId: 'G-5D32B9B1S6',
};

export function resolveFirebaseAuthConfig(): FirebaseAuthConfig {
  const platformId = inject(PLATFORM_ID);

  if (!isPlatformBrowser(platformId)) {
    // Server-side: return empty config to avoid Firebase init during SSR
    return {
      apiKey: '',
      authDomain: '',
      projectId: '',
      storageBucket: '',
      messagingSenderId: '',
      appId: '',
    };
  }

  // Check for runtime config from window
  const runtimeConfig = (
    globalThis as { __PUS_FIREBASE_AUTH__?: Partial<FirebaseAuthConfig> }
  ).__PUS_FIREBASE_AUTH__;

  return {
    apiKey: runtimeConfig?.apiKey ?? defaultConfig.apiKey,
    authDomain: runtimeConfig?.authDomain ?? defaultConfig.authDomain,
    projectId: runtimeConfig?.projectId ?? defaultConfig.projectId,
    storageBucket: runtimeConfig?.storageBucket ?? defaultConfig.storageBucket,
    messagingSenderId:
      runtimeConfig?.messagingSenderId ?? defaultConfig.messagingSenderId,
    appId: runtimeConfig?.appId ?? defaultConfig.appId,
    measurementId: runtimeConfig?.measurementId ?? defaultConfig.measurementId,
  };
}

export function isFirebaseAuthConfigured(config: FirebaseAuthConfig): boolean {
  return Boolean(
    config.apiKey && config.authDomain && config.projectId && config.appId
  );
}

export const FIREBASE_AUTH_CONFIG = new InjectionToken<FirebaseAuthConfig>(
  'FIREBASE_AUTH_CONFIG',
  {
    factory: resolveFirebaseAuthConfig,
  }
);
