import { Injectable } from '@nestjs/common';
import { buildStats } from './stats.core';
import { PushupDbService } from '../pushups/pushup-db.service';

@Injectable()
export class StatsService {
  constructor(private readonly db: PushupDbService) {}

  getHealth() {
    return { ok: true, storage: 'nedb' };
  }

  async getStats(from: string | null, to: string | null) {
    const rows = await this.db.findAll();
    return buildStats(rows.map((r) => ({ timestamp: r.timestamp, reps: r.reps, source: r.source })), from, to);
  }
}
