// app/services/snapshot/store.js
// Adapter that connects the snapshot loop to the file store.

import fs from "fs";
import { createFileStore } from "./file_store.js";

/**
 * Build a store bound to exports.dir in config (creates the dir if needed).
 * @param {string} dir - config.exports.dir
 * @param {number} retentionHours - default 24
 */
export function createStore(dir, retentionHours = 24) {
  ensureDir(dir);
  const fileStore = createFileStore(dir, retentionHours);

  return {
    /**
     * Persist one snapshot and prune to the retention window.
     * Logs a concise line for observability.
     */
    async save(snapshot) {
      const { count } = await fileStore.appendAndPrune(snapshot);
      // concise log for now
      console.log(JSON.stringify({
        t: snapshot.timestamp_utc,
        kept: count
      }));
    },
    filepath: fileStore.filepath
  };
}

function ensureDir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (e) {
    // If directory exists or cannot be created, let write fail later with clear error
    if (e?.code !== "EEXIST") throw e;
  }
}
