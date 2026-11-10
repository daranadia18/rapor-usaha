// Komponen khas Rapor Usaha: pita status (band track), batang faktor skala 1-5, bar tumpuk status.
// Semua SVG digambar sendiri; warna lewat kelas CSS (ikut mode gelap).
import { STATUS, STATUS_BERAT, statusDariTotal } from './status.js';
import { esc, fmtNum, fmtTetap, fmtTanggal, fmtHariBulan, fmtTahun } from './ui.js';

// Sumbu tetap 6-30. Tiap skor menempati satu sel; pita berbatas di 12,5 / 18,5 / 24,5.
const LO = 5.5, HI = 30.5, SPAN = HI - LO;
const PITA = [
  { s: 'SANGAT_SEHAT', dari: 30.5, ke: 24.5 },
  { s: 'SEHAT', dari: 24.5, ke: 18.5 },
  { s: 'CUKUP_SEHAT', dari: 18.5, ke: 12.5 },
  { s: 'KURANG_SEHAT', dari: 12.5, ke: 5.5 },
];
const clamp = v => Math.min(HI, Math.max(LO, Number(v)));
const f1 = n => Math.round(n * 10) / 10;

function titik(jejak) {
  return (Array.isArray(jejak) ? jejak : []).filter(p => p && p.total_skor != null && !Number.isNaN(Number(p.total_skor)))
    .map(p => ({ tanggal: p.tanggal, total: Number(p.total_skor) }));
}
// Selisih survei terakhir terhadap sebelumnya: dari parameter bila ada, kalau tidak dihitung dari jejak
function selisih(pts, perubahan) {
  if (perubahan !== undefined && perubahan !== null) return Number(perubahan);
  return pts.length >= 2 ? pts[pts.length - 1].total - pts[pts.length - 2].total : null;
}

export function teksPerubahan(p) {
  if (p === null || p === undefined) return 'survei pertama';
  if (p > 0) return `naik ${fmtNum(p)}`;
  if (p < 0) return `turun ${fmtNum(-p)}`;
  return 'tidak berubah';
}

// Ringkasan teks untuk pembaca layar
export function ariaTrack(jejak, perubahan) {
  const pts = titik(jejak);
  if (!pts.length) return 'Belum ada survei';
  const bag = pts.map(p => `${fmtNum(p.total)} pada ${fmtTanggal(p.tanggal)}`).join(', ');
  const d = selisih(pts, perubahan);
  return `Total skor: ${bag}${pts.length > 1 ? ', ' + teksPerubahan(d) : ''}`;
}

// Tanda Naik / Turun untuk tabel dan teks
export function deltaHtml(p, { pertama = 'Survei pertama' } = {}) {
  if (p === null || p === undefined) return `<span class="delta delta-none">${esc(pertama)}</span>`;
  const n = Number(p);
  if (n > 0) return `<span class="delta delta-naik"><svg class="tri" aria-hidden="true"><use href="/icons.svg#i-naik"></use></svg>Naik ${fmtNum(n)}</span>`;
  if (n < 0) return `<span class="delta delta-turun"><svg class="tri" aria-hidden="true"><use href="/icons.svg#i-turun"></use></svg>Turun ${fmtNum(-n)}</span>`;
  return '<span class="delta delta-none">Tetap</span>';
}

function marker(x, y, d, r) {
  if (d > 0) return `<path class="bt-last naik" d="M${f1(x)} ${f1(y - r)}L${f1(x + r)} ${f1(y + r * .8)}L${f1(x - r)} ${f1(y + r * .8)}Z"/>`;
  if (d < 0) return `<path class="bt-last turun" d="M${f1(x)} ${f1(y + r)}L${f1(x + r)} ${f1(y - r * .8)}L${f1(x - r)} ${f1(y - r * .8)}Z"/>`;
  return `<circle class="bt-last" cx="${f1(x)}" cy="${f1(y)}" r="${f1(r * .8)}"/>`;
}

function pitaSvg(x0, x1, yy, aktif) {
  return PITA.map(b => `<rect class="bt-b-${STATUS[b.s].css}${b.s === aktif ? ' on' : ''}" x="${f1(x0)}" y="${f1(yy(b.dari))}" width="${f1(x1 - x0)}" height="${f1(yy(b.ke) - yy(b.dari))}"/>`).join('') +
    [24.5, 18.5, 12.5].map(v => `<line class="bt-sep" x1="${f1(x0)}" x2="${f1(x1)}" y1="${f1(yy(v))}" y2="${f1(yy(v))}"/>`).join('');
}

