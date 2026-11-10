import { toCsv } from './csv.js';

export class HttpError extends Error {
  constructor(status, errors) {
    super(Array.isArray(errors) ? errors[0] : errors);
    this.status = status;
    this.errors = Array.isArray(errors) ? errors : [errors];
  }
}

export function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export function ok(res, data, meta, status = 200) {
  const body = { success: true, data };
  if (meta !== undefined) body.meta = meta;
  send(res, status, body);
}

export function fail(res, status, errors) {
  send(res, status, { success: false, errors: Array.isArray(errors) ? errors : [errors] });
}

// Kembalikan true bila metode diizinkan; kalau tidak, kirim 405.
export function allow(req, res, methods) {
  if (methods.includes(req.method)) return true;
  res.setHeader('Allow', methods.join(', '));
  fail(res, 405, 'Metode tidak diizinkan');
  return false;
}

export async function readBody(req) {
  // Di Vercel, mengakses req.body bisa melempar galat bila JSON tidak valid
  let pre;
  try { pre = req.body; } catch { throw new HttpError(400, 'Body bukan JSON yang valid'); }
  if (pre && typeof pre === 'object' && !Buffer.isBuffer(pre)) return pre;
  let raw = '';
  if (typeof pre === 'string') raw = pre;
  else if (Buffer.isBuffer(pre)) raw = pre.toString('utf8');
  else {
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 1_000_000) throw new HttpError(400, 'Body terlalu besar');
      raw += chunk;
    }
  }
  if (!raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    throw new HttpError(400, 'Body bukan JSON yang valid');
  }
}

export function parseCookies(req) {
  if (req.cookies && typeof req.cookies === 'object') return req.cookies;
  const out = {};
  for (const part of (req.headers?.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    try { out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); } catch { /* lewati */ }
  }
  return out;
}

export function sendCsv(res, filename, rows, columns) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.end(toCsv(rows, columns));
}

// Bungkus handler: tangkap galat -> respons rapi, tanpa membocorkan detail.
export function handle(fn) {
  return async function handler(req, res) {
    try {
      await fn(req, res);
    } catch (e) {
      if (e instanceof HttpError) return fail(res, e.status, e.errors);
      console.error('[api error]', req.url, e);
      if (!res.headersSent) fail(res, 500, 'Terjadi galat pada server');
    }
  };
}

// Ambil parameter query sebagai string (req.query bisa berisi array).
export function qs(req, name) {
  const v = req.query?.[name];
  const s = Array.isArray(v) ? v[0] : v;
  return s === undefined || s === null || s === '' ? undefined : String(s);
}
