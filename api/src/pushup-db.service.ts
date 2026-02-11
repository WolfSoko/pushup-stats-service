import { Injectable } from '@nestjs/common';
import Datastore from 'nedb-promises';
import fs from 'node:fs';
import path from 'node:path';

export type PushupDoc = {
  _id?: string;
  timestamp: string;
  reps: number;
  source: string;
  type?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

const DEFAULT_DB_PATH = process.env.PUSHUPS_DB_PATH || path.join(process.cwd(), 'data', 'pushups.db');

@Injectable()
export class PushupDbService {
  private readonly db: Datastore<PushupDoc>;

  constructor() {
    const dir = path.dirname(DEFAULT_DB_PATH);
    fs.mkdirSync(dir, { recursive: true });
    this.db = Datastore.create({ filename: DEFAULT_DB_PATH, autoload: true, timestampData: true }) as Datastore<PushupDoc>;
  }

  async findAll(): Promise<PushupDoc[]> {
    const rows = await this.db.find({}).sort({ timestamp: 1 });
    return rows.map((row) => ({ ...row, type: row.type ?? 'Standard' }));
  }

  async findById(id: string): Promise<PushupDoc | null> {
    const row = await this.db.findOne({ _id: id });
    return row ? { ...row, type: row.type ?? 'Standard' } : null;
  }

  async create(input: Omit<PushupDoc, '_id' | 'createdAt' | 'updatedAt'>): Promise<PushupDoc> {
    return this.db.insert({ ...input, type: input.type ?? 'Standard' });
  }

  async update(id: string, patch: Partial<Omit<PushupDoc, '_id' | 'createdAt' | 'updatedAt'>>): Promise<PushupDoc | null> {
    await this.db.update({ _id: id }, { $set: patch });
    return this.findById(id);
  }

  async remove(id: string): Promise<number> {
    return this.db.remove({ _id: id }, {});
  }
}
