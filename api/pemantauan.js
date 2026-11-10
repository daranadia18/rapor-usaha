// GET /api/pemantauan : UMKM yang survei terakhirnya CUKUP_SEHAT / KURANG_SEHAT
import { query } from './_lib/db.js';
import { handle, allow, ok } from './_lib/http.js';
import { statusFromTotal } from './_lib/predict.js';
import { jejakUntuk } from './_lib/jejak.js';

export default handle(async (req, res) => {
  if (!allow(req, res, ['GET'])) return;

  const { rows } = await query(
    `SELECT t.id_umkm, u.nama_umkm, k.nama_sektor, u.kota,
            to_char(t.tanggal, 'YYYY-MM-DD') AS tanggal, t.total_skor
     FROM (
       SELECT DISTINCT ON (id_umkm) id_umkm, tanggal, total_skor, survei_id
       FROM survei ORDER BY id_umkm, tanggal DESC, survei_id DESC
     ) t
     JOIN umkm u ON u.id_umkm = t.id_umkm
     JOIN sektor k ON k.sektor_id = u.sektor_id
     WHERE t.total_skor < 19
     ORDER BY t.total_skor ASC, t.id_umkm ASC`);

  const j = await jejakUntuk(rows.map((r) => r.id_umkm));
  ok(res, rows.map((r) => ({
    ...r, ...statusFromTotal(r.total_skor),
    skor_sebelumnya: j.get(r.id_umkm)?.skor_sebelumnya ?? null,
    perubahan: j.get(r.id_umkm)?.perubahan ?? null,
  })));
});
