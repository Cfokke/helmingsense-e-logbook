# Helmingsense Derived Data — STW (DD-STW) v0.1.0

Purpose: derive Speed Through Water (STW) using TZ iBoat route CSV (lat/lon/SOG/COG) and LuckGrib ocean current GRIBs.

Inputs:
- Route CSV (semicolon format)
- GRIB: data/grib_currents/current.grb2 (UOGRD/VOGRD)

CLI usage:
  bin/stw_from_csv.cjs --csv data/<route>.csv --slices --start 2025-09-03T12:00Z

Outputs (data/derived/stw/):
- <base>-hourly.csv
- <base>-slices.csv (optional)
- <base>-summary.txt

Notes:
- current_dir_deg = direction the current flows toward (true degrees).
- max_neighbor_offset_nm = distance to nearest valid current grid cell (coastal fallback).
