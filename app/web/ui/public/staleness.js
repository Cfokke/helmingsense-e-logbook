// app/web/ui/public/staleness.js
// Marks stale cells for CSV-based rows (arrays).
// Rule: if a cell's value is exactly identical to the previous row's value (string match), it's stale.
// We only check known numeric/sensor headers; others are left as non-stale.

export function markStale(headers, rows) {
  if (!Array.isArray(headers) || !headers.length || !Array.isArray(rows) || !rows.length) {
    return rows;
  }

  // Build the list of column indexes we care about (numeric/sensor fields)
  const idxs = [];
  for (let i = 0; i < headers.length; i++) {
    if (NUMERIC_HEADERS.has(headers[i])) idxs.push(i);
  }

  const out = [];
  let prev = null;

  for (const row of rows) {
    // Work with a shallow copy so we can attach metadata without mutating input
    const copy = row.slice();
    const staleMask = new Array(headers.length).fill(false);

    if (prev) {
      for (const i of idxs) {
        const cur = copy[i];
        const prv = prev[i];
        // Only mark stale if both are non-empty and exactly equal (string compare)
        if (cur !== "" && prv !== "" && cur === prv) {
          staleMask[i] = true;
        }
      }
    }
    // Attach the per-column stale mask
    copy._stale = staleMask;

    out.push(copy);
    prev = copy;
  }

  return out;
}

// Exact header texts to check (match your CSV headers)
const NUMERIC_HEADERS = new Set([
  "Lat",
  "Lon",
  "COG (°T)",
  "HdgMag (°)",
  "HdgTrue (°)",
  "SOG (kt)",
  "AWS (kt)",
  "TWS (kt)",
  "TWD (°T)",
  "Temp (°C)",
  "Pres (mbar)",
  "Dew (°C)",
  "Hum (%)",
  "Pitch (°)",
  "Roll (°)"
]);
