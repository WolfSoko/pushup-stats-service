import { FirebaseOptions } from '@angular/fire/app';

// Staging Firebase project – used for PR preview deployments.
// Functions, Firestore rules & indexes are deployed to this project on every PR.
export const fireConfig: FirebaseOptions = {
  apiKey: 'AIzaSyDUkcc6fgmfwOWOl1C96rxu8hn2EdOFpmM',
  authDomain: 'pushup-stats-staging-867b7.firebaseapp.com',
  projectId: 'pushup-stats-staging-867b7',
  storageBucket: 'pushup-stats-staging-867b7.firebasestorage.app',
  messagingSenderId: '914326002953',
  appId: '1:914326002953:web:650a7ba6e76b321861c7d8',
  measurementId: 'G-P4JYPH70KC',
};
