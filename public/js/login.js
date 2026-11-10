import { api } from './api.js';
import { initPage, amanNext } from './auth-guard.js';
import { tampilAlert, bacaQuery } from './ui.js';
import { pasangToggleSandi, bersihkanGalat, galatKolom, petakanGalat } from './form-helpers.js';

const user = await initPage();
const next = amanNext(bacaQuery().get('next'));
if (user) location.replace(next); // sudah login

const form = document.getElementById('form-login');
pasangToggleSandi(form);

form.addEventListener('submit', async e => {
  e.preventDefault();
  bersihkanGalat(form);
  const email = form.email.value.trim();
  const password = form.password.value;
  let valid = true;
  if (!email) { galatKolom(form, 'email', 'Email wajib diisi.'); valid = false; }
  if (!password) { galatKolom(form, 'password', 'Kata sandi wajib diisi.'); valid = false; }
  if (!valid) return;

  const btn = document.getElementById('btn-submit');
  btn.disabled = true; btn.textContent = 'Memproses...';
  const r = await api('/api/auth/login', { method: 'POST', body: { email, password } });
  if (r.ok) { location.href = next; return; }
  btn.disabled = false; btn.textContent = 'Masuk';
  const umum = petakanGalat(form, r.errors, { email: ['email harus', 'format email'] });
  tampilAlert(document.getElementById('form-alert'), umum);
});
