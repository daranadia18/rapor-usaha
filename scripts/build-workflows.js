// Membangun ekspor workflow n8n untuk JS-4 dan JS-5.
// Jalankan: npm run workflows:build
// Hasil: workflows/js4-umkm-predict.json dan workflows/js5-umkm-monitoring.json
//
// Kredensial TIDAK disimpan di repo. Impor workflows/credentials.example.json
// setelah mengganti nilainya.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'workflows');

const CRED = {
  postgres: { id: 'rapor-postgres-01', name: 'Postgres Rapor Usaha' },
  webhook: { id: 'rapor-webhook-01', name: 'Rapor Usaha Webhook Secret' },
};

const TIMEZONE = 'Asia/Jakarta';

const CODE_PREDICT = `// Logika penilaian yang sama dengan api/_lib/predict.js (JS-4).
// Input: { id_umkm, sumber_daya, kepemimpinan, lingkungan_kerja,
//          nilai_organisasi, stabilitas, kinerja }
const FAKTOR = ['sumber_daya', 'kepemimpinan', 'lingkungan_kerja',
  'nilai_organisasi', 'stabilitas', 'kinerja'];

const NAMA = {
  sumber_daya: 'Sumber Daya',
  kepemimpinan: 'Kepemimpinan',
  lingkungan_kerja: 'Lingkungan Kerja',
  nilai_organisasi: 'Nilai Organisasi',
  stabilitas: 'Stabilitas',
  kinerja: 'Kinerja',
};

const SARAN = {
  sumber_daya: 'Lengkapi modal, peralatan, dan bahan baku utama, lalu catat pemakaiannya agar tidak boros.',
  kepemimpinan: 'Tetapkan target dan pembagian tugas yang jelas, serta adakan rapat singkat rutin dengan karyawan.',
  lingkungan_kerja: 'Rapikan tempat usaha, atur jam kerja yang wajar, dan buka ruang bagi karyawan untuk memberi masukan.',
  nilai_organisasi: 'Rumuskan nilai dan aturan usaha secara sederhana, lalu biasakan semua anggota menjalankannya.',
  stabilitas: 'Buat pembukuan kas sederhana dan siapkan dana cadangan agar usaha tetap berjalan saat penjualan turun.',
  kinerja: 'Pantau penjualan dan kualitas produk setiap bulan, lalu tetapkan target perbaikan yang terukur.',
};

const REKOMENDASI = {
  SANGAT_SEHAT: 'Pertahankan kinerja! Jadikan UMKM ini sebagai role model.',
  SEHAT: 'Kinerja sudah baik. Tingkatkan faktor yang masih di bawah rata-rata.',
  CUKUP_SEHAT: 'Perlu perbaikan signifikan pada 1-2 faktor kesehatan organisasi.',
  KURANG_SEHAT: 'Prioritas intervensi! Segera konsultasi dengan pendamping UMKM.',
};

function statusFromTotal(total) {
  if (total >= 25) return { status: 'SANGAT_SEHAT', label: 'Best Practice' };
  if (total >= 19) return { status: 'SEHAT', label: 'Perlu Perhatian' };
  if (total >= 13) return { status: 'CUKUP_SEHAT', label: 'Perlu Intervensi' };
  return { status: 'KURANG_SEHAT', label: 'Prioritas Intervensi' };
}

const hasil = [];
for (const item of $input.all()) {
  // Webhook v2 membungkus payload di item.json.body; dukung juga body datar.
  const raw = item.json ?? {};
  const b = (raw.body && typeof raw.body === 'object' && !Array.isArray(raw.body)) ? raw.body : raw;
  const errors = [];
  if (typeof b.id_umkm !== 'string' || !/^UMKM\\d{3}$/.test(b.id_umkm)) {
    errors.push('id_umkm harus berformat UMKMxxx');
  }

  const skor = {};
  for (const f of FAKTOR) {
    const v = (typeof b[f] === 'number' || typeof b[f] === 'string') ? Number(b[f]) : NaN;
    if (!Number.isInteger(v) || v < 1 || v > 5) {
      errors.push(f + ' harus bilangan bulat 1-5');
    } else {
      skor[f] = v;
    }
  }

  if (errors.length) {
    hasil.push({ json: { success: false, errors } });
    continue;
  }

  const total = FAKTOR.reduce((a, f) => a + skor[f], 0);
  const { status, label } = statusFromTotal(total);
  const min = Math.min(...FAKTOR.map((f) => skor[f]));

  hasil.push({
    json: {
      success: true,
      data: {
        id_umkm: b.id_umkm,
        total_skor: total,
        status,
        label,
        rekomendasi: REKOMENDASI[status],
        skor_faktor: skor,
        faktor_terlemah: FAKTOR
          .filter((f) => skor[f] === min)
          .map((f) => ({ faktor: f, nama: NAMA[f], skor: min, saran: SARAN[f] })),
      },
    },
  });
}
return hasil;`;

