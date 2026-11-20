import { createServer } from 'node:http';
import process from 'node:process';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const ROOT = resolve(process.cwd(), 'dist');
const PORT = Number(process.env.PORT || 3000);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.map': 'application/json; charset=utf-8',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm'
};

createServer(async (req, res) => {
  const headers = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': "base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self'; script-src-attr 'none'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; upgrade-insecure-requests"
  };
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
  if (req.url === '/health' || req.url === '/health/live') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end('ok');
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    return res.end();
  }
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400); return res.end(); }
  if (pathname.includes('\\') || pathname.split('/').includes('..') || pathname.includes('\0')) {
    res.writeHead(400); return res.end();
  }
  let file = resolve(ROOT, '.' + pathname);
  if (file !== ROOT && !file.startsWith(ROOT + sep)) {
    res.writeHead(403); return res.end();
  }
  try {
    const st = await stat(file);
    if (st.isDirectory()) file = resolve(file, 'index.html');
    else if (!st.isFile()) throw new Error('Not a file');
  } catch {
    // SPA fallback for client routes, but never return HTML for missing assets.
    if (extname(pathname)) { res.writeHead(404); return res.end(); }
    file = resolve(ROOT, 'index.html');
  }
  try {
    const data = await readFile(file);
    const extension = extname(file).toLowerCase();
    const isHTML = extension === '.html';
    const isMedia = extension === '.mp4' || extension === '.webm';
    const immutableAsset = pathname.startsWith('/assets/') && /-[\w]{8,}\./.test(pathname);
    const commonHeaders = {
      'Content-Type': TYPES[extension] || 'application/octet-stream',
      'Cache-Control': isHTML ? 'no-cache, max-age=0, must-revalidate' : immutableAsset ? 'public, max-age=31536000, immutable' : 'public, max-age=300'
    };
    if (isMedia) {
      commonHeaders['Accept-Ranges'] = 'bytes';
      if (req.headers.range) {
        const match = /^bytes=(\d+)-(\d*)$/.exec(String(req.headers.range));
        if (!match) {
          res.writeHead(416, { ...commonHeaders, 'Content-Range': 'bytes */' + data.length });
          return res.end();
        }
        const start = Number(match[1]);
        const end = match[2] ? Number(match[2]) : data.length - 1;
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || end >= data.length) {
          res.writeHead(416, { ...commonHeaders, 'Content-Range': 'bytes */' + data.length });
          return res.end();
        }
        const part = data.subarray(start, end + 1);
        res.writeHead(206, {
          ...commonHeaders,
          'Content-Range': 'bytes ' + start + '-' + end + '/' + data.length,
          'Content-Length': part.length
        });
        return res.end(req.method === 'HEAD' ? undefined : part);
      }
    }
    res.writeHead(200, { ...commonHeaders, 'Content-Length': data.length });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch { res.writeHead(404); res.end(); }
}).listen(PORT, '0.0.0.0', () => {
  console.log('ACG Trader web server listening on', PORT);
});
