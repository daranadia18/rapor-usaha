// Logika penilaian kesehatan UMKM. Fungsi murni (tanpa DB) supaya
// mudah diuji dan bisa disalin ke Code node n8n.

export const FAKTOR = [
  'sumber_daya', 'kepemimpinan', 'lingkungan_kerja',
  'nilai_organisasi', 'stabilitas', 'kinerja',
];

export const NAMA_FAKTOR = {
  sumber_daya: 'Sumber Daya',
  kepemimpinan: 'Kepemimpinan',
  lingkungan_kerja: 'Lingkungan Kerja',
  nilai_organisasi: 'Nilai Organisasi',
  stabilitas: 'Stabilitas',
  kinerja: 'Kinerja',
};

export const SARAN = {
  sumber_daya: 'Lengkapi modal, peralatan, dan bahan baku utama, lalu catat pemakaiannya agar tidak boros.',
  kepemimpinan: 'Tetapkan target dan pembagian tugas yang jelas, serta adakan rapat singkat rutin dengan karyawan.',
  lingkungan_kerja: 'Rapikan tempat usaha, atur jam kerja yang wajar, dan buka ruang bagi karyawan untuk memberi masukan.',
  nilai_organisasi: 'Rumuskan nilai dan aturan usaha secara sederhana, lalu biasakan semua anggota menjalankannya.',
  stabilitas: 'Buat pembukuan kas sederhana dan siapkan dana cadangan agar usaha tetap berjalan saat penjualan turun.',
  kinerja: 'Pantau penjualan dan kualitas produk setiap bulan, lalu tetapkan target perbaikan yang terukur.',
};

export const REKOMENDASI = {
  SANGAT_SEHAT: 'Pertahankan kinerja! Jadikan UMKM ini sebagai role model.',
  SEHAT: 'Kinerja sudah baik. Tingkatkan faktor yang masih di bawah rata-rata.',
  CUKUP_SEHAT: 'Perlu perbaikan signifikan pada 1-2 faktor kesehatan organisasi.',
  KURANG_SEHAT: 'Prioritas intervensi! Segera konsultasi dengan pendamping UMKM.',
};

export function statusFromTotal(total) {
  if (total >= 25) return { status: 'SANGAT_SEHAT', label: 'Best Practice' };
  if (total >= 19) return { status: 'SEHAT', label: 'Perlu Perhatian' };
  if (total >= 13) return { status: 'CUKUP_SEHAT', label: 'Perlu Intervensi' };
  return { status: 'KURANG_SEHAT', label: 'Prioritas Intervensi' };
}

// Nilai faktor mengikuti modul: Number(v) harus bilangan bulat 1-5
// (string angka seperti "3" diterima, 2.5 / kosong / null ditolak).
function nilaiFaktor(v) {
  if (typeof v !== 'number' && typeof v !== 'string') return NaN;
  return Number(v);
}

export function validate(body) {
  const b = body && typeof body === 'object' ? body : {};
  const errors = [];
  if (typeof b.id_umkm !== 'string' || !/^UMKM\d{3}$/.test(b.id_umkm)) {
    errors.push('id_umkm harus berformat UMKMxxx');
  }
  for (const f of FAKTOR) {
    const v = nilaiFaktor(b[f]);
    if (!Number.isInteger(v) || v < 1 || v > 5) errors.push(f + ' harus bilangan bulat 1-5');
  }
  return errors;
}

// Asumsi: body sudah lolos validate().
export function predict(body) {
  const skor_faktor = {};
  for (const f of FAKTOR) skor_faktor[f] = Number(body[f]);
  const total_skor = FAKTOR.reduce((a, f) => a + skor_faktor[f], 0);
  const { status, label } = statusFromTotal(total_skor);
  const min = Math.min(...FAKTOR.map((f) => skor_faktor[f]));
  const faktor_terlemah = FAKTOR.filter((f) => skor_faktor[f] === min).map((f) => ({
    faktor: f, nama: NAMA_FAKTOR[f], skor: min, saran: SARAN[f],
  }));
  return {
    id_umkm: body.id_umkm, total_skor, status, label,
    rekomendasi: REKOMENDASI[status], skor_faktor, faktor_terlemah,
  };
}

// Skor SUS: butir ganjil = j-1, genap = 5-j, jumlah x 2,5 (rentang 0-100).
// Mengembalikan null bila jawaban tidak valid.
export function susScore(jawaban) {
  if (!Array.isArray(jawaban) || jawaban.length !== 10) return null;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const j = jawaban[i];
    if (!Number.isInteger(j) || j < 1 || j > 5) return null;
    sum += i % 2 === 0 ? j - 1 : 5 - j;
  }
  return sum * 2.5;
}
