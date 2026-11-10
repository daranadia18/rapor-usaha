// Daftar UMKM padat (GET /api/umkm) dengan pita status mini per baris
import { api, qs } from './api.js';
import { initLayout } from './layout.js';
import { getUser, isAdmin } from './auth-guard.js';
import { $, esc, fmtNum, fmtTanggal, isiSelect, debounce, tampilLoading, tampilGalat, tampilKosong } from './ui.js';
import { chipHtml } from './status.js';
import { miniTrack, deltaHtml } from './track.js';

const user = await getUser();
initLayout(user);
if (isAdmin(user)) $('#btn-csv').hidden = false;

const daftar = $('#daftar');
const fQ = $('#f-q'), fSektor = $('#f-sektor'), fKota = $('#f-kota');
let opsiTerisi = false;
let permintaanKe = 0;

async function muat() {
  const no = ++permintaanKe;
  tampilLoading(daftar, 3);
  const r = await api('/api/umkm' + qs({ q: fQ.value.trim(), sektor_id: fSektor.value, kota: fKota.value }));
  if (no !== permintaanKe) return;
  if (!r.ok) { tampilGalat(daftar, r.errors[0], muat); return; }
  const rows = r.data || [];
  if (!opsiTerisi) {
    const sektor = new Map(rows.map(u => [u.sektor_id, u.nama_sektor]));
    isiSelect(fSektor, [...sektor].map(([value, label]) => ({ value, label })), 'Semua sektor');
    isiSelect(fKota, [...new Set(rows.map(u => u.kota))].sort().map(k => ({ value: k, label: k })), 'Semua kota');
    opsiTerisi = true;
  }
  $('#jumlah').textContent = `${fmtNum(rows.length)} UMKM`;
  $('#s-n').textContent = `n = ${fmtNum(rows.length)} UMKM`;
  if (!rows.length) {
    tampilKosong(daftar, 'Tidak ada UMKM', 'Ubah kata kunci atau filter, atau tambahkan UMKM baru lewat halaman Penilaian.',
      '<a class="btn btn-primary" href="/prediksi">Ke Penilaian</a>');
    return;
  }
  daftar.removeAttribute('aria-busy');
  daftar.innerHTML = `<div class="table-wrap"><table class="table-stack tbl-dense">
    <caption class="sr-only">Daftar UMKM dengan skor, status, dan perubahan terakhir</caption>
    <thead><tr><th scope="col">UMKM</th><th scope="col">Sektor</th><th scope="col">Kota</th><th scope="col">Posisi skor</th><th scope="col" class="num">Total /30</th><th scope="col">Status</th><th scope="col">Perubahan</th><th scope="col">Survei terakhir</th></tr></thead>
    <tbody>${rows.map(u => `<tr>
      <td class="cell-first"><span class="cell-name"><a href="/umkm-detail?id=${encodeURIComponent(u.id_umkm)}">${esc(u.nama_umkm)}</a></span><span class="cell-meta">${esc(u.id_umkm)}</span></td>
      <td data-label="Sektor">${esc(u.nama_sektor)}</td>
      <td data-label="Kota">${esc(u.kota)}</td>
      <td data-label="Posisi skor">${miniTrack(u.jejak || (u.skor_terakhir == null ? [] : [{ tanggal: u.tanggal_terakhir, total_skor: u.skor_terakhir }]), u.perubahan)}</td>
      <td class="num total" data-label="Total /30">${u.skor_terakhir == null ? '-' : fmtNum(u.skor_terakhir)}</td>
      <td data-label="Status">${chipHtml(u.status_terakhir)}</td>
      <td data-label="Perubahan">${u.skor_terakhir == null ? '<span class="delta delta-none">-</span>' : deltaHtml(u.perubahan, { pertama: 'Satu survei' })}</td>
      <td data-label="Survei terakhir">${fmtTanggal(u.tanggal_terakhir)}</td></tr>`).join('')}</tbody></table></div>`;
}

fQ.addEventListener('input', debounce(muat, 350));
fSektor.addEventListener('change', muat);
fKota.addEventListener('change', muat);
$('#filter-form').addEventListener('submit', e => { e.preventDefault(); muat(); });
muat();
