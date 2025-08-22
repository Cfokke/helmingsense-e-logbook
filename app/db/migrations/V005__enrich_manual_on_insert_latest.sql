-- V005__enrich_manual_on_insert_latest.sql
-- On each manual_logs INSERT, copy missing instrument fields from the latest autolog snapshot
-- (regardless of age). Then define merged_log as a simple UNION of autologs + manual_logs.

-- 1) Safety: remove older view/trigger if present
DROP VIEW IF EXISTS merged_log;
DROP TRIGGER IF EXISTS trg_manual_enrich_latest;

-- 2) Enrich the newly-inserted manual row from the latest autolog snapshot
CREATE TRIGGER trg_manual_enrich_latest
AFTER INSERT ON manual_logs
BEGIN
  UPDATE manual_logs
  SET
    lat            = COALESCE(NEW.lat,          (SELECT lat            FROM autologs ORDER BY timestamp_utc DESC LIMIT 1)),
    lon            = COALESCE(NEW.lon,          (SELECT lon            FROM autologs ORDER BY timestamp_utc DESC LIMIT 1)),
    cog_true_deg   = COALESCE(NEW.cog_true_deg, (SELECT cog_true_deg   FROM autologs ORDER BY timestamp_utc DESC LIMIT 1)),
    hdg_mag_deg    = COALESCE(NEW.hdg_mag_deg,  (SELECT hdg_mag_deg    FROM autologs ORDER BY timestamp_utc DESC LIMIT 1)),
    hdg_true_deg   = COALESCE(NEW.hdg_true_deg, (SELECT hdg_true_deg   FROM autologs ORDER BY timestamp_utc DESC LIMIT 1)),
    sog_kt         = COALESCE(NEW.sog_kt,       (SELECT sog_kt         FROM autologs ORDER BY timestamp_utc DESC LIMIT 1)),
    aws_kt         = COALESCE(NEW.aws_kt,       (SELECT aws_kt         FROM autologs ORDER BY timestamp_utc DESC LIMIT 1)),
    tws_kt         = COALESCE(NEW.tws_kt,       (SELECT tws_kt         FROM autologs ORDER BY timestamp_utc DESC LIMIT 1)),
    twd_true_deg   = COALESCE(NEW.twd_true_deg, (SELECT twd_true_deg   FROM autologs ORDER BY timestamp_utc DESC LIMIT 1)),
    temp_c         = COALESCE(NEW.temp_c,       (SELECT temp_c         FROM autologs ORDER BY timestamp_utc DESC LIMIT 1)),
    pres_mbar      = COALESCE(NEW.pres_mbar,    (SELECT pres_mbar      FROM autologs ORDER BY timestamp_utc DESC LIMIT 1)),
    dew_c          = COALESCE(NEW.dew_c,        (SELECT dew_c          FROM autologs ORDER BY timestamp_utc DESC LIMIT 1)),
    hum_pct        = COALESCE(NEW.hum_pct,      (SELECT hum_pct        FROM autologs ORDER BY timestamp_utc DESC LIMIT 1)),
    pitch_deg      = COALESCE(NEW.pitch_deg,    (SELECT pitch_deg      FROM autologs ORDER BY timestamp_utc DESC LIMIT 1)),
    roll_deg       = COALESCE(NEW.roll_deg,     (SELECT roll_deg       FROM autologs ORDER BY timestamp_utc DESC LIMIT 1))
  WHERE id = NEW.id;
END;

-- 3) Simple merged view (no enrichment logic here)
CREATE VIEW merged_log AS
SELECT
  timestamp_utc, crew, autopilot, propulsion, visibility, sea_state, observations,
  lat, lon,
  cog_true_deg, hdg_mag_deg, hdg_true_deg,
  sog_kt, aws_kt, tws_kt, twd_true_deg,
  temp_c, pres_mbar, dew_c, hum_pct,
  pitch_deg, roll_deg
FROM autologs
UNION ALL
SELECT
  timestamp_utc, crew, autopilot, propulsion, visibility, sea_state, observations,
  lat, lon,
  cog_true_deg, hdg_mag_deg, hdg_true_deg,
  sog_kt, aws_kt, tws_kt, twd_true_deg,
  temp_c, pres_mbar, dew_c, hum_pct,
  pitch_deg, roll_deg
FROM manual_logs;
