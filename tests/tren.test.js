import { test } from 'node:test';
import assert from 'node:assert/strict';
import { perubahan, ringkasJejak, urutPrioritas } from '../api/_lib/tren.js';

test('perubahan', () => {
  assert.equal(perubahan(13, 18), -5);
  assert.equal(perubahan(29, 28), 1);
  assert.equal(perubahan(10, null), null);
});

test('ringkasJejak: satu survei, banyak survei, batas 8', () => {
  assert.equal(ringkasJejak([]), null);
  const satu = ringkasJejak([{ tanggal: '2026-03-02', total_skor: 22 }]);
  assert.equal(satu.skor_sebelumnya, null);
  assert.equal(satu.perubahan, null);
  const dua = ringkasJejak([{ tanggal: '2026-03-04', total_skor: 18 }, { tanggal: '2026-06-04', total_skor: 13 }]);
  assert.equal(dua.skor_sebelumnya, 18);
  assert.equal(dua.perubahan, -5);
  assert.deepEqual(dua.jejak, [{ tanggal: '2026-03-04', total_skor: 18 }, { tanggal: '2026-06-04', total_skor: 13 }]);
  const banyak = ringkasJejak(Array.from({ length: 10 }, (_, i) => ({ tanggal: 'd' + i, total_skor: i + 10 })));
  assert.equal(banyak.jejak.length, 8);
  assert.equal(banyak.jejak[0].tanggal, 'd2');
});

test('urutPrioritas: status berat, perubahan negatif, total naik', () => {
  const seed = [
    { id_umkm: 'UMKM001', total_skor: 29, perubahan: 1 },
    { id_umkm: 'UMKM002', total_skor: 22, perubahan: null },
    { id_umkm: 'UMKM003', total_skor: 19, perubahan: 4 },
    { id_umkm: 'UMKM004', total_skor: 15, perubahan: 3 },
    { id_umkm: 'UMKM005', total_skor: 26, perubahan: null },
    { id_umkm: 'UMKM006', total_skor: 13, perubahan: -5 },
  ];
  assert.deepEqual(urutPrioritas(seed).map((x) => x.id_umkm),
    ['UMKM006', 'UMKM004', 'UMKM003', 'UMKM002', 'UMKM001', 'UMKM005']);
  // status sama: perubahan paling negatif dulu, null terakhir, lalu total naik
  const sama = [
    { id_umkm: 'A', total_skor: 20, perubahan: null },
    { id_umkm: 'B', total_skor: 21, perubahan: 2 },
    { id_umkm: 'C', total_skor: 22, perubahan: -3 },
    { id_umkm: 'D', total_skor: 19, perubahan: 2 },
  ];
  assert.deepEqual(urutPrioritas(sama).map((x) => x.id_umkm), ['C', 'D', 'B', 'A']);
});
