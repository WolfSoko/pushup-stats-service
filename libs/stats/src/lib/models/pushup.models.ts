export interface PushupRecord {
  _id: string;
  timestamp: string;
  reps: number;
  source: string;
  type?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PushupCreate {
  timestamp: string;
  reps: number;
  source?: string;
  type?: string;
}

export interface PushupUpdate {
  timestamp?: string;
  reps?: number;
  source?: string;
  type?: string;
}
