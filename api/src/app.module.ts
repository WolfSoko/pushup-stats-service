import { Module } from '@nestjs/common';
import { PushupDbService } from './pushup-db.service';
import { PushupsController } from './pushups.controller';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';
import { UserConfigController } from './user-config.controller';
import { UserConfigDbService } from './user-config-db.service';

@Module({
  controllers: [StatsController, PushupsController, UserConfigController],
  providers: [PushupDbService, UserConfigDbService, StatsService],
})
export class AppModule {}
