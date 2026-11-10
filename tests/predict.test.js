import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FAKTOR, validate, predict, statusFromTotal, susScore } from '../api/_lib/predict.js';

const mk = (arr, id = 'UMKM001') => ({ id_umkm: id, ...Object.fromEntries(FAKTOR.map((f, i) => [f, arr[i]])) });

test('batas status', () => {
  const tabel = [
    [[2, 2, 2, 2, 2, 2], 12, 'KURANG_SEHAT'],
    [[3, 2, 2, 2, 2, 2], 13, 'CUKUP_SEHAT'],
    [[3, 3, 3, 3, 3, 3], 18, 'CUKUP_SEHAT'],
    [[4, 3, 3, 3, 3, 3], 19, 'SEHAT'],
    [[4, 4, 4, 4, 4, 4], 24, 'SEHAT'],
    [[5, 4, 4, 4, 4, 4], 25, 'SANGAT_SEHAT'],
    [[5, 4, 5, 5, 4, 5], 28, 'SANGAT_SEHAT'], // contoh modul UMKM008
  ];
  for (const [arr, total, status] of tabel) {
    const b = mk(arr);
    assert.deepEqual(validate(b), []);
    const r = predict(b);
    assert.equal(r.total_skor, total);
    assert.equal(r.status, status);
  }
});

test('label dan rekomendasi', () => {
  assert.equal(statusFromTotal(28).label, 'Best Practice');
  assert.equal(statusFromTotal(20).label, 'Perlu Perhatian');
  assert.equal(statusFromTotal(15).label, 'Perlu Intervensi');
  assert.equal(statusFromTotal(8).label, 'Prioritas Intervensi');
  assert.equal(predict(mk([2, 2, 2, 2, 2, 2])).rekomendasi,
    'Prioritas intervensi! Segera konsultasi dengan pendamping UMKM.');
});

test('input tidak valid ditolak', () => {
  const dasar = [3, 3, 3, 3, 3, 3];
  for (const bad of [6, 0, 2.5, null, undefined, '', 'abc']) {
    const arr = [...dasar]; arr[2] = bad;
    assert.deepEqual(validate(mk(arr)), ['lingkungan_kerja harus bilangan bulat 1-5'], String(bad));
  }
  const b = mk(dasar); delete b.kinerja;
  assert.deepEqual(validate(b), ['kinerja harus bilangan bulat 1-5']);
  assert.deepEqual(validate(mk(dasar, 'UMKM12')), ['id_umkm harus berformat UMKMxxx']);
  assert.deepEqual(validate(mk(dasar, 'umkm001')), ['id_umkm harus berformat UMKMxxx']);
  assert.ok(validate({}).length === 7);
  assert.ok(validate(null).length === 7);
});

test('string angka diterima seperti modul', () => {
  const b = mk(['3', '3', '3', '3', '3', '3']);
  assert.deepEqual(validate(b), []);
  assert.equal(predict(b).total_skor, 18);
});

test('faktor_terlemah: satu faktor dan seri', () => {
  const satu = predict(mk([5, 4, 5, 5, 4, 5]));
  assert.deepEqual(satu.faktor_terlemah.map((x) => x.faktor), ['kepemimpinan', 'stabilitas']);
  const tunggal = predict(mk([5, 5, 2, 5, 5, 5]));
  assert.equal(tunggal.faktor_terlemah.length, 1);
  assert.equal(tunggal.faktor_terlemah[0].faktor, 'lingkungan_kerja');
  assert.equal(tunggal.faktor_terlemah[0].nama, 'Lingkungan Kerja');
  assert.equal(tunggal.faktor_terlemah[0].skor, 2);
  assert.ok(tunggal.faktor_terlemah[0].saran.length > 10);
  assert.equal(predict(mk([3, 3, 3, 3, 3, 3])).faktor_terlemah.length, 6);
});

test('susScore', () => {
  assert.equal(susScore([4, 2, 4, 1, 4, 2, 5, 1, 4, 2]), 82.5);
  assert.equal(susScore([5, 1, 4, 2, 5, 1, 4, 2, 5, 1]), 90);
  assert.equal(susScore([1, 5, 1, 5, 1, 5, 1, 5, 1, 5]), 0);
  assert.equal(susScore([5, 1, 5, 1, 5, 1, 5, 1, 5, 1]), 100);
  assert.equal(susScore([1, 2, 3]), null);
  assert.equal(susScore([1, 2, 3, 4, 5, 1, 2, 3, 4, 6]), null);
});
