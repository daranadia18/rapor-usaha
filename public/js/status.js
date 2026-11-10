// Satu sumber untuk ambang, label, dan warna status. Sama dengan kontrak API;
// dipakai untuk pratinjau di browser. Hasil resmi tetap dari server (POST /api/predict).

export const NIVEL = ['Sangat lemah', 'Lemah', 'Sedang', 'Baik', 'Sangat baik'];

export const FAKTOR = [
  { key: 'sumber_daya', nama: 'Sumber Daya',
    info: 'Kecukupan modal, peralatan, bahan baku, dan tenaga kerja untuk menjalankan usaha.',
    level: ['Sangat kekurangan modal, alat, atau tenaga kerja.', 'Sering kekurangan; kebutuhan pokok baru sebagian terpenuhi.',
      'Cukup untuk operasional harian, belum ada cadangan.', 'Memadai dan tertata; sesekali perlu tambahan.', 'Lebih dari cukup dan tertata baik.'] },
  { key: 'kepemimpinan', nama: 'Kepemimpinan',
    info: 'Kemampuan pemilik atau pengelola memberi arah, mengambil keputusan, dan memotivasi pekerja.',
    level: ['Arah usaha tidak jelas, keputusan sering tertunda.', 'Arah ada tetapi sering berubah; keputusan lambat.',
      'Arah cukup jelas; keputusan kadang masih tertunda.', 'Arah jelas dan diikuti pekerja; keputusan umumnya tepat.', 'Arah jelas, keputusan cepat dan tepat.'] },
  { key: 'lingkungan_kerja', nama: 'Lingkungan Kerja',
    info: 'Kenyamanan, keselamatan, kebersihan, dan kerja sama di tempat usaha.',
    level: ['Tempat kerja tidak nyaman atau kurang aman.', 'Sering ada gangguan kenyamanan atau keselamatan.',
      'Cukup nyaman dan aman; kerja sama belum rutin.', 'Nyaman dan aman; kerja sama baik.', 'Tempat kerja nyaman, aman, dan kompak.'] },
  { key: 'nilai_organisasi', nama: 'Nilai Organisasi',
    info: 'Budaya, etika, dan komitmen usaha terhadap pelanggan serta pekerja.',
    level: ['Nilai usaha belum dirumuskan atau tidak dijalankan.', 'Nilai dikenal sebagian orang, jarang dijalankan.',
      'Nilai dikenal dan dijalankan, tetapi belum konsisten.', 'Nilai dijalankan di sebagian besar kegiatan.', 'Nilai usaha jelas dan dijalankan sehari-hari.'] },
  { key: 'stabilitas', nama: 'Stabilitas',
    info: 'Kesinambungan usaha: pendapatan, pasokan bahan, dan pelanggan yang relatif tetap.',
    level: ['Pendapatan dan pasokan sangat naik-turun.', 'Pendapatan sering turun; pasokan kadang terputus.',
      'Cukup stabil, sesekali bergejolak.', 'Umumnya stabil; gejolak kecil cepat teratasi.', 'Pendapatan dan pasokan stabil dari waktu ke waktu.'] },
  { key: 'kinerja', nama: 'Kinerja',
    info: 'Hasil usaha: penjualan, kualitas produk atau jasa, dan pencapaian target.',
    level: ['Target jarang tercapai, kualitas tidak konsisten.', 'Target tercapai sesekali; kualitas naik-turun.',
      'Sebagian target tercapai; kualitas cukup.', 'Sebagian besar target tercapai; kualitas baik.', 'Target tercapai, kualitas konsisten.'] },
];

export const FAKTOR_KEYS = FAKTOR.map(f => f.key);
export const FAKTOR_NAMA = Object.fromEntries(FAKTOR.map(f => [f.key, f.nama]));

// Urutan dari terbaik ke terburuk. batas = skor terendah pita; css = nama kelas pita.
export const STATUS = {
  SANGAT_SEHAT: { label: 'Best Practice', teks: 'Sangat Sehat', min: 25, max: 30, css: 'sangat', rentang: '≥ 25' },
  SEHAT: { label: 'Perlu Perhatian', teks: 'Sehat', min: 19, max: 24, css: 'sehat', rentang: '19–24' },
  CUKUP_SEHAT: { label: 'Perlu Intervensi', teks: 'Cukup Sehat', min: 13, max: 18, css: 'cukup', rentang: '13–18' },
  KURANG_SEHAT: { label: 'Prioritas Intervensi', teks: 'Kurang Sehat', min: 6, max: 12, css: 'kurang', rentang: '≤ 12' },
};
export const STATUS_KEYS = Object.keys(STATUS);
// Dari yang terberat ke terbaik (dipakai untuk urutan sumbu dan bar tumpuk)
export const STATUS_BERAT = ['KURANG_SEHAT', 'CUKUP_SEHAT', 'SEHAT', 'SANGAT_SEHAT'];

export function statusDariTotal(total) {
  if (total >= 25) return 'SANGAT_SEHAT';
  if (total >= 19) return 'SEHAT';
  if (total >= 13) return 'CUKUP_SEHAT';
  return 'KURANG_SEHAT';
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Chip status: nama ramah + (opsional) label modul. Teks selalu ada, tidak hanya warna.
// opsi.label: 'bawah' (label modul di baris kedua), 'sebaris' (satu chip "Sehat · Perlu Perhatian"), false.
export function chipHtml(status, { label = false, besar = false } = {}) {
  const s = STATUS[status];
  if (!s) return '<span class="chip chip-none">Belum disurvei</span>';
  const cls = `chip st-${status}${besar ? ' chip-lg' : ''}`;
  if (label === 'sebaris') return `<span class="${cls}">${esc(s.teks)} · ${esc(s.label)}</span>`;
  if (label === 'bawah') return `<span class="stat"><span class="${cls}">${esc(s.teks)}</span><span class="modul">${esc(s.label)}</span></span>`;
  return `<span class="${cls}">${esc(s.teks)}</span>`;
}
// Nama lama dipertahankan agar pemanggil lain tetap jalan
export const badgeHtml = (status, o) => chipHtml(status, o);
