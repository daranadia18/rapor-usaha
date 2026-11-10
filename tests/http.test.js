import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCsv } from '../api/_lib/csv.js';

test('toCsv: BOM, kutip, koma, newline, null', () => {
  const out = toCsv(
    [{ a: 'Warung "Bu" Sari, Jakarta', b: null, c: 5 }, { a: 'baris\nbaru', b: 'x', c: 0 }],
    ['a', { key: 'b', header: 'Kolom B' }, 'c']);
  assert.ok(out.startsWith('﻿'));
  const body = out.slice(1);
  assert.equal(body, 'a,Kolom B,c\r\n"Warung ""Bu"" Sari, Jakarta",,5\r\n"baris\nbaru",x,0\r\n');
});

test('toCsv: awalan formula dinetralkan', () => {
  assert.ok(toCsv([{ a: '=1+1' }], ['a']).includes("'=1+1"));
});

test('toCsv: awalan tab dan CR dinetralkan', () => {
  assert.ok(toCsv([{ a: '\tx' }], ['a']).includes("'\tx"));
  assert.ok(toCsv([{ a: '\rx' }], ['a']).includes("'\rx"));
});
