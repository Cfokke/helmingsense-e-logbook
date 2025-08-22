// app/web/ui/public/viewer.js
// Fetches /merged.csv (new), /auto.csv and /manual.csv, parses CSV,
// renders table or cards, and marks stale cells per column using staleness.js.

import { markStale } from "./staleness.js";

const ui = {
  tabMerged: document.getElementById("tab-merged"),
  tabAuto: document.getElementById("tab-auto"),
  tabManual: document.getElementById("tab-manual"),
  viewTable: document.getElementById("view-table"),
  viewCards: document.getElementById("view-cards"),
  refreshNow: document.getElementById("refresh-now"),
  autoInterval: document.getElementById("auto-interval"),
  rowCount: document.getElementById("row-count"),

  mergedTable: document.getElementById("merged-table"),
  mergedCards: document.getElementById("merged-cards"),

  autoTable: document.getElementById("auto-table"),
  autoCards: document.getElementById("auto-cards"),
  manualTable: document.getElementById("manual-table"),
  manualCards: document.getElementById("manual-cards")
};

let model = {
  tab: "merged",   // "merged" | "auto" | "manual"
  view: "table",   // "table" | "cards"
  rows: { merged: [], auto: [], manual: [] },
  headers: { merged: [], auto: [], manual: [] },
  autoRefreshSec: 3600,
  timer: null
};

// --------- Formatting rules (exact per your spec) ----------
const FORMATTERS = {
  "Temp (°C)":   (v) => formatFixed(v, 1),
  "Dew (°C)":    (v) => formatFixed(v, 1),
  "Hum (%)":     (v) => formatInt(v),
  "Pres (mbar)": (v) => formatInt(v),
  "Pitch (°)":   (v) => formatInt(v),
  "Roll (°)":    (v) => formatInt(v),
};
function formatFixed(v, dp) {
  if (v == null || v === "") return "";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toFixed(dp);
}
function formatInt(v) {
  if (v == null || v === "") return "";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return String(Math.round(n));
}
function formatValue(header, value) {
  const fn = FORMATTERS[header];
  return fn ? fn(value) : (value ?? "");
}
// ----------------------------------------------------------

// ---- Sorting: latest first by ISO 8601 Timestamp ----
function sortByTimestamp(headers, rows) {
  const ix = headers.indexOf("Timestamp");
  if (ix === -1) return rows;
  return [...rows].sort((a, b) => {
    const ta = Date.parse(a[ix]);
    const tb = Date.parse(b[ix]);
    const aOK = Number.isFinite(ta), bOK = Number.isFinite(tb);
    if (aOK && bOK) return tb - ta;
    if (aOK && !bOK) return -1;
    if (!aOK && bOK) return 1;
    return 0;
  });
}
// -----------------------------------------------------

async function init() {
  await refreshAll();
  wireUI();
  try { model.autoRefreshSec = 3600; } catch {}
  ui.autoInterval.textContent = `${model.autoRefreshSec}s`;
  scheduleAutoRefresh();
}

function scheduleAutoRefresh() {
  clearTimer();
  model.timer = setInterval(refreshAll, model.autoRefreshSec * 1000);
}
function clearTimer() {
  if (model.timer) clearInterval(model.timer);
  model.timer = null;
}

function wireUI() {
  ui.tabMerged.addEventListener("click", () => { model.tab = "merged"; syncUI(); });
  ui.tabAuto.addEventListener("click",   () => { model.tab = "auto";   syncUI(); });
  ui.tabManual.addEventListener("click", () => { model.tab = "manual"; syncUI(); });
  ui.viewTable.addEventListener("click", () => { model.view = "table"; syncUI(); });
  ui.viewCards.addEventListener("click", () => { model.view = "cards"; syncUI(); });
  ui.refreshNow.addEventListener("click", async () => { await refreshAll(true); });
  syncUI();
}

function syncUI() {
  toggleActive(ui.tabMerged, model.tab === "merged");
  toggleActive(ui.tabAuto,   model.tab === "auto");
  toggleActive(ui.tabManual, model.tab === "manual");
  toggleActive(ui.viewTable, model.view === "table");
  toggleActive(ui.viewCards, model.view === "cards");

  const isMerged = model.tab === "merged";
  const isAuto   = model.tab === "auto";
  const isManual = model.tab === "manual";
  const isTable  = model.view === "table";

  show(ui.mergedTable, isMerged && isTable);
  show(ui.mergedCards, isMerged && !isTable);

  show(ui.autoTable,   isAuto   && isTable);
  show(ui.autoCards,   isAuto   && !isTable);

  show(ui.manualTable, isManual && isTable);
  show(ui.manualCards, isManual && !isTable);

  render();
}

function show(el, on) { el.classList.toggle("hidden", !on); }
function toggleActive(el, on) { el.classList.toggle("active", on); }

