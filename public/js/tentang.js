// F10 - Halaman Tentang: tabel uji batas dihitung dari aturan yang sama + contoh curl dengan tombol salin
import { initPage } from './auth-guard.js';
import { $, $$, esc, salinTeks } from './ui.js';
import { STATUS, statusDariTotal, badgeHtml } from './status.js';

await initPage();

// Tabel nilai batas (12/13, 18/19, 24/25 adalah pasangan di batas dua status)
$('#tbody-batas').innerHTML = [6, 12, 13, 18, 19, 24, 25, 30].map(t => {
  const s = statusDariTotal(t);
  return `<tr><td class="num"><strong>${t}</strong></td><td>${badgeHtml(s)}</td><td>${esc(STATUS[s].label)}</td></tr>`;
}).join('');

// Contoh curl memakai alamat situs saat ini
const o = location.origin;
$('#curl-login').textContent =
`curl -c cookies.txt -X POST ${o}/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email":"anda@contoh.com","password":"kata-sandi-anda"}'`;
$('#curl-predict').textContent =
`curl -X POST ${o}/api/predict \\
  -H "Content-Type: application/json" \\
  -d '{"id_umkm":"UMKM001","sumber_daya":4,"kepemimpinan":5,"lingkungan_kerja":4,"nilai_organisasi":5,"stabilitas":4,"kinerja":5}'`;
$('#curl-ringkasan').textContent = `curl "${o}/api/ringkasan?kota=Jakarta"`;

$$('[data-copy]').forEach(btn => {
  btn.addEventListener('click', () => salinTeks(document.getElementById(btn.dataset.copy).textContent, btn));
});
