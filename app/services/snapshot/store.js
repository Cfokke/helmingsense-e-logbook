// app/services/snapshot/store.js
// Storage stub. For MVP skeleton we simply print to console.
// Next iteration: write/merge into signalk_snapshot.json and prune to 24h.

export async function storeSnapshot(snapshot) {
  // Keep log concise but informative
  console.log(JSON.stringify({
    t: snapshot.timestamp_utc,
    fields: snapshot.requested_fields.length,
    raw_keys: Object.keys(snapshot.raw || {}).length
  }));
}
