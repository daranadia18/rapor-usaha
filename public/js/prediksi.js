// Penilaian kesehatan UMKM (POST /api/predict, POST /api/umkm).
// Enam faktor dimulai "belum dinilai"; tombol simpan baru aktif setelah semuanya dinilai.
import { api } from './api.js';
import { initPage } from './auth-guard.js';
import { $, $$, esc, fmtNum, icon, isiSelect, tampilAlert, tampilLoading, tampilGalat, bacaQuery, debounce } from './ui.js';
import { FAKTOR, NIVEL, STATUS, statusDariTotal, chipHtml } from './status.js';
import { liveTrackSvg, setLive, bandChart, deltaHtml } from './track.js';

await initPage();
document.body.classList.add('pg-nilai');

const muatAwal = $('#muat-awal');
const konten = $('#konten');
const selUmkm = $('#umkm-pilih');
const cari = $('#umkm-cari');
let daftarUmkm = [];
let sektorOpsi = [];

// ---------- Muat daftar UMKM + sektor ----------
async function muat() {
  konten.hidden = true;
  tampilLoading(muatAwal, 2);
  const [ru, rs] = await Promise.all([api('/api/umkm'), api('/api/ringkasan')]);
  if (!ru.ok) { tampilGalat(muatAwal, ru.errors[0], muat); return; }
  muatAwal.innerHTML = '';
  muatAwal.removeAttribute('aria-busy');
  daftarUmkm = ru.data || [];
  sektorOpsi = rs.ok ? rs.data.filter_opsi.sektor : [];
  if (!sektorOpsi.length) {
    const seen = new Map();
    daftarUmkm.forEach(u => seen.set(u.sektor_id, u.nama_sektor));
    sektorOpsi = [...seen].map(([sektor_id, nama_sektor]) => ({ sektor_id, nama_sektor }));
  }
  isiSelect($('#t-sektor'), sektorOpsi.map(s => ({ value: s.sektor_id, label: s.nama_sektor })), 'Pilih sektor');
  konten.hidden = false;
  gambarPilihan(bacaQuery().get('id') || '');
}

function gambarPilihan(pilihId) {
  const kata = cari.value.trim().toLowerCase();
  const cocok = daftarUmkm.filter(u => !kata || (u.nama_umkm + ' ' + u.id_umkm + ' ' + u.kota).toLowerCase().includes(kata));
  const sebelumnya = pilihId || selUmkm.value;
  isiSelect(selUmkm, cocok.map(u => ({ value: u.id_umkm, label: `${u.id_umkm} - ${u.nama_umkm} (${u.kota})` })),
    cocok.length ? 'Pilih UMKM...' : 'Tidak ada UMKM yang cocok');
  if (sebelumnya && cocok.some(u => u.id_umkm === sebelumnya)) selUmkm.value = sebelumnya;
  $('#umkm-hint').textContent = `${cocok.length} UMKM ditampilkan.`;
}

cari.addEventListener('input', () => gambarPilihan());

// ---------- Tambah UMKM ----------
const formTambah = $('#form-tambah');
const btnTambah = $('#btn-tambah');
function bukaFormTambah(buka) {
  formTambah.hidden = !buka;
  btnTambah.setAttribute('aria-expanded', String(buka));
  if (buka) $('#t-nama').focus();
}
btnTambah.addEventListener('click', () => bukaFormTambah(formTambah.hidden));

formTambah.addEventListener('submit', async e => {
  e.preventDefault();
  const body = { nama_umkm: $('#t-nama').value.trim(), sektor_id: Number($('#t-sektor').value), kota: $('#t-kota').value.trim() };
  const alertEl = $('#tambah-alert');
  if (!body.nama_umkm || !body.sektor_id || !body.kota) { tampilAlert(alertEl, ['Nama, sektor, dan kota wajib diisi.']); return; }
  const btn = $('#t-submit');
  btn.disabled = true; btn.textContent = 'Menyimpan...';
  const r = await api('/api/umkm', { method: 'POST', body });
  btn.disabled = false; btn.textContent = 'Simpan UMKM';
  if (!r.ok) { tampilAlert(alertEl, r.errors); return; }
  const baru = r.data.umkm;
  const sektor = sektorOpsi.find(s => Number(s.sektor_id) === Number(baru.sektor_id));
  daftarUmkm.push({ ...baru, nama_sektor: baru.nama_sektor || (sektor && sektor.nama_sektor) || '', jumlah_survei: 0, jejak: [] });
  cari.value = '';
  gambarPilihan(baru.id_umkm);
  formTambah.reset();
  tampilAlert(alertEl, [`UMKM ${baru.id_umkm} berhasil ditambahkan dan sudah dipilih.`], 'ok');
  formTambah.hidden = true; btnTambah.setAttribute('aria-expanded', 'false');
  $('#umkm-hint').textContent = `UMKM ${baru.id_umkm} - ${baru.nama_umkm} dipilih.`;
});

