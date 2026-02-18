import { Controller, Get, Header, Query } from '@nestjs/common';
import { StatsService } from './stats.service';

@Controller()
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('health')
  getHealth() {
    return this.statsService.getHealth();
  }

  @Get('stats')
  @Header('Cache-Control', 'no-store')
  async getStats(@Query('from') from?: string, @Query('to') to?: string) {
    return this.statsService.getStats(from ?? null, to ?? null);
  }
}
