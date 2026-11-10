// Server pengembangan lokal tanpa dependensi.
// Meniru Vercel: file statis dari public/ (cleanUrls) + fungsi di api/*.js.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadEnv } from './_env.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const API = path.join(ROOT, 'api');

loadEnv(path.join(ROOT, '.env'));

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.map': 'application/json',
  '.csv': 'text/csv; charset=utf-8', '.xml': 'application/xml',
};

// Rewrite yang sama dengan vercel.json
const REWRITES = [
  { re: /^\/api\/auth\/([^/]+)$/, to: '/api/auth', param: 'action' },
  { re: /^\/api\/umkm\/([^/]+)$/, to: '/api/umkm', param: 'id' },
];

const SECURITY = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

function addVercelHelpers(res) {
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => {
    if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(obj));
    return res;
  };
  res.send = (body) => {
    if (body !== null && typeof body === 'object' && !Buffer.isBuffer(body)) return res.json(body);
    res.end(body);
    return res;
  };
}

async function readRaw(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

function parseCookieHeader(h = '') {
  const out = {};
  for (const part of h.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    try { out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); } catch { /* lewati */ }
  }
  return out;
}

async function handleApi(req, res, pathname, searchParams) {
  let name;
  const query = {};
  const rw = REWRITES.find((r) => r.re.test(pathname));
  if (rw) {
    name = rw.to.replace('/api/', '');
    query[rw.param] = decodeURIComponent(pathname.match(rw.re)[1]);
  } else {
    const m = pathname.match(/^\/api\/([a-z0-9-]+)\/?$/);
    name = m && m[1];
  }
  // Query string ditambahkan; parameter dari rewrite tidak boleh ditimpa
  for (const [k, v] of searchParams) {
    if (!(k in query)) query[k] = v;
  }
  const file = name && path.join(API, name + '.js');
  if (!file || !fs.existsSync(file)) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ success: false, errors: ['Endpoint tidak ditemukan'] }));
  }

  req.query = query;
  req.cookies = parseCookieHeader(req.headers.cookie);
  if (!['GET', 'HEAD'].includes(req.method)) {
    const raw = await readRaw(req);
    try { req.body = raw ? JSON.parse(raw) : {}; } catch { req.body = raw; }
  }
  addVercelHelpers(res);
  // ?t= agar perubahan file langsung terbaca tanpa restart
  const mod = await import(pathToFileURL(file).href + '?t=' + fs.statSync(file).mtimeMs);
  await mod.default(req, res);
}

function serveStatic(req, res, pathname) {
  let rel;
  try { rel = decodeURIComponent(pathname); } catch { rel = null; }
  const send404 = () => {
    const nf = path.join(PUBLIC, '404.html');
    res.statusCode = 404;
    if (fs.existsSync(nf)) {
      res.setHeader('Content-Type', MIME['.html']);
      return res.end(fs.readFileSync(nf));
    }
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('404 Tidak ditemukan');
  };
  if (rel === null || rel.includes('\0')) return send404();

  const base = path.resolve(PUBLIC, '.' + rel);
  // Blokir path traversal
  if (base !== PUBLIC && !base.startsWith(PUBLIC + path.sep)) return send404();

  const isFile = (p) => fs.existsSync(p) && fs.statSync(p).isFile();
  const candidates = [base, base + '.html', path.join(base, 'index.html')];
  const hit = candidates.find(isFile);
  if (!hit) return send404();

  res.setHeader('Content-Type', MIME[path.extname(hit).toLowerCase()] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-cache');
  if (req.method === 'HEAD') return res.end();
  res.end(fs.readFileSync(hit));
}

const server = http.createServer(async (req, res) => {
  for (const [k, v] of Object.entries(SECURITY)) res.setHeader(k, v);
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url.pathname, url.searchParams);
    } else {
      serveStatic(req, res, url.pathname);
    }
  } catch (e) {
    console.error('[dev-server]', e);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    res.end(JSON.stringify({ success: false, errors: ['Terjadi galat pada server'] }));
  }
});

const PORT = Number(process.env.PORT) || 3000;
server.listen(PORT, () => {
  console.log(`Rapor Usaha dev-server berjalan di http://localhost:${PORT}`);
  if (!process.env.DATABASE_URL) console.warn('Peringatan: DATABASE_URL belum diatur (lihat .env.example)');
});
