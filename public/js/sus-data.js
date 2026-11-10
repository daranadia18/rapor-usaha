// 10 butir System Usability Scale (versi bahasa Indonesia). Ganjil = positif, genap = negatif.
export const SUS_BUTIR = [
  'Saya berpikir akan menggunakan sistem ini lagi.',
  'Saya merasa sistem ini rumit untuk digunakan.',
  'Saya merasa sistem ini mudah digunakan.',
  'Saya membutuhkan bantuan dari orang teknis untuk dapat menggunakan sistem ini.',
  'Saya merasa fitur-fitur sistem ini berjalan dengan semestinya.',
  'Saya merasa ada banyak hal yang tidak konsisten (tidak serasi) pada sistem ini.',
  'Saya merasa orang lain akan memahami cara menggunakan sistem ini dengan cepat.',
  'Saya merasa sistem ini membingungkan.',
  'Saya merasa tidak ada hambatan dalam menggunakan sistem ini.',
  'Saya perlu membiasakan diri terlebih dahulu sebelum menggunakan sistem ini.',
];

export const SUS_PILIHAN = ['Sangat tidak setuju', 'Tidak setuju', 'Netral', 'Setuju', 'Sangat setuju'];

export const SUS_BENCHMARK = 68; // rata-rata global SUS
export const SUS_TARGET = 80;    // target modul K3

// Hitung skor SUS: ganjil (j-1), genap (5-j), jumlah x 2,5
export function hitungSus(jawaban) {
  const total = jawaban.reduce((s, j, i) => s + ((i + 1) % 2 === 1 ? j - 1 : 5 - j), 0);
  return total * 2.5;
}
