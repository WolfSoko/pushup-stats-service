import { Injectable } from '@nestjs/common';
import Datastore from 'nedb-promises';
import fs from 'node:fs';
import path from 'node:path';

export type UserConfigDoc = {
  _id?: string;
  userId: string;
  displayName?: string;
  dailyGoal?: number;
  ui?: {
    showSourceColumn?: boolean;
  };
  createdAt?: Date;
  updatedAt?: Date;
};

const DEFAULT_DB_PATH =
  process.env.USER_CONFIG_DB_PATH || path.join(process.cwd(), 'data', 'user-config.db');

@Injectable()
export class UserConfigDbService {
  private readonly db: Datastore<UserConfigDoc>;

  constructor() {
    const dir = path.dirname(DEFAULT_DB_PATH);
    fs.mkdirSync(dir, { recursive: true });
    this.db = Datastore.create({ filename: DEFAULT_DB_PATH, autoload: true, timestampData: true }) as Datastore<UserConfigDoc>;

    // Ensure we have at most one config per user.
    void this.db.ensureIndex({ fieldName: 'userId', unique: true });
  }

  async getByUserId(userId: string): Promise<UserConfigDoc | null> {
    return this.db.findOne({ userId });
  }

  async upsert(userId: string, patch: Partial<Omit<UserConfigDoc, '_id' | 'userId' | 'createdAt' | 'updatedAt'>>): Promise<UserConfigDoc> {
    await this.db.update(
      { userId },
      {
        $set: {
          ...patch,
        },
        $setOnInsert: { userId },
      } as any,
      { upsert: true },
    );

    const doc = await this.getByUserId(userId);
    if (!doc) {
      // Should not happen, but keep API deterministic.
      return { userId };
    }
    return doc;
  }
}
