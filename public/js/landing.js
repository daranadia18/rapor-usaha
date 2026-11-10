// Beranda: contoh antarmuka statis yang dibangun dari komponen yang sama dengan aplikasi
import { initPage } from './auth-guard.js';
import { $$ } from './ui.js';
import { miniTrack, deltaHtml } from './track.js';

await initPage();

const tgl = ['2026-03-04', '2026-06-04', '2026-09-04'];
const jejakDari = angka => angka.map((n, i) => ({ tanggal: tgl[i], total_skor: n }));
$$('[data-mini]').forEach(td => {
  td.innerHTML = miniTrack(jejakDari(td.dataset.mini.split(',').map(Number)));
});
$$('[data-delta]').forEach(td => { td.innerHTML = deltaHtml(Number(td.dataset.delta)); });
