import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

export {
  aggregateDaily,
  aggregateHourly,
  buildStats,
  CSV_PATH,
  parseCsv,
  PushupEntry,
  SeriesEntry,
  WORKSPACE,
} from './stats.core';

const PORT = Number(process.env.PORT || 8787);
const WEB_DIST_PATH = process.env.WEB_DIST_PATH || path.join(process.cwd(), 'dist', 'web', 'browser');

export async function createApp() {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });
  app.enableCors();

  if (fs.existsSync(WEB_DIST_PATH)) {
    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.use(express.static(WEB_DIST_PATH));
    expressApp.get('*', (_req: any, res: any) => {
      res.sendFile(path.join(WEB_DIST_PATH, 'index.html'));
    });
  }

  return app;
}

export async function startServer() {
  const app = await createApp();
  await app.listen(PORT, '127.0.0.1');
  console.log(`pushup api listening on http://127.0.0.1:${PORT}`);
  console.log(`Web path: ${WEB_DIST_PATH}`);
}

if (require.main === module) {
  void startServer();
}
