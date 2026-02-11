import { Injectable } from '@nestjs/common';
import { buildStats, parseCsv } from './stats.core';

@Injectable()
export class StatsService {
  getHealth() {
    return { ok: true };
  }

  getStats(from: string | null, to: string | null) {
    const rows = parseCsv();
    return buildStats(rows, from, to);
  }
}
