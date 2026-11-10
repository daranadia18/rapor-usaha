// Fungsi bantu tampilan: escape HTML, format angka/tanggal, ikon, state loading/kosong/galat.

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// Ikon dari sprite /icons.svg (garis 1,75). Selalu dekoratif.
export function icon(nama, kelas = '') {
  return `<svg class="ic${kelas ? ' ' + kelas : ''}" aria-hidden="true" focusable="false"><use href="/icons.svg#i-${nama}"></use></svg>`;
}

export function fmtNum(n, desimal = 0) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '-';
  return new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: desimal }).format(Number(n));
}
// Angka dengan desimal tetap (mis. 3,50)
export function fmtTetap(n, desimal = 2) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '-';
  return new Intl.NumberFormat('id-ID', { minimumFractionDigits: desimal, maximumFractionDigits: desimal }).format(Number(n));
}

// Tanggal "YYYY-MM-DD" dibaca sebagai tanggal lokal (tanpa geser zona waktu)
function bacaTanggal(iso) {
  if (!iso) return null;
  const s = String(iso);
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + 'T00:00:00') : new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}
export function fmtTanggal(iso, opsi = { day: 'numeric', month: 'short', year: 'numeric' }) {
  const d = bacaTanggal(iso);
  return d ? d.toLocaleDateString('id-ID', opsi) : '-';
}
export const fmtTanggalPanjang = iso => fmtTanggal(iso, { day: 'numeric', month: 'long', year: 'numeric' });
export function fmtHariBulan(iso) {
  const d = bacaTanggal(iso);
  return d ? d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '-';
}
export function fmtTahun(iso) {
  const d = bacaTanggal(iso);
  return d ? String(d.getFullYear()) : '';
}
export function fmtWaktu(iso) {
  const d = bacaTanggal(iso);
  if (!d) return '-';
  return d.toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function debounce(fn, ms = 300) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

// ---- State tampilan ----
export function tampilLoading(el, baris = 3) {
  el.setAttribute('aria-busy', 'true');
  el.innerHTML = '<div role="status"><span class="sr-only">Memuat data...</span>' +
    '<div class="skeleton block"></div>' + '<div class="skeleton"></div>'.repeat(baris) + '</div>';
}

export function tampilKosong(el, judul, teks = '', ctaHtml = '', ikon = 'sempurna') {
  el.removeAttribute('aria-busy');
  el.innerHTML = `<div class="state">${icon(ikon)}<h3>${esc(judul)}</h3>` +
    (teks ? `<p>${esc(teks)}</p>` : '') + ctaHtml + '</div>';
}

export function tampilGalat(el, pesan, ulangi) {
  el.removeAttribute('aria-busy');
  el.innerHTML = `<div class="state" role="alert">${icon('peringatan')}<h3>Data belum bisa dimuat</h3><p>${esc(pesan)}</p>` +
    (ulangi ? `<button type="button" class="btn btn-outline" data-ulangi>${icon('muat')} Coba lagi</button>` : '') + '</div>';
  if (ulangi) $('[data-ulangi]', el).addEventListener('click', ulangi);
}

// Daftar galat dari API -> kotak alert (textContent, aman)
export function tampilAlert(el, errors, jenis = 'error') {
  el.innerHTML = '';
  if (!errors || !errors.length) return;
  const box = document.createElement('div');
  box.className = `alert alert-${jenis}`;
  box.setAttribute('role', jenis === 'error' ? 'alert' : 'status');
  if (errors.length === 1) box.textContent = errors[0];
  else {
    box.append('Mohon periksa kembali:');
    const ul = document.createElement('ul');
    errors.forEach(e => { const li = document.createElement('li'); li.textContent = e; ul.append(li); });
    box.append(ul);
  }
  el.append(box);
}

export async function salinTeks(teks, tombol) {
  const asli = tombol ? tombol.innerHTML : '';
  let ok = true;
  try { await navigator.clipboard.writeText(teks); }
  catch {
    const ta = document.createElement('textarea');
    ta.value = teks; document.body.append(ta); ta.select();
    try { document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
  }
  if (tombol) {
    tombol.innerHTML = ok ? `${icon('centang')} Tersalin` : 'Gagal menyalin';
    setTimeout(() => { tombol.innerHTML = asli; }, 1800);
  }
}

// Isi <select> dari array [{value,label}]
export function isiSelect(select, opsi, placeholder) {
  select.innerHTML = '';
  if (placeholder !== undefined) select.append(new Option(placeholder, ''));
  opsi.forEach(o => select.append(new Option(o.label, o.value)));
}

export function bacaQuery() { return new URLSearchParams(location.search); }