async function refreshAll(isManualClick=false) {
  const [merged, auto, manual] = await Promise.all([
    fetchCsv("/merged.csv"),
    fetchCsv("/auto.csv"),
    fetchCsv("/manual.csv")
  ]);

  if (!merged.headers.length) console.warn("[viewer] /merged.csv: no headers");
  if (!auto.headers.length)   console.warn("[viewer] /auto.csv: no headers");
  if (!manual.headers.length) console.warn("[viewer] /manual.csv: no headers");

  model.headers.merged = merged.headers;
  model.headers.auto   = auto.headers;
  model.headers.manual = manual.headers;

  // Sort each set, then compute staleness per column
  const mergedSorted = sortByTimestamp(merged.headers, merged.rows);
  const autoSorted   = sortByTimestamp(auto.headers,   auto.rows);
  const manualSorted = sortByTimestamp(manual.headers, manual.rows);

  model.rows.merged = markStale(merged.headers, mergedSorted);
  model.rows.auto   = markStale(auto.headers,   autoSorted);
  model.rows.manual = markStale(manual.headers, manualSorted);

  if (isManualClick) console.log("[viewer] refresh triggered");
  render();
}

function render() {
  const set = model.tab; // "merged" | "auto" | "manual"
  const h = model.headers[set], rows = model.rows[set];
  ui.rowCount.textContent = `${rows.length} rows`;

  if (model.view === "table") {
    const html = tableHtml(h, rows);
    (set === "merged" ? ui.mergedTable :
     set === "auto"   ? ui.autoTable   : ui.manualTable).innerHTML = html;
  } else {
    const html = cardsHtml(set, h, rows);
    (set === "merged" ? ui.mergedCards :
     set === "auto"   ? ui.autoCards   : ui.manualCards).innerHTML = html;
  }
}

function tableHtml(headers, rows) {
  if (!headers.length) return "<div class='muted'>No data.</div>";
  const head = `<tr>${headers.map(h=>`<th>${escapeHtml(h)}</th>`).join("")}</tr>`;
  const body = rows.map(r => `<tr>${
    r.map((v,i) => {
      const display = formatValue(headers[i], v);
      const stale = Array.isArray(r._stale) ? r._stale[i] : false;
      const cls = stale ? "stale" : "";
      return `<td class="${cls}">${escapeHtml(display)}</td>`;
    }).join("")
  }</tr>`).join("");
  return `<div style="overflow:auto; max-height:70vh"><table>${head}${body}</table></div>`;
}

function cardsHtml(kind, headers, rows) {
  if (!headers.length) return "<div class='muted'>No data.</div>";
  const ix = indexMap(headers);
  const cards = rows.map(row => {
    const ts  = row[ix["Timestamp"]] ?? "";
    const obs = row[ix["Observations"]] ?? "";
    const crew= row[ix["Crew"]] ?? "";
    const prop= row[ix["Propulsion"]] ?? "";
    const sog = row[ix["SOG (kt)"]] ?? "";
    const tws = row[ix["TWS (kt)"]] ?? "";
    const cog = row[ix["COG (°T)"]] ?? "";
    const tagClass = kind === "auto" ? "tag-auto"
                    : kind === "manual" ? "tag-manual"
                    : ""; // merged: neutral card background

    const mini = headers.map((h,i)=>{
      const val = formatValue(h, row[i]);
      const stale = Array.isArray(row._stale) ? row._stale[i] : false;
      const cls = stale ? "stale" : "";
      return `<div class="${cls}"><span class="muted">${escapeHtml(h)}:</span> ${escapeHtml(val)}</div>`;
    }).join("");

    return `<div class="card ${tagClass}">
      <div><strong>${escapeHtml(ts)}</strong></div>
      <div class="muted">Crew ${escapeHtml(crew)} • ${escapeHtml(prop)} • SOG ${escapeHtml(sog)} kt • TWS ${escapeHtml(tws)} kt • COG ${escapeHtml(cog)}°</div>
      <div style="margin:6px 0">${escapeHtml(obs)}</div>
      <details><summary class="muted">Show all</summary>${mini}</details>
    </div>`;
  }).join("");

  return `<div class="cards">${cards}</div>`;
}

function indexMap(headers) {
  const m = {};
  headers.forEach((h,i)=> m[h]=i);
  return m;
}

// --- CSV fetch & parse (simple, handles quotes) ---
async function fetchCsv(url) {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      console.warn("[viewer] fetch failed:", url, res.status, res.statusText);
      return { headers: [], rows: [] };
    }
    const text = await res.text();
    if (!text.trim()) return { headers: [], rows: [] };
    return parseCsv(text);
  } catch (e) {
    console.warn("[viewer] fetch error:", url, e);
    return { headers: [], rows: [] };
  }
}

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  const pushField = () => { row.push(field); field=""; };
  const pushRow = () => { rows.push(row); row = []; };
  for (let i=0; i<text.length; i++) {
    const c = text[i], n = text[i+1];
    if (inQuotes) {
      if (c === '"' && n === '"') { field+='"'; i++; continue; }
      if (c === '"') { inQuotes = false; continue; }
      field += c;
    } else {
      if (c === '"') { inQuotes = true; continue; }
      if (c === ',') { pushField(); continue; }
      if (c === '\r') { continue; }
      if (c === '\n') { pushField(); pushRow(); continue; }
      field += c;
    }
  }
  if (field.length || row.length) { pushField(); pushRow(); }
  const headers = rows.shift() ?? [];
  return { headers, rows };
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

init();
