// Perbandingan faktor UMKM dengan rata-rata sektor / UMKM lain (GET /api/umkm/:id)
import { api } from './api.js';
import { initPage } from './auth-guard.js';
import { $, esc, fmtNum, isiSelect, bacaQuery, tampilLoading, tampilGalat, tampilKosong } from './ui.js';
import { FAKTOR } from './status.js';
import { faktorBars } from './track.js';

await initPage();
const area = $('#status-area');
const hasil = $('#hasil');
const selA = $('#p-a'), selB = $('#p-b');
let daftar = [];

async function muat() {
  tampilLoading(area, 2);
  const r = await api('/api/umkm');
  if (!r.ok) { tampilGalat(area, r.errors[0], muat); return; }
  daftar = r.data || [];
  area.innerHTML = ''; area.removeAttribute('aria-busy');
  if (!daftar.length) {
    tampilKosong(area, 'Belum ada UMKM', 'Tambahkan UMKM dan isi penilaian terlebih dahulu.', '<a class="btn btn-primary" href="/prediksi">Ke Penilaian</a>');
    return;
  }
  $('#form-pilih').hidden = false;
  const opsi = daftar.map(u => ({ value: u.id_umkm, label: `${u.id_umkm} - ${u.nama_umkm}` }));
  isiSelect(selA, opsi, 'Pilih UMKM A...');
  isiSelect(selB, opsi, 'Tanpa pembanding');
  const q = bacaQuery();
  const awalA = q.get('a') || '';
  if (awalA && daftar.some(u => u.id_umkm === awalA)) selA.value = awalA;
  if (q.get('b') && daftar.some(u => u.id_umkm === q.get('b'))) selB.value = q.get('b');
  bandingkan();
}

async function bandingkan() {
  if (!selA.value) { tampilKosong(hasil, 'Pilih UMKM A', 'Pilih satu UMKM untuk mulai membandingkan.', '', 'umkm'); return; }
  tampilLoading(hasil, 4);
  const ids = [selA.value, selB.value].filter(Boolean);
  const res = await Promise.all(ids.map(i => api('/api/umkm/' + encodeURIComponent(i))));
  const gagal = res.find(r => !r.ok);
  if (gagal) { tampilGalat(hasil, gagal.errors[0], bandingkan); return; }
  const [a, b] = res.map(r => r.data);
  gambar(a, b);
}

function gambar(a, b) {
  const pa = a.perbandingan;
  if (!pa) {
    tampilKosong(hasil, `${a.umkm.nama_umkm} belum punya survei`, 'Isi penilaian dulu agar bisa dibandingkan dengan sektor.',
      `<a class="btn btn-primary" href="/prediksi?id=${encodeURIComponent(a.umkm.id_umkm)}">Isi penilaian</a>`);
    return;
  }
  const pb = b ? b.perbandingan : null;
  // Baris batang + kalimat ringkas untuk satu UMKM (dipakai A dan B, supaya keduanya diperlakukan sama)
  const baris = p => FAKTOR.map(f => {
    const v = Number(p.skor_terakhir[f.key]), r = Number(p.rata_sektor[f.key]);
    return { nama: f.nama, nilai: v, rata: r, flag: v < r ? 'di bawah rata-rata sektor' : '' };
  });
  const ringkas = p => {
    const bawah = baris(p).filter(r => r.flag);
    return `<p class="banding-ringkas">${bawah.length
      ? `Di bawah rata-rata sektor: <strong>${bawah.map(r => esc(r.nama)).join(', ')}</strong>. Mulai perbaikan dari faktor ini.`
      : 'Semua faktor sama dengan atau di atas rata-rata sektor.'}</p>`;
  };
  const barisA = baris(pa);
  const barisB = pb ? baris(pb) : null;

  const legenda = u => `<div class="legend-line"><span><i class="lg-bar"></i>${esc(u.umkm.nama_umkm)}</span><span><i class="lg-avg"></i>Rata-rata sektor ${esc(u.umkm.nama_sektor)}</span></div>`;
  hasil.innerHTML = `
    <section class="kpis" aria-label="Ringkasan perbandingan">
      <div class="kpi"><p class="kpi-label">Peringkat ${esc(a.umkm.nama_umkm)}</p><p class="kpi-val">${fmtNum(pa.peringkat)}<small>dari ${fmtNum(pa.dari)} UMKM</small></p></div>
      <div class="kpi"><p class="kpi-label">Total A</p><p class="kpi-val">${fmtNum(pa.skor_terakhir.total_skor, 1)}<small>/ 30</small></p></div>
      <div class="kpi"><p class="kpi-label">Rata-rata sektor ${esc(a.umkm.nama_sektor)}</p><p class="kpi-val">${fmtNum(pa.rata_sektor.total_skor, 1)}<small>/ 30</small></p></div>
      ${pb ? `<div class="kpi"><p class="kpi-label">Total B</p><p class="kpi-val">${fmtNum(pb.skor_terakhir.total_skor, 1)}<small>/ 30</small></p></div>` : ''}
    </section>
    <div class="grid-2">
      <section class="card" aria-labelledby="h-a">
        <div class="card-head"><h2 id="h-a">${esc(a.umkm.nama_umkm)}</h2><span class="note">${esc(a.umkm.nama_sektor)} &middot; skala 1&ndash;5</span></div>
        <div class="card-body">${faktorBars(barisA, { rataLabel: 'rata-rata sektor', lebarNama: 190 })}${legenda(a)}${barisB ? ringkas(pa) : ''}</div>
      </section>
      <section class="card" aria-labelledby="h-ring">
        <div class="card-head"><h2 id="h-ring">${barisB ? esc(b.umkm.nama_umkm) : 'Ringkasan'}</h2>${barisB ? `<span class="note">${esc(b.umkm.nama_sektor)} &middot; skala 1&ndash;5</span>` : ''}</div>
        <div class="card-body">
          ${barisB ? faktorBars(barisB, { rataLabel: 'rata-rata sektor', lebarNama: 190 }) + legenda(b) + ringkas(pb) : ringkas(pa)}
          ${b && !pb ? `<p class="muted small">${esc(b.umkm.nama_umkm)} belum punya survei sehingga tidak ditampilkan.</p>` : ''}
        </div>
        <div class="card-foot"><p>Sumber: data contoh modul, survei terakhir tiap UMKM.</p></div>
      </section>
    </div>`;
  hasil.removeAttribute('aria-busy');
}

selA.addEventListener('change', bandingkan);
selB.addEventListener('change', bandingkan);
muat();