// ---------- Meteran posisi skor (baris tabel) ----------
// Satu batang 6-30 dibagi empat status, dibaca kiri ke kanan seperti termometer.
// Titik penuh = skor terakhir, lingkaran kosong = skor sebelumnya, panah = arah perubahan.
const pos = v => f1((clamp(v) - LO) / SPAN * 100);
const SEG = ['KURANG_SEHAT', 'CUKUP_SEHAT', 'SEHAT', 'SANGAT_SEHAT'];
const SEG_LEBAR = { KURANG_SEHAT: 7, CUKUP_SEHAT: 6, SEHAT: 6, SANGAT_SEHAT: 6 };

export function miniTrack(jejak, perubahan, { skala = true } = {}) {
  const pts = titik(jejak);
  if (!pts.length) return '<span class="muted small">Belum ada survei</span>';
  const akhir = pts[pts.length - 1].total;
  const d = selisih(pts, perubahan);
  const sebelum = d !== null && pts.length >= 2 ? akhir - d : null;
  const aktif = statusDariTotal(akhir);
  const seg = SEG.map(k => `<span class="m-seg st-${k}${k === aktif ? ' on' : ''}" style="flex:${SEG_LEBAR[k]}"></span>`).join('');
  let panah = '';
  if (sebelum !== null && d !== 0) {
    const a = pos(sebelum), b = pos(akhir);
    panah = `<span class="m-arrow ${d < 0 ? 'turun' : 'naik'}" style="left:${Math.min(a, b)}%;width:${f1(Math.abs(b - a))}%"></span>`;
  }
  const lama = sebelum !== null && d !== 0 ? `<span class="m-prev" style="left:${pos(sebelum)}%"></span>` : '';
  const kini = `<span class="m-now${d < 0 ? ' turun' : d > 0 ? ' naik' : ''}" style="left:${pos(akhir)}%"></span>`;
  const sk = skala ? '<span class="m-scale" aria-hidden="true">' + [13, 19, 25].map(v => `<i style="left:${pos(v - .5)}%">${v}</i>`).join('') + '</span>' : '';
  return `<span class="meter" role="img" aria-label="${esc(ariaTrack(jejak, perubahan))}"><span class="m-bar">${seg}</span>${panah}${lama}${kini}${sk}</span>`;
}

// Kalimat sederhana untuk menjelaskan riwayat skor
export function kalimatJejak(jejak, perubahan) {
  const pts = titik(jejak);
  if (!pts.length) return 'Belum ada survei.';
  const n = pts.length, akhir = pts[n - 1];
  const st = STATUS[statusDariTotal(akhir.total)];
  if (n === 1) return `Baru satu survei: skor ${fmtNum(akhir.total)} pada ${fmtTanggal(akhir.tanggal)}, berstatus ${st.label}.`;
  const d = selisih(pts, perubahan), awal = pts[n - 2];
  const arah = d > 0 ? `Naik ${fmtNum(d)}` : d < 0 ? `Turun ${fmtNum(-d)}` : 'Tetap';
  return `${arah}: dari ${fmtNum(awal.total)} (${fmtTanggal(awal.tanggal)}) ke ${fmtNum(akhir.total)} (${fmtTanggal(akhir.tanggal)}). Sekarang berstatus ${st.label} (${st.teks}, ${st.rentang}).`;
}

// Keterangan cara membaca meteran (sekali per tabel)
export function meterLegend() {
  return '<span class="meter-legend"><span><i class="lg-now"></i>skor terakhir</span><span><i class="lg-prev"></i>skor sebelumnya</span>' +
    SEG.map(k => `<span><i class="sw st-${k}"></i>${esc(STATUS[k].label)} ${esc(STATUS[k].rentang)}</span>`).join('') + '</span>';
}

