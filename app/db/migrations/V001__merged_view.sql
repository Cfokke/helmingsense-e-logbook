-- V001__merged_view.sql
-- Idempotent indexes on timestamps
CREATE INDEX IF NOT EXISTS idx_autologs_ts   ON autologs(timestamp_utc);
CREATE INDEX IF NOT EXISTS idx_manual_logs   ON manual_logs(timestamp_utc);

-- Recreate view safely
DROP VIEW IF EXISTS merged_log;

-- Unified chronological stream with explicit source discriminator
CREATE VIEW merged_log AS
SELECT
  a.id            AS row_id,
  'autolog'       AS source,
  a.timestamp_utc AS timestamp_utc,
  a.crew, a.autopilot, a.propulsion, a.visibility, a.sea_state, a.observations,
  a.lat, a.lon, a.cog_true_deg, a.hdg_mag_deg, a.hdg_true_deg, a.sog_kt,
  a.aws_kt, a.tws_kt, a.twd_true_deg,
  a.temp_c, a.pres_mbar, a.dew_c, a.hum_pct,
  a.pitch_deg, a.roll_deg
FROM autologs a
UNION ALL
SELECT
  m.id            AS row_id,
  'manual'        AS source,
  m.timestamp_utc AS timestamp_utc,
  m.crew, m.autopilot, m.propulsion, m.visibility, m.sea_state, m.observations,
  m.lat, m.lon, m.cog_true_deg, m.hdg_mag_deg, m.hdg_true_deg, m.sog_kt,
  m.aws_kt, m.tws_kt, m.twd_true_deg,
  m.temp_c, m.pres_mbar, m.dew_c, m.hum_pct,
  m.pitch_deg, m.roll_deg
FROM manual_logs m;
