import { Injectable } from '@nestjs/common';
import fs from 'node:fs';
import path from 'node:path';
import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

export type PushupDoc = {
  _id?: string;
  userId?: string;
  timestamp: string;
  reps: number;
  source: string;
  type?: string;
  createdAt?: string;
  updatedAt?: string;
};

const DEFAULT_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'pushup-stats';
const DEFAULT_SERVICE_ACCOUNT_PATH =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  path.join(
    process.env.HOME || '/home/wolf',
    '.firebase',
    'pushup-stats-firebase-adminsdk-fbsvc-e502979fa7.json'
  );

@Injectable()
export class PushupDbService {
  private readonly db: Firestore;

  constructor() {
    if (getApps().length === 0) {
      const credential = fs.existsSync(DEFAULT_SERVICE_ACCOUNT_PATH)
        ? cert(
            JSON.parse(fs.readFileSync(DEFAULT_SERVICE_ACCOUNT_PATH, 'utf8'))
          )
        : applicationDefault();

      initializeApp({
        credential,
        projectId: DEFAULT_PROJECT_ID,
      });
    }

    this.db = getFirestore();
  }

  async findAll(): Promise<PushupDoc[]> {
    const snap = await this.db
      .collection('pushups')
      .orderBy('timestamp', 'asc')
      .get();
    return snap.docs.map((d) => this.mapDoc(d.id, d.data()));
  }

  async findById(id: string): Promise<PushupDoc | null> {
    const doc = await this.db.collection('pushups').doc(id).get();
    if (!doc.exists) return null;
    return this.mapDoc(doc.id, doc.data() || {});
  }

  async create(
    input: Omit<PushupDoc, '_id' | 'createdAt' | 'updatedAt'>
  ): Promise<PushupDoc> {
    const now = new Date().toISOString();
    const ref = this.db.collection('pushups').doc();
    const payload = {
      userId: input.userId ?? 'default',
      timestamp: input.timestamp,
      reps: Number(input.reps),
      source: input.source,
      type: input.type ?? 'Standard',
      createdAt: now,
      updatedAt: now,
    };

    await ref.set(payload);
    return { _id: ref.id, ...payload };
  }

  async update(
    id: string,
    patch: Partial<Omit<PushupDoc, '_id' | 'createdAt' | 'updatedAt'>>
  ): Promise<PushupDoc | null> {
    const ref = this.db.collection('pushups').doc(id);
    const current = await ref.get();
    if (!current.exists) return null;

    const nextPatch: Record<string, unknown> = {
      ...patch,
      ...(typeof patch.reps !== 'undefined'
        ? { reps: Number(patch.reps) }
        : {}),
      updatedAt: new Date().toISOString(),
    };

    await ref.set(nextPatch, { merge: true });
    const updated = await ref.get();
    return this.mapDoc(updated.id, updated.data() || {});
  }

  async remove(id: string): Promise<number> {
    const ref = this.db.collection('pushups').doc(id);
    const current = await ref.get();
    if (!current.exists) return 0;
    await ref.delete();
    return 1;
  }

  private mapDoc(id: string, data: Record<string, any>): PushupDoc {
    return {
      _id: id,
      userId: data.userId ?? 'default',
      timestamp: String(data.timestamp),
      reps: Number(data.reps),
      source: String(data.source ?? 'api'),
      type: String(data.type ?? 'Standard'),
      createdAt:
        typeof data.createdAt === 'string' ? data.createdAt : undefined,
      updatedAt:
        typeof data.updatedAt === 'string' ? data.updatedAt : undefined,
    };
  }
}
