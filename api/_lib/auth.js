import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { timingSafeEqual } from 'node:crypto';
import { query } from './db.js';
import { parseCookies, fail } from './http.js';

const COOKIE = 'rapor_token';
const MAX_AGE = 7 * 24 * 3600;

export const hashPassword = (pw) => bcrypt.hash(pw, 10);
export const verifyPassword = (pw, hash) => bcrypt.compare(pw, hash);

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) throw new Error('JWT_SECRET belum diatur atau kurang dari 32 karakter');
  return new TextEncoder().encode(s);
}

export function signToken(user) {
  return new SignJWT({ role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret());
}

function isSecure(req) {
  return process.env.NODE_ENV === 'production' || req.headers?.['x-forwarded-proto'] === 'https';
}

export function setAuthCookie(req, res, token) {
  const parts = [`${COOKIE}=${token}`, 'HttpOnly', 'Path=/', 'SameSite=Lax', `Max-Age=${MAX_AGE}`];
  if (isSecure(req)) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearAuthCookie(req, res) {
  const parts = [`${COOKIE}=`, 'HttpOnly', 'Path=/', 'SameSite=Lax', 'Max-Age=0'];
  if (isSecure(req)) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function publicUser(u) {
  return { id: u.id, nama: u.nama, email: u.email, role: u.role, id_umkm: u.id_umkm ?? null };
}

// Verifikasi token lalu muat data user terbaru dari DB.
export async function getUser(req) {
  const token = parseCookies(req)[COOKIE];
  if (!token) return null;
  const key = secret();
  let payload;
  try {
    ({ payload } = await jwtVerify(token, key, { algorithms: ['HS256'] }));
  } catch {
    return null;
  }
  const id = Number(payload.sub);
  if (!Number.isInteger(id)) return null;
  const { rows } = await query(
    'SELECT id, nama, email, role, id_umkm FROM users WHERE id = $1', [id]);
  return rows[0] || null;
}

// Mengembalikan user, atau mengirim 401 dan mengembalikan null.
export async function requireUser(req, res) {
  const user = await getUser(req);
  if (!user) { fail(res, 401, 'Silakan login terlebih dahulu'); return null; }
  return user;
}

export async function requireRole(req, res, roles) {
  const user = await requireUser(req, res);
  if (!user) return null;
  if (!roles.includes(user.role)) {
    fail(res, 403, 'Anda tidak berhak mengakses fitur ini');
    return null;
  }
  return user;
}

// Satu peran login: admin. 'analis'/'pendamping' lama diperlakukan sebagai admin.
export const ADMIN = ['admin', 'analis', 'pendamping'];
export const STAF = ADMIN;

// Hanya admin: 401 bila belum login, 403 bila login tetapi bukan admin.
export const requireAdmin = (req, res) => requireRole(req, res, ADMIN);

export function isApiKey(req) {
  const expected = process.env.N8N_API_KEY;
  if (!expected) return false;
  const given = req.headers?.['x-api-key'];
  if (typeof given !== 'string') return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
