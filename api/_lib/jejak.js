import { query } from './db.js';
import { FAKTOR } from './predict.js';
import { ringkasJejak } from './tren.js';

// Ambil maks 8 survei terakhir tiap UMKM (window function), lalu ringkas.
// Hasil: Map id_umkm -> ringkasJejak(...) (UMKM tanpa survei tidak ada di Map).
export async function jejakUntuk(ids) {
  const out = new Map();
  if (!ids.length) return out;
  const f = FAKTOR.join(', ');
  const { rows } = await query(
    `SELECT id_umkm, tanggal, total_skor, ${f} FROM (
       SELECT id_umkm, to_char(tanggal, 'YYYY-MM-DD') AS tanggal, total_skor::int AS total_skor, ${f},
              ROW_NUMBER() OVER (PARTITION BY id_umkm ORDER BY tanggal DESC, survei_id DESC) AS rn
       FROM survei WHERE id_umkm = ANY($1::text[])
     ) t WHERE rn <= 8 ORDER BY id_umkm, rn DESC`, [ids]);
  const per = new Map();
  for (const r of rows) {
    if (!per.has(r.id_umkm)) per.set(r.id_umkm, []);
    per.get(r.id_umkm).push(r);
  }
  for (const [id, list] of per) out.set(id, ringkasJejak(list));
  return out;
}
