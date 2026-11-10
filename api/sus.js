// /api/sus : kuesioner System Usability Scale
import { query } from './_lib/db.js';
import { requireAdmin } from './_lib/auth.js';
import { handle, allow, ok, fail, readBody, qs, sendCsv } from './_lib/http.js';
import { susScore } from './_lib/predict.js';

const Q = Array.from({ length: 10 }, (_, i) => 'q' + (i + 1));
const r2 = (n) => Math.round(Number(n) * 100) / 100;

async function kirim(req, res) {
  const b = await readBody(req);
  const errors = [];
  const skor = susScore(b.jawaban);
  if (skor === null) errors.push('jawaban harus berisi 10 bilangan bulat 1-5');
  const nama = typeof b.nama_responden === 'string' ? b.nama_responden.trim() : '';
  const peran = typeof b.peran === 'string' ? b.peran.trim() : '';
  if (nama.length > 80) errors.push('nama_responden maksimal 80 karakter');
  if (peran.length > 40) errors.push('peran maksimal 40 karakter');
  let iterasi = 1;
  if (b.iterasi !== undefined && b.iterasi !== null && b.iterasi !== '') {
    iterasi = Number(b.iterasi);
    if (!Number.isInteger(iterasi) || iterasi < 1 || iterasi > 32767) errors.push('iterasi harus bilangan bulat >= 1');
  }
  if (errors.length) return fail(res, 400, errors);

  const { rows } = await query(
    `INSERT INTO sus_respons (nama_responden, peran, iterasi, ${Q.join(', ')}, skor)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING id`,
    [nama || null, peran || null, iterasi, ...b.jawaban, skor]);
  ok(res, { id: rows[0].id, skor }, undefined, 201);
}

async function lihat(req, res) {
  if (!(await requireAdmin(req, res))) return;

  if (qs(req, 'format') === 'csv') {
    const { rows } = await query(
      `SELECT id, nama_responden, peran, iterasi, ${Q.join(', ')}, skor::float8 AS skor, dibuat_pada
       FROM sus_respons ORDER BY id`);
    return sendCsv(res, 'sus-respons.csv', rows,
      ['id', 'nama_responden', 'peran', 'iterasi', ...Q, 'skor', 'dibuat_pada']);
  }

  const [iter, butir, resp] = await Promise.all([
    query(`SELECT iterasi, COUNT(*)::int AS n, AVG(skor)::float8 AS rata_skor,
             MIN(skor)::float8 AS min, MAX(skor)::float8 AS max
           FROM sus_respons GROUP BY iterasi ORDER BY iterasi`),
    query(`SELECT ${Q.map((q) => `AVG(${q})::float8 AS ${q}`).join(', ')} FROM sus_respons`),
    query(`SELECT id, nama_responden, peran, iterasi, skor::float8 AS skor, dibuat_pada
           FROM sus_respons ORDER BY id DESC`),
  ]);
  const rb = butir.rows[0];
  ok(res, {
    per_iterasi: iter.rows.map((r) => ({ ...r, rata_skor: r2(r.rata_skor) })),
    rata_per_butir: Q.map((q, i) => ({ butir: i + 1, rata: rb[q] === null ? null : r2(rb[q]) })),
    responden: resp.rows,
  });
}

export default handle(async (req, res) => {
  if (!allow(req, res, ['GET', 'POST'])) return;
  if (req.method === 'POST') return kirim(req, res);
  return lihat(req, res);
});
