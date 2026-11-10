// Impor data survei dosen (CSV / JSON) ke tabel sektor, umkm, survei.
// Pakai:  npm run db:import -- data.csv [--replace]
//   --replace : kosongkan survei, umkm, sektor lebih dulu (akun users dilepas dari UMKM)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { loadEnv } from './_env.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
loadEnv(path.join(ROOT, '.env'));

const FAKTOR = ['sumber_daya', 'kepemimpinan', 'lingkungan_kerja', 'nilai_organisasi', 'stabilitas', 'kinerja'];

// nama kolom (setelah dinormalisasi) -> kolom baku
const ALIAS = {
  id_umkm: ['id_umkm', 'id', 'kode', 'kode_umkm'],
  nama_umkm: ['nama_umkm', 'nama', 'name', 'nama_usaha'],
  sektor: ['sektor', 'sector', 'nama_sektor', 'bidang'],
  kota: ['kota', 'city', 'lokasi', 'daerah'],
  tanggal: ['tanggal', 'date', 'tgl', 'waktu'],
  sumber_daya: ['sumber_daya', 'sumberdaya', 'resources', 'resource'],
  kepemimpinan: ['kepemimpinan', 'leadership'],
  lingkungan_kerja: ['lingkungan_kerja', 'lingkungan', 'environment', 'work_environment'],
  nilai_organisasi: ['nilai_organisasi', 'nilai', 'values', 'organizational_values'],
  stabilitas: ['stabilitas', 'stability'],
  kinerja: ['kinerja', 'performance'],
};

const norm = (h) => String(h).replace(/^﻿/, '').trim().toLowerCase().replace(/[\s\-.]+/g, '_');

// ---- CSV sederhana: mendukung tanda kutip, "" sebagai kutip, delimiter , atau ; ----
function parseCsv(text) {
  text = text.replace(/^﻿/, '');
  const first = text.split(/\r?\n/, 1)[0] || '';
  const delim = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ',';
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false;
      } else field += c;
    } else if (c === '"') inQ = true;
    else if (c === delim) { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((x) => x.trim() !== '')) rows.push(row);
  const [head, ...body] = rows;
  if (!head) return [];
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

function loadRecords(file) {
  const text = fs.readFileSync(file, 'utf8');
  if (file.toLowerCase().endsWith('.json')) {
    const j = JSON.parse(text);
    const arr = Array.isArray(j) ? j : j.data || j.rows || [];
    return arr;
  }
  return parseCsv(text);
}

// Ambil nilai dengan nama baku dari baris (header bebas huruf besar/kecil)
function pick(rec, key) {
  const names = new Set(ALIAS[key]);
  for (const [k, v] of Object.entries(rec)) {
    if (names.has(norm(k)) && v !== null && v !== undefined && String(v).trim() !== '') return v;
  }
  return undefined;
}

function parseDate(v) {
  if (v === undefined) return null;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return undefined; // tidak dikenali
}

