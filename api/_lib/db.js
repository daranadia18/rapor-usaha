import pg from 'pg';

let pool;

function getPool() {
  if (pool) return pool;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL belum diatur');
  // SSL ditentukan oleh connection string (mis. ?sslmode=verify-full atau default Neon).
  pool = new pg.Pool({
    connectionString: url, max: 3, connectionTimeoutMillis: 10000, idleTimeoutMillis: 10000,
  });
  pool.on('error', (e) => console.error('pg pool error:', e.message));
  return pool;
}

// Semua query WAJIB berparameter: query('... WHERE id = $1', [id])
export function query(text, params = []) {
  return getPool().query(text, params);
}

// Transaksi: fn menerima client; otomatis COMMIT / ROLLBACK.
export async function withTx(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch { /* abaikan */ }
    throw e;
  } finally {
    client.release();
  }
}
