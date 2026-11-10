// Profil UMKM: pita status penuh, perbandingan faktor, riwayat (GET /api/umkm/:id)
import { api } from './api.js';
import { initPage } from './auth-guard.js';
import { $, esc, fmtNum, fmtTanggal, fmtTanggalPanjang, bacaQuery, tampilLoading, tampilGalat, tampilKosong } from './ui.js';
import { chipHtml, FAKTOR } from './status.js';
import { bandChart, faktorBars, deltaHtml } from './track.js';

await initPage();
const area = $('#status-area');
const isi = $('#isi');
const id = bacaQuery().get('id') || '';

async function muat() {
  isi.hidden = true;
  if (!id) {
    tampilKosong(area, 'UMKM belum dipilih', 'Pilih UMKM dari daftar, atau tambahkan UMKM baru lewat halaman Penilaian.',
      '<a class="btn btn-primary" href="/prediksi">Ke halaman Penilaian</a>');
    return;
  }
  tampilLoading(area, 3);
  const r = await api('/api/umkm/' + encodeURIComponent(id));
  if (r.status === 404 || r.status === 403) {
    tampilKosong(area, r.status === 404 ? 'UMKM tidak ditemukan' : 'Akses ditolak', r.errors[0],
      '<a class="btn btn-outline" href="/umkm">Kembali ke daftar</a>', 'peringatan');
    return;
  }
  if (!r.ok) { tampilGalat(area, r.errors[0], muat); return; }
  area.innerHTML = ''; area.removeAttribute('aria-busy');
  isi.hidden = false;
  gambar(r.data);
}

function gambar({ umkm, riwayat, perbandingan }) {
  document.title = `${umkm.nama_umkm} - Rapor Usaha`;
  $('#nama-umkm').textContent = umkm.nama_umkm;
  $('#u-meta').innerHTML = [umkm.id_umkm, 'Sektor ' + umkm.nama_sektor, umkm.kota, fmtNum(riwayat.length) + ' survei']
    .map(t => `<span>${esc(t)}</span>`).join('<span class="dot" aria-hidden="true"></span>');
  $('#btn-survei').href = '/prediksi?id=' + encodeURIComponent(umkm.id_umkm);
  $('#btn-banding').href = '/perbandingan?a=' + encodeURIComponent(umkm.id_umkm);

  const jejak = riwayat.map(s => ({ tanggal: s.tanggal, total_skor: s.total_skor }));
  const terakhir = riwayat[riwayat.length - 1];
  const prev = riwayat.length > 1 ? riwayat[riwayat.length - 2] : null;
  const perubahan = prev ? terakhir.total_skor - prev.total_skor : null;
  $('#u-skor').innerHTML = terakhir ? `${fmtNum(terakhir.total_skor)}<small> / 30</small>` : '';
  $('#u-badge').innerHTML = terakhir ? chipHtml(terakhir.status, { label: 'sebaris', besar: true }) : chipHtml(null);
  $('#u-tgl').innerHTML = terakhir ? `<span>Survei ${esc(fmtTanggalPanjang(terakhir.tanggal))}</span>${prev ? deltaHtml(perubahan) : ''}` : '';

  const tren = $('#tren-isi');
  if (!riwayat.length) {
    tampilKosong(tren, 'Belum ada survei', 'UMKM ini belum pernah dinilai.', `<a class="btn btn-primary" href="/prediksi?id=${encodeURIComponent(umkm.id_umkm)}">Isi survei pertama</a>`);
  } else {
    const gambarTren = () => { tren.innerHTML = bandChart(jejak, { width: tren.clientWidth || 720, perubahan }); };
    gambarTren();
    let lebar = tren.clientWidth;
    if (window.ResizeObserver) new ResizeObserver(() => {
      if (Math.abs(tren.clientWidth - lebar) > 8) { lebar = tren.clientWidth; gambarTren(); }
    }).observe(tren);
  }

  $('#tbody-riwayat').innerHTML = riwayat.length
    ? [...riwayat].reverse().map(s => `<tr><th scope="row" data-label="Tanggal">${esc(fmtTanggal(s.tanggal))}</th>` +
        FAKTOR.map(f => `<td class="num" data-label="${esc(f.nama)}">${fmtNum(s[f.key])}</td>`).join('') +
        `<td class="num total" data-label="Total">${fmtNum(s.total_skor)}</td><td data-label="Status">${chipHtml(s.status)}</td></tr>`).join('')
    : '<tr><td colspan="9" class="muted">Belum ada riwayat survei.</td></tr>';

  gambarBanding(umkm, terakhir, perbandingan, riwayat.length);
}

function gambarBanding(umkm, terakhir, p, jumlahSurvei) {
  const el = $('#banding-isi');
  if (!terakhir) {
    tampilKosong(el, 'Belum bisa dibandingkan', 'Perbandingan muncul setelah UMKM ini memiliki minimal satu survei.',
      `<a class="btn btn-primary" href="/prediksi?id=${encodeURIComponent(umkm.id_umkm)}">Isi survei sekarang</a>`);
    return;
  }
  const rows = FAKTOR.map(f => {
    const v = Number(p ? p.skor_terakhir[f.key] : terakhir[f.key]);
    const rata = p ? Number(p.rata_sektor[f.key]) : null;
    return { nama: f.nama, nilai: v, rata, flag: rata != null && v < rata ? 'di bawah rata-rata sektor' : '' };
  });
  el.innerHTML = faktorBars(rows, { rataLabel: 'rata-rata sektor', lebarNama: 190 }) +
    (p ? '<div class="legend-line"><span><i class="lg-bar"></i>UMKM ini, survei terakhir</span><span><i class="lg-avg"></i>Rata-rata sektor</span></div>' : '');
  const pair = $('#u-pair'), cat = $('#banding-catatan');
  if (p) {
    pair.innerHTML = `<div><dt>Peringkat</dt><dd>${fmtNum(p.peringkat)}<small> dari ${fmtNum(p.dari)} UMKM</small></dd></div>
      <div><dt>Total sektor (rata-rata)</dt><dd>${fmtNum(p.rata_sektor.total_skor, 1)}<small> / 30</small></dd></div>
      <div><dt>Persentil</dt><dd>${fmtNum(p.persentil)}<small>%</small></dd></div>
      <div><dt>Jumlah survei</dt><dd>${fmtNum(jumlahSurvei)}</dd></div>`;
    pair.hidden = false;
    cat.innerHTML = `<p>Persentil: ${fmtNum(p.persentil)}% UMKM memiliki skor terakhir sama atau lebih rendah.</p>`;
    cat.hidden = false;
  } else { pair.hidden = true; cat.hidden = true; }
}

muat();
