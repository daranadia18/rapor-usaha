-- Peran 'admin' (satu-satunya peran login). Idempoten: aman dijalankan berulang
-- pada basis data lama maupun baru. Nilai lama tetap diizinkan (kompatibilitas).
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin','analis','pendamping','pengelola'));
