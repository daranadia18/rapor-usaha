// Kuesioner SUS publik (POST /api/sus)
import { api } from './api.js';
import { initPage } from './auth-guard.js';
import { $, esc, fmtNum, bacaQuery, tampilAlert } from './ui.js';
import { SUS_BUTIR, SUS_PILIHAN } from './sus-data.js';

await initPage();

let iterasi = parseInt(bacaQuery().get('iterasi'), 10);
if (!Number.isInteger(iterasi) || iterasi < 1 || iterasi > 1000) iterasi = 1;
$('#iterasi').value = iterasi;
$('#label-iterasi').textContent = iterasi;

$('#butir').innerHTML = SUS_BUTIR.map((teks, i) => `
  <fieldset class="sus-item" id="butir-${i + 1}">
    <legend>${i + 1}. ${esc(teks)}</legend>
    <div class="sus-options">${SUS_PILIHAN.map((p, j) => `
      <label><input type="radio" name="b${i + 1}" value="${j + 1}"><span><b>${j + 1}</b>${esc(p)}</span></label>`).join('')}
    </div>
  </fieldset>`).join('');

const form = $('#form-sus');
function perbaruiProgres() {
  const n = SUS_BUTIR.filter((_, i) => form.querySelector(`input[name="b${i + 1}"]:checked`)).length;
  $('#prog-teks').textContent = `${n}/10 terjawab`;
  $('#prog-bar').style.width = (n * 10) + '%';
}
form.addEventListener('change', perbaruiProgres);

form.addEventListener('submit', async e => {
  e.preventDefault();
  const jawaban = SUS_BUTIR.map((_, i) => {
    const c = form.querySelector(`input[name="b${i + 1}"]:checked`);
    return c ? Number(c.value) : null;
  });
  const kosong = jawaban.map((v, i) => (v === null ? i + 1 : null)).filter(Boolean);
  const alertEl = $('#form-alert');
  if (kosong.length) {
    tampilAlert(alertEl, [`Pernyataan nomor ${kosong.join(', ')} belum dijawab.`]);
    form.querySelector(`input[name="b${kosong[0]}"]`).focus();
    return;
  }
  const body = { iterasi, jawaban };
  const nama = $('#nama').value.trim(), peran = $('#peran').value.trim();
  if (nama) body.nama_responden = nama;
  if (peran) body.peran = peran;

  const btn = $('#btn-kirim');
  btn.disabled = true; btn.textContent = 'Mengirim...';
  const r = await api('/api/sus', { method: 'POST', body });
  if (!r.ok) {
    btn.disabled = false; btn.textContent = 'Kirim jawaban';
    tampilAlert(alertEl, r.errors);
    return;
  }
  // Responden tidak dinilai: skor hanya ditampilkan netral untuk evaluasi aplikasi
  $('#skor-netral').textContent = `Skor SUS respons ini: ${fmtNum(Number(r.data.skor), 1)} (untuk evaluasi aplikasi).`;
  $('#bagian-form').hidden = true;
  const t = $('#bagian-terima');
  t.hidden = false; t.focus();
  window.scrollTo({ top: 0 });
});
