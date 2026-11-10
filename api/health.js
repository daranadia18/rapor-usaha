// GET /api/health : cek server dan database (selalu 200)
import { query } from './_lib/db.js';
import { handle, allow, ok } from './_lib/http.js';

export default handle(async (req, res) => {
  if (!allow(req, res, ['GET'])) return;
  let db = 'ok';
  try {
    await query('SELECT 1');
  } catch (e) {
    db = 'error';
    console.error('[health] db:', e.message);
  }
  const auth = (process.env.JWT_SECRET || '').length >= 32 ? 'ok' : 'JWT_SECRET belum diatur';
  ok(res, {
    status: db === 'ok' && auth === 'ok' ? 'ok' : 'degraded',
    db,
    auth,
    waktu: new Date().toISOString(),
    versi: '1.0.0',
    engine: (process.env.N8N_WEBHOOK_URL || '').trim() ? 'n8n' : 'lokal',
  });
});
