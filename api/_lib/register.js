// Aturan pendaftaran (fungsi murni agar mudah diuji).
import { timingSafeEqual, createHash } from 'node:crypto';

export const ROLES = ['admin'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Bandingkan dua string dalam waktu konstan (hash dulu agar panjang sama).
export function safeEqual(a, b) {
  const ha = createHash('sha256').update(String(a)).digest();
  const hb = createHash('sha256').update(String(b)).digest();
  return timingSafeEqual(ha, hb);
}

// Hasil: { status: 200 } bila lolos, atau { status, errors } bila ditolak.
export function checkRegister(b, inviteCode) {
  const errors = [];
  const nama = typeof b.nama === 'string' ? b.nama.trim() : '';
  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
  const password = typeof b.password === 'string' ? b.password : '';
  if (!nama || nama.length > 80) errors.push('Nama wajib diisi (maksimal 80 karakter)');
  if (!EMAIL_RE.test(email) || email.length > 120) errors.push('Format email tidak valid');
  if (password.length < 8) errors.push('Kata sandi minimal 8 karakter');
  if (password.length > 72) errors.push('Kata sandi maksimal 72 karakter');
  if (b.role !== undefined && b.role !== null && b.role !== '' && !ROLES.includes(b.role)) {
    errors.push('Peran hanya boleh admin');
  }
  if (b.id_umkm !== undefined && b.id_umkm !== null && b.id_umkm !== '') {
    errors.push('id_umkm tidak dapat diisi saat pendaftaran; tambahkan UMKM setelah masuk');
  }
  if (errors.length) return { status: 400, errors };

  // Admin selalu memerlukan kode undangan
  if (!inviteCode) return { status: 403, errors: ['Pendaftaran staf belum dibuka. Hubungi admin.'] };
  if (typeof b.kode_undangan !== 'string' || !safeEqual(b.kode_undangan, inviteCode)) {
    return { status: 403, errors: ['Kode undangan salah'] };
  }
  return { status: 200, nama, email, password, role: 'admin' };
}