const USAGE = `Pemakaian: node scripts/import-data.js <file.csv|file.json> [--replace]
  --replace : kosongkan survei, umkm, sektor lebih dulu (disarankan bila data seed tidak diperlukan)
  Tanggal: YYYY-MM-DD atau DD/MM/YYYY (diasumsikan hari/bulan/tahun). Tanggal kosong/tidak dikenali
  diganti tanggal hari ini dan dihitung di ringkasan.`;

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) { console.log(USAGE); return; }
  const replace = args.includes('--replace');
  const file = args.find((a) => !a.startsWith('--'));
  if (!file) { console.error(USAGE); process.exit(1); }
  if (!fs.existsSync(file)) { console.error('File tidak ditemukan:', file); process.exit(1); }
  const url = process.env.DATABASE_URL;
  if (!url) { console.error('DATABASE_URL belum diatur.'); process.exit(1); }

  const records = loadRecords(file);
  console.log(`Membaca ${records.length} baris dari ${file}`);

  const valid = [];
  const skipped = [];
  const placeholder = { id: 0, nama: 0, sektor: 0, kota: 0 };
  let dateFallback = 0;
  records.forEach((rec, i) => {
    const line = i + 2; // nomor baris (1 = header)
    // id_umkm
    let id = pick(rec, 'id_umkm');
    if (id === undefined) { id = i + 1; placeholder.id++; }
    id = String(id).trim();
    if (/^\d+$/.test(id)) id = 'UMKM' + id.padStart(3, '0');
    id = id.toUpperCase();
    if (!/^UMKM\d{3}$/.test(id)) return skipped.push(`baris ${line}: id_umkm "${id}" tidak valid (UMKM001-UMKM999)`);
    // faktor
    const skor = {};
    for (const f of FAKTOR) {
      const raw = pick(rec, f);
      const n = raw === undefined ? NaN : Number(raw);
      if (!Number.isInteger(n) || n < 1 || n > 5) return skipped.push(`baris ${line}: ${f} harus 1-5 (nilai: ${raw ?? 'kosong'})`);
      skor[f] = n;
    }
    // tanggal
    const tgl = parseDate(pick(rec, 'tanggal'));
    if (tgl === undefined) dateFallback++; // tidak dikenali -> CURRENT_DATE
    // atribut UMKM (placeholder bila kosong)
    let nama = pick(rec, 'nama_umkm');
    if (nama === undefined) { nama = `UMKM Responden ${id.slice(4)}`; placeholder.nama++; }
    let sektor = pick(rec, 'sektor');
    if (sektor === undefined) { sektor = 'Tidak Diketahui'; placeholder.sektor++; }
    let kota = pick(rec, 'kota');
    if (kota === undefined) { kota = 'Tidak Diketahui'; placeholder.kota++; }
    valid.push({
      id, tgl: tgl || null, skor,
      nama: String(nama).trim().slice(0, 80),
      sektor: String(sektor).trim().slice(0, 40),
      kota: String(kota).trim().slice(0, 40),
    });
  });

  // SSL mengikuti connection string (sslmode=verify-full / default Neon).
  const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 10000 });
  await client.connect();
  let umkmBaru = 0;
  let bentrok = 0;
  let totalSurvei = 0, totalUmkm = 0;
  try {
    await client.query('BEGIN');
    if (replace) {
      console.warn('--replace: menghapus data survei, umkm, dan sektor yang ada.');
      await client.query('UPDATE users SET id_umkm = NULL');
      await client.query('DELETE FROM survei');
      await client.query('DELETE FROM umkm');
      await client.query('DELETE FROM sektor');
    }
    // Hitung baris yang jatuh ke UMKM yang sudah ada (mis. data seed UMKM001-007)
    const ada = await client.query('SELECT id_umkm FROM umkm WHERE id_umkm = ANY($1)', [[...new Set(valid.map((r) => r.id))]]);
    const adaSet = new Set(ada.rows.map((r) => r.id_umkm));
    bentrok = valid.filter((r) => adaSet.has(r.id)).length;
    const sektorId = new Map();
    const umkmSeen = new Set();
    for (const r of valid) {
      if (!sektorId.has(r.sektor)) {
        const s = await client.query(
          `INSERT INTO sektor (nama_sektor) VALUES ($1)
           ON CONFLICT (nama_sektor) DO UPDATE SET nama_sektor = EXCLUDED.nama_sektor
           RETURNING sektor_id`, [r.sektor]);
        sektorId.set(r.sektor, s.rows[0].sektor_id);
      }
      if (!umkmSeen.has(r.id)) {
        umkmSeen.add(r.id);
        const u = await client.query(
          `INSERT INTO umkm (id_umkm, nama_umkm, sektor_id, kota) VALUES ($1, $2, $3, $4)
           ON CONFLICT (id_umkm) DO NOTHING`, [r.id, r.nama, sektorId.get(r.sektor), r.kota]);
        umkmBaru += u.rowCount;
      }
      await client.query(
        `INSERT INTO survei (id_umkm, tanggal, ${FAKTOR.join(', ')})
         VALUES ($1, COALESCE($2::date, CURRENT_DATE), $3, $4, $5, $6, $7, $8)`,
        [r.id, r.tgl, ...FAKTOR.map((f) => r.skor[f])]);
    }
    totalSurvei = (await client.query('SELECT COUNT(*)::int AS n FROM survei')).rows[0].n;
    totalUmkm = (await client.query('SELECT COUNT(*)::int AS n FROM umkm')).rows[0].n;
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Gagal, semua perubahan dibatalkan:', e.message);
    process.exitCode = 1;
    return;
  } finally {
    await client.end().catch(() => {});
  }

  console.log('--- Ringkasan ---');
  console.log(`Survei diimpor : ${valid.length}`);
  console.log(`UMKM baru      : ${umkmBaru}`);
  console.log(`Baris dilewati : ${skipped.length}`);
  skipped.slice(0, 20).forEach((s) => console.log('  - ' + s));
  if (skipped.length > 20) console.log(`  ... dan ${skipped.length - 20} lainnya`);
  if (dateFallback) console.log(`Tanggal kosong/tidak dikenali -> hari ini: ${dateFallback} baris`);
  if (bentrok) {
    console.warn(`PERINGATAN: ${bentrok} baris jatuh ke ID UMKM yang SUDAH ADA (mis. data seed); survei ditambahkan ke UMKM tersebut dan atribut lamanya dipertahankan. Gunakan --replace untuk mengganti seluruh data.`);
  }
  console.log(`Total di database: survei = ${totalSurvei}, umkm = ${totalUmkm}`);
  const p = placeholder;
  if (p.id || p.nama || p.sektor || p.kota) {
    console.log(`Catatan: kolom tidak ada/kosong diisi placeholder -> id_umkm: ${p.id} baris, nama_umkm: ${p.nama}, sektor: ${p.sektor}, kota: ${p.kota}`);
  }
}

main().catch((e) => { console.error('Gagal:', e.message); process.exit(1); });
