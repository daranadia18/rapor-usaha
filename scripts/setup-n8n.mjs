// Impor kredensial + workflow ke n8n lewat Public API.
// Prasyarat: n8n berjalan, N8N_PUBLIC_API_KEY di .env (Settings > n8n API > Create API key).
// Jalankan: npm run n8n:setup
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnv } from './_env.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
loadEnv(path.join(ROOT, '.env'));

const BASE = (process.env.N8N_URL || 'http://localhost:5678').replace(/\/+$/, '');
const KEY = process.env.N8N_PUBLIC_API_KEY;
if (!KEY) {
  console.error('N8N_PUBLIC_API_KEY belum diatur. Buka n8n > Settings > n8n API > Create API key.');
  process.exit(1);
}

const headers = {
  'Content-Type': 'application/json',
  'X-N8N-API-KEY': KEY,
};

async function api(method, endpoint, body) {
  const res = await fetch(BASE + '/api/v1' + endpoint, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  if (!res.ok) {
    throw new Error(`${method} ${endpoint} -> ${res.status}: ${typeof json === 'string' ? json : JSON.stringify(json)}`);
  }
  return json;
}

const requiredCredentials = [
  {
    name: 'Postgres Rapor Usaha',
    type: 'postgres',
    data: {
      host: 'postgres',
      port: 5432,
      database: process.env.POSTGRES_DB || 'umkm',
      user: process.env.POSTGRES_USER || 'umkm_admin',
      password: process.env.POSTGRES_PASSWORD,
      ssl: 'disable',
    },
  },
  {
    name: 'Rapor Usaha Webhook Secret',
    type: 'httpHeaderAuth',
    data: {
      name: 'x-webhook-secret',
      value: process.env.N8N_WEBHOOK_SECRET,
    },
  },
];

if (!process.env.POSTGRES_PASSWORD) {
  console.error('POSTGRES_PASSWORD belum diatur di .env');
  process.exit(1);
}
if (!process.env.N8N_WEBHOOK_SECRET) {
  console.error('N8N_WEBHOOK_SECRET belum diatur di .env');
  process.exit(1);
}

const existing = await api('GET', '/credentials?limit=250');
const byName = new Map((existing.data || []).map((c) => [c.name, c]));

const credentialIds = {};
for (const cred of requiredCredentials) {
  const current = byName.get(cred.name);
  if (current) {
    await api('PATCH', `/credentials/${current.id}`, cred);
    credentialIds[cred.type] = { id: current.id, name: current.name };
    console.log(`Diperbarui kredensial: ${cred.name} (${current.id})`);
  } else {
    const created = await api('POST', '/credentials', cred);
    credentialIds[cred.type] = { id: created.id, name: created.name };
    console.log(`Dibuat kredensial: ${cred.name} (${created.id})`);
  }
}

const workflowFiles = ['js4-umkm-predict.json', 'js5-umkm-monitoring.json'];
const workflows = await api('GET', '/workflows?limit=250');
const workflowsByName = new Map((workflows.data || []).map((w) => [w.name, w]));

for (const file of workflowFiles) {
  const full = path.join(ROOT, 'workflows', file);
  const wf = JSON.parse(fs.readFileSync(full, 'utf8'));

  // Ganti referensi kredensial contoh dengan ID yang benar-benar ada di instance ini.
  for (const node of wf.nodes) {
    if (!node.credentials) continue;
    for (const [type, ref] of Object.entries(node.credentials)) {
      const actual = credentialIds[type];
      if (actual) node.credentials[type] = { id: actual.id, name: actual.name };
      else if (ref) console.warn(`Kredensial tipe ${type} pada node "${node.name}" belum tersedia.`);
    }
  }

  const payload = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: wf.settings || {},
  };

  const current = workflowsByName.get(wf.name);
  let saved;
  if (current) {
    saved = await api('PUT', `/workflows/${current.id}`, payload);
    console.log(`Diperbarui workflow: ${wf.name} (${saved.id})`);
  } else {
    saved = await api('POST', '/workflows', payload);
    console.log(`Dibuat workflow: ${wf.name} (${saved.id})`);
  }

  const action = wf.active ? 'activate' : 'deactivate';
  await api('POST', `/workflows/${saved.id}/${action}`);
  console.log(`  ${wf.active ? 'Diaktifkan' : 'Dinonaktifkan'}: ${BASE}${wf.active ? '/webhook/' + (wf.nodes.find((n) => n.type === 'n8n-nodes-base.webhook')?.parameters?.path || '') : ''}`);
}
