// tests/snapshot/file_store.test.js
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { createFileStore } from "../../app/services/snapshot/file_store.js";

let tmpdir;

beforeEach(() => {
  tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), "hs-logbook-"));
});

afterEach(() => {
  try { fs.rmSync(tmpdir, { recursive: true, force: true }); } catch {}
});

function snapAt(isoNoSeconds) {
  return { timestamp_utc: isoNoSeconds, requested_fields: [], raw: {} };
}

test("appendAndPrune creates file and keeps entries within retention", async () => {
  const store = createFileStore(tmpdir, 24);
  const file = path.join(tmpdir, "signalk_snapshot.json");

  const now = new Date();
  const fmt = (d) => {
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const hh = String(d.getUTCHours()).padStart(2, "0");
    const min = String(d.getUTCMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}T${hh}:${min}Z`;
  };

  const old = new Date(now.getTime() - 25 * 3600 * 1000);
  const recent = new Date(now.getTime() - 2 * 3600 * 1000);

  await store.appendAndPrune(snapAt(fmt(old)));
  await store.appendAndPrune(snapAt(fmt(recent)));
  await store.appendAndPrune(snapAt(fmt(now)));

  const arr = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(arr.length, 2, "should prune items older than 24h");
  assert.equal(arr[0].timestamp_utc, fmt(recent));
  assert.equal(arr[1].timestamp_utc, fmt(now));
});

test("recovers from corrupt JSON by backing up and starting fresh", async () => {
  const store = createFileStore(tmpdir, 24);
  const file = path.join(tmpdir, "signalk_snapshot.json");

  fs.writeFileSync(file, "{not-json");
  await store.appendAndPrune(snapAt("2025-08-20T12:00Z"));

  const data = fs.readFileSync(file, "utf8");
  const arr = JSON.parse(data);
  assert.equal(arr.length, 1);
  assert.ok(fs.existsSync(file + ".corrupt"), "corrupt file should be backed up");
});

test("handles empty file gracefully", async () => {
  const store = createFileStore(tmpdir, 24);
  const file = path.join(tmpdir, "signalk_snapshot.json");

  fs.writeFileSync(file, "");
  await store.appendAndPrune(snapAt("2025-08-20T12:00Z"));

  const arr = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(arr.length, 1);
});
