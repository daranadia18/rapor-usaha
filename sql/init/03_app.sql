-- 03_app.sql : tambahan khusus website Rapor Usaha.
-- Dijalankan SETELAH 01_schema.sql dan 02_seed.sql (satu kali).

-- ADAPT 1: website juga menulis ke prediksi_log, sehingga sumber 'web' diizinkan.
-- Constraint tanpa nama di 01 otomatis bernama prediksi_log_sumber_check.
ALTER TABLE prediksi_log DROP CONSTRAINT IF EXISTS prediksi_log_sumber_check;
ALTER TABLE prediksi_log
  ADD CONSTRAINT prediksi_log_sumber_check CHECK (sumber IN ('web','webhook','schedule'));

-- ADAPT 2: waktu proses prediksi (milidetik) untuk evaluasi kinerja sistem.
ALTER TABLE prediksi_log ADD COLUMN IF NOT EXISTS durasi_ms int NULL;

-- ADAPT 3: akun pengguna (autentikasi + peran).
CREATE TABLE IF NOT EXISTS users (
  id            serial PRIMARY KEY,
  nama          varchar(80)  NOT NULL,
  email         varchar(120) NOT NULL UNIQUE,
  password_hash text         NOT NULL,
  role          varchar(12)  NOT NULL CHECK (role IN ('admin','analis','pendamping','pengelola')),
  id_umkm       varchar(10)  NULL REFERENCES umkm(id_umkm),
  dibuat_pada   timestamptz  NOT NULL DEFAULT now()
);

-- ADAPT 4: respons kuesioner SUS (System Usability Scale) untuk uji usability.
CREATE TABLE IF NOT EXISTS sus_respons (
  id             serial PRIMARY KEY,
  nama_responden varchar(80),
  peran          varchar(40),
  iterasi        smallint NOT NULL DEFAULT 1 CHECK (iterasi >= 1),
  q1  smallint NOT NULL CHECK (q1  BETWEEN 1 AND 5),
  q2  smallint NOT NULL CHECK (q2  BETWEEN 1 AND 5),
  q3  smallint NOT NULL CHECK (q3  BETWEEN 1 AND 5),
  q4  smallint NOT NULL CHECK (q4  BETWEEN 1 AND 5),
  q5  smallint NOT NULL CHECK (q5  BETWEEN 1 AND 5),
  q6  smallint NOT NULL CHECK (q6  BETWEEN 1 AND 5),
  q7  smallint NOT NULL CHECK (q7  BETWEEN 1 AND 5),
  q8  smallint NOT NULL CHECK (q8  BETWEEN 1 AND 5),
  q9  smallint NOT NULL CHECK (q9  BETWEEN 1 AND 5),
  q10 smallint NOT NULL CHECK (q10 BETWEEN 1 AND 5),
  skor           numeric(5,2) NOT NULL,
  dibuat_pada    timestamptz  NOT NULL DEFAULT now()
);

-- ADAPT 5: indeks untuk query dashboard (riwayat per UMKM, log terbaru).
CREATE INDEX IF NOT EXISTS idx_survei_umkm_tanggal ON survei (id_umkm, tanggal);
CREATE INDEX IF NOT EXISTS idx_prediksi_log_dibuat ON prediksi_log (dibuat_pada);
