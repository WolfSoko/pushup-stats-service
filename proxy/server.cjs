/*
 * Locale proxy for pushup-stats-service.
 *
 * Routes:
 *   /de/* -> http://127.0.0.1:8788/*
 *   /en/* -> http://127.0.0.1:8789/*
 *   /api/*, /socket.io/*, /health -> DE backend (8788)
 *   /      -> 302 /de/
 */

const http = require('http');
const httpProxy = require('http-proxy');

const PORT = Number(process.env.PORT || 8787);
const DE_TARGET = process.env.DE_TARGET || 'http://127.0.0.1:8788';
const EN_TARGET = process.env.EN_TARGET || 'http://127.0.0.1:8789';

const proxy = httpProxy.createProxyServer({
  xfwd: true,
  ws: true,
  changeOrigin: true,
});

proxy.on('error', (err, _req, res) => {
  // Best-effort error response.
  try {
    if (res && !res.headersSent) {
      res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
    }
    res?.end(`Bad gateway: ${String(err?.message || err)}`);
  } catch {
    // ignore
  }
});

function pickTarget(reqUrl) {
  if (!reqUrl) return { target: DE_TARGET, stripPrefix: '' };

  if (reqUrl === '/' || reqUrl === '') {
    return { redirect: '/de/' };
  }

  // Language-scoped paths
  if (reqUrl === '/de' || reqUrl.startsWith('/de/')) {
    return { target: DE_TARGET, stripPrefix: '' };
  }
  if (reqUrl === '/en' || reqUrl.startsWith('/en/')) {
    return { target: EN_TARGET, stripPrefix: '' };
  }

  // Unscoped infra/API routes go to DE backend.
  if (reqUrl.startsWith('/api/') || reqUrl.startsWith('/socket.io') || reqUrl === '/health') {
    return { target: DE_TARGET, stripPrefix: '' };
  }

  // Anything else: default to DE locale.
  return { redirect: `/de${reqUrl.startsWith('/') ? '' : '/'}${reqUrl}` };
}

const server = http.createServer((req, res) => {
  const route = pickTarget(req.url);

  if (route.redirect) {
    res.statusCode = 302;
    res.setHeader('Location', route.redirect);
    res.end('Found');
    return;
  }

  const originalUrl = req.url || '/';
  if (route.stripPrefix && (originalUrl === route.stripPrefix || originalUrl.startsWith(route.stripPrefix + '/'))) {
    req.url = originalUrl.slice(route.stripPrefix.length) || '/';
  }

  proxy.web(req, res, { target: route.target });
});

server.on('upgrade', (req, socket, head) => {
  // Websocket upgrades (socket.io).
  const route = pickTarget(req.url);
  if (route.redirect) {
    socket.destroy();
    return;
  }

  const originalUrl = req.url || '/';
  if (route.stripPrefix && (originalUrl === route.stripPrefix || originalUrl.startsWith(route.stripPrefix + '/'))) {
    req.url = originalUrl.slice(route.stripPrefix.length) || '/';
  }

  proxy.ws(req, socket, head, { target: route.target });
});

server.listen(PORT, () => {
  console.log(`Locale proxy listening on http://localhost:${PORT}`);
  console.log(`DE target: ${DE_TARGET}`);
  console.log(`EN target: ${EN_TARGET}`);
});
