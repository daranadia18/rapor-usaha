// GET /api/log : riwayat prediksi (admin)
import { query } from './_lib/db.js';
import { requireAdmin } from './_lib/auth.js';
import { handle, allow, ok, fail, qs, sendCsv } from './_lib/http.js';

const SUMBER = ['web', 'webhook', 'schedule'];
const STATUS = ['SANGAT_SEHAT', 'SEHAT', 'CUKUP_SEHAT', 'KURANG_SEHAT'];
const COLS = ['log_id', 'id_umkm', 'total_skor', 'status', 'sumber', 'durasi_ms', 'dibuat_pada'];

export default handle(async (req, res) => {
  if (!allow(req, res, ['GET'])) return;
  if (!(await requireAdmin(req, res))) return;

  const sumber = qs(req, 'sumber');
  const status = qs(req, 'status');
  if (sumber !== undefined && !SUMBER.includes(sumber)) return fail(res, 400, 'sumber tidak valid');
  if (status !== undefined && !STATUS.includes(status)) return fail(res, 400, 'status tidak valid');

  const params = [];
  const where = [];
  if (sumber) { params.push(sumber); where.push(`sumber = $${params.length}`); }
  if (status) { params.push(status); where.push(`status = $${params.length}`); }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const select = `SELECT ${COLS.join(', ')} FROM prediksi_log ${w} ORDER BY log_id DESC`;

  if (qs(req, 'format') === 'csv') {
    const { rows } = await query(select, params);
    return sendCsv(res, 'log-prediksi.csv', rows, COLS);
  }

  const page = Math.max(1, parseInt(qs(req, 'page'), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(qs(req, 'limit'), 10) || 20));
  const [total, items] = await Promise.all([
    query(`SELECT COUNT(*)::int AS n FROM prediksi_log ${w}`, params),
    query(`${select} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, (page - 1) * limit]),
  ]);
  ok(res, { items: items.rows, total: total.rows[0].n, page, limit });
});
