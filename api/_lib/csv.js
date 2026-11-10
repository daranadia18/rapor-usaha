// Pembuat CSV. columns: array nama kunci, atau {key, header}.
const BOM = '﻿'; // agar Excel membaca UTF-8 (teks Indonesia) dengan benar

function cell(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) v = v.toISOString();
  let s = String(v);
  // Cegah formula injection di Excel (sel teks yang diawali = + - @)
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function toCsv(rows, columns) {
  const cols = columns.map((c) => (typeof c === 'string' ? { key: c, header: c } : c));
  const lines = [cols.map((c) => cell(c.header)).join(',')];
  for (const r of rows) lines.push(cols.map((c) => cell(r[c.key])).join(','));
  return BOM + lines.join('\r\n') + '\r\n';
}
