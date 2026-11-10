// POST /api/predict : hitung status kesehatan, simpan survei, catat log.
import { performance } from 'node:perf_hooks';
import { query } from './_lib/db.js';
import { handle, allow, ok, fail, readBody } from './_lib/http.js';
import { FAKTOR, validate, predict } from './_lib/predict.js';

// Teruskan body ke webhook n8n (timeout 8 detik). Mengembalikan {status, json} atau null.
async function callN8n(url, body) {
  const headers = { 'Content-Type': 'application/json' };
  // Rahasia bersama: di node Webhook n8n pakai Header Auth dengan nama header x-webhook-secret
  if (process.env.N8N_WEBHOOK_SECRET) headers['x-webhook-secret'] = process.env.N8N_WEBHOOK_SECRET;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const json = await r.json();
    if (r.status >= 500 || !json || typeof json !== 'object' || Array.isArray(json)) return null;
    return { status: r.status, json };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function simpanSurvei(b) {
  const { rows } = await query(
    `INSERT INTO survei (id_umkm, ${FAKTOR.join(', ')})
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING survei_id`,
    [b.id_umkm, ...FAKTOR.map((f) => Number(b[f]))]);
  return rows[0].survei_id;
}

export default handle(async (req, res) => {
  if (!allow(req, res, ['POST'])) return;
  const t0 = performance.now();
  const b = await readBody(req);
  const errors = validate(b);
  if (errors.length) return fail(res, 400, errors);

  const cek = await query('SELECT 1 FROM umkm WHERE id_umkm = $1', [b.id_umkm]);
  if (!cek.rowCount) return fail(res, 404, 'UMKM belum terdaftar. Tambahkan UMKM terlebih dahulu.');

  const webhook = (process.env.N8N_WEBHOOK_URL || '').trim();

  if (webhook) {
    // Mode n8n: hitung lokal dulu sebagai cadangan kelengkapan data;
    // n8n menulis prediksi_log (sumber webhook)
    const local = predict(b);
    const payload = { id_umkm: b.id_umkm };
    for (const f of FAKTOR) payload[f] = Number(b[f]);
    const r = await callN8n(webhook, payload);
    if (!r) return fail(res, 502, 'Layanan n8n tidak dapat dihubungi');
    const sukses = r.status >= 200 && r.status < 300 && r.json.success === true;
    if (!sukses) {
      if (r.status >= 400 && r.status < 500 && Array.isArray(r.json.errors) && r.json.errors.length) {
        return fail(res, 400, r.json.errors.map(String));
      }
      return fail(res, 502, 'Layanan n8n tidak dapat dihubungi');
    }
    const n8nData = r.json.data && typeof r.json.data === 'object' ? r.json.data : {};
    if ((n8nData.total_skor !== undefined && n8nData.total_skor !== local.total_skor) ||
        (n8nData.status !== undefined && n8nData.status !== local.status)) {
      console.warn('[predict] hasil n8n berbeda dari hitungan lokal', n8nData.total_skor, n8nData.status, local.total_skor, local.status);
    }
    const survei_id = await simpanSurvei(b);
    const data = { ...local, ...n8nData, survei_id };
    return ok(res, data, { durasi_ms: Math.round(performance.now() - t0), engine: 'n8n' });
  }

  // Mode lokal
  const hasil = predict(b);
  hasil.survei_id = await simpanSurvei(b);
  const durasi_ms = Math.round(performance.now() - t0);
  await query(
    `INSERT INTO prediksi_log (id_umkm, total_skor, status, sumber, durasi_ms)
     VALUES ($1, $2, $3, 'web', $4)`,
    [hasil.id_umkm, hasil.total_skor, hasil.status, durasi_ms]);
  ok(res, hasil, { durasi_ms, engine: 'lokal' });
});
