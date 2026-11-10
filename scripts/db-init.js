// Jalankan sql/init/01,02,03 ke DATABASE_URL (mis. Neon).
// Pakai:  npm run db:init            (menolak bila tabel sudah ada)
//         npm run db:init -- --force (HAPUS tabel aplikasi lalu buat ulang)
//         npm run db:init -- --migrate (non-destruktif: hanya 04_admin_role.sql pada DB yang sudah ada)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { loadEnv } from './_env.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
loadEnv(path.join(ROOT, '.env'));

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL belum diatur (lihat .env.example).'); process.exit(1); }
const force = process.argv.includes('--force');
const migrate = process.argv.includes('--migrate');
// SSL mengikuti connection string (sslmode=verify-full / default Neon).
const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 10000 });

try {
  await client.connect();
  if (migrate) {
    console.log('Menjalankan 04_admin_role.sql');
    await client.query(fs.readFileSync(path.join(ROOT, 'sql', 'init', '04_admin_role.sql'), 'utf8'));
    console.log('Migrasi selesai.');
    await client.end();
    process.exit(0);
  }
  const { rows } = await client.query(
    `SELECT COUNT(*)::int AS n FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = ANY($1)`,
    [['sektor', 'umkm', 'survei', 'prediksi_log', 'users', 'sus_respons']]);
  if (rows[0].n > 0) {
    if (!force) {
      console.error('Tabel aplikasi sudah ada. Gunakan --force untuk menghapus dan membuat ulang.');
      process.exit(1);
    }
    console.warn('!!! PERINGATAN: --force MENGHAPUS SEMUA DATA di tabel aplikasi (sektor, umkm, survei, prediksi_log, users, sus_respons) !!!');
    await client.query('DROP TABLE IF EXISTS sus_respons, users, prediksi_log, survei, umkm, sektor CASCADE');
  }
  for (const f of ['01_schema.sql', '02_seed.sql', '03_app.sql', '04_admin_role.sql']) {
    console.log('Menjalankan', f);
    await client.query(fs.readFileSync(path.join(ROOT, 'sql', 'init', f), 'utf8'));
  }
  console.log('Selesai. Database siap dipakai.');
} catch (e) {
  console.error('Gagal:', e.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
