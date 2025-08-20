Purpose

Authoritative schemas/contracts for the MVP so services, UI, and exports align.
Documentation only; no runtime code. All times UTC unless noted.

1) CSV Schemas
1.1 auto_log.csv (authoritative order)
#	Column	Type	Units	Nullable	Notes
1	Timestamp	string	UTC YYYY-MM-DDTHH:mmZ	no	Stored UTC; UI may show local
2	Crew	string (enum)	—	no	1,2,3,4,5,6
3	Autopilot	string (enum)	—	no	off,standby,engaged,wind
4	Propulsion	string (enum)	—	no	drift,sailing,motor-sailing,under engine, Heave-to
5	Visibility	string (enum)	—	no	excellent,good,fair,poor,fog
6	Sea_state	string (enum)	—	no	smooth,slight,moderate,rough,very-rough
7	Observations	string	—	yes	free text
8	Lat	number	deg	yes	from Signal K
9	Lon	number	deg	yes	from Signal K
10	COG (°T)	number	deg	yes	true
11	HdgMag (°)	number	deg	yes	magnetic
12	HdgTrue (°)	number	deg	yes	true
13	SOG (kt)	number	kt	yes	—
14	AWS (kt)	number	kt	yes	—
15	TWS (kt)	number	kt	yes	—
16	TWD (°T)	number	deg	yes	true
17	Temp (°C)	number	°C	yes	environment.inside.temperature
18	Pres (mbar)	number	mbar	yes	environment.inside.pressure
19	Dew (°C)	number	°C	yes	environment.inside.dewPointTemperature
20	Hum (%)	number	%	yes	environment.inside.humidity
21	Pitch (°)	number	deg	yes	navigation.pitch converted to degrees
22	Roll (°)	number	deg	yes	navigation.roll converted to degrees
   Angles in degrees, speeds in knots. Missing sensors may produce blanks.

  1.2 manual_log.csv

Same columns and order as auto_log.csv. Rows originate from the manual form (dropdowns + free text). Any Signal K‑derived fields present at time of submission may be filled; blanks allowed. 

2) Manual dropdown enums (authoritative)

crew: 1, 2, 3, 4, 5, 6

autopilot: off, standby, engaged, wind

propulsion: drift, sailing, motor-sailing, under engine, Heave-to

visibility: excellent, good, fair, poor, fog

sea_state: smooth, slight, moderate, rough, very-rough

observations: free text

Values are case- and spelling‑sensitive. Validation rejects anything else.

3) Time & retention

Timestamp storage: UTC, no seconds → YYYY-MM-DDTHH:mmZ.

Display: Frontend converts to local time (fallback: show UTC).

Snapshots: keep last 24h only (rolling). DB/CSV persist indefinitely.

4) SQLite schema (DDL — documentation only)
 -- Autologs (hourly)
CREATE TABLE autologs (
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
  UNIQUE(timestamp_utc)                    -- one per hour tick
);

-- Manual logs
CREATE TABLE manual_logs (
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
  linked_autolog_id INTEGER               -- latest autolog shown alongside
);

-- Voyages
CREATE TABLE voyage (
  id INTEGER PRIMARY KEY,
  name TEXT,
  status TEXT CHECK(status IN ('active','stopped')) NOT NULL,
  started_utc TEXT NOT NULL,
  stopped_utc TEXT
);

-- Derived distances (per hourly autolog-to-autolog)
CREATE TABLE voyage_leg (
  id INTEGER PRIMARY KEY,
  voyage_id INTEGER NOT NULL,
  from_autolog_id INTEGER NOT NULL,
  to_autolog_id INTEGER NOT NULL,
  leg_nm REAL NOT NULL                      -- haversine result
);

  5) Config schema (fields + JSON Schema)

Human YAML (example fields):
signalk:
  base_url: "http://localhost:3000/signalk/v1/api/vessels/self"
  token: ""                  # optional
  timeout_sec: 5

sampling:
  snapshot_interval_sec: 60
  autolog_on_the_hour: true
  fields:
    - environment.inside.temperature
    - environment.inside.pressure
    - environment.inside.dewPointTemperature
    - environment.inside.humidity
    - navigation.pitch
    - navigation.roll
    # GPS/AIS/Seatalk fields will appear when the bridge is connected

exports:
  dir: "/opt/helmingsense/data"
  csv_timestamp_format: "YYYY-MM-DDTHH:mmZ"

viewer:
  auto_refresh_sec: 3600
  local_base_url: "http://localhost:8080"
  
JSON Schema (trimmed, for validation):
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["signalk", "sampling", "exports", "viewer"],
  "additionalProperties": false,
  "properties": {
    "signalk": {
      "type": "object",
      "required": ["base_url", "timeout_sec"],
      "additionalProperties": false,
      "properties": {
        "base_url": {"type": "string", "format": "uri"},
        "token": {"type": "string"},
        "timeout_sec": {"type": "integer", "minimum": 1}
      }
    },
    "sampling": {
      "type": "object",
      "required": ["snapshot_interval_sec", "autolog_on_the_hour", "fields"],
      "additionalProperties": false,
      "properties": {
        "snapshot_interval_sec": {"type": "integer", "minimum": 10},
        "autolog_on_the_hour": {"type": "boolean"},
        "fields": {
          "type": "array",
          "items": {"type": "string"},
          "minItems": 1
        }
      }
    },
    "exports": {
      "type": "object",
      "required": ["dir", "csv_timestamp_format"],
      "additionalProperties": false,
      "properties": {
        "dir": {"type": "string"},
        "csv_timestamp_format": {"type": "string", "const": "YYYY-MM-DDTHH:mmZ"}
      }
    },
    "viewer": {
      "type": "object",
      "required": ["auto_refresh_sec", "local_base_url"],
      "additionalProperties": false,
      "properties": {
        "auto_refresh_sec": {"type": "integer", "minimum": 60},
        "local_base_url": {"type": "string", "format": "uri"}
      }
    }
  }
}
  
6) ASCII ERD (high‑level)
voyage (1) ──< voyage_leg >── (1) autolog
                       ^               ^
                       |               |
                    links ─────────────┘ (from/to hourly ticks)

manual_log --(optional)-> linked_autolog_id (latest hourly context)

7) Validation rules (summary)

Reject CSV rows with unknown headers or enum values.

Timestamp must match YYYY-MM-DDTHH:mmZ (UTC).

Numeric fields parseable; Hum (%) 0..100 if present.

Pitch (°) and Roll (°) in degrees (convert from radians if Signal K provides radians).
