import { api } from './api.js';
import { initPage } from './auth-guard.js';
import { tampilAlert } from './ui.js';
import { pasangToggleSandi, bersihkanGalat, galatKolom, petakanGalat } from './form-helpers.js';

const user = await initPage();
if (user) location.replace('/dashboard');

const form = document.getElementById('form-register');
pasangToggleSandi(form);

form.addEventListener('submit', async e => {
  e.preventDefault();
  bersihkanGalat(form);
  const body = {
    nama: form.nama.value.trim(),
    email: form.email.value.trim(),
    password: form.password.value,
    role: 'admin',
  };
  const kode = form.kode_undangan.value.trim();
  if (kode) body.kode_undangan = kode;

  // Validasi sisi klien (server tetap memvalidasi ulang)
  let valid = true;
  if (!body.nama) { galatKolom(form, 'nama', 'Nama wajib diisi.'); valid = false; }
  if (!body.email) { galatKolom(form, 'email', 'Email wajib diisi.'); valid = false; }
  if (body.password.length < 8) { galatKolom(form, 'password', 'Kata sandi minimal 8 karakter.'); valid = false; }
  if (!kode) { galatKolom(form, 'kode_undangan', 'Kode undangan wajib diisi.'); valid = false; }
  if (!valid) return;

  const btn = document.getElementById('btn-submit');
  btn.disabled = true; btn.textContent = 'Memproses...';
  const r = await api('/api/auth/register', { method: 'POST', body });
  if (r.ok) { location.href = '/dashboard'; return; }
  btn.disabled = false; btn.textContent = 'Daftar admin';
  const umum = petakanGalat(form, r.errors, {
    kode_undangan: ['kode'],
    email: ['email'],
    password: ['sandi', 'password'],
    nama: ['nama'],
  });
  tampilAlert(document.getElementById('form-alert'), umum);
});
