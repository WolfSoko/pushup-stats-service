import { FirebaseOptions } from '@angular/fire/app';

// Placeholder for a dedicated staging Firebase project (for branch/PR deploys).
// Replace ALL values below with credentials from a real, separate staging project
// before enabling staging builds. Leaving these empty strings here intentionally
// causes staging builds to fail fast rather than silently targeting the production project.
export const fireConfig: FirebaseOptions = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
  measurementId: '',
};