// ---------- Enam faktor: kelompok radio 1-5, awalnya belum dinilai ----------
const listEl = $('#faktor-list');
listEl.innerHTML = FAKTOR.map((f, i) => `
  <fieldset class="factor" data-key="${f.key}">
    <legend>${i + 1}. ${esc(f.nama)}</legend>
    <p class="f-desc" id="d-${f.key}">${esc(f.info)}</p>
    <div class="seg">${[1, 2, 3, 4, 5].map(n => `
      <label><input type="radio" name="${f.key}" value="${n}" aria-label="${n} dari 5, ${NIVEL[n - 1].toLowerCase()}" aria-describedby="d-${f.key} l-${f.key}"><span>${n}</span></label>`).join('')}
    </div>
    <p class="f-level unrated" id="l-${f.key}"></p>
  </fieldset>`).join('');

function nilai() {
  return Object.fromEntries(FAKTOR.map(f => {
    const c = listEl.querySelector(`input[name="${f.key}"]:checked`);
    return [f.key, c ? Number(c.value) : null];
  }));
}

const lvChart = $('#lv-chart');
lvChart.innerHTML = liveTrackSvg();
const lvSvg = lvChart.firstElementChild;
const katakanSr = debounce(t => { $('#lv-sr').textContent = t; }, 900);

function perbarui() {
  const v = nilai();
  let jumlahDinilai = 0, sum = 0;
  FAKTOR.forEach(f => {
    const n = v[f.key], el = $('#l-' + f.key);
    if (n == null) {
      el.className = 'f-level unrated';
      el.innerHTML = `Belum dinilai<span class="anchor">1: ${esc(f.level[0])} 5: ${esc(f.level[4])}</span>`;
    } else {
      el.className = 'f-level';
      el.innerHTML = `<strong>${n} dari 5 &middot; ${NIVEL[n - 1]}.</strong> ${esc(f.level[n - 1])}`;
      jumlahDinilai++; sum += n;
    }
  });
  const sisa = FAKTOR.length - jumlahDinilai;
  const lengkap = sisa === 0;
  const total = lengkap ? sum : null;
  setLive(lvSvg, lengkap ? { total } : { total: null, min: jumlahDinilai ? sum + sisa : null, max: sum + sisa * 5 });
  const st = lengkap ? statusDariTotal(total) : null;
  $('#lv-total').textContent = lengkap ? total : '–';
  $('#lb-total').textContent = lengkap ? total : '–';
  const ket = lengkap ? chipHtml(st, { label: 'sebaris' })
    : `Lengkapi ${sisa} faktor lagi${jumlahDinilai ? `<br><span class="muted">Total akan berada di ${sum + sisa}&ndash;${sum + sisa * 5}</span>` : ''}`;
  $('#lv-line').innerHTML = ket;
  $('#lb-stt').innerHTML = lengkap ? chipHtml(st) : `Lengkapi ${sisa} faktor lagi`;
  $('#btn-simpan').setAttribute('aria-disabled', String(!lengkap));
  katakanSr(lengkap ? `Semua faktor sudah dinilai. Total ${total} dari 30, ${STATUS[st].teks}, ${STATUS[st].label}.` : `Lengkapi ${sisa} faktor lagi.`);
}
listEl.addEventListener('change', perbarui);
perbarui();

// ---------- Simpan penilaian ----------
const formNilai = $('#form-penilaian');
const hasilEl = $('#hasil');
const hasilIsi = $('#hasil-isi');
let sedangKirim = false;

formNilai.addEventListener('submit', async e => {
  e.preventDefault();
  if (sedangKirim) return;
  const alertEl = $('#submit-alert');
  alertEl.innerHTML = '';
  const id = selUmkm.value;
  if (!id) { tampilAlert(alertEl, ['Pilih UMKM terlebih dahulu.']); selUmkm.focus(); return; }
  const v = nilai();
  const kurang = FAKTOR.filter(f => v[f.key] == null);
  if (kurang.length) {
    tampilAlert(alertEl, [`Faktor yang belum dinilai: ${kurang.map(f => f.nama).join(', ')}.`]);
    listEl.querySelector(`input[name="${kurang[0].key}"]`).focus();
    return;
  }
  const btn = $('#btn-simpan');
  sedangKirim = true; btn.setAttribute('aria-disabled', 'true'); btn.textContent = 'Menyimpan...';
  const mulai = performance.now();
  const r = await api('/api/predict', { method: 'POST', body: { id_umkm: id, ...v } });
  const klien = Math.round(performance.now() - mulai);
  sedangKirim = false; btn.textContent = 'Simpan penilaian'; btn.setAttribute('aria-disabled', 'false');
  if (!r.ok) { tampilAlert(alertEl, r.errors); return; }
  tampilHasil(r.data, r.meta, klien);
});

