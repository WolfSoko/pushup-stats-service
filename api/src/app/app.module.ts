import { Module } from '@nestjs/common';
import { PushupLiveGateway } from './live/pushup-live.gateway';
import { PushupDbService } from './pushups/pushup-db.service';
import { PushupsController } from './pushups/pushups.controller';
import { StatsController } from './stats/stats.controller';
import { StatsService } from './stats/stats.service';
import { UserConfigController } from './user/user-config.controller';
import { UserConfigDbService } from './user/user-config-db.service';

@Module({
  controllers: [StatsController, PushupsController, UserConfigController],
  providers: [PushupDbService, UserConfigDbService, StatsService, PushupLiveGateway],
})
export class AppModule {}
