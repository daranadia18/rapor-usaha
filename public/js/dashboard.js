// Dashboard: rilis ringkasan per UMKM (GET /api/ringkasan), data.umkm = survei terakhir tiap UMKM
import { api, qs } from './api.js';
import { initLayout } from './layout.js';
import { getUser, isAdmin } from './auth-guard.js';
import { $, esc, fmtNum, fmtTetap, fmtTanggalPanjang, isiSelect, icon, tampilLoading, tampilGalat, tampilKosong } from './ui.js';
import { FAKTOR, chipHtml, statusDariTotal } from './status.js';
import { miniTrack, deltaHtml, faktorBars, stackBar } from './track.js';

const user = await getUser();
initLayout(user);
if (isAdmin(user)) $('#btn-csv').hidden = false;

const area = $('#status-area');
const isi = $('#isi');
const selSektor = $('#f-sektor');
const selKota = $('#f-kota');
let opsiTerisi = false;

async function muat() {
  isi.hidden = true;
  tampilLoading(area, 2);
  const r = await api('/api/ringkasan' + qs({ sektor_id: selSektor.value, kota: selKota.value }));
  if (!r.ok) { tampilGalat(area, r.errors[0], muat); return; }
  const d = r.data;
  if (!opsiTerisi && d.filter_opsi) {
    isiSelect(selSektor, d.filter_opsi.sektor.map(s => ({ value: s.sektor_id, label: s.nama_sektor })), 'Semua sektor');
    isiSelect(selKota, d.filter_opsi.kota.map(k => ({ value: k, label: k })), 'Semua kota');
    opsiTerisi = true;
  }
  // Cadangan bila API lama belum punya blok umkm: pakai agregat tingkat survei
  const u = d.umkm || {
    jumlah_umkm: d.kpi.jumlah_umkm, tersurvei: d.kpi.jumlah_umkm, belum_disurvei: 0, perlu_intervensi: null, turun: 0, naik: 0,
    tanggal_terakhir: null, distribusi_status: d.distribusi_status, rata_faktor: d.rata_faktor, prioritas: null,
  };
  area.innerHTML = ''; area.removeAttribute('aria-busy');

  $('#s-tgl').textContent = u.tanggal_terakhir ? 'Data per ' + fmtTanggalPanjang(u.tanggal_terakhir) : 'Belum ada survei';

  if (!u.tersurvei) {
    tampilKosong(area, 'Belum ada data survei', 'Tidak ada survei untuk filter ini. Ubah filter atau isi penilaian baru.',
      '<a class="btn btn-primary" href="/prediksi">Isi penilaian</a>');
    isi.hidden = true;
    return;
  }
  isi.hidden = false;
  $('#catatan').hidden = false;

  // Kartu angka
  $('#k-tersurvei').innerHTML = `${fmtNum(u.tersurvei)}<small>dari ${fmtNum(u.jumlah_umkm)}</small>`;
  $('#k-tersurvei-sub').textContent = u.belum_disurvei > 0 ? `${fmtNum(u.belum_disurvei)} UMKM belum pernah disurvei` : 'Semua UMKM sudah disurvei';
  const perlu = u.perlu_intervensi;
  $('#k-perlu').innerHTML = perlu == null ? '-' : `${fmtNum(perlu)}<small>UMKM</small>`;
  $('#k-perlu-box').classList.toggle('alert', perlu > 0);
  $('#k-perlu-sub').textContent = perlu == null ? '' : perlu === 0 ? 'Tidak ada yang berstatus Perlu atau Prioritas Intervensi'
    : `Berstatus Perlu atau Prioritas Intervensi`;
  const rata = u.rata_skor != null ? Number(u.rata_skor) : (d.kpi && d.kpi.rata_skor != null ? Number(d.kpi.rata_skor) : null);
  $('#k-rata').innerHTML = rata == null ? '-' : `${fmtTetap(rata, 1)}<small>/ 30</small>`;
  $('#k-rata-sub').innerHTML = rata == null ? '' : chipHtml(statusDariTotal(Math.round(rata)), { label: 'sebaris' });
  $('#k-ubah').innerHTML = `<span class="delta-turun">${icon('turun', 'tri')}${fmtNum(u.turun || 0)}</span><span class="delta-naik">${icon('naik', 'tri')}${fmtNum(u.naik || 0)}</span>`;
  $('#k-ubah').setAttribute('aria-label', `${fmtNum(u.turun || 0)} turun, ${fmtNum(u.naik || 0)} naik`);
  $('#k-ubah-sub').textContent = u.turun > 0 ? `${fmtNum(u.turun)} UMKM turun, ${fmtNum(u.naik || 0)} naik` : `${fmtNum(u.naik || 0)} UMKM naik, tidak ada yang turun`;

  // Tabel prioritas (terbuka untuk semua)
  const tab = $('#tabel-prioritas');
  const rows = u.prioritas;
  $('#n-prioritas').textContent = rows ? `${fmtNum(rows.length)} UMKM, status terberat di atas` : '';
  if (!rows || !rows.length) {
    tampilKosong(tab, 'Tidak ada UMKM tersurvei', 'Ubah filter atau isi penilaian baru.');
  } else {
    tab.innerHTML = `<div class="table-wrap"><table class="table-stack">
      <caption class="sr-only">Daftar prioritas UMKM, status terburuk lebih dulu</caption>
      <thead><tr><th scope="col">UMKM</th><th scope="col">Posisi skor</th><th scope="col" class="num">Total /30</th><th scope="col">Status</th><th scope="col">Perubahan</th></tr></thead>
      <tbody>${rows.map((x, i) => `<tr>
        <td class="cell-first"><span class="cell-name"><a href="/umkm-detail?id=${encodeURIComponent(x.id_umkm)}">${esc(x.nama_umkm)}</a></span>
          <span class="cell-meta">${esc(x.id_umkm)} &middot; ${esc(x.nama_sektor)} &middot; ${esc(x.kota)}</span></td>
        <td data-label="Posisi skor">${miniTrack(x.jejak, x.perubahan)}</td>
        <td class="num total" data-label="Total /30">${fmtNum(x.total_skor)}</td>
        <td data-label="Status">${chipHtml(x.status, { label: 'bawah' })}</td>
        <td data-label="Perubahan">${deltaHtml(x.perubahan, { pertama: 'Satu survei' })}</td></tr>`).join('')}</tbody></table></div>`;
  }
  $('#catatan-tabel').textContent = u.belum_disurvei > 0 ? `${fmtNum(u.belum_disurvei)} UMKM belum disurvei dan tidak ditampilkan. Sumber: data contoh modul.` : 'Sumber: data contoh modul. Ambang status 13 / 19 / 25 sesuai modul.';

  // Sebaran status (UMKM, bukan survei)
  const sb = stackBar(u.distribusi_status);
  $('#n-sebaran').textContent = `n = ${fmtNum(sb.total)}`;
  $('#sebaran').innerHTML = sb.html;

  // Rata-rata faktor, panjang batang = nilai persis
  const rf = u.rata_faktor || {};
  const barisF = FAKTOR.filter(f => rf[f.key] != null).map(f => ({ nama: f.nama, nilai: Number(rf[f.key]) }));
  $('#faktor').innerHTML = barisF.length ? faktorBars(barisF, { terlemah: true }) : '<p class="muted">Belum ada data faktor.</p>';
  if (barisF.length) {
    const min = Math.min(...barisF.map(b => b.nilai));
    const nama = barisF.filter(b => b.nilai === min).map(b => b.nama).join(', ');
    $('#catatan-faktor').textContent = `${nama} terendah (${fmtTetap(min, 2)}). Sumber: data contoh modul, survei terakhir tiap UMKM.`;
  }
}

selSektor.addEventListener('change', muat);
selKota.addEventListener('change', muat);
$('#f-reset').addEventListener('click', () => { selSektor.value = ''; selKota.value = ''; muat(); });
muat();
