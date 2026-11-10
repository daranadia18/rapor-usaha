// /api/umkm (daftar, tambah, CSV) dan /api/umkm/:id (detail via ?id=)
import { query, withTx } from './_lib/db.js';
import { requireAdmin } from './_lib/auth.js';
import { handle, allow, ok, fail, qs, readBody, sendCsv } from './_lib/http.js';
import { FAKTOR, statusFromTotal } from './_lib/predict.js';
import { jejakUntuk } from './_lib/jejak.js';

const r2 = (n) => Math.round(Number(n) * 100) / 100;

// ---------- GET /api/umkm ----------
async function daftar(req, res) {
  const params = [];
  const where = [];
  const add = (cond, val) => { params.push(val); where.push(cond.replace('?', '$' + params.length)); };

  const q = qs(req, 'q');
  if (q) {
    // escape wildcard LIKE agar input dianggap teks biasa
    const like = '%' + q.replace(/[\\%_]/g, '\\$&') + '%';
    params.push(like);
    where.push(`(u.nama_umkm ILIKE $${params.length} OR u.id_umkm ILIKE $${params.length})`);
  }
  const sektor = qs(req, 'sektor_id');
  if (sektor !== undefined) {
    if (!/^\d{1,9}$/.test(sektor)) return fail(res, 400, 'sektor_id harus bilangan bulat');
    add('u.sektor_id = ?', Number(sektor));
  }
  const kota = qs(req, 'kota');
  if (kota) add('u.kota = ?', kota);

  const { rows } = await query(
    `SELECT u.id_umkm, u.nama_umkm, u.sektor_id, k.nama_sektor, u.kota,
            (SELECT COUNT(*)::int FROM survei WHERE id_umkm = u.id_umkm) AS jumlah_survei,
            l.total_skor AS skor_terakhir, to_char(l.tanggal, 'YYYY-MM-DD') AS tanggal_terakhir
     FROM umkm u
     JOIN sektor k ON k.sektor_id = u.sektor_id
     LEFT JOIN LATERAL (
       SELECT total_skor, tanggal FROM survei WHERE id_umkm = u.id_umkm
       ORDER BY tanggal DESC, survei_id DESC LIMIT 1) l ON true
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY u.id_umkm`, params);

  const j = await jejakUntuk(rows.map((r) => r.id_umkm));
  ok(res, rows.map((r) => ({
    ...r,
    status_terakhir: r.skor_terakhir === null ? null : statusFromTotal(r.skor_terakhir).status,
    skor_sebelumnya: j.get(r.id_umkm)?.skor_sebelumnya ?? null,
    perubahan: j.get(r.id_umkm)?.perubahan ?? null,
    jejak: j.get(r.id_umkm)?.jejak ?? [],
  })));
}

// ---------- GET /api/umkm?format=csv ----------
async function csv(res) {
  const { rows } = await query(
    `SELECT s.survei_id, s.id_umkm, u.nama_umkm, k.nama_sektor, u.kota,
            to_char(s.tanggal, 'YYYY-MM-DD') AS tanggal,
            ${FAKTOR.map((f) => 's.' + f).join(', ')}, s.total_skor
     FROM survei s JOIN umkm u ON u.id_umkm = s.id_umkm JOIN sektor k ON k.sektor_id = u.sektor_id
     ORDER BY s.survei_id`);
  for (const r of rows) r.status = statusFromTotal(r.total_skor).status;
  sendCsv(res, 'survei-umkm.csv', rows, [
    'survei_id', 'id_umkm', 'nama_umkm', 'nama_sektor', 'kota', 'tanggal', ...FAKTOR, 'total_skor', 'status',
  ]);
}

