// Hasil SUS untuk staf (GET /api/sus)
import { api } from './api.js';
import { requireAdmin } from './auth-guard.js';
import { $, esc, fmtNum, fmtWaktu, salinTeks, tampilLoading, tampilGalat, tampilKosong } from './ui.js';
import { SUS_BUTIR, SUS_BENCHMARK, SUS_TARGET } from './sus-data.js';

await requireAdmin();

const area = $('#status-area');
const isi = $('#isi');

const inIter = $('#share-iterasi'), inLink = $('#share-link');
function perbaruiLink() {
  const n = Math.max(1, parseInt(inIter.value, 10) || 1);
  inLink.value = `${location.origin}/sus?iterasi=${n}`;
}
inIter.addEventListener('input', perbaruiLink);
$('#btn-salin').addEventListener('click', e => salinTeks(inLink.value, e.currentTarget));
perbaruiLink();

// Batang skala tetap 0-100 dengan penanda 68 dan 80
function batangSus(nilai, label) {
  const v = Math.max(0, Math.min(100, Number(nilai)));
  return `<div class="sus-track" aria-hidden="true"><i class="fill" style="width:${v}%"></i>` +
    `<i class="ref" style="left:${SUS_BENCHMARK}%"><span>68</span></i><i class="ref" style="left:${SUS_TARGET}%"><span>80</span></i></div>`;
}
function bandingTeks(rata) {
  const r = Number(rata);
  if (r >= SUS_TARGET) return 'Mencapai target 80';
  if (r >= SUS_BENCHMARK) return 'Di atas 68, di bawah target 80';
  return 'Di bawah rata-rata global 68';
}

async function muat() {
  isi.hidden = true;
  tampilLoading(area, 3);
  const r = await api('/api/sus');
  if (!r.ok) { tampilGalat(area, r.errors[0], muat); return; }
  const { per_iterasi, rata_per_butir, responden } = r.data;
  area.innerHTML = ''; area.removeAttribute('aria-busy');
  const n = responden.length;
  $('#s-n').textContent = `n = ${fmtNum(n)} responden`;
  $('#btn-csv').hidden = n === 0;
  if (!n && !per_iterasi.length) {
    $('#headline').textContent = 'Belum ada responden';
    tampilKosong(area, 'Belum ada responden', 'Bagikan tautan kuesioner di bawah untuk mulai mengumpulkan jawaban.');
    return;
  }
  isi.hidden = false;
  if (per_iterasi.length) inIter.value = Math.max(...per_iterasi.map(x => x.iterasi));
  perbaruiLink();

  const akhir = per_iterasi[per_iterasi.length - 1];
  if (akhir) {
    $('#headline').innerHTML = `Iterasi ${fmtNum(akhir.iterasi)}: skor rata-rata <em>${fmtNum(akhir.rata_skor, 1)}</em>`;
    $('#sub-headline').textContent = `${bandingTeks(akhir.rata_skor)}. n = ${fmtNum(akhir.n)} responden pada iterasi ini.`;
    const selisih = Number(akhir.rata_skor) - SUS_TARGET;
    $('#k-rata').innerHTML = `${fmtNum(akhir.rata_skor, 1)}<small>/ 100</small>`;
    $('#k-rata-sub').textContent = `Iterasi ${fmtNum(akhir.iterasi)}, n = ${fmtNum(akhir.n)}`;
    $('#k-target').innerHTML = `${selisih > 0 ? '+' : ''}${fmtNum(selisih, 1)}<small>poin</small>`;
    $('#k-target-sub').textContent = bandingTeks(akhir.rata_skor);
    $('#k-target-box').classList.toggle('alert', selisih < 0);
  }
  $('#k-n').textContent = fmtNum(n);
  $('#k-n-sub').textContent = 'Seluruh iterasi';
  $('#k-iter').textContent = fmtNum(per_iterasi.length);
  $('#k-iter-sub').textContent = per_iterasi.length ? `Iterasi ${fmtNum(per_iterasi[0].iterasi)} sampai ${fmtNum(akhir.iterasi)}` : '';

  $('#iter-isi').innerHTML = `<div class="table-wrap"><table class="table-stack">
    <caption class="sr-only">Skor SUS per iterasi dibanding 68 dan 80</caption>
    <thead><tr><th scope="col">Iterasi</th><th scope="col" class="num">n</th><th scope="col" class="num">Rata-rata</th><th scope="col" class="num">Min</th><th scope="col" class="num">Maks</th><th scope="col">Rata-rata terhadap 68 dan 80</th></tr></thead>
    <tbody>${per_iterasi.map(x => `<tr><th scope="row" data-label="Iterasi">${fmtNum(x.iterasi)}</th>
      <td class="num" data-label="n">${fmtNum(x.n)}</td><td class="num total" data-label="Rata-rata">${fmtNum(x.rata_skor, 1)}</td>
      <td class="num" data-label="Min">${fmtNum(x.min, 1)}</td><td class="num" data-label="Maks">${fmtNum(x.max, 1)}</td>
      <td class="sus-iter-cell" data-label="Terhadap 68 / 80">${batangSus(x.rata_skor)}<span class="sr-only">${esc(bandingTeks(x.rata_skor))}</span></td></tr>`).join('')}</tbody></table></div>
    <div class="card-foot"><p>Garis putus-putus: rata-rata global 68 dan target modul 80. Sumber: respons kuesioner SUS yang masuk.</p></div>`;

  $('#butir-isi').innerHTML = '<ul class="fbars fbars-sus">' + rata_per_butir.map(b => {
    const v = Number(b.rata);
    return `<li class="fbar"><span class="nm">${b.butir}. ${esc(SUS_BUTIR[b.butir - 1])}</span>` +
      `<div class="fbar-track" aria-hidden="true"><i class="fbar-fill" style="width:${v / 5 * 100}%"></i></div><span class="val">${fmtNum(v, 2)}</span></li>`;
  }).join('') + '</ul><p class="src">Rata-rata jawaban 1&ndash;5 per butir (ganjil positif, genap negatif).</p>';

  $('#resp-isi').innerHTML = n
    ? `<div class="table-wrap"><table class="table-stack tbl-dense"><thead><tr><th scope="col">Nama</th><th scope="col">Peran</th><th scope="col" class="num">Iterasi</th><th scope="col" class="num">Skor</th><th scope="col">Waktu</th></tr></thead>
      <tbody>${responden.map(x => `<tr><td data-label="Nama">${esc(x.nama_responden || 'Anonim')}</td><td data-label="Peran">${esc(x.peran || '-')}</td>
        <td class="num" data-label="Iterasi">${fmtNum(x.iterasi)}</td><td class="num" data-label="Skor">${fmtNum(x.skor, 1)}</td><td data-label="Waktu">${fmtWaktu(x.dibuat_pada)}</td></tr>`).join('')}</tbody></table></div>`
    : '<p class="muted empty-pad">Belum ada responden.</p>';
}

muat();
