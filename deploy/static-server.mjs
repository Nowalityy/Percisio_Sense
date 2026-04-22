import http from 'node:http';
import fs from 'node:fs/promises';
import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, '..', 'frontend', 'dist');
const PORT = process.env.PORT || 3000;

if (!existsSync(DIST)) {
  console.error(`❌ ${DIST} does not exist. Run "npm run build --prefix frontend" first.`);
  process.exit(1);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
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
  '.ttf': 'font/ttf',
  '.map': 'application/json',
  '.webmanifest': 'application/manifest+json',
};

const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg', '.map', '.webmanifest']);

function acceptsGzip(req) {
  const h = req.headers['accept-encoding'] || '';
  return typeof h === 'string' && h.includes('gzip');
}

const server = http.createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    let filePath = path.join(DIST, urlPath);

    if (!filePath.startsWith(DIST)) {
      res.writeHead(403);
      return res.end('Forbidden');
    }

    let stat;
    try {
      stat = await fs.stat(filePath);
    } catch {
      filePath = path.join(DIST, 'index.html');
      stat = await fs.stat(filePath);
    }
    if (stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';
    const cacheControl = filePath.endsWith('index.html')
      ? 'no-cache'
      : 'public, max-age=2592000, immutable';

    const headers = {
      'Content-Type': contentType,
      'Cache-Control': cacheControl,
    };

    if (COMPRESSIBLE.has(ext) && acceptsGzip(req)) {
      headers['Content-Encoding'] = 'gzip';
      res.writeHead(200, headers);
      createReadStream(filePath).pipe(zlib.createGzip()).pipe(res);
    } else {
      res.writeHead(200, headers);
      createReadStream(filePath).pipe(res);
    }
  } catch (err) {
    console.error('static-server error:', err.message);
    res.writeHead(500);
    res.end('Internal Server Error');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Frontend static server listening on :${PORT} (dist: ${DIST})`);
});
