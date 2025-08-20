// app/utils/config/schema.js
// Centralized constraints matching docs/SCHEMAS.md (MVP)

export const TIMESTAMP_FORMAT = "YYYY-MM-DDTHH:mmZ"; // const per spec

export const enums = {
  crew: ["1","2","3","4","5","6"],
  autopilot: ["off","standby","engaged","wind"],
  propulsion: ["drift","sailing","motor-sailing","under engine","Heave-to"],
  visibility: ["excellent","good","fair","poor","fog"],
  sea_state: ["smooth","slight","moderate","rough","very-rough"]
};

export const schema = {
  requiredTop: ["signalk", "sampling", "exports", "viewer"],
  signalk: {
    required: ["base_url", "timeout_sec"],
  },
  sampling: {
    required: ["snapshot_interval_sec", "autolog_on_the_hour", "fields"],
    minSnapshotSec: 10
  },
  exports: {
    required: ["dir", "csv_timestamp_format"],
    timestampConst: TIMESTAMP_FORMAT
  },
  viewer: {
    required: ["auto_refresh_sec", "local_base_url"],
    minAutoRefreshSec: 60
  }
};