// ---------- Pita penuh dengan sumbu dan label (halaman detail & hasil) ----------
export function bandChart(jejak, { width = 720, perubahan } = {}) {
  const pts = titik(jejak);
  if (!pts.length) return '<p class="muted">Belum ada survei.</p>';
  const W = Math.max(280, Math.round(width));
  const H = 300, lebar = W >= 560;
  const x0 = 34, x1 = W - (lebar ? 176 : 14), y0 = 16, y1 = H - 46;
  const yy = v => y0 + (HI - clamp(v)) / SPAN * (y1 - y0);
  const n = pts.length;
  const xa = x0 + 28, xb = x1 - 28;
  const xs = pts.map((_, i) => (n === 1 ? (x0 + x1) / 2 : xa + i * (xb - xa) / (n - 1)));
  const d = selisih(pts, perubahan);
  const aktif = statusDariTotal(pts[n - 1].total);
  const jarak = n > 1 ? (xb - xa) / (n - 1) : 999;
  const langkah = Math.max(1, Math.ceil(46 / jarak));

  let s = `<p class="bt-caption">${esc(kalimatJejak(jejak, perubahan))}</p>`;
  s += `<svg class="bt" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(ariaTrack(jejak, perubahan))}">`;
  s += pitaSvg(x0, x1, yy, aktif);
  s += [30, 25, 19, 13, 6].map(v => `<text class="bt-axis" x="${x0 - 7}" y="${f1(yy(v) + 4)}" text-anchor="end">${v}</text>`).join('');
  if (lebar) {
    s += PITA.map(b => {
      const mid = (yy(b.dari) + yy(b.ke)) / 2, st = STATUS[b.s];
      return `<text class="bt-band-name" x="${x1 + 12}" y="${f1(mid - 2)}">${esc(st.label)}</text>` +
        `<text class="bt-band-sub" x="${x1 + 12}" y="${f1(mid + 13)}">${esc(st.teks)} · ${esc(st.rentang)}</text>`;
    }).join('');
  }
  if (n > 1) s += `<polyline class="bt-line" points="${pts.map((p, i) => `${f1(xs[i])},${f1(yy(p.total))}`).join(' ')}"/>`;
  pts.forEach((p, i) => {
    const x = xs[i], y = yy(p.total), akhirDot = i === n - 1;
    s += akhirDot ? marker(x, y, d || 0, 8) : `<circle class="bt-dot" cx="${f1(x)}" cy="${f1(y)}" r="4.5"/>`;
    const atas = y - 14 >= y0 + 8;
    s += `<text class="bt-txt${akhirDot ? ' last' : ''}" x="${f1(x)}" y="${f1(atas ? y - (akhirDot ? 13 : 10) : y + (akhirDot ? 25 : 21))}" text-anchor="middle">${fmtNum(p.total)}</text>`;
    if ((n - 1 - i) % langkah === 0) {
      s += `<text class="bt-date" x="${f1(x)}" y="${y1 + 18}" text-anchor="middle">${esc(fmtHariBulan(p.tanggal))}</text>` +
        `<text class="bt-date yr" x="${f1(x)}" y="${y1 + 32}" text-anchor="middle">${esc(fmtTahun(p.tanggal))}</text>`;
    }
  });
  if (n > 1 && d !== null) {
    const ket = d > 0 ? `Naik ${fmtNum(d)}` : d < 0 ? `Turun ${fmtNum(-d)}` : 'Tetap';
    const kls = d > 0 ? 'naik' : d < 0 ? 'turun' : '';
    const lx = xs[n - 1] - 16, ly = yy(pts[n - 1].total) + 5, tw = ket.length * 7;
    s += `<text class="bt-mark ${kls}" x="${f1(lx)}" y="${f1(ly)}" text-anchor="end">${esc(ket)}</text>`;
    if (d !== 0) {
      const ax = lx - tw - 9, ay = ly - 4;
      s += d > 0 ? `<path class="bt-mark-tri naik" d="M${f1(ax)} ${f1(ay - 5)}l5 9h-10z"/>` : `<path class="bt-mark-tri turun" d="M${f1(ax)} ${f1(ay + 5)}l5 -9h-10z"/>`;
    }
  }
  s += '</svg>';
  if (!lebar) {
    s += '<ul class="bt-legend">' + PITA.map(b => `<li><span class="sw st-${b.s}"></span><span><b>${esc(STATUS[b.s].label)}</b> ${esc(STATUS[b.s].rentang)}</span></li>`).join('') + '</ul>';
  }
  return s;
}

// ---------- Meteran langsung (halaman Penilaian): satu titik yang bergeser kiri-kanan ----------
export function liveTrackSvg() {
  const seg = SEG.map(k => `<span class="m-seg st-${k}" data-s="${k}" style="flex:${SEG_LEBAR[k]}"></span>`).join('');
  const lbl = SEG.map(k => `<span class="st-${k}" style="flex:${SEG_LEBAR[k]}"><b>${esc(STATUS[k].label)}</b><small>${esc(STATUS[k].rentang)}</small></span>`).join('');
  const sk = [6, 13, 19, 25, 30].map(v => `<i style="left:${v === 6 ? 0 : v === 30 ? 100 : pos(v - .5)}%">${v}</i>`).join('');
  return `<div class="lmeter" data-live role="img" aria-label="Meteran status: posisi total skor sementara pada skala 6 sampai 30">
    <div class="lm-track"><span class="m-bar">${seg}</span><span class="lm-range" data-range hidden></span><span class="lm-dot" data-dot hidden></span></div>
    <div class="lm-scale" aria-hidden="true">${sk}</div>
    <div class="lm-labels" aria-hidden="true">${lbl}</div></div>`;
}

