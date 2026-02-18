/*
 * Locale proxy for pushup-stats-service.
 *
 * Routes:
 *   /      -> DE backend (8788) (default)
 *   /en/*  -> EN backend (8789)
 *   /api/*, /socket.io/*, /health -> DE backend (8788)
 *
 * Locale selection for unprefixed URLs:
 *   1) cookie "language" (highest prio)
 *   2) Accept-Language header
 * If the resolved locale is EN, we redirect to /en/... for canonical URLs.
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

function parseCookies(headerValue) {
  const out = {};
  if (!headerValue) return out;
  for (const part of String(headerValue).split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (!k) continue;
    out[k] = decodeURIComponent(rest.join('=') || '');
  }
  return out;
}

function pickLocale(req) {
  const cookies = parseCookies(req.headers?.cookie);
  const cookieLang = String(cookies.language || '').toLowerCase();
  if (cookieLang.startsWith('en')) return 'en';
  if (cookieLang.startsWith('de')) return 'de';

  const al = String(req.headers?.['accept-language'] || '').toLowerCase();
  // Very small heuristic: if "en" appears as a language tag, prefer EN.
  if (/\ben\b/.test(al) || al.startsWith('en-') || al.startsWith('en,')) return 'en';
  return 'de';
}

function pickTarget(req, reqUrl) {
  if (!reqUrl) return { target: DE_TARGET, stripPrefix: '' };

  // Unscoped infra/API routes go to DE backend.
  if (
    reqUrl === '/health' ||
    reqUrl.startsWith('/api/') ||
    reqUrl.startsWith('/socket.io')
  ) {
    return { target: DE_TARGET, stripPrefix: '' };
  }

  // English prefix
  if (reqUrl === '/en' || reqUrl.startsWith('/en/')) {
    return { target: EN_TARGET, stripPrefix: '' };
  }

  // Root & other unprefixed routes: choose locale by cookie/header.
  const locale = pickLocale(req);
  if (locale === 'en') {
    // Canonicalize to /en/...
    if (reqUrl === '/' || reqUrl === '') return { redirect: '/en/' };
    return { redirect: `/en${reqUrl.startsWith('/') ? '' : '/'}${reqUrl}` };
  }

  // Default DE at /
  return { target: DE_TARGET, stripPrefix: '' };
}

const server = http.createServer((req, res) => {
  const route = pickTarget(req, req.url);

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
  const route = pickTarget(req, req.url);
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
