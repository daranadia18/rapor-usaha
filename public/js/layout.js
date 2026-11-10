// Rel navigasi (desktop) / bilah atas (ponsel) dan footer yang dipakai semua halaman.
import { api } from './api.js';
import { esc, icon } from './ui.js';

export const roleLabel = () => 'Admin';

// Satu menu untuk semua; grup Admin hanya untuk admin
function menuUntuk(user) {
  const utama = [['/', 'Beranda', 'beranda'], ['/dashboard', 'Dashboard', 'dashboard'], ['/prediksi', 'Penilaian', 'penilaian'],
    ['/umkm', 'UMKM', 'umkm'], ['/pemantauan', 'Pemantauan', 'pemantauan'], ['/perbandingan', 'Perbandingan', 'perbandingan'],
    ['/sus', 'Kuesioner SUS', 'sus']];
  const admin = user ? [['/log', 'Log', 'log'], ['/sus-hasil', 'Hasil SUS', 'sus']] : [];
  return { utama, admin };
}

function inisial(nama) {
  const k = String(nama || '?').trim().split(/\s+/).filter(Boolean);
  return ((k[0] || '?')[0] + (k.length > 1 ? k[k.length - 1][0] : '')).toUpperCase();
}

function aktif(href) {
  const path = href.split('?')[0].replace(/\/$/, '') || '/';
  const sekarang = location.pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/';
  return path === sekarang;
}

export function initLayout(user) {
  const header = document.getElementById('site-header');
  const footer = document.getElementById('site-footer');
  if (header) {
    const item = ([href, teks, ik]) =>
      `<li><a class="nav-link" href="${esc(href)}"${aktif(href) ? ' aria-current="page"' : ''}>${icon(ik)}<span>${esc(teks)}</span></a></li>`;
    const m = menuUntuk(user);
    const grup = m.admin.length ? `<p class="nav-group" id="nav-grup">Admin</p><ul aria-labelledby="nav-grup">${m.admin.map(item).join('')}</ul>` : '';
    const cta = '<a class="btn btn-primary btn-block nav-cta" href="/sus">Isi kuesioner SUS</a>';
    const userBox = user
      ? `<div class="nav-user"><span class="avatar" aria-hidden="true">${esc(inisial(user.nama))}</span><span class="who">${esc(user.nama)}</span><span class="role">${esc(roleLabel(user.role))}</span>` +
        `<button type="button" class="btn btn-outline btn-sm" id="btn-keluar">${icon('keluar')} Keluar</button></div>`
      : ''; // tombol masuk admin sengaja disembunyikan; admin buka /login langsung
    header.innerHTML = `<div class="rail-top">
      <a class="brand" href="/"><img src="/favicon.svg" alt="" width="30" height="30"><span>Rapor Usaha</span></a>
      <button type="button" class="nav-toggle" aria-expanded="false" aria-controls="nav-utama">${icon('menu')}<span>Menu</span></button></div>
      <nav class="nav" id="nav-utama" aria-label="Navigasi utama"><ul>${m.utama.map(item).join('')}</ul>${grup}<div class="nav-bottom">${cta}${userBox}</div></nav>`;
    const toggle = header.querySelector('.nav-toggle');
    const nav = header.querySelector('.nav');
    const atur = buka => {
      nav.classList.toggle('open', buka);
      toggle.setAttribute('aria-expanded', String(buka));
      toggle.innerHTML = icon(buka ? 'tutup' : 'menu') + '<span>' + (buka ? 'Tutup' : 'Menu') + '</span>';
    };
    toggle.addEventListener('click', () => atur(!nav.classList.contains('open')));
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && nav.classList.contains('open')) { atur(false); toggle.focus(); }
    });
    const keluar = document.getElementById('btn-keluar');
    if (keluar) keluar.addEventListener('click', async () => {
      keluar.disabled = true;
      await api('/api/auth/logout', { method: 'POST', body: {} });
      location.href = '/';
    });
  }
  if (footer) {
    footer.innerHTML = '<p>Rapor Usaha &middot; Proyek mata kuliah Otomasi Alur Data dan Dashboard Berpusat Pengguna (D3). Data contoh untuk keperluan belajar. ' +
      '<a href="/tentang">Tentang &amp; arsitektur</a> &middot; <a href="/sus">Kuesioner SUS</a></p>';
  }
}
