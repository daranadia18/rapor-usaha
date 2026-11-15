// Impor kredensial Gmail SMTP ("Rapor Usaha SMTP", ID tetap rapor-smtp-01) ke n8n lewat CLI.
// Prasyarat: SMTP_USER, SMTP_PASS (App Password Gmail), ALERT_EMAIL_FROM, ALERT_EMAIL_TO di .env.
// Jalankan: npm run n8n:smtp
//   1) docker compose up -d n8n  (membuat ulang container bila env ALERT_EMAIL_* berubah; data n8n aman di volume)
//   2) n8n import:credentials    (menimpa kredensial ber-ID sama bila sudah ada)
//   3) uji login SMTP tanpa mengirim email (transporter.verify)
// Nilai rahasia tidak pernah dicetak ke layar.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadEnv } from './_env.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
loadEnv(path.join(ROOT, '.env'));
const N8N = (process.env.N8N_URL || 'http://localhost:5678').replace(/\/+$/, '');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const compose = (args, opts = {}) => {
  const r = spawnSync('docker', ['compose', ...args], { cwd: ROOT, stdio: 'inherit', ...opts });
  if (r.error) throw new Error(`docker tidak ditemukan: ${r.error.message}`);
  return r.status;
};

const user = (process.env.SMTP_USER || '').trim();
// Google menampilkan App Password dengan spasi ("abcd efgh ijkl mnop"); spasi dibuang.
const pass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');
const masalah = [];
if (!user || user.includes('akun.pengirim')) masalah.push('SMTP_USER belum diisi (alamat Gmail pengirim)');
if (!pass) masalah.push('SMTP_PASS belum diisi (App Password Gmail 16 karakter)');
else if (pass.length !== 16) masalah.push(`SMTP_PASS panjangnya ${pass.length} karakter; App Password Gmail selalu 16 huruf`);
if (!process.env.ALERT_EMAIL_TO || process.env.ALERT_EMAIL_TO.includes('example.com')) {
  masalah.push('ALERT_EMAIL_TO belum diisi (penerima notifikasi)');
}
if (masalah.length) {
  console.error('Lengkapi rapor-usaha/.env dulu:\n  - ' + masalah.join('\n  - '));
  process.exit(1);
}
const from = process.env.ALERT_EMAIL_FROM || '';
if (!from.toLowerCase().includes(user.toLowerCase())) {
  console.warn(`Peringatan: ALERT_EMAIL_FROM tidak memuat ${user}. Gmail akan memakai alamat SMTP_USER sebagai pengirim.`);
}

const example = JSON.parse(fs.readFileSync(path.join(ROOT, 'workflows', 'credentials.example.json'), 'utf8'));
const cred = example.find((c) => c.type === 'smtp');
cred.data = { ...cred.data, user, password: pass };

// 1) Pastikan n8n memakai env terbaru (ALERT_EMAIL_FROM/TO).
if (compose(['up', '-d', 'n8n']) !== 0) process.exit(1);
for (let i = 0; i < 45; i++) {
  try { if ((await fetch(`${N8N}/healthz`)).ok) break; } catch { /* belum siap */ }
  await sleep(2000);
}

// 2) Impor kredensial. JSON dialirkan lewat stdin dan ditulis oleh user n8n sendiri
//    (umask 077), sehingga bisa dihapus lagi; `docker cp` membuat file milik root
//    yang tidak bisa dihapus user node dan sandi tertinggal di /tmp.
const status = compose(['exec', '-T', 'n8n', 'sh', '-c',
  'umask 077; f=$(mktemp); cat > "$f" && n8n import:credentials --input="$f"; s=$?; rm -f "$f"; exit $s'],
{ input: JSON.stringify([cred]), stdio: ['pipe', 'inherit', 'inherit'] });
if (status !== 0) {
  console.error('Impor kredensial SMTP gagal.');
  process.exit(1);
}
console.log(`Kredensial "${cred.name}" (${cred.id}) tersimpan di n8n untuk ${user}.`);

// 3) Uji login SMTP memakai nodemailer bawaan n8n (tidak mengirim email).
const cek = `
const p = require('path'), fs = require('fs');
const base = fs.realpathSync('/usr/local/lib/node_modules/n8n/node_modules/n8n-nodes-base');
let nm; try { nm = require(require.resolve('nodemailer', { paths: [base] })); } catch { console.log('LEWATI'); process.exit(0); }
nm.createTransport({ host: ${JSON.stringify(cred.data.host)}, port: ${Number(cred.data.port)}, secure: ${Boolean(cred.data.secure)},
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } })
  .verify().then(() => console.log('OK'), (e) => { console.log('GAGAL ' + (e.response || e.message)); process.exit(2); });`;
const r = spawnSync('docker', ['compose', 'exec', '-T', '-e', 'SMTP_USER', '-e', 'SMTP_PASS', 'n8n', 'node', '-e', cek], {
  cwd: ROOT, encoding: 'utf8', env: { ...process.env, SMTP_USER: user, SMTP_PASS: pass },
});
const out = (r.stdout || '').trim();
if (out === 'OK') console.log('Login SMTP Gmail berhasil.');
else if (out === 'LEWATI') console.log('Uji login SMTP dilewati (nodemailer tidak ditemukan di container). Uji lewat workflow saja.');
else {
  console.error(`Login SMTP gagal: ${out || (r.stderr || '').trim().split('\n').pop()}`);
  console.error('Periksa: Verifikasi 2 Langkah aktif, SMTP_PASS = App Password (bukan sandi login), SMTP_USER benar.');
  process.exit(1);
}
