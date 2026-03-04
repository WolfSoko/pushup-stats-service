import express, { type Request, type Response } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { pino } from 'pino';
import pinoHttp from 'pino-http';

const logger = pino({
  name: 'pushup-reverse-proxy',
  level: 'warn',
});

// Host to bind the reverse-proxy listener to (0.0.0.0 inside Docker).
const host = process.env.HOST ?? '127.0.0.1';
const port = process.env.PORT ? Number(process.env.PORT) : 8787;

// Targets (can be service names in docker-compose).
const webHost = process.env.WEB_HOST ?? '127.0.0.1';
const webPort = process.env.WEB_PORT ? Number(process.env.WEB_PORT) : 8789;

const app = express();
app.use(pinoHttp({ logger }));

console.log(`[PushUp Reverse Proxy] Configuration:`);
console.log(`  Proxy Port: ${port}`);
console.log(`  Web Target: http://${webHost}:${webPort}`);

// Web Proxy (forwards all traffic to the SSR server)
const webProxy = createProxyMiddleware<Request, Response>({
  logger: logger,
  target: `http://${webHost}:${webPort}`,
  changeOrigin: true,
  autoRewrite: true,
  on: {
    error: (err) => {
      logger.error(`[Web Proxy Error] ${err.message}`);
      return new Response(null, {
        statusText: 'Proxy Error',
        status: 500,
      });
    },
  },
});

app.use(webProxy);

app.listen(port, host, () => {
  logger.info(`[PushUp Reverse Proxy] Listening on http://${host}:${port}`);
});
