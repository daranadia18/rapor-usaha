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
  smtp: { id: 'rapor-smtp-01', name: 'Rapor Usaha SMTP' },
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

// Mode "Run Once for Each Item": satu email per UMKM kritis (<13).
// Field asli tetap dibawa (...$json) agar terlihat di panel output.
// Email dikirim dua format: HTML (template berwarna, tabel inline-style agar aman di Gmail/Outlook)
// dan teks biasa sebagai cadangan untuk aplikasi email yang tidak menampilkan HTML.
// String.raw: kode di bawah tidak boleh memuat backtick atau tanda dolar-kurung-kurawal.
const CODE_EMAIL = String.raw`// Susun email (HTML + teks) untuk satu UMKM dengan skor kritis (<13).
const u = $json;
const waktu = u.waktu_format
  || $now.setZone('Asia/Jakarta').setLocale('id').toFormat('dd MMMM yyyy HH:mm');
const esc = (v) => String(v ?? '-').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Warna status sama dengan website (public/css/style.css).
const STATUS = {
  SANGAT_SEHAT: { nama: 'Sangat Sehat', warna: '#1f8a4c', soft: '#e2f4e9', ink: '#115c33' },
  SEHAT: { nama: 'Sehat', warna: '#13879c', soft: '#def2f5', ink: '#0b5966' },
  CUKUP_SEHAT: { nama: 'Cukup Sehat', warna: '#e09a12', soft: '#fdf0d5', ink: '#7d4f00' },
  KURANG_SEHAT: { nama: 'Kurang Sehat', warna: '#d6453a', soft: '#fde6e4', ink: '#9c2a21' },
};
const st = STATUS[u.status] || STATUS.KURANG_SEHAT;
const skor = Number(u.total_skor);
const persen = Math.max(4, Math.min(100, Math.round(skor / 30 * 100)));

const tren = u.perubahan == null
  ? 'belum ada survei sebelumnya'
  : (u.perubahan > 0 ? 'naik ' : u.perubahan < 0 ? 'turun ' : 'tetap ')
    + Math.abs(u.perubahan) + ' poin dari ' + u.skor_sebelumnya;
const trenWarna = u.perubahan == null || u.perubahan === 0 ? '#556070' : (u.perubahan < 0 ? '#c23a2f' : '#15803d');
const trenPanah = u.perubahan == null ? '' : (u.perubahan < 0 ? '&#9660; ' : u.perubahan > 0 ? '&#9650; ' : '');

const subject = '[Rapor Usaha] Prioritas Intervensi: ' + u.nama_umkm + ' (' + u.id_umkm + ')';

const text = [
  'Halo Pendamping UMKM,',
  '',
  'Pemantauan terjadwal menemukan UMKM dengan skor kritis:',
  '',
  '  UMKM        : ' + u.nama_umkm + ' (' + u.id_umkm + ')',
  '  Sektor/Kota : ' + (u.nama_sektor ?? '-') + ' / ' + (u.kota ?? '-'),
  '  Survei      : ' + (u.tanggal ?? '-'),
  '  Total skor  : ' + u.total_skor + ' dari 30 (' + tren + ')',
  '  Status      : ' + u.status + ' - ' + (u.label ?? 'Prioritas Intervensi'),
  '',
  'Segera jadwalkan konsultasi dengan pemilik UMKM.',
  '',
  'Waktu pengecekan: ' + waktu + ' WIB',
  '-- Dikirim otomatis oleh workflow n8n umkm-monitoring',
].join('\n');

const FONT = "font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";
const baris = (label, nilai) =>
  '<tr><td style="' + FONT + 'padding:11px 0;border-bottom:1px solid #e3e7ee;color:#556070;font-size:14px;width:38%;vertical-align:top">' + label + '</td>'
  + '<td style="' + FONT + 'padding:11px 0;border-bottom:1px solid #e3e7ee;color:#111827;font-size:14px;font-weight:600">' + nilai + '</td></tr>';

const html = [
  '<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
  '<meta name="color-scheme" content="light"><title>' + esc(subject) + '</title></head>',
  '<body style="margin:0;padding:0;background:#f4f6fa">',
  '<div style="display:none;max-height:0;overflow:hidden;opacity:0">' + esc(u.nama_umkm) + ': skor ' + skor + ' dari 30, perlu pendampingan segera.</div>',
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fa"><tr><td align="center" style="padding:28px 12px">',
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #e3e7ee;border-radius:12px;border-collapse:separate">',

  // Kepala
  '<tr><td style="' + FONT + 'background:#2453c9;border-radius:12px 12px 0 0;padding:18px 28px">',
  '<div style="color:#ffffff;font-size:18px;font-weight:700">Rapor Usaha</div>',
  '<div style="color:#dbe5fb;font-size:13px;margin-top:2px">Pemantauan Kesehatan UMKM</div></td></tr>',

  // Judul
  '<tr><td style="' + FONT + 'padding:28px 28px 4px">',
  '<span style="display:inline-block;background:#fde6e4;color:#9c2a21;font-size:12px;font-weight:700;letter-spacing:.06em;padding:5px 11px;border-radius:999px">PRIORITAS INTERVENSI</span>',
  '<h1 style="margin:14px 0 8px;font-size:22px;line-height:1.3;color:#111827">' + esc(u.nama_umkm) + ' perlu pendampingan segera</h1>',
  '<p style="margin:0;font-size:15px;line-height:1.6;color:#374151">Halo Pendamping UMKM, pemantauan terjadwal menemukan UMKM dengan skor kesehatan <strong>kritis</strong> (di bawah 13 dari 30).</p>',
  '</td></tr>',

  // Kartu skor
  '<tr><td style="padding:20px 28px 8px">',
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:' + st.soft + ';border-radius:10px"><tr><td style="' + FONT + 'padding:18px 20px">',
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>',
  '<td style="' + FONT + 'vertical-align:bottom"><div style="font-size:13px;font-weight:600;color:' + st.ink + '">Total skor</div>',
  '<div style="margin-top:2px"><span style="font-size:38px;font-weight:700;line-height:1;color:' + st.ink + '">' + skor + '</span>',
  '<span style="font-size:16px;color:' + st.ink + '"> / 30</span></div></td>',
  '<td align="right" style="' + FONT + 'vertical-align:bottom"><span style="display:inline-block;background:' + st.warna + ';color:#ffffff;font-size:13px;font-weight:700;padding:6px 12px;border-radius:999px">' + st.nama + '</span></td>',
  '</tr></table>',
  '<div style="margin-top:14px;background:#ffffff;border-radius:999px;height:8px;line-height:8px;font-size:0">',
  '<div style="width:' + persen + '%;background:' + st.warna + ';border-radius:999px;height:8px;line-height:8px;font-size:0">&nbsp;</div></div>',
  '</td></tr></table></td></tr>',

  // Rincian
  '<tr><td style="padding:12px 28px 4px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">',
  baris('ID UMKM', esc(u.id_umkm)),
  baris('Sektor', esc(u.nama_sektor)),
  baris('Kota', esc(u.kota)),
  baris('Tanggal survei', esc(u.tanggal)),
  baris('Keterangan', esc(u.label ?? 'Prioritas Intervensi')),
  baris('Perubahan skor', '<span style="color:' + trenWarna + '">' + trenPanah + esc(tren) + '</span>'),
  '</table></td></tr>',

  // Langkah berikutnya
  '<tr><td style="padding:20px 28px 28px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>',
  '<td style="' + FONT + 'background:#eaf0fc;border-left:4px solid #2453c9;border-radius:6px;padding:14px 16px;font-size:14px;line-height:1.6;color:#1c3f99">',
  '<strong>Langkah berikutnya</strong><br>Segera jadwalkan konsultasi dengan pemilik UMKM untuk meninjau faktor yang rendah dan menyusun rencana perbaikan.',
  '</td></tr></table></td></tr>',

  // Kaki
  '<tr><td style="' + FONT + 'padding:16px 28px 20px;border-top:1px solid #e3e7ee;color:#6b7280;font-size:12px;line-height:1.6">',
  'Waktu pengecekan: ' + esc(waktu) + ' WIB<br>Dikirim otomatis oleh workflow n8n <strong>umkm-monitoring</strong>. Email ini tidak perlu dibalas.',
  '</td></tr>',
  '</table></td></tr></table></body></html>',
].join('');

return { json: { ...u, to: $env.ALERT_EMAIL_TO, subject, text, html } };`;

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
              operator: { type: 'number', operation: 'lt' },
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
      parameters: { mode: 'runOnceForEachItem', jsCode: CODE_EMAIL },
      id: 'b2000000-0000-4000-8000-000000000009',
      name: 'Susun Email',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [840, 60],
      notes: 'Satu item = satu email (subjek + HTML + teks) per UMKM kritis.',
    },
    {
      parameters: {
        fromEmail: '={{ $env.ALERT_EMAIL_FROM }}',
        toEmail: '={{ $json.to }}',
        subject: '={{ $json.subject }}',
        emailFormat: 'both',
        text: '={{ $json.text }}',
        html: '={{ $json.html }}',
        options: { appendAttribution: false },
      },
      id: 'b2000000-0000-4000-8000-000000000007',
      name: 'Kirim Email',
      type: 'n8n-nodes-base.emailSend',
      typeVersion: 2.1,
      position: [1060, 60],
      credentials: { smtp: CRED.smtp },
      notes: 'Gmail SMTP (smtp.gmail.com:465, App Password). Pengirim/penerima dari env ALERT_EMAIL_FROM/ALERT_EMAIL_TO.',
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
          { node: 'Susun Email', type: 'main', index: 0 },
        ],
        [{ node: 'Tidak ada skor kritis', type: 'main', index: 0 }],
      ],
    },
    'Susun Email': {
      main: [[{ node: 'Kirim Email', type: 'main', index: 0 }]],
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
