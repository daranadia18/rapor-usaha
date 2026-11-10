// Pembungkus fetch: selalu mengembalikan {ok, status, data, errors, meta} dan tidak pernah melempar error.

export async function api(path, { method = 'GET', body } = {}) {
  const opsi = { method, credentials: 'same-origin', headers: { Accept: 'application/json' } };
  if (body !== undefined) {
    opsi.headers['Content-Type'] = 'application/json';
    opsi.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(path, opsi);
  } catch {
    return { ok: false, status: 0, data: null, meta: null,
      errors: ['Tidak dapat terhubung ke server. Periksa koneksi internet Anda lalu coba lagi.'] };
  }
  let json = null;
  try { json = await res.json(); } catch { /* bukan JSON */ }
  if (res.ok && json && json.success !== false) {
    return { ok: true, status: res.status, data: json.data ?? null, meta: json.meta ?? null, errors: [] };
  }
  const errors = json && Array.isArray(json.errors) && json.errors.length
    ? json.errors
    : [res.status >= 500 ? 'Terjadi gangguan pada server. Coba lagi beberapa saat.' : `Permintaan gagal (kode ${res.status}).`];
  return { ok: false, status: res.status, data: null, meta: json && json.meta ? json.meta : null, errors };
}

export const get = path => api(path);
export const post = (path, body) => api(path, { method: 'POST', body: body ?? {} });

// Susun query string, abaikan nilai kosong
export function qs(obj) {
  const p = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => { if (v !== '' && v !== null && v !== undefined) p.set(k, v); });
  const s = p.toString();
  return s ? '?' + s : '';
}
