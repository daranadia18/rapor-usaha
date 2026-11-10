// Uji nilai batas webhook n8n (JS-4) dan cek baris prediksi_log.
// Jalankan: npm run n8n:test
import { loadEnv } from './_env.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
loadEnv(path.join(ROOT, '.env'));

const url = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/predict';
const secret = process.env.N8N_WEBHOOK_SECRET || '';
const FAKTOR = ['sumber_daya', 'kepemimpinan', 'lingkungan_kerja', 'nilai_organisasi', 'stabilitas', 'kinerja'];

const cases = [
  { n: 1, skor: [2, 2, 2, 2, 2, 2], total: 12, status: 'KURANG_SEHAT', http: 200 },
  { n: 2, skor: [3, 2, 2, 2, 2, 2], total: 13, status: 'CUKUP_SEHAT', http: 200 },
  { n: 3, skor: [3, 3, 3, 3, 3, 3], total: 18, status: 'CUKUP_SEHAT', http: 200 },
  { n: 4, skor: [4, 3, 3, 3, 3, 3], total: 19, status: 'SEHAT', http: 200 },
  { n: 5, skor: [4, 4, 4, 4, 4, 4], total: 24, status: 'SEHAT', http: 200 },
  { n: 6, skor: [5, 4, 4, 4, 4, 4], total: 25, status: 'SANGAT_SEHAT', http: 200 },
  { n: 7, skor: [6, 1, 1, 1, 1, 1], total: null, status: null, http: 400 },
];

function body(skor) {
  const out = { id_umkm: 'UMKM001' };
  FAKTOR.forEach((f, i) => { out[f] = skor[i]; });
  return JSON.stringify(out);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
let gagal = 0;
try {
  await client.connect();
  const before = await client.query('SELECT COUNT(*)::int AS n FROM prediksi_log');
  const start = before.rows[0].n;

  console.log(`Webhook : ${url}`);
  console.log('No | Faktor              | Total | Ekspektasi    | Aktual        | HTTP | ms  | Sesuai');
  console.log('---+---------------------+-------+---------------+---------------+------+-----+-------');

  for (const c of cases) {
    const t0 = performance.now();
    let res;
    let json = null;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(secret ? { 'x-webhook-secret': secret } : {}) },
        body: body(c.skor),
      });
      json = await res.json().catch(() => null);
    } catch (e) {
      console.log(`${String(c.n).padStart(2)} | gagal koneksi: ${e.message}`);
      gagal++;
      continue;
    }
    const ms = Math.round(performance.now() - t0);
    const status = res.status === 200 ? json?.data?.status : null;
    const total = res.status === 200 ? json?.data?.total_skor : null;
    const sesuai = res.status === c.http && (c.status === null ? status === null : status === c.status && total === c.total);
    if (!sesuai) gagal++;
    console.log(
      `${String(c.n).padStart(2)} | ${c.skor.join(',').padEnd(19)} | ${String(total ?? '-').padStart(5)} | ` +
      `${String(c.status ?? 'success:false').padEnd(13)} | ${String(status ?? 'success:false').padEnd(13)} | ` +
      `${String(res.status).padStart(4)} | ${String(ms).padStart(3)} | ${sesuai ? 'ya' : 'TIDAK'}`,
    );
  }

  const after = await client.query('SELECT COUNT(*)::int AS n FROM prediksi_log');
  const bertambah = after.rows[0].n - start;
  console.log(`\nprediksi_log bertambah: ${bertambah} baris (diharapkan 6; kasus 7 tidak boleh masuk)`);
  if (bertambah !== 6) gagal++;
} finally {
  await client.end().catch(() => {});
}

if (gagal) {
  console.error(`\n${gagal} pemeriksaan gagal.`);
  process.exitCode = 1;
} else {
  console.log('Semua pemeriksaan lulus.');
}
