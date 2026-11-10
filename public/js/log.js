// Log penilaian berpaginasi & unduh CSV (GET /api/log), khusus staf
import { api, qs } from './api.js';
import { requireAdmin } from './auth-guard.js';
import { $, esc, fmtNum, fmtWaktu, tampilLoading, tampilGalat, tampilKosong } from './ui.js';
import { chipHtml } from './status.js';

await requireAdmin();

const LIMIT = 20;
let halaman = 1;
const daftar = $('#daftar');
const fSumber = $('#f-sumber'), fStatus = $('#f-status');
const SUMBER = { web: 'Web', webhook: 'Webhook', schedule: 'Jadwal otomatis' };
let namaUmkm = new Map();
api('/api/umkm').then(r => { if (r.ok) { namaUmkm = new Map((r.data || []).map(u => [u.id_umkm, u.nama_umkm])); if (ada) muat(); } });
let ada = false;

async function muat() {
  const f = { sumber: fSumber.value, status: fStatus.value };
  $('#btn-csv').href = '/api/log' + qs({ ...f, format: 'csv' });
  tampilLoading(daftar, 4);
  $('#pager').hidden = true;
  const r = await api('/api/log' + qs({ page: halaman, limit: LIMIT, ...f }));
  if (!r.ok) { tampilGalat(daftar, r.errors[0], muat); return; }
  const { items, total, limit } = r.data;
  ada = true;
  $('#s-n').textContent = `${fmtNum(total)} catatan`;
  if (!items.length) { tampilKosong(daftar, 'Log kosong', 'Tidak ada catatan penilaian untuk filter ini.'); return; }
  daftar.removeAttribute('aria-busy');
  daftar.innerHTML = `<div class="table-wrap"><table class="table-stack tbl-dense">
    <caption class="sr-only">Log penilaian terbaru di atas</caption>
    <thead><tr><th scope="col" class="num">No. log</th><th scope="col">UMKM</th><th scope="col" class="num">Total /30</th><th scope="col">Status</th><th scope="col">Sumber</th><th scope="col" class="num">Waktu proses</th><th scope="col">Waktu</th></tr></thead>
    <tbody>${items.map(l => `<tr>
      <td class="num" data-label="No. log">${fmtNum(l.log_id)}</td>
      <td data-label="UMKM"><a href="/umkm-detail?id=${encodeURIComponent(l.id_umkm)}">${esc(namaUmkm.get(l.id_umkm) || l.id_umkm)}</a>${namaUmkm.has(l.id_umkm) ? ` <span class="cell-meta">${esc(l.id_umkm)}</span>` : ''}</td>
      <td class="num total" data-label="Total /30">${fmtNum(l.total_skor)}</td>
      <td data-label="Status">${chipHtml(l.status)}</td>
      <td data-label="Sumber"><span class="tag">${esc(SUMBER[l.sumber] || l.sumber)}</span></td>
      <td class="num" data-label="Waktu proses">${l.durasi_ms == null ? '-' : fmtNum(l.durasi_ms) + ' ms'}</td>
      <td data-label="Waktu">${fmtWaktu(l.dibuat_pada)}</td></tr>`).join('')}</tbody></table></div>`;
  const totalHal = Math.max(1, Math.ceil(total / (limit || LIMIT)));
  $('#info-hal').textContent = `Halaman ${fmtNum(halaman)} dari ${fmtNum(totalHal)} (${fmtNum(total)} catatan)`;
  $('#btn-prev').disabled = halaman <= 1;
  $('#btn-next').disabled = halaman >= totalHal;
  $('#pager').hidden = false;
}

function ubahFilter() { halaman = 1; muat(); }
fSumber.addEventListener('change', ubahFilter);
fStatus.addEventListener('change', ubahFilter);
$('#btn-prev').addEventListener('click', () => { halaman = Math.max(1, halaman - 1); muat(); });
$('#btn-next').addEventListener('click', () => { halaman += 1; muat(); });
muat();
