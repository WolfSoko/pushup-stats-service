export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  providerId: string;
  isAnonymous: boolean;
}

export type AuthProvider =
  | 'google'
  | 'microsoft'
  | 'github'
  | 'apple'
  | 'email';

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: Error | null;
}
