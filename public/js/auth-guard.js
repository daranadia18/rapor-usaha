// Penjaga halaman: hanya admin yang perlu login. Halaman lain terbuka untuk semua.
import { api } from './api.js';
import { initLayout } from './layout.js';
import { esc, icon } from './ui.js';

// analis/pendamping lama dianggap admin
export const isAdmin = u => !!u && (u.role === 'admin' || u.role === 'analis' || u.role === 'pendamping');
export const isStaf = isAdmin;

// Halaman publik: tampilkan navigasi sesuai status login, kembalikan user atau null (tanpa pengalihan)
export async function getUser() {
  const r = await api('/api/auth/me');
  return r.ok && r.data ? r.data.user || null : null;
}

export async function initPage() {
  const user = await getUser();
  initLayout(user);
  return user;
}

const tunggu = () => new Promise(() => {}); // sengaja tidak pernah selesai (halaman dialihkan/diblokir)

// Halaman khusus admin: alihkan ke /login bila belum masuk
export async function requireAdmin() {
  const r = await api('/api/auth/me');
  const main = document.getElementById('main');
  if (r.status === 401) {
    const next = encodeURIComponent(location.pathname + location.search);
    location.replace('/login?next=' + next);
    return tunggu();
  }
  if (!r.ok) {
    initLayout(null);
    main.innerHTML = `<div class="state" role="alert">${icon('peringatan')}<h2>Tidak dapat memeriksa sesi</h2><p>${esc(r.errors[0])}</p>` +
      '<button class="btn btn-primary" type="button" id="coba-lagi">Coba lagi</button></div>';
    document.getElementById('coba-lagi').addEventListener('click', () => location.reload());
    return tunggu();
  }
  const user = r.data.user;
  initLayout(user);
  if (!isAdmin(user)) {
    main.innerHTML = `<div class="state" role="alert">${icon('peringatan')}<h2>Halaman ini khusus admin</h2>` +
      '<p>Akun Anda tidak punya akses ke halaman ini.</p><a class="btn btn-primary" href="/dashboard">Kembali ke Dashboard</a></div>';
    return tunggu();
  }
  return user;
}
export const requireLogin = () => requireAdmin();

// Alamat tujuan setelah login: hanya path internal
export function amanNext(next) {
  try {
    if (!next || next.includes('\\')) return '/dashboard';
    const u = new URL(next, location.origin);
    return u.origin === location.origin ? u.pathname + u.search + u.hash : '/dashboard';
  } catch { return '/dashboard'; }
}