// total: angka atau null (belum lengkap); min/max: rentang mungkin selama belum lengkap
export function setLive(el, { total, min, max }) {
  if (!el) return;
  const dot = el.querySelector('[data-dot]'), range = el.querySelector('[data-range]');
  const status = total == null ? null : statusDariTotal(total);
  el.querySelectorAll('[data-s]').forEach(s => s.classList.toggle('on', s.dataset.s === status));
  el.querySelectorAll('.lm-labels > span').forEach((s, i) => s.classList.toggle('on', SEG[i] === status));
  if (total == null) {
    dot.hidden = true;
    if (min != null) {
      const a = pos(min - .5), b = pos(max + .5);
      range.style.left = a + '%'; range.style.width = f1(b - a) + '%'; range.hidden = false;
    } else range.hidden = true;
    el.setAttribute('aria-label', 'Meteran status: lengkapi semua faktor untuk melihat posisi skor');
    return;
  }
  range.hidden = true;
  dot.hidden = false;
  dot.style.left = pos(total) + '%';
  dot.textContent = total;
  el.setAttribute('aria-label', `Meteran status: total skor sementara ${total} dari 30, ${STATUS[status].label}`);
}

// ---------- Batang faktor skala 1-5 (panjang = nilai persis, nol di kiri) ----------
// rows: [{ nama, nilai, rata?, flag? }]; opsi.terlemah: tandai nilai terendah dengan oranye
export function faktorBars(rows, { terlemah = false, rataLabel = '', lebarNama = 124 } = {}) {
  const min = Math.min(...rows.map(r => Number(r.nilai)));
  const li = rows.map(r => {
    const v = Number(r.nilai), lemah = terlemah && v === min;
    const rata = r.rata != null ? Number(r.rata) : null;
    const flag = r.flag || (lemah ? 'terendah' : '');
    return `<li class="fbar${lemah ? ' weak' : ''}"><span class="nm">${esc(r.nama)}${flag ? `<span class="flag">${esc(flag)}</span>` : ''}</span>` +
      `<div class="fbar-track" aria-hidden="true"><i class="fbar-fill" style="width:${f1(v / 5 * 100)}%"></i>${rata != null ? `<i class="fbar-avg" style="left:${f1(rata / 5 * 100)}%"></i>` : ''}</div>` +
      `<span class="val">${fmtTetap(v, Number.isInteger(v) ? 0 : 2)}<span class="sr-only"> dari 5${rata != null ? `, ${esc(rataLabel)} ${fmtTetap(rata, 2)}` : ''}</span></span></li>`;
  }).join('');
  const sumbu = '<div class="fbar-axis" aria-hidden="true"><span></span><div>' + [1, 2, 3, 4, 5].map(k => `<span style="left:${k * 20}%">${k}</span>`).join('') + '</div><span></span></div>';
  return `<div class="fb" style="--nm:${lebarNama}px"><ul class="fbars">${li}</ul>${sumbu}</div>`;
}

// ---------- Bar tumpuk status (jumlah UMKM) ----------
export function stackBar(distribusi) {
  const peta = Object.fromEntries((distribusi || []).map(d => [d.status, Number(d.jumlah) || 0]));
  const total = STATUS_BERAT.reduce((a, k) => a + (peta[k] || 0), 0);
  const aria = 'Sebaran status: ' + STATUS_BERAT.map(k => `${fmtNum(peta[k] || 0)} ${STATUS[k].label}`).join(', ');
  const bar = `<div class="stackbar" role="img" aria-label="${esc(aria)}">` +
    STATUS_BERAT.filter(k => peta[k]).map(k => `<span class="st-${k}" style="flex:${peta[k]} 1 0"><span aria-hidden="true">${fmtNum(peta[k])}</span></span>`).join('') + '</div>';
  const legenda = '<ul class="stat-legend">' + STATUS_BERAT.map(k =>
    `<li><span class="sw st-${k}"></span><span><b>${esc(STATUS[k].label)}</b> <span class="th">${esc(STATUS[k].teks)} ${esc(STATUS[k].rentang)}</span></span><b>${fmtNum(peta[k] || 0)}</b></li>`).join('') + '</ul>';
  return { total, html: bar + legenda };
}
