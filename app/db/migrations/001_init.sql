-- 001_init.sql — initial schema (plural tables)

PRAGMA journal_mode=WAL;

CREATE TABLE IF NOT EXISTS autologs (
  id INTEGER PRIMARY KEY,
  timestamp_utc TEXT NOT NULL,            -- YYYY-MM-DDTHH:mmZ
  crew TEXT NOT NULL,
  autopilot TEXT NOT NULL,
  propulsion TEXT NOT NULL,
  visibility TEXT NOT NULL,
  sea_state TEXT NOT NULL,
  observations TEXT,
  lat REAL, lon REAL,
  cog_true_deg REAL, hdg_mag_deg REAL, hdg_true_deg REAL,
  sog_kt REAL, aws_kt REAL, tws_kt REAL, twd_true_deg REAL,
  temp_c REAL, pres_mbar REAL, dew_c REAL, hum_pct REAL,
  pitch_deg REAL, roll_deg REAL,
  voyage_id INTEGER,
  UNIQUE(timestamp_utc)
);

CREATE TABLE IF NOT EXISTS manual_logs (
  id INTEGER PRIMARY KEY,
  timestamp_utc TEXT NOT NULL,
  crew TEXT NOT NULL,
  autopilot TEXT NOT NULL,
  propulsion TEXT NOT NULL,
  visibility TEXT NOT NULL,
  sea_state TEXT NOT NULL,
  observations TEXT,
  lat REAL, lon REAL,
  cog_true_deg REAL, hdg_mag_deg REAL, hdg_true_deg REAL,
  sog_kt REAL, aws_kt REAL, tws_kt REAL, twd_true_deg REAL,
  temp_c REAL, pres_mbar REAL, dew_c REAL, hum_pct REAL,
  pitch_deg REAL, roll_deg REAL,
  linked_autolog_id INTEGER
);

CREATE TABLE IF NOT EXISTS voyage (
  id INTEGER PRIMARY KEY,
  name TEXT,
  status TEXT CHECK(status IN ('active','stopped')) NOT NULL,
  started_utc TEXT NOT NULL,
  stopped_utc TEXT
);

CREATE TABLE IF NOT EXISTS voyage_leg (
  id INTEGER PRIMARY KEY,
  voyage_id INTEGER NOT NULL,
  from_autolog_id INTEGER NOT NULL,
  to_autolog_id INTEGER NOT NULL,
  leg_nm REAL NOT NULL
);
