import express, { type Request, type Response } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { pino } from 'pino';
import pinoHttp from 'pino-http';

const logger = pino({
  name: 'pushup-reverse-proxy',
  level: 'warn',
});

const host = process.env.HOST ?? '127.0.0.1';
const port = process.env.PORT ? Number(process.env.PORT) : 8787;
const apiPort = process.env.API_PORT ? Number(process.env.API_PORT) : 8788;
const webPort = process.env.WEB_PORT ? Number(process.env.WEB_PORT) : 8789;

const app = express();
app.use(pinoHttp({ logger }));

console.log(`[PushUp Reverse Proxy] Configuration:`);
console.log(`  Proxy Port: ${port}`);
console.log(`  API Target: http://${host}:${apiPort}`);
console.log(`  Web Target: http://${host}:${webPort}`);

// 1. API Proxy
const apiProxy = createProxyMiddleware<Request, Response>({
  logger: logger,
  target: `http://${host}:${apiPort}/api`,
  changeOrigin: true,
  on: {
    error: (err) => {
      logger.error(`[API Proxy Error] ${err.message}`);
      return new Response(null, {
        statusText: 'Proxy Error',
        status: 500,
      });
    },
  },
});

// 2. Socket.io Proxy (Goes to API Port 8788)
const wsProxy = createProxyMiddleware({
  pathFilter: (path: string) => {
    return path.startsWith('/socket.io');
  },
  target: `http://${host}:${apiPort}/socket.io`,
  logger: logger,
  changeOrigin: true,
  autoRewrite: true,
  ws: true,
  on: {
    error: (err) => {
      logger.error(`[WS Proxy Error] ${err.message}`);
      return new Response(null, {
        statusText: 'Proxy Error',
        status: 500,
      });
    },
  },
});

// 3. Web Proxy (Goes to Web Port 8789, includes HMR)
const webProxy = createProxyMiddleware<Request, Response>({
  pathFilter: (path: string) => {
    return !path.startsWith('/socket.io') && !path.startsWith('/api');
  },
  logger: logger,
  target: `http://${host}:${webPort}`,
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

app.use('/api', apiProxy);
app.use('/socket.io', wsProxy);
app.use(webProxy);

const server = app.listen(port, host, () => {
  logger.info(`[PushUp Reverse Proxy] Listening on http://${host}:${port}`);
});

server.on('upgrade', (_req, _socket, _head) => {
  logger.info('WebSocket upgrade');
});
