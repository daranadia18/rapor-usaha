// Pemantauan UMKM yang perlu intervensi (GET /api/pemantauan), terbuka untuk semua
import { api } from './api.js';
import { initPage } from './auth-guard.js';
import { $, esc, fmtNum, fmtTanggal, fmtWaktu, icon, tampilLoading, tampilGalat, tampilKosong } from './ui.js';
import { chipHtml } from './status.js';
import { miniTrack, deltaHtml } from './track.js';

await initPage();

const area = $('#status-area');
const isi = $('#isi');
const urutan = { KURANG_SEHAT: 0, CUKUP_SEHAT: 1 };

async function muat() {
  isi.hidden = true;
  tampilLoading(area, 3);
  const [r, ru] = await Promise.all([api('/api/pemantauan'), api('/api/umkm')]);
  if (!r.ok) { tampilGalat(area, r.errors[0], muat); return; }
  area.innerHTML = ''; area.removeAttribute('aria-busy');
  $('#s-waktu').textContent = 'Dimuat ' + fmtWaktu(new Date().toISOString());
  const jejak = new Map((ru.ok ? ru.data : []).map(u => [u.id_umkm, u.jejak]));

  // Status terberat dulu, lalu penurunan terbesar, lalu skor naik
  const rows = [...(r.data || [])].sort((a, b) =>
    (urutan[a.status] ?? 9) - (urutan[b.status] ?? 9) ||
    (a.perubahan ?? 0) - (b.perubahan ?? 0) || a.total_skor - b.total_skor);
  const chg = $('#change');
  if (!rows.length) {
    $('#headline').textContent = 'Tidak ada UMKM yang perlu intervensi';
    chg.hidden = true;
    tampilKosong(area, 'Semua UMKM tersurvei dalam kondisi sehat', 'Tidak ada tindak lanjut saat ini. Pantau lagi setelah survei berikutnya.');
    return;
  }
  const turun = rows.filter(x => x.perubahan != null && x.perubahan < 0).length;
  $('#headline').textContent = `${fmtNum(rows.length)} UMKM perlu intervensi`;
  $('#k-total').innerHTML = `${fmtNum(rows.length)}<small>UMKM</small>`;
  $('#k-kurang').textContent = fmtNum(rows.filter(x => x.status === 'KURANG_SEHAT').length);
  $('#k-cukup').textContent = fmtNum(rows.filter(x => x.status === 'CUKUP_SEHAT').length);
  $('#k-turun').innerHTML = `${icon('turun', 'tri')}${fmtNum(turun)}`;
  chg.hidden = turun === 0;
  if (turun) chg.innerHTML = `${icon('turun', 'tri')}${fmtNum(turun)} turun sejak survei sebelumnya`;
  isi.hidden = false;
  $('#daftar').innerHTML = `<div class="table-wrap"><table class="table-stack">
    <caption class="sr-only">UMKM yang perlu intervensi, status terberat dulu</caption>
    <thead><tr><th scope="col">UMKM</th><th scope="col">Posisi skor</th><th scope="col" class="num">Total /30</th><th scope="col">Status</th><th scope="col">Perubahan</th><th scope="col">Survei</th><th scope="col"><span class="sr-only">Aksi</span></th></tr></thead>
    <tbody>${rows.map((u, i) => `<tr>
      <td class="cell-first"><span class="cell-name"><span class="muted">${i + 1}.</span> <a href="/umkm-detail?id=${encodeURIComponent(u.id_umkm)}">${esc(u.nama_umkm)}</a></span>
        <span class="cell-meta">${esc(u.id_umkm)} &middot; ${esc(u.nama_sektor)} &middot; ${esc(u.kota)}</span></td>
      <td data-label="Posisi skor">${miniTrack(jejak.get(u.id_umkm) || [{ tanggal: u.tanggal, total_skor: u.total_skor }], u.perubahan)}</td>
      <td class="num total" data-label="Total /30">${fmtNum(u.total_skor)}</td>
      <td data-label="Status">${chipHtml(u.status, { label: 'bawah' })}</td>
      <td data-label="Perubahan">${deltaHtml(u.perubahan, { pertama: 'Satu survei' })}</td>
      <td data-label="Survei">${fmtTanggal(u.tanggal)}</td>
      <td data-label="Aksi"><a class="btn btn-outline btn-sm" href="/umkm-detail?id=${encodeURIComponent(u.id_umkm)}">Buka ${icon('panah')}</a></td></tr>`).join('')}</tbody></table></div>`;
}

$('#btn-segarkan').addEventListener('click', muat);
muat();
