import { Body, Controller, Delete, Get, NotFoundException, Param, Post, Put } from '@nestjs/common';
import { PushupDbService } from './pushup-db.service';

@Controller('api/pushups')
export class PushupsController {
  constructor(private readonly db: PushupDbService) {}

  @Get()
  async list() {
    return this.db.findAll();
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    const doc = await this.db.findById(id);
    if (!doc) throw new NotFoundException('Pushup entry not found');
    return doc;
  }

  @Post()
  async create(@Body() body: { timestamp: string; reps: number; source?: string; type?: string }) {
    return this.db.create({
      timestamp: body.timestamp,
      reps: Number(body.reps),
      source: body.source ?? 'api',
      type: body.type ?? 'Standard',
    });
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: { timestamp?: string; reps?: number; source?: string; type?: string }) {
    const updated = await this.db.update(id, {
      ...(body.timestamp ? { timestamp: body.timestamp } : {}),
      ...(typeof body.reps !== 'undefined' ? { reps: Number(body.reps) } : {}),
      ...(typeof body.source !== 'undefined' ? { source: body.source } : {}),
      ...(typeof body.type !== 'undefined' ? { type: body.type } : {}),
    });

    if (!updated) throw new NotFoundException('Pushup entry not found');
    return updated;
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const removed = await this.db.remove(id);
    if (!removed) throw new NotFoundException('Pushup entry not found');
    return { ok: true };
  }
}
