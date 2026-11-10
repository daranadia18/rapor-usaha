// /api/auth/:action  (register | login | logout | me)
import { query } from './_lib/db.js';
import {
  hashPassword, verifyPassword, signToken, setAuthCookie, clearAuthCookie,
  publicUser, getUser,
} from './_lib/auth.js';
import { checkRegister } from './_lib/register.js';
import { handle, allow, ok, fail, readBody, qs } from './_lib/http.js';

// Hash palsu agar waktu respons login sama baik email ada maupun tidak
const DUMMY_HASH = hashPassword('tidak-dipakai');

async function register(req, res) {
  if (!allow(req, res, ['POST'])) return;
  const b = await readBody(req);
  const chk = checkRegister(b, (process.env.STAF_INVITE_CODE || '').trim());
  if (chk.status !== 200) return fail(res, chk.status, chk.errors);
  const { nama, email, password, role } = chk;
  const hash = await hashPassword(password);
  let user;
  try {
    const r = await query(
      `INSERT INTO users (nama, email, password_hash, role, id_umkm)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, nama, email, role, id_umkm`,
      [nama, email, hash, role, null]);
    user = r.rows[0];
  } catch (e) {
    if (e.code === '23505') return fail(res, 409, 'Email sudah terdaftar');
    throw e;
  }
  setAuthCookie(req, res, await signToken(user));
  ok(res, { user: publicUser(user) }, undefined, 201);
}

async function login(req, res) {
  if (!allow(req, res, ['POST'])) return;
  const b = await readBody(req);
  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
  const password = typeof b.password === 'string' ? b.password : '';
  if (!email || !password) return fail(res, 400, 'Email dan kata sandi wajib diisi');
  const { rows } = await query(
    'SELECT id, nama, email, role, id_umkm, password_hash FROM users WHERE email = $1', [email]);
  const u = rows[0];
  const valid = await verifyPassword(password, u ? u.password_hash : await DUMMY_HASH);
  if (!u || !valid) return fail(res, 401, 'Email atau kata sandi salah');
  setAuthCookie(req, res, await signToken(u));
  ok(res, { user: publicUser(u) });
}

async function logout(req, res) {
  if (!allow(req, res, ['POST'])) return;
  clearAuthCookie(req, res);
  ok(res, null);
}

async function me(req, res) {
  if (!allow(req, res, ['GET'])) return;
  const user = await getUser(req);
  if (!user) return fail(res, 401, 'Silakan login terlebih dahulu');
  ok(res, { user: publicUser(user) });
}

const ACTIONS = { register, login, logout, me };

export default handle(async (req, res) => {
  const fn = ACTIONS[qs(req, 'action')];
  if (!fn) return fail(res, 404, 'Aksi tidak ditemukan');
  await fn(req, res);
});
