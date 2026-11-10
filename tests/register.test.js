import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkRegister } from '../api/_lib/register.js';

const dasar = { nama: 'Ani', email: 'ani@example.com', password: 'rahasia123' };

test('tanpa kode undangan di server: ditolak 403', () => {
  const r = checkRegister({ ...dasar, role: 'admin', kode_undangan: 'x' }, '');
  assert.equal(r.status, 403);
  assert.equal(r.errors[0], 'Pendaftaran staf belum dibuka. Hubungi admin.');
});

test('tanpa / dengan kode salah: 403 berisi kata kode', () => {
  for (const kode of [undefined, 'salah', 123]) {
    const r = checkRegister({ ...dasar, role: 'admin', kode_undangan: kode }, 'RAHASIA');
    assert.equal(r.status, 403);
    assert.match(r.errors[0], /kode/i);
  }
});

test('kode benar: lolos dan peran selalu admin (role boleh dihilangkan)', () => {
  assert.equal(checkRegister({ ...dasar, role: 'admin', kode_undangan: 'RAHASIA' }, 'RAHASIA').role, 'admin');
  const r = checkRegister({ ...dasar, kode_undangan: 'RAHASIA' }, 'RAHASIA');
  assert.equal(r.status, 200);
  assert.equal(r.role, 'admin');
});

test('peran selain admin ditolak 400; id_umkm ditolak 400', () => {
  const a = checkRegister({ ...dasar, role: 'pengelola', kode_undangan: 'RAHASIA' }, 'RAHASIA');
  assert.equal(a.status, 400);
  const r = checkRegister({ ...dasar, role: 'admin', id_umkm: 'UMKM001', kode_undangan: 'RAHASIA' }, 'RAHASIA');
  assert.equal(r.status, 400);
  assert.match(r.errors[0], /id_umkm tidak dapat diisi/);
});

test('validasi dasar', () => {
  const r = checkRegister({ role: 'admin', password: '123' }, 'RAHASIA');
  assert.equal(r.status, 400);
  assert.equal(r.errors.length, 3);
});
