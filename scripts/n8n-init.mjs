// Inisialisasi n8n untuk mode Docker lengkap (service "n8n-init", jalan sekali sebelum n8n menyala).
// Berjalan DI DALAM image n8n, jadi hanya memakai modul bawaan Node + CLI n8n.
//   - Kredensial (Postgres, Webhook Secret, Gmail SMTP bila diisi) diimpor ulang setiap start,
//     sehingga perubahan .env langsung terbaca. ID tetap, sesuai referensi di workflows/*.json.
//   - Workflow JS-4/JS-5 hanya diimpor pada start PERTAMA agar suntingan di UI n8n tidak tertimpa.
//     Hapus berkas penanda (lihat MARK) untuk mengimpor ulang.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const DIR = '/rapor/workflows';
const MARK = '/home/node/.n8n/.rapor-workflows-imported';
const env = process.env;
const log = (m) => console.log(`[n8n-init] ${m}`);

function n8n(args) {
  const r = spawnSync('n8n', args, { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`n8n ${args[0]} gagal (kode ${r.status})`);
}

for (const k of ['POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB', 'N8N_WEBHOOK_SECRET', 'N8N_ENCRYPTION_KEY']) {
  if (!env[k]) {
    console.error(`[n8n-init] ${k} kosong di .env. Hapus .env lalu jalankan MULAI.bat lagi.`);
    process.exit(1);
  }
}

const creds = JSON.parse(fs.readFileSync(path.join(DIR, 'credentials.example.json'), 'utf8'));
const cred = (type) => creds.find((c) => c.type === type);
cred('postgres').data = {
  host: 'postgres', port: 5432, database: env.POSTGRES_DB,
  user: env.POSTGRES_USER, password: env.POSTGRES_PASSWORD, ssl: 'disable',
};
cred('httpHeaderAuth').data.value = env.N8N_WEBHOOK_SECRET;
const smtp = cred('smtp');
const smtpUser = (env.SMTP_USER || '').trim();
const smtpPass = (env.SMTP_PASS || '').replace(/\s+/g, '');
if (smtpUser && smtpPass && !smtpUser.includes('akun.pengirim')) {
  smtp.data = { ...smtp.data, user: smtpUser, password: smtpPass };
} else {
  creds.splice(creds.indexOf(smtp), 1);
  log('SMTP_USER/SMTP_PASS belum diisi: kredensial email dilewati (notifikasi email nonaktif).');
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rapor-'));
try {
  const credFile = path.join(tmp, 'creds.json');
  fs.writeFileSync(credFile, JSON.stringify(creds), { mode: 0o600 });
  n8n(['import:credentials', `--input=${credFile}`]);
  log(`${creds.length} kredensial diimpor: ${creds.map((c) => c.name).join(', ')}`);

  if (fs.existsSync(MARK)) {
    log('Workflow sudah pernah diimpor; dilewati.');
  } else {
    const wfDir = path.join(tmp, 'wf');
    fs.mkdirSync(wfDir);
    const files = fs.readdirSync(DIR).filter((f) => /^js\d.*\.json$/.test(f));
    for (const f of files) fs.copyFileSync(path.join(DIR, f), path.join(wfDir, f));
    n8n(['import:workflow', '--separate', `--input=${wfDir}`]);
    // Webhook JS-4 harus aktif; JS-5 (schedule) sengaja dibiarkan nonaktif.
    n8n(['publish:workflow', '--id=js4umkmPredict0001']);
    fs.writeFileSync(MARK, new Date().toISOString() + '\n');
    log(`Workflow diimpor: ${files.join(', ')} (umkm-predict aktif).`);
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
