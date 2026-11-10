// GET /api/ringkasan?sektor_id=&kota=  (publik)
import { query } from './_lib/db.js';
import { handle, allow, ok, fail, qs } from './_lib/http.js';
import { FAKTOR, statusFromTotal } from './_lib/predict.js';
import { jejakUntuk } from './_lib/jejak.js';
import { urutPrioritas } from './_lib/tren.js';

// Status dihitung dari total_skor (ambang 25 / 19 / 13)
const STATUS_SQL = `CASE WHEN s.total_skor >= 25 THEN 'SANGAT_SEHAT'
  WHEN s.total_skor >= 19 THEN 'SEHAT'
  WHEN s.total_skor >= 13 THEN 'CUKUP_SEHAT'
  ELSE 'KURANG_SEHAT' END`;

// Filter opsional: $1 = sektor_id (int|null), $2 = kota (text|null)
const FILTER = `($1::int IS NULL OR u.sektor_id = $1::int) AND ($2::text IS NULL OR u.kota = $2::text)`;
const FROM = `FROM survei s JOIN umkm u ON u.id_umkm = s.id_umkm JOIN sektor k ON k.sektor_id = u.sektor_id
  WHERE ${FILTER}`;
const STATUS_ORDER = ['SANGAT_SEHAT', 'SEHAT', 'CUKUP_SEHAT', 'KURANG_SEHAT'];

const r2 = (n) => (n === null || n === undefined ? 0 : Math.round(Number(n) * 100) / 100);

export default handle(async (req, res) => {
  if (!allow(req, res, ['GET'])) return;
  const sektorRaw = qs(req, 'sektor_id');
  if (sektorRaw !== undefined && !/^\d{1,9}$/.test(sektorRaw)) return fail(res, 400, 'sektor_id harus bilangan bulat');
  const p = [sektorRaw === undefined ? null : Number(sektorRaw), qs(req, 'kota') ?? null];

  const avgFaktor = FAKTOR.map((f) => `AVG(s.${f})::float8 AS ${f}`).join(', ');

  const [kpi, umkm, dist, faktor, sektor, kota, opsiSektor, opsiKota] = await Promise.all([
    query(`SELECT COUNT(*)::int AS jumlah_survei, AVG(s.total_skor)::float8 AS rata_skor,
             COUNT(*) FILTER (WHERE s.total_skor >= 19)::int AS sehat ${FROM}`, p),
    query(`SELECT COUNT(*)::int AS n FROM umkm u WHERE ${FILTER}`, p),
    query(`SELECT ${STATUS_SQL} AS status, COUNT(*)::int AS jumlah ${FROM} GROUP BY 1`, p),
    query(`SELECT ${avgFaktor} ${FROM}`, p),
    query(`SELECT k.sektor_id, k.nama_sektor, COUNT(*)::int AS jumlah_survei,
             AVG(s.total_skor)::float8 AS rata_skor ${FROM}
           GROUP BY k.sektor_id, k.nama_sektor ORDER BY k.sektor_id`, p),
    query(`SELECT u.kota, COUNT(*)::int AS jumlah_survei, AVG(s.total_skor)::float8 AS rata_skor,
             MIN(s.total_skor)::int AS min, MAX(s.total_skor)::int AS max ${FROM}
           GROUP BY u.kota ORDER BY u.kota`, p),
    query('SELECT sektor_id, nama_sektor FROM sektor ORDER BY sektor_id'),
    query('SELECT DISTINCT kota FROM umkm ORDER BY kota'),
  ]);

  // ---- Tingkat UMKM: berdasarkan survei terakhir tiap UMKM ----
  const daftar = await query(
    `SELECT u.id_umkm, u.nama_umkm, k.nama_sektor, u.kota
     FROM umkm u JOIN sektor k ON k.sektor_id = u.sektor_id WHERE ${FILTER} ORDER BY u.id_umkm`, p);
  const jej = await jejakUntuk(daftar.rows.map((r) => r.id_umkm));
  const item = daftar.rows.filter((r) => jej.has(r.id_umkm)).map((r) => {
    const j = jej.get(r.id_umkm);
    return {
      id_umkm: r.id_umkm, nama_umkm: r.nama_umkm, nama_sektor: r.nama_sektor, kota: r.kota,
      total_skor: j.terakhir.total_skor, ...statusFromTotal(j.terakhir.total_skor),
      skor_sebelumnya: j.skor_sebelumnya, perubahan: j.perubahan,
      tanggal: j.terakhir.tanggal, jejak: j.jejak, _faktor: j.terakhir,
    };
  });
  const n = item.length;
  const distU = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0]));
  item.forEach((i) => { distU[i.status]++; });
  const umkmBlok = {
    jumlah_umkm: daftar.rowCount,
    tersurvei: n,
    belum_disurvei: daftar.rowCount - n,
    perlu_intervensi: distU.CUKUP_SEHAT + distU.KURANG_SEHAT,
    turun: item.filter((i) => i.perubahan !== null && i.perubahan < 0).length,
    naik: item.filter((i) => i.perubahan !== null && i.perubahan > 0).length,
    rata_skor: n ? r2(item.reduce((a, i) => a + i.total_skor, 0) / n) : 0,
    tanggal_terakhir: n ? item.reduce((m, i) => (i.tanggal > m ? i.tanggal : m), '') : null,
    distribusi_status: STATUS_ORDER.map((status) => ({ status, jumlah: distU[status] })),
    rata_faktor: Object.fromEntries(FAKTOR.map((f) => [f, n ? r2(item.reduce((a, i) => a + i._faktor[f], 0) / n) : 0])),
  };
  umkmBlok.prioritas = urutPrioritas(item).map(({ _faktor, ...rest }) => rest);

  const k = kpi.rows[0];
  const jumlahDist = Object.fromEntries(dist.rows.map((r) => [r.status, r.jumlah]));
  const rf = faktor.rows[0];

  ok(res, {
    kpi: {
      jumlah_umkm: umkm.rows[0].n,
      jumlah_survei: k.jumlah_survei,
      rata_skor: r2(k.rata_skor),
      persen_sehat: k.jumlah_survei ? Math.round((k.sehat / k.jumlah_survei) * 1000) / 10 : 0,
    },
    distribusi_status: STATUS_ORDER.map((status) => ({ status, jumlah: jumlahDist[status] || 0 })),
    rata_faktor: Object.fromEntries(FAKTOR.map((f) => [f, r2(rf[f])])),
    per_sektor: sektor.rows.map((r) => ({ ...r, rata_skor: r2(r.rata_skor) })),
    per_kota: kota.rows.map((r) => ({ ...r, rata_skor: r2(r.rata_skor) })),
    filter_opsi: { sektor: opsiSektor.rows, kota: opsiKota.rows.map((r) => r.kota) },
    umkm: umkmBlok,
    dibuat_pada: new Date().toISOString(),
  });
});
