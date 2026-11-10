// Halaman statis (404, beranda): tampilkan navigasi sesuai status login.
import { initPage } from './auth-guard.js';

const user = await initPage();
if (user) {
  document.querySelectorAll('[data-cta-guest]').forEach(el => { el.hidden = true; });
  document.querySelectorAll('[data-cta-user]').forEach(el => { el.hidden = false; });
}
