import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { UserConfigDbService } from './user-config-db.service';

@Controller('api/users/:userId/config')
export class UserConfigController {
  constructor(private readonly db: UserConfigDbService) {}

  @Get()
  async get(@Param('userId') userId: string) {
    const existing = await this.db.getByUserId(userId);
    return (
      existing ?? {
        userId,
        displayName: '',
        dailyGoal: 100,
        ui: { showSourceColumn: false },
      }
    );
  }

  @Put()
  async put(
    @Param('userId') userId: string,
    @Body()
    body: {
      displayName?: string;
      dailyGoal?: number;
      ui?: { showSourceColumn?: boolean };
    },
  ) {
    const dailyGoal = typeof body.dailyGoal === 'number' ? Number(body.dailyGoal) : undefined;

    return this.db.upsert(userId, {
      ...(typeof body.displayName !== 'undefined' ? { displayName: String(body.displayName) } : {}),
      ...(typeof dailyGoal !== 'undefined' ? { dailyGoal } : {}),
      ...(typeof body.ui !== 'undefined' ? { ui: body.ui } : {}),
    });
  }
}