const CODE_PECAH = `// HTTP Request mengembalikan satu item berisi { success, data: [...] }.
// Pecah array data menjadi satu item per UMKM agar bisa diolah Edit Fields.
const res = $input.first().json;
const rows = Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);
return rows.map((row) => ({ json: row }));`;

const workflowPredict = {
  id: 'js4umkmPredict0001',
  name: 'umkm-predict',
  active: true,
  nodes: [
    {
      parameters: {
        httpMethod: 'POST',
        path: 'predict',
        responseMode: 'responseNode',
        authentication: 'headerAuth',
        options: {},
      },
      id: 'a1000000-0000-4000-8000-000000000001',
      name: 'Webhook POST /predict',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2.2,
      position: [-260, 0],
      webhookId: 'rapor-predict-js4',
      credentials: { httpHeaderAuth: CRED.webhook },
      notes: 'POST /webhook/predict (Production URL). Header x-webhook-secret wajib cocok.',
    },
    {
      parameters: { jsCode: CODE_PREDICT },
      id: 'a1000000-0000-4000-8000-000000000002',
      name: 'Validasi & Hitung',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [-40, 0],
      notes: 'Validasi id_umkm, enam faktor 1-5, total, status, rekomendasi.',
    },
    {
      parameters: {
        conditions: {
          options: {
            caseSensitive: true,
            leftValue: '',
            typeValidation: 'strict',
            version: 2,
          },
          conditions: [
            {
              id: 'c1000000-0000-4000-8000-000000000001',
              leftValue: '={{ String($json.success) }}',
              rightValue: 'true',
              operator: { type: 'string', operation: 'equals' },
            },
          ],
          combinator: 'and',
        },
        options: {},
      },
      id: 'a1000000-0000-4000-8000-000000000003',
      name: 'Sukses?',
      type: 'n8n-nodes-base.if',
      typeVersion: 2.2,
      position: [180, 0],
    },
    {
      parameters: {
        operation: 'executeQuery',
        query:
          'INSERT INTO prediksi_log (id_umkm, total_skor, status, sumber)\n' +
          "VALUES ($1, $2, $3, 'webhook')\n" +
          'RETURNING log_id, dibuat_pada;',
        options: {
          queryReplacement:
            '={{ [$json.data.id_umkm, $json.data.total_skor, $json.data.status] }}',
        },
      },
      id: 'a1000000-0000-4000-8000-000000000004',
      name: 'Simpan prediksi_log',
      type: 'n8n-nodes-base.postgres',
      typeVersion: 2.8,
      position: [440, -120],
      credentials: { postgres: CRED.postgres },
      notes: 'Query berparameter; sumber = webhook (JS-7).',
    },
    {
      parameters: {
        respondWith: 'json',
        responseBody: "={{ $('Validasi & Hitung').first().json }}",
        options: { responseCode: 200 },
      },
      id: 'a1000000-0000-4000-8000-000000000005',
      name: 'Balas 200',
      type: 'n8n-nodes-base.respondToWebhook',
      typeVersion: 1.5,
      position: [700, -120],
    },
    {
      parameters: {
        respondWith: 'json',
        responseBody: "={{ $('Validasi & Hitung').first().json }}",
        options: { responseCode: 400 },
      },
      id: 'a1000000-0000-4000-8000-000000000006',
      name: 'Balas 400',
      type: 'n8n-nodes-base.respondToWebhook',
      typeVersion: 1.5,
      position: [440, 120],
      notes: 'Input tidak valid: success=false, tidak menulis prediksi_log.',
    },
  ],
  connections: {
    'Webhook POST /predict': {
      main: [[{ node: 'Validasi & Hitung', type: 'main', index: 0 }]],
    },
    'Validasi & Hitung': {
      main: [[{ node: 'Sukses?', type: 'main', index: 0 }]],
    },
    'Sukses?': {
      main: [
        [{ node: 'Simpan prediksi_log', type: 'main', index: 0 }],
        [{ node: 'Balas 400', type: 'main', index: 0 }],
      ],
    },
    'Simpan prediksi_log': {
      main: [[{ node: 'Balas 200', type: 'main', index: 0 }]],
    },
  },
  settings: {
    executionOrder: 'v1',
    timezone: TIMEZONE,
    saveManualExecutions: true,
    saveDataSuccessExecution: 'all',
    saveDataErrorExecution: 'all',
  },
  pinData: {},
  meta: { templateCredsSetupCompleted: true },
  tags: [],
};

