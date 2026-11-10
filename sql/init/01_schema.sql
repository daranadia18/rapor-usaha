CREATE TABLE sektor (
  sektor_id   serial PRIMARY KEY,
  nama_sektor varchar(40) NOT NULL UNIQUE
);
CREATE TABLE umkm (
  id_umkm   varchar(10) PRIMARY KEY CHECK (id_umkm ~ '^UMKM[0-9]{3}$'),
  nama_umkm varchar(80) NOT NULL,
  sektor_id int NOT NULL REFERENCES sektor(sektor_id),
  kota      varchar(40) NOT NULL
);
CREATE TABLE survei (
  survei_id        serial PRIMARY KEY,
  id_umkm          varchar(10) NOT NULL REFERENCES umkm(id_umkm),
  tanggal          date NOT NULL DEFAULT CURRENT_DATE,
  sumber_daya      smallint NOT NULL CHECK (sumber_daya      BETWEEN 1 AND 5),
  kepemimpinan     smallint NOT NULL CHECK (kepemimpinan     BETWEEN 1 AND 5),
  lingkungan_kerja smallint NOT NULL CHECK (lingkungan_kerja BETWEEN 1 AND 5),
  nilai_organisasi smallint NOT NULL CHECK (nilai_organisasi BETWEEN 1 AND 5),
  stabilitas       smallint NOT NULL CHECK (stabilitas       BETWEEN 1 AND 5),
  kinerja          smallint NOT NULL CHECK (kinerja          BETWEEN 1 AND 5),
  total_skor       smallint GENERATED ALWAYS AS
    (sumber_daya + kepemimpinan + lingkungan_kerja +
     nilai_organisasi + stabilitas + kinerja) STORED
);
CREATE TABLE prediksi_log (
  log_id      serial PRIMARY KEY,
  id_umkm     varchar(10) NOT NULL,
  total_skor  smallint NOT NULL,
  status      varchar(20) NOT NULL,
  sumber      varchar(10) NOT NULL CHECK (sumber IN ('webhook','schedule')),
  dibuat_pada timestamptz NOT NULL DEFAULT now()
);
