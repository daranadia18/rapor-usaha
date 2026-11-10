// Fungsi murni untuk tren skor per UMKM (jejak, perubahan, urutan prioritas).
import { statusFromTotal } from './predict.js';

const URUT_STATUS = { KURANG_SEHAT: 0, CUKUP_SEHAT: 1, SEHAT: 2, SANGAT_SEHAT: 3 };

// Selisih skor terakhir dan sebelumnya; null bila belum ada survei sebelumnya.
export function perubahan(total, sebelumnya) {
  return sebelumnya === null || sebelumnya === undefined ? null : total - sebelumnya;
}

// rows: survei satu UMKM, urut tanggal naik ({tanggal, total_skor, ...faktor}).
// Mengembalikan null bila kosong.
export function ringkasJejak(rows) {
  if (!rows.length) return null;
  const last = rows[rows.length - 1];
  const prev = rows.length > 1 ? rows[rows.length - 2].total_skor : null;
  return {
    terakhir: last,
    skor_sebelumnya: prev,
    perubahan: perubahan(last.total_skor, prev),
    jejak: rows.slice(-8).map((r) => ({ tanggal: r.tanggal, total_skor: r.total_skor })),
  };
}

// Urut: status paling berat dulu, lalu perubahan paling negatif (null terakhir), lalu total naik.
export function urutPrioritas(list) {
  return [...list].sort((a, b) => {
    const s = URUT_STATUS[statusFromTotal(a.total_skor).status] - URUT_STATUS[statusFromTotal(b.total_skor).status];
    if (s) return s;
    if (a.perubahan !== b.perubahan) {
      if (a.perubahan === null) return 1;
      if (b.perubahan === null) return -1;
      return a.perubahan - b.perubahan;
    }
    return a.total_skor - b.total_skor || String(a.id_umkm).localeCompare(String(b.id_umkm));
  });
}
