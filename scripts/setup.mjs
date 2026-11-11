// Setup satu perintah (Linux/macOS/Windows): npm run setup
// Prasyarat: Node 22 + Docker (Desktop) berjalan + DATABASE_URL Neon (sama dengan di Vercel).
// 1) buat .env (rahasia acak, minta DATABASE_URL)  2) npm install  3) docker compose up n8n
// 4) impor kredensial + workflow via CLI n8n  5) restart n8n  6) uji webhook lalu hapus baris ujinya
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadEnv } from './_env.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENV = path.join(ROOT, '.env');
const N8N = 'http://localhost:5678';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function run(cmd, args) {
  console.log(`> ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit' });
  if (r.error) throw new Error(`${cmd} tidak ditemukan/gagal: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`${cmd} ${args[0]} keluar dengan kode ${r.status}`);
}
const compose = (...args) => run('docker', ['compose', ...args]);

async function waitFor(url, tries = 90) {
  for (let i = 0; i < tries; i++) {
    try { if ((await fetch(url)).ok) return; } catch { /* belum siap */ }
    await sleep(2000);
  }
  throw new Error(`n8n tidak merespons di ${url}`);
}

const isPlaceholder = (v) => !v || v.includes('ganti_');

// 1) .env
const rand = () => crypto.randomBytes(24).toString('hex');
let envText = fs.existsSync(ENV) ? fs.readFileSync(ENV, 'utf8') : fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');
const getVar = (k) => envText.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1].trim();
const setVar = (k, v) => {
  envText = new RegExp(`^${k}=`, 'm').test(envText)
    ? envText.replace(new RegExp(`^${k}=.*$`, 'm'), `${k}=${v}`)
    : `${envText.trimEnd()}\n${k}=${v}\n`;
};
for (const k of ['N8N_ENCRYPTION_KEY', 'JWT_SECRET', 'N8N_WEBHOOK_SECRET', 'N8N_API_KEY']) {
  if (isPlaceholder(getVar(k))) setVar(k, rand());
}
if (!getVar('N8N_WEBHOOK_URL')) setVar('N8N_WEBHOOK_URL', `${N8N}/webhook/predict`);
let dbUrl = process.env.DATABASE_URL || getVar('DATABASE_URL');
if (isPlaceholder(dbUrl) || /@(localhost|127\.0\.0\.1)[:/]/.test(dbUrl)) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  dbUrl = (await rl.question('DATABASE_URL Neon (Vercel > Settings > Environment Variables): ')).trim();
  rl.close();
}
const db = new URL(dbUrl);
if (!db.protocol.startsWith('postgres')) throw new Error('DATABASE_URL harus postgresql://...');
setVar('DATABASE_URL', dbUrl);
fs.writeFileSync(ENV, envText);
loadEnv(ENV);
process.env.DATABASE_URL = dbUrl;

// 2) dependensi Node
if (!fs.existsSync(path.join(ROOT, 'node_modules', 'pg'))) {
  run(process.execPath, [process.env.npm_execpath || 'npm', 'install']);
}

// 3) n8n
compose('up', '-d', '--wait', 'n8n');
await waitFor(`${N8N}/healthz`);

// 4) Kredensial (ID tetap, sesuai referensi di workflows/*.json) + workflow
const creds = JSON.parse(fs.readFileSync(path.join(ROOT, 'workflows', 'credentials.example.json'), 'utf8'));
creds[0].data = {
  host: db.hostname,
  port: Number(db.port || 5432),
  database: decodeURIComponent(db.pathname.slice(1)),
  user: decodeURIComponent(db.username),
  password: decodeURIComponent(db.password),
  ssl: db.searchParams.get('sslmode') === 'disable' ? 'disable' : 'require',
};
creds[1].data.value = process.env.N8N_WEBHOOK_SECRET;
const tmp = path.join(os.tmpdir(), `rapor-creds-${process.pid}.json`);
fs.writeFileSync(tmp, JSON.stringify(creds));
try {
  compose('cp', tmp, 'n8n:/tmp/creds.json');
  compose('cp', 'workflows/.', 'n8n:/tmp/wf');
  compose('exec', '-T', 'n8n', 'sh', '-c', [
    'n8n import:credentials --input=/tmp/creds.json',
    'n8n import:workflow --separate --input=/tmp/wf',
    'n8n publish:workflow --id=js4umkmPredict0001',
    'rm -rf /tmp/creds.json /tmp/wf',
  ].join(' && '));
} finally {
  fs.rmSync(tmp, { force: true });
}

// 5) Restart agar aktivasi workflow terbaca
compose('restart', 'n8n');
await waitFor(`${N8N}/healthz`);

// 6) Uji webhook -> Neon, lalu hapus baris uji agar data produksi bersih.
// (npm run n8n:test = uji lengkap 7 kasus, tapi menambah 6 baris ke prediksi_log.)
const { default: pg } = await import('pg');
const client = new pg.Client({ connectionString: dbUrl });
await client.connect();
try {
  const hit = (body) => fetch(process.env.N8N_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-webhook-secret': process.env.N8N_WEBHOOK_SECRET },
    body: JSON.stringify(body),
  });
  let res;
  for (let i = 0; i < 15; i++) {
    res = await hit({ id_umkm: 'UMKM001', sumber_daya: 0 }).catch(() => null);
    if (res?.status === 400) break;
    await sleep(2000);
  }
  if (res?.status !== 400) throw new Error(`Webhook belum aktif (status ${res?.status ?? 'gagal koneksi'})`);
  const r = await hit({ id_umkm: 'UMKM001', sumber_daya: 5, kepemimpinan: 4, lingkungan_kerja: 4, nilai_organisasi: 4, stabilitas: 4, kinerja: 4 });
  const json = await r.json().catch(() => null);
  if (r.status !== 200 || json?.data?.status !== 'SANGAT_SEHAT') {
    throw new Error(`Webhook valid gagal: ${r.status} ${JSON.stringify(json)}`);
  }
  const del = await client.query(
    `DELETE FROM prediksi_log WHERE log_id = (SELECT max(log_id) FROM prediksi_log
     WHERE sumber = 'webhook' AND id_umkm = 'UMKM001' AND total_skor = 25 AND dibuat_pada > now() - interval '2 minutes')`);
  if (del.rowCount !== 1) throw new Error('Webhook membalas 200 tapi baris prediksi_log tidak ditemukan di database');
  console.log('Uji webhook OK: 400 untuk input salah, 200 + tersimpan di prediksi_log (baris uji dihapus).');
} finally {
  await client.end();
}

console.log(`
Selesai.
  n8n     : ${N8N}  (buat akun owner saat pertama dibuka)
  Webhook : ${process.env.N8N_WEBHOOK_URL}
  Web app : npm run dev  ->  http://localhost:${process.env.PORT || 3000}`);