const workflowMonitoring = {
  id: 'js5umkmMonitoring01',
  name: 'umkm-monitoring',
  active: false,
  nodes: [
    {
      parameters: {
        rule: {
          interval: [{ field: 'cronExpression', expression: '*/10 * * * *' }],
        },
      },
      id: 'b2000000-0000-4000-8000-000000000001',
      name: 'Schedule */10 menit',
      type: 'n8n-nodes-base.scheduleTrigger',
      typeVersion: 1.4,
      position: [-300, 0],
      notes: 'Aktifkan hanya saat uji; nonaktifkan lagi setelah selesai (JS-5).',
    },
    {
      parameters: {
        url: "={{ $env.RAPOR_BASE_URL + '/api/pemantauan' }}",
        sendHeaders: true,
        headerParameters: {
          parameters: [{ name: 'x-api-key', value: '={{ $env.N8N_API_KEY }}' }],
        },
        options: {},
      },
      id: 'b2000000-0000-4000-8000-000000000002',
      name: 'Ambil /api/pemantauan',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.5,
      position: [-80, 0],
      notes: 'RAPOR_BASE_URL diatur di docker-compose/.env.',
    },
    {
      parameters: { jsCode: CODE_PECAH },
      id: 'b2000000-0000-4000-8000-000000000003',
      name: 'Pecah Data',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [140, 0],
    },
    {
      parameters: {
        assignments: {
          assignments: [
            {
              id: 'd2000000-0000-4000-8000-000000000001',
              name: 'waktu_format',
              value:
                "={{ $now.setZone('Asia/Jakarta').setLocale('id').toFormat('dd MMMM yyyy HH:mm') }}",
              type: 'string',
            },
            {
              id: 'd2000000-0000-4000-8000-000000000002',
              name: 'total_skor',
              value: '={{ Number($json.total_skor) }}',
              type: 'number',
            },
            {
              id: 'd2000000-0000-4000-8000-000000000003',
              name: 'status_message',
              value: "={{ $json.status + ' - ' + $json.nama_umkm }}",
              type: 'string',
            },
          ],
        },
        includeOtherFields: true,
        options: {},
      },
      id: 'b2000000-0000-4000-8000-000000000004',
      name: 'Rapikan Data',
      type: 'n8n-nodes-base.set',
      typeVersion: 3.5,
      position: [360, 0],
    },
    {
      parameters: {
        conditions: {
          options: {
            caseSensitive: true,
            leftValue: '',
            typeValidation: 'strict',
            version: 2,
          },
          conditions: [
            {
              id: 'd2000000-0000-4000-8000-000000000004',
              leftValue: '={{ $json.total_skor }}',
              rightValue: 13,
              operator: { type: 'number', operation: 'smaller' },
            },
          ],
          combinator: 'and',
        },
        options: {},
      },
      id: 'b2000000-0000-4000-8000-000000000005',
      name: 'Kritis? (<13)',
      type: 'n8n-nodes-base.if',
      typeVersion: 2.2,
      position: [580, 0],
    },
    {
      parameters: {
        operation: 'executeQuery',
        query:
          'INSERT INTO prediksi_log (id_umkm, total_skor, status, sumber)\n' +
          "VALUES ($1, $2, $3, 'schedule')\n" +
          'RETURNING log_id;',
        options: {
          queryReplacement: '={{ [$json.id_umkm, $json.total_skor, $json.status] }}',
        },
      },
      id: 'b2000000-0000-4000-8000-000000000006',
      name: 'Catat skor kritis',
      type: 'n8n-nodes-base.postgres',
      typeVersion: 2.8,
      position: [840, -140],
      credentials: { postgres: CRED.postgres },
      notes: 'sumber = schedule (JS-7).',
    },
    {
      parameters: {
        chatId: 'GANTI_CHAT_ID',
        text: "=⚠️ *{{ $json.status_message }}*\\nTotal skor: {{ $json.total_skor }} (prioritas intervensi)\\nWaktu: {{ $json.waktu_format }}",
        additionalFields: {},
      },
      id: 'b2000000-0000-4000-8000-000000000007',
      name: 'Telegram (isi token & chat id)',
      type: 'n8n-nodes-base.telegram',
      typeVersion: 1.2,
      position: [840, 60],
      disabled: true,
      notes: 'Nonaktif secara bawaan: isi kredensial bot Telegram dan chatId, lalu aktifkan.',
    },
    {
      parameters: {},
      id: 'b2000000-0000-4000-8000-000000000008',
      name: 'Tidak ada skor kritis',
      type: 'n8n-nodes-base.noOp',
      typeVersion: 1,
      position: [840, 220],
    },
  ],
  connections: {
    'Schedule */10 menit': {
      main: [[{ node: 'Ambil /api/pemantauan', type: 'main', index: 0 }]],
    },
    'Ambil /api/pemantauan': {
      main: [[{ node: 'Pecah Data', type: 'main', index: 0 }]],
    },
    'Pecah Data': {
      main: [[{ node: 'Rapikan Data', type: 'main', index: 0 }]],
    },
    'Rapikan Data': {
      main: [[{ node: 'Kritis? (<13)', type: 'main', index: 0 }]],
    },
    'Kritis? (<13)': {
      main: [
        [
          { node: 'Catat skor kritis', type: 'main', index: 0 },
          { node: 'Telegram (isi token & chat id)', type: 'main', index: 0 },
        ],
        [{ node: 'Tidak ada skor kritis', type: 'main', index: 0 }],
      ],
    },
  },
  settings: {
    executionOrder: 'v1',
    timezone: TIMEZONE,
    saveManualExecutions: true,
    saveDataSuccessExecution: 'all',
    saveDataErrorExecution: 'all',
  },
  pinData: {},
  meta: { templateCredsSetupCompleted: true },
  tags: [],
};

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(
  path.join(OUT, 'js4-umkm-predict.json'),
  JSON.stringify(workflowPredict, null, 2) + '\n',
);
fs.writeFileSync(
  path.join(OUT, 'js5-umkm-monitoring.json'),
  JSON.stringify(workflowMonitoring, null, 2) + '\n',
);

console.log('Dibuat: workflows/js4-umkm-predict.json');
console.log('Dibuat: workflows/js5-umkm-monitoring.json');