// ---------- GET /api/umkm/:id ----------
async function detail(req, res, id) {
  const u = await query(
    `SELECT u.id_umkm, u.nama_umkm, u.sektor_id, k.nama_sektor, u.kota
     FROM umkm u JOIN sektor k ON k.sektor_id = u.sektor_id WHERE u.id_umkm = $1`, [id]);
  if (!u.rowCount) return fail(res, 404, 'UMKM tidak ditemukan');

  const cols = FAKTOR.join(', ');
  const rw = await query(
    `SELECT survei_id, to_char(tanggal, 'YYYY-MM-DD') AS tanggal, total_skor, ${cols}
     FROM survei WHERE id_umkm = $1 ORDER BY tanggal ASC, survei_id ASC`, [id]);
  const riwayat = rw.rows.map((r) => ({ ...r, status: statusFromTotal(r.total_skor).status }));

  let perbandingan = null;
  if (riwayat.length) {
    const avg = FAKTOR.map((f) => `AVG(s.${f})::float8 AS ${f}`).join(', ') + ', AVG(s.total_skor)::float8 AS total_skor';
    const terakhir = riwayat[riwayat.length - 1];
    const [sek, semua, rank] = await Promise.all([
      query(`SELECT ${avg} FROM survei s JOIN umkm x ON x.id_umkm = s.id_umkm WHERE x.sektor_id = $1`, [u.rows[0].sektor_id]),
      query(`SELECT ${avg} FROM survei s`),
      // skor terakhir tiap UMKM, lalu hitung peringkat & persentil
      query(
        `WITH t AS (
           SELECT DISTINCT ON (id_umkm) id_umkm, total_skor FROM survei
           ORDER BY id_umkm, tanggal DESC, survei_id DESC)
         SELECT (1 + COUNT(*) FILTER (WHERE total_skor > $1))::int AS peringkat,
                COUNT(*)::int AS dari,
                COUNT(*) FILTER (WHERE total_skor <= $1)::int AS lte
         FROM t`, [terakhir.total_skor]),
    ]);
    const fmt = (row) => Object.fromEntries([...FAKTOR, 'total_skor'].map((k) => [k, r2(row[k])]));
    const { peringkat, dari, lte } = rank.rows[0];
    perbandingan = {
      skor_terakhir: Object.fromEntries([...FAKTOR, 'total_skor'].map((k) => [k, terakhir[k]])),
      rata_sektor: fmt(sek.rows[0]),
      rata_semua: fmt(semua.rows[0]),
      peringkat, dari, persentil: Math.round((lte / dari) * 100),
    };
  }
  ok(res, { umkm: u.rows[0], riwayat, perbandingan });
}

// ---------- POST /api/umkm ----------
async function tambah(req, res) {
  const b = await readBody(req);
  const errors = [];
  const nama = typeof b.nama_umkm === 'string' ? b.nama_umkm.trim() : '';
  const kota = typeof b.kota === 'string' ? b.kota.trim() : '';
  const sektorId = Number(b.sektor_id);
  if (!nama || nama.length > 80) errors.push('nama_umkm wajib diisi (maksimal 80 karakter)');
  if (!kota || kota.length > 40) errors.push('kota wajib diisi (maksimal 40 karakter)');
  if (!Number.isInteger(sektorId) || sektorId < 1 || sektorId > 2147483647) errors.push('sektor_id harus bilangan bulat');
  if (errors.length) return fail(res, 400, errors);

  const sek = await query('SELECT 1 FROM sektor WHERE sektor_id = $1', [sektorId]);
  if (!sek.rowCount) return fail(res, 400, 'sektor_id tidak ditemukan');

  // Kunci tabel agar dua permintaan bersamaan tidak membuat ID yang sama
  const umkm = await withTx(async (c) => {
    await c.query('LOCK TABLE umkm IN SHARE ROW EXCLUSIVE MODE');
    const m = await c.query(`SELECT COALESCE(MAX(substring(id_umkm FROM 5)::int), 0) AS maks FROM umkm`);
    const next = m.rows[0].maks + 1;
    if (next > 999) return null;
    const id = 'UMKM' + String(next).padStart(3, '0');
    const ins = await c.query(
      `INSERT INTO umkm (id_umkm, nama_umkm, sektor_id, kota) VALUES ($1, $2, $3, $4)
       RETURNING id_umkm, nama_umkm, sektor_id, kota`, [id, nama, sektorId, kota]);
    return ins.rows[0];
  });
  if (!umkm) return fail(res, 409, 'Kapasitas ID UMKM (UMKM999) sudah penuh');
  ok(res, { umkm }, undefined, 201);
}

export default handle(async (req, res) => {
  if (!allow(req, res, ['GET', 'POST'])) return;
  const id = qs(req, 'id');
  if (id !== undefined) {
    if (req.method !== 'GET') return allow({ method: 'X' }, res, ['GET']);
    if (!/^UMKM\d{3}$/.test(id)) return fail(res, 404, 'UMKM tidak ditemukan');
    return detail(req, res, id);
  }
  if (req.method === 'POST') return tambah(req, res);

  if (qs(req, 'format') === 'csv') {
    if (!(await requireAdmin(req, res))) return;
    return csv(res);
  }
  return daftar(req, res);
});
