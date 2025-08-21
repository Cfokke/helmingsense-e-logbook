// app/web/ui/public/viewer.js
// Fetches /auto.csv and /manual.csv, parses minimal CSV, renders table or cards.
// No dependencies.

const ui = {
  tabAuto: document.getElementById("tab-auto"),
  tabManual: document.getElementById("tab-manual"),
  viewTable: document.getElementById("view-table"),
  viewCards: document.getElementById("view-cards"),
  refreshNow: document.getElementById("refresh-now"),
  autoInterval: document.getElementById("auto-interval"),
  rowCount: document.getElementById("row-count"),

  autoTable: document.getElementById("auto-table"),
  autoCards: document.getElementById("auto-cards"),
  manualTable: document.getElementById("manual-table"),
  manualCards: document.getElementById("manual-cards")
};

let model = {
  tab: "auto",    // "auto" | "manual"
  view: "table",  // "table" | "cards"
  rows: { auto: [], manual: [] },
  headers: { auto: [], manual: [] },
  autoRefreshSec: 3600,
  timer: null
};

async function init() {
  await refreshAll();
  wireUI();
  // Ask the backend what the interval is by peeking at index logs (we can’t read config directly in the browser)
  // We’ll just display the default we use server-side if UI doesn’t know precisely:
  try {
    // If you later expose a /meta endpoint, update this. For now show a sensible default.
    model.autoRefreshSec = 3600;
  } catch {}
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
  ui.tabAuto.addEventListener("click", () => { model.tab = "auto"; syncUI(); });
  ui.tabManual.addEventListener("click", () => { model.tab = "manual"; syncUI(); });
  ui.viewTable.addEventListener("click", () => { model.view = "table"; syncUI(); });
  ui.viewCards.addEventListener("click", () => { model.view = "cards"; syncUI(); });
  ui.refreshNow.addEventListener("click", async () => { await refreshAll(true); });
  syncUI();
}

function syncUI() {
  // tabs
  toggleActive(ui.tabAuto, model.tab === "auto");
  toggleActive(ui.tabManual, model.tab === "manual");
  // view
  toggleActive(ui.viewTable, model.view === "table");
  toggleActive(ui.viewCards, model.view === "cards");

  // visibility
  const isAuto = model.tab === "auto";
  const isTable = model.view === "table";
  show(ui.autoTable,  isAuto && isTable);
  show(ui.autoCards,  isAuto && !isTable);
  show(ui.manualTable,!isAuto && isTable);
  show(ui.manualCards,!isAuto && !isTable);

  // render
  render();
}

function show(el, on) { el.classList.toggle("hidden", !on); }
function toggleActive(el, on) { el.classList.toggle("active", on); }

async function refreshAll(isManualClick=false) {
  const [auto, manual] = await Promise.all([fetchCsv("/auto.csv"), fetchCsv("/manual.csv")]);
  model.headers.auto = auto.headers; model.rows.auto = auto.rows;
  model.headers.manual = manual.headers; model.rows.manual = manual.rows;
  if (isManualClick) console.log("[viewer] refresh triggered");
  render();
}

function render() {
  const set = model.tab === "auto" ? "auto" : "manual";
  const h = model.headers[set], rows = model.rows[set];
  ui.rowCount.textContent = `${rows.length} rows`;

  if (model.view === "table") {
    const html = tableHtml(h, rows);
    (set === "auto" ? ui.autoTable : ui.manualTable).innerHTML = html;
  } else {
    const html = cardsHtml(set, h, rows);
    (set === "auto" ? ui.autoCards : ui.manualCards).innerHTML = html;
  }
}

function tableHtml(headers, rows) {
  if (!headers.length) return "<div class='muted'>No data.</div>";
  const head = `<tr>${headers.map(h=>`<th>${escapeHtml(h)}</th>`).join("")}</tr>`;
  const body = rows.map(r => `<tr>${r.map(v=>`<td>${escapeHtml(v)}</td>`).join("")}</tr>`).join("");
  return `<div style="overflow:auto; max-height:70vh"><table>${head}${body}</table></div>`;
}

function cardsHtml(kind, headers, rows) {
  if (!headers.length) return "<div class='muted'>No data.</div>";
  // Show a compact subset prominently; everything else as small rows.
  // Choose some meaningful highlights:
  const ix = indexMap(headers);
  const cards = rows.map(row => {
    const ts = row[ix["Timestamp"]] ?? "";
    const obs = row[ix["Observations"]] ?? "";
    const crew = row[ix["Crew"]] ?? "";
    const prop = row[ix["Propulsion"]] ?? "";
    const sog = row[ix["SOG (kt)"]] ?? "";
    const tws = row[ix["TWS (kt)"]] ?? "";
    const cog = row[ix["COG (°T)"]] ?? "";
    const tagClass = kind === "auto" ? "tag-auto" : "tag-manual";

    const mini = headers.map((h,i)=>`<div><span class="muted">${escapeHtml(h)}:</span> ${escapeHtml(row[i] ?? "")}</div>`).join("");

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
    if (!res.ok) return { headers: [], rows: [] };
    const text = await res.text();
    if (!text.trim()) return { headers: [], rows: [] };
    return parseCsv(text);
  } catch {
    return { headers: [], rows: [] };
  }
}

// Minimal CSV parser for RFC4180-ish CSV
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
  // trailing field
  if (field.length || row.length) { pushField(); pushRow(); }
  // first row = header
  const headers = rows.shift() ?? [];
  return { headers, rows };
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

init();
