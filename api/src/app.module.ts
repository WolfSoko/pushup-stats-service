import { Module } from '@nestjs/common';
import { PushupDbService } from './pushup-db.service';
import { PushupsController } from './pushups.controller';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

@Module({
  controllers: [StatsController, PushupsController],
  providers: [PushupDbService, StatsService],
})
export class AppModule {}