function panduan(status) {
  return {
    SANGAT_SEHAT: 'Tidak perlu intervensi. Pertimbangkan sebagai contoh praktik baik untuk UMKM lain.',
    SEHAT: 'Pantau berkala. Belum perlu intervensi, tetapi awasi faktor terlemah.',
    CUKUP_SEHAT: 'Masuk daftar intervensi. Rencanakan pendampingan untuk faktor terlemah.',
    KURANG_SEHAT: 'Prioritas kunjungan. Jadwalkan pendampingan segera, mulai dari faktor terlemah.',
  }[status];
}

function tampilHasil(d, meta, klienMs) {
  const total = Number(d.total_skor);
  const st = d.status || statusDariTotal(total);
  const u = daftarUmkm.find(x => x.id_umkm === d.id_umkm);
  const lama = (u && Array.isArray(u.jejak)) ? u.jejak : [];
  const prev = lama.length ? Number(lama[lama.length - 1].total_skor) : null;
  const perubahan = prev == null ? null : total - prev;
  const hariIni = new Date().toLocaleDateString('sv-SE');
  const jejak = [...lama, { tanggal: hariIni, total_skor: total }].slice(-8);
  if (u) { u.jejak = jejak; u.skor_sebelumnya = prev; u.skor_terakhir = total; u.perubahan = perubahan; u.status_terakhir = st; u.jumlah_survei = (u.jumlah_survei || 0) + 1; }

  const lemah = (Array.isArray(d.faktor_terlemah) ? d.faktor_terlemah : []).map(f => `
    <li><strong>${esc(f.nama || f.faktor)}</strong> <span class="muted">(skor ${fmtNum(f.skor)} dari 5)</span>
      <p class="small">${esc(f.saran || '')}</p></li>`).join('');
  hasilIsi.innerHTML = `
    <div class="result-head">
      <div class="result-total">${fmtNum(total)}<small> / 30</small></div>
      <div>${chipHtml(st, { label: 'sebaris', besar: true })}<p style="margin:8px 0 0">${perubahan == null ? 'Survei pertama untuk UMKM ini.' : deltaHtml(perubahan) + ' dibanding survei sebelumnya'}</p></div>
    </div>
    <p class="guide">${esc(panduan(st))}</p>
    <div class="chart-block" id="hasil-chart"></div>
    <h3 class="hasil-sec">Faktor terlemah</h3>
    <ul class="weak-list">${lemah || '<li class="muted">Tidak ada data faktor.</li>'}</ul>
    ${d.rekomendasi ? `<h3 class="hasil-sec">Rekomendasi</h3><p>${esc(d.rekomendasi)}</p>` : ''}
    <p class="perf">${meta && meta.durasi_ms != null ? `Diproses dalam ${fmtNum(meta.durasi_ms)} ms` : ''}</p>
    <details class="tech"><summary>Detail teknis</summary>
      <p>Mesin penghitung: ${esc(meta && meta.engine ? meta.engine : '-')}</p>
      <p>Waktu total di browser: ${fmtNum(klienMs)} ms</p>
      <p>ID survei: ${esc(d.survei_id ?? '-')}</p></details>
    <div class="row actions-row">
      <a class="btn btn-primary" href="/umkm-detail?id=${encodeURIComponent(d.id_umkm)}">Lihat profil UMKM ${icon('panah')}</a>
      <a class="btn btn-outline" href="/dashboard">Daftar prioritas</a>
      <button type="button" class="btn btn-outline" id="btn-lagi">Penilaian baru</button>
    </div>`;
  hasilEl.hidden = false;
  const gambarChart = () => { const c = $('#hasil-chart'); if (c) c.innerHTML = bandChart(jejak, { width: c.clientWidth || 640, perubahan }); };
  gambarChart();
  $('#btn-lagi').addEventListener('click', () => {
    $$('input[type=radio]', listEl).forEach(r => { r.checked = false; });
    perbarui();
    hasilEl.hidden = true;
    $('#faktor-judul').scrollIntoView({ behavior: 'smooth' });
    listEl.querySelector('input').focus({ preventScroll: true });
  });
  const h = $('#h-hasil');
  h.focus({ preventScroll: true });
  hasilEl.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
}

muat();
