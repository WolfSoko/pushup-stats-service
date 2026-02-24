export type User = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  providerId: AuthProvider;
  isAnonymous: boolean;
}

export type AuthProvider =
  | 'google'
  | 'email';

