// Variables used by Scriptable.
// These must be at the top and may not be edited.
// icon-color: orange; icon-glyph: fire;
// ---- Shared settings (saved on this phone by the Setup script) ----
// Keys and personal settings live in the phone's keychain, not in this file,
// so the file can be shared as is.
function setting(key, fallback) {
  try { if (Keychain.contains(key)) { const v = Keychain.get(key); if (v) return v; } } catch (e) {}
  return fallback;
}

// Inflation Expectations Widget for Scriptable (small widget)
// Is inflation heading up or down? A scorecard of eight signals: today's pace,
// what people expect, wages, oil, producer prices, rents on new leases,
// long-run expectations and supply chains. Each points up, down or sideways
// by a simple rule; the verdict is which way most of them point (not a forecast).
// Home screen: the verdict and how many signals agree. Tap for the full view:
// the Fed's calendar (FOMC meetings, minutes, Board speeches), release schedule,
// the scorecard (tap a signal for its chart; "What people expect" shows each
// group and the forecasts forward: economists, Fannie Mae, the market model and
// the Fed's projections), inflation now vs what people expect, every source
// under Details, and Share as PDF (two slides).

// ---- Update check (every 6 hours; one shared request for all the Housing Widgets) ----
// When GitHub has a newer version of this widget: a thin yellow glow around the
// widget face, and an "Update ready" card in the full view with a Run Installer button.
const UPD_REPO = "r6mjz5hk4v-glitch/housing-widgets";
const UPD_CACHE = "housing-widgets-update-v3.json"; // v3: fingerprints from the title line down, with update notes
const UPD_SKIP = "housing-widgets-skipped.json";
const UPD_EVERY_MS = 6 * 3600e3; // check GitHub at most every 6 hours (one check shared by all the widgets)
function updHash(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(16); }
// the code from the title line down: Scriptable rewrites the icon lines above it, so they don't count
function updBody(src, sig) { const t = src.replace(/\r\n/g, "\n"), i = t.indexOf(sig); return (i >= 0 ? t.slice(i) : t).replace(/\s+$/, ""); }
function updOwnSource() {
  const fms = [FileManager.local()];
  try { fms.push(FileManager.iCloud()); } catch (e) {}
  for (const f of fms) { try { const s = f.readString(module.filename); if (s) return s; } catch (e) {} }
  return "";
}
async function updFetch(fm, p) {
  const r = new Request("https://raw.githubusercontent.com/" + UPD_REPO + "/main/manifest.json?t=" + Date.now());
  r.timeoutInterval = 4; // a slow connection never holds up a widget for long
  const m = await r.loadJSON();
  if (!m || !m.files) throw new Error("no manifest");
  const c = { at: Date.now(), files: m.files.filter((f) => f.sig && f.hash).map((f) => ({ sig: f.sig, hash: f.hash, file: f.file, title: f.title || f.name || "", notes: (f.notes || []).slice(0, 3) })) };
  fm.writeString(p, JSON.stringify(c));
  return c;
}
// "Skip this version": remembered per widget until a newer version appears
function updSkips(fm) { try { const p = fm.joinPath(fm.documentsDirectory(), UPD_SKIP); if (fm.fileExists(p)) return JSON.parse(fm.readString(p)) || {}; } catch (e) {} return {}; }
function updSkip() {
  if (!UPD_INFO) return;
  try { const fm = FileManager.local(), k = updSkips(fm); k[UPD_INFO.file] = UPD_INFO.hash; fm.writeString(fm.joinPath(fm.documentsDirectory(), UPD_SKIP), JSON.stringify(k)); } catch (e) {}
}
async function updCheck(fetchNow) {
  const fm = FileManager.local(), p = fm.joinPath(fm.documentsDirectory(), UPD_CACHE);
  let c = null;
  try { if (fm.fileExists(p)) c = JSON.parse(fm.readString(p)); } catch (e) {}
  if (!c || Date.now() - (c.at || 0) > UPD_EVERY_MS) {
    if (fetchNow) {
      try { c = await updFetch(fm, p); }
      catch (e) { if (c) { c.at = Date.now(); try { fm.writeString(p, JSON.stringify(c)); } catch (e2) {} } } // offline: try again at the next check
    } else updFetch(fm, p).catch(() => {}); // in the app: refresh in the background, use what's saved now
  }
  if (!c || !c.files) return false;
  const src = updOwnSource();
  if (!src) return false;
  const top = src.slice(0, 3000), find = (cc) => cc.files.find((f) => top.includes(f.sig));
  let mine = find(c);
  if (!mine) return false;
  let same = mine.hash === updHash(updBody(src, mine.sig));
  // a mismatch against an older saved list may just mean this widget was installed after it: check GitHub again first
  if (!same && Date.now() - (c.at || 0) > 15 * 60e3) {
    try { const fresh = await updFetch(fm, p); const m2 = find(fresh); if (m2) { mine = m2; same = mine.hash === updHash(updBody(src, mine.sig)); } } catch (e) {}
  }
  if (same) return false;
  if (updSkips(fm)[mine.file] === mine.hash) return false; // skipped by hand
  UPD_INFO = mine;
  return true;
}
let UPD_READY = false, UPD_INFO = null;
try { UPD_READY = await updCheck(config.runsInWidget); } catch (e) {}

// the glow: a hairline at the edge plus fading strokes stepping inward
function updRing(img) {
  if (!UPD_READY) return img;
  try {
    const W = img ? img.size.width : 510, H = img ? img.size.height : 510;
    const dc = new DrawContext();
    dc.size = new Size(W, H);
    dc.opaque = false;
    dc.respectScreenScale = Math.min(W, H) <= 200;
    if (img) dc.drawImageInRect(img, new Rect(0, 0, W, H));
    else for (let y = 0; y < H; y += 3) { const t = y / H; dc.setFillColor(new Color("#" + [44 - 16 * t, 44 - 16 * t, 46 - 16 * t].map((v) => Math.round(v).toString(16).padStart(2, "0")).join(""))); dc.fillRect(new Rect(0, y, W, 3)); }
    const k = Math.min(W, H) / 170, R = 22 * k, core = 0.75 * k, step = 0.8 * k, layers = 10;
    const ring = (i, w, a) => { const p = new Path(), r = Math.max(4 * k, R - i); p.addRoundedRect(new Rect(i + w / 2, i + w / 2, W - 2 * i - w, H - 2 * i - w), r, r); dc.addPath(p); dc.setStrokeColor(new Color("#FFD60A", a)); dc.setLineWidth(w); dc.strokePath(); };
    for (let j = layers; j >= 1; j--) ring(core + (j - 1) * step, Math.max(1, step), (70 / 255) * Math.pow(1 - j / (layers + 1), 1.8));
    ring(0, Math.max(1, core), 0.9);
    return dc.getImage();
  } catch (e) { return img; }
}
// the full view: an "Update ready" card at the top; its button runs the Installer
function updPage(html) {
  // only the main full view (it carries Share as PDF, or is the Reports calendar), never helper pages
  if (!UPD_READY || typeof html !== "string" || (html.indexOf("__takeShare") < 0 && html.indexOf("<title>Reports</title>") < 0)) return html;
  const b = html.indexOf("<body");
  const at = b < 0 ? -1 : html.indexOf(">", b) + 1;
  if (at <= 0) return html;
  const info = UPD_INFO || {}, esc = (x) => String(x == null ? "" : x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const day = (d) => { try { return new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); } catch (e) { return d; } };
  const notes = (info.notes || []).map((n) => '<div style="margin-top:12px"><div style="color:#8E8E93;font-size:12px">' + esc(day(n.d)) + '</div><div style="color:#FFFFFF;font-size:14.5px;line-height:1.4;margin-top:2px">' + esc(n.t) + "</div></div>").join("")
    || '<div style="color:#C7C7CC;font-size:14.5px;margin-top:12px">Fixes and improvements.</div>';
  const run = "scriptable:///run/" + encodeURIComponent(setting("hw_installer", "Installer")) + "?only=" + encodeURIComponent(info.file || "");
  const hide = "document.getElementById('hwPanel').style.display='none';";
  const btn = "display:block;text-align:center;border-radius:12px;padding:13px 10px;font-weight:700;font-size:15.5px;text-decoration:none;";
  // a pill floating at the bottom (it never moves the page's own layout); tapping it slides up the notes and choices.
  // class "hint" keeps both out of PDFs
  const ui = '<a id="hwPill" class="hint" href="#" onclick="document.getElementById(\'hwPanel\').style.display=\'flex\';return false;" style="position:fixed;left:50%;bottom:calc(22px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:9999;margin:0;display:flex;align-items:center;gap:8px;background:#FFD60A;color:#1C1C1E;border-radius:22px;padding:11px 18px;font:700 14.5px -apple-system,system-ui,sans-serif;text-decoration:none;box-shadow:0 6px 20px rgba(0,0,0,.45);white-space:nowrap">Update ready ›</a>'
    + '<div id="hwPanel" class="hint" onclick="if (event.target === this) { ' + hide + ' }" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;z-index:10000;margin:0;background:rgba(0,0,0,.55);align-items:flex-end;font-family:-apple-system,system-ui,sans-serif">'
    + '<div style="width:100%;box-sizing:border-box;background:#2C2C2E;border-radius:18px 18px 0 0;padding:20px 18px calc(18px + env(safe-area-inset-bottom));max-height:80vh;overflow:auto">'
    + '<div style="color:#FFD60A;font-weight:700;font-size:12.5px;letter-spacing:.05em">UPDATE READY</div>'
    + '<div style="color:#FFFFFF;font-weight:700;font-size:21px;margin-top:3px">' + esc(info.title || "This widget") + "</div>"
    + notes
    + '<a href="' + esc(run) + '" style="' + btn + 'background:#FFD60A;color:#1C1C1E;margin-top:18px">Install this update</a>'
    + '<div style="display:flex;gap:10px;margin-top:10px">'
    + '<a href="hwupdate://skip" onclick="' + hide + "document.getElementById('hwPill').style.display='none';\" style=\"" + btn + 'flex:1;background:#3A3A3C;color:#FFFFFF">Skip this version</a>'
    + '<a href="#" onclick="' + hide + 'return false;" style="' + btn + 'flex:1;background:#3A3A3C;color:#FFFFFF">Not now</a>'
    + "</div>"
    + '<div style="color:#8E8E93;font-size:12px;line-height:1.4;margin-top:12px">Installs only this widget; your keys and settings stay. Close and reopen it afterwards. Skipped versions stay hidden until a newer one comes out.</div>'
    + "</div></div>";
  return html.slice(0, at) + ui + html.slice(at);
}
function updArgs(html, base) { return base === undefined ? [updPage(html)] : [updPage(html), base]; }
// let the page's Run Installer link open Scriptable
function updWV(wv) {
  try {
    wv.shouldAllowRequest = (req) => {
      const u = String((req && req.url) || "");
      if (/^hwupdate:\/\/skip/i.test(u)) { updSkip(); return false; }
      if (/^scriptable:/i.test(u)) { Safari.open(u); return false; }
      return true;
    };
  } catch (e) {}
  return wv;
}

// ---------- Config ----------
const FRED_KEY = setting("fred_api_key", ""); // your own free key, saved by Setup

// No FRED key on this phone yet: say so instead of failing quietly
if (!FRED_KEY) {
  const msg = "Run the Setup script once to add your free FRED API key.";
  if (config.runsInWidget) {
    const w = new ListWidget();
    w.backgroundColor = new Color("#1C1C1E");
    const t = w.addText(msg);
    t.textColor = new Color("#FF9F0A");
    t.font = Font.semiboldSystemFont(12);
    Script.setWidget(w);
  } else {
    const a = new Alert();
    a.title = "FRED key needed";
    a.message = msg;
    a.addAction("OK");
    await a.present();
  }
  Script.complete();
  return;
}

const STORE_FILE = "inflation-expectations-v2.json";
const REFRESH_HOURS = 6;
const START = "2014-01-01"; // history kept; charts open on the last 5 years
// Set true to preview the small widget when running in the app
const PREVIEW_WIDGET_IN_APP = false;

// Colors: one per group of expectations, white/gray for actual inflation
const COL = { consumers: "#FF9F0A", sce: "#FFD60A", forecasters: "#64D2FF", fed: "#30D158", model: "#BF5AF2", actual: "#FFFFFF", actual2: "#98989F" };

// SheetJS reads the NY Fed's and Philadelphia Fed's Excel files in a hidden page
const XLSX_LIB = ["https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js", "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"];
const SCE_XLSX = [
  "https://www.newyorkfed.org/medialibrary/interactives/sce/sce/downloads/data/frbny-sce-data.xlsx",
  "https://www.newyorkfed.org/medialibrary/Interactives/sce/sce/downloads/data/frbny-sce-data.xlsx",
];
const SPF_XLSX = [
  "https://www.philadelphiafed.org/-/media/FRBP/Assets/Surveys-And-Data/survey-of-professional-forecasters/historical-data/medianLevel.xlsx",
  "https://www.philadelphiafed.org/-/media/frbp/assets/surveys-and-data/survey-of-professional-forecasters/historical-data/medianlevel.xlsx",
];
const UMICH_CSV = ["https://www.sca.isr.umich.edu/files/tbmpx1px5.csv"];
const BROWSER_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

// ---------- Small helpers ----------
const sleepMs = (ms) => new Promise((r) => Timer.schedule(ms, false, r));
const isoDay = (d) => d.toISOString().slice(0, 10);
const MON3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONF = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const mKey = (y, m0) => `${y}-${String(m0 + 1).padStart(2, "0")}`;
const mIdx = (k) => { const [y, m] = k.split("-").map(Number); return y * 12 + m - 1; };
const mStr = (i) => mKey(Math.floor(i / 12), i % 12);
const mLabel = (k) => `${MON3[+k.slice(5, 7) - 1]} ${k.slice(0, 4)}`;

async function fredRaw(id) {
  const r = new Request(`https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${FRED_KEY}&file_type=json&observation_start=${START}`);
  r.timeoutInterval = 20;
  const j = await r.loadJSON();
  if (!j || !j.observations) throw new Error((j && j.error_message) || `no data for ${id}`);
  return j.observations.filter((o) => o.value !== ".");
}
// a monthly series as { "YYYY-MM": value }
async function fredMonthly(id) {
  const out = {};
  for (const o of await fredRaw(id)) out[o.date.slice(0, 7)] = +o.value;
  return out;
}
// change from a year earlier, in percent, from a price index
function yoy(ix) {
  const out = {};
  for (const k of Object.keys(ix)) {
    const prev = ix[mStr(mIdx(k) - 12)];
    if (prev) out[k] = (ix[k] / prev - 1) * 100;
  }
  return out;
}
function lastOf(series) {
  const ks = Object.keys(series || {}).sort();
  return ks.length ? { m: ks[ks.length - 1], v: series[ks[ks.length - 1]] } : null;
}
function prevOf(series, m) {
  const ks = Object.keys(series || {}).filter((k) => k < m).sort();
  return ks.length ? { m: ks[ks.length - 1], v: series[ks[ks.length - 1]] } : null;
}

async function getText(urls, ua) {
  let last = null;
  for (const u of urls) {
    try {
      const r = new Request(u);
      r.headers = { "User-Agent": ua || BROWSER_UA };
      r.timeoutInterval = 25;
      const t = await r.loadString();
      const code = (r.response && r.response.statusCode) || 0;
      if (code === 200 && t) return t;
      last = new Error(`${code} from ${u.split("/")[2]}`);
    } catch (e) { last = e; }
  }
  throw last || new Error("couldn't load");
}
async function getData(urls) {
  let last = null;
  for (const u of urls) {
    try {
      const r = new Request(u);
      r.headers = { "User-Agent": BROWSER_UA };
      r.timeoutInterval = 40;
      const d = await r.load();
      const code = (r.response && r.response.statusCode) || 0;
      if (code === 200 && d) return d;
      last = new Error(`${code} from ${u.split("/")[2]}`);
    } catch (e) { last = e; }
  }
  throw last || new Error("couldn't load");
}

// ---------- Sources ----------
// Actual inflation (FRED): CPI and PCE, headline and core, as change from a year earlier
async function getActual() {
  const [cpi, ccpi, pce, cpce] = await Promise.all(["CPIAUCSL", "CPILFESL", "PCEPI", "PCEPILFE"].map(fredMonthly));
  return { cpi: yoy(cpi), ccpi: yoy(ccpi), pce: yoy(pce), cpce: yoy(cpce), cpiIx: cpi };
}
// Cleveland Fed's model (FRED): 1-year and 10-year expected inflation
async function getCleveland() {
  const [one, ten] = await Promise.all(["EXPINF1YR", "EXPINF10YR"].map(fredMonthly));
  return { one, ten };
}
// The Fed's own projections (FRED): median PCE inflation for next year, and the longer run.
// Only the newest projections are on FRED, so these are single points, dated at the meeting.
async function getFomc() {
  const [proj, lr] = await Promise.all([fredRaw("PCECTPIMD"), fredRaw("PCECTPIMDLR")]);
  const vint = proj.reduce((m, o) => (o.realtime_start > m ? o.realtime_start : m), "") || null; // the newest projections' date
  const year = vint ? +vint.slice(0, 4) : new Date().getFullYear();
  const next = proj.find((o) => +o.date.slice(0, 4) === year + 1) || proj[proj.length - 1];
  const lrv = lr.length ? +lr[lr.length - 1].value : null;
  const path = proj.filter((o) => +o.date.slice(0, 4) >= year).map((o) => ({ y: +o.date.slice(0, 4), v: +o.value }));
  return { m: vint ? vint.slice(0, 7) : null, date: vint, year: next ? +next.date.slice(0, 4) : null, one: next ? +next.value : null, lr: lrv, path };
}
// University of Michigan's own table: median expected price change, next year and next 5 years.
// FRED's copy (MICH) is a month behind and has no 5-year, so it's only the fallback.
async function getUmich() {
  const out = { one: {}, five: {} };
  try {
    const csv = await getText(UMICH_CSV);
    for (const line of csv.split(/\r?\n/)) {
      const c = line.split(",").map((x) => x.trim().replace(/"/g, ""));
      const mi = MONF.findIndex((n) => n.toLowerCase() === (c[0] || "").toLowerCase());
      if (mi < 0 || !/^\d{4}$/.test(c[1] || "")) continue;
      const k = mKey(+c[1], mi);
      if (c[2] !== "" && !isNaN(+c[2])) out.one[k] = +c[2];
      if (c[3] !== "" && !isNaN(+c[3])) out.five[k] = +c[3];
    }
  } catch (e) { out.err = String(e.message || e); }
  if (!Object.keys(out.one).length) {
    try { out.one = await fredMonthly("MICH"); out.fromFred = true; } catch (e) {}
  }
  if (!Object.keys(out.one).length) throw new Error(out.err || "no data");
  return out;
}

// ---------- Excel files, read in a hidden page ----------
const XLSX_PAGE = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><script>
window.__ready = false;
function load(i) {
  var LIBS = __LIBS__;
  if (i >= LIBS.length) { window.__libErr = "couldn't load the spreadsheet reader"; return; }
  var s = document.createElement("script");
  s.src = LIBS[i];
  s.onload = function () { window.__ready = true; };
  s.onerror = function () { load(i + 1); };
  document.head.appendChild(s);
}
load(0);
window.readBook = function (b64, wanted) {
  var wb = XLSX.read(b64, { type: "base64", sheets: wanted.length ? wanted : undefined });
  var out = { names: wb.SheetNames, sheets: {} };
  wb.SheetNames.forEach(function (n) {
    if (!wb.Sheets[n]) return;
    if (wanted.length && wanted.indexOf(n) < 0) return;
    out.sheets[n] = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null });
  });
  return JSON.stringify(out);
};
</script></body></html>`;
let XWV = null;
async function xlsxReader() {
  if (XWV) return XWV;
  const wv = new WebView();
  await wv.loadHTML(XLSX_PAGE.replace("__LIBS__", JSON.stringify(XLSX_LIB)));
  for (let i = 0; i < 60; i++) {
    const st = await wv.evaluateJavaScript("window.__ready ? 1 : (window.__libErr ? -1 : 0)");
    if (st === 1) { XWV = wv; return wv; }
    if (st === -1) throw new Error("couldn't load the spreadsheet reader");
    await sleepMs(250);
  }
  throw new Error("the spreadsheet reader didn't load");
}
// rows of the wanted sheets (all sheets' names come back too, to find one by name)
async function readXlsx(urls, wanted) {
  const data = await getData(urls);
  const wv = await xlsxReader();
  const raw = await wv.evaluateJavaScript(`readBook(${JSON.stringify(data.toBase64String())}, ${JSON.stringify(wanted || [])})`);
  return JSON.parse(raw);
}

// NY Fed Survey of Consumer Expectations: median expected inflation 1, 3 and 5 years ahead
async function getSce() {
  const book = await readXlsx(SCE_XLSX, []);
  const name = book.names.find((n) => /inflation expectations/i.test(n) && !/uncertain|prob/i.test(n)) || book.names.find((n) => /infl/i.test(n));
  if (!name) throw new Error("no inflation sheet in the NY Fed file");
  const rows = book.sheets[name] || [];
  // the header row names each column; dates are YYYYMM in the first column
  let hdr = -1, c1 = -1, c3 = -1, c5 = -1;
  for (let r = 0; r < Math.min(rows.length, 20) && hdr < 0; r++) {
    const row = (rows[r] || []).map((x) => String(x || "").toLowerCase());
    const f = (re) => row.findIndex((x) => re.test(x));
    const a = f(/median.*one[- ]year|one[- ]year.*median/), b = f(/median.*three[- ]year|three[- ]year.*median/), c = f(/median.*five[- ]year|five[- ]year.*median/);
    if (a >= 0) { hdr = r; c1 = a; c3 = b; c5 = c; }
  }
  if (hdr < 0) throw new Error("NY Fed file layout changed");
  const one = {}, three = {}, five = {};
  for (let r = hdr + 1; r < rows.length; r++) {
    const row = rows[r] || [], d = String(row[0] || "").replace(/\D/g, "");
    if (!/^\d{6}$/.test(d)) continue;
    const k = `${d.slice(0, 4)}-${d.slice(4, 6)}`;
    const v = (c) => (c >= 0 && row[c] != null && row[c] !== "" && !isNaN(+row[c]) ? +row[c] * (Math.abs(+row[c]) < 0.25 ? 100 : 1) : null);
    if (v(c1) != null) one[k] = v(c1);
    if (v(c3) != null) three[k] = v(c3);
    if (v(c5) != null) five[k] = v(c5);
  }
  if (!Object.keys(one).length) throw new Error("no readings in the NY Fed file");
  return { one, three, five };
}

// Philadelphia Fed Survey of Professional Forecasters: next four quarters (CPI, PCE) and
// 10-year (CPI10, PCE10). Dated in the survey's middle month: Feb, May, Aug, Nov.
async function getSpf() {
  const book = await readXlsx(SPF_XLSX, ["CPI", "PCE", "CPI10", "PCE10"]);
  const surveyMonth = (y, q) => mKey(+y, (+q - 1) * 3 + 1);
  const quarterly = (rows, cols) => {
    const out = {};
    const head = (rows || []).findIndex((r) => r && String(r[0]).toUpperCase() === "YEAR");
    if (head < 0) return out;
    const H = rows[head].map((x) => String(x || "").toUpperCase());
    const idx = cols.map((c) => H.indexOf(c));
    if (idx.some((i) => i < 0)) return out;
    for (let r = head + 1; r < rows.length; r++) {
      const row = rows[r] || [];
      if (!row[0] || !row[1]) continue;
      const vals = idx.map((i) => +row[i]);
      if (vals.some((v) => row[idx[0]] === null || isNaN(v))) continue;
      out[surveyMonth(row[0], row[1])] = vals;
    }
    return out;
  };
  // the next four quarters, compounded from the quarterly annualized forecasts 3..6
  const next4 = (tbl) => {
    const out = {};
    for (const [k, v] of Object.entries(tbl)) out[k] = (v.reduce((p, x) => p * Math.pow(1 + x / 100, 0.25), 1) - 1) * 100;
    return out;
  };
  const cpi = next4(quarterly(book.sheets.CPI, ["CPI3", "CPI4", "CPI5", "CPI6"]));
  const pce = next4(quarterly(book.sheets.PCE, ["PCE3", "PCE4", "PCE5", "PCE6"]));
  const one = (t) => { const o = {}; for (const [k, v] of Object.entries(t)) o[k] = v[0]; return o; };
  const cpi10 = one(quarterly(book.sheets.CPI10, ["CPI10"])), pce10 = one(quarterly(book.sheets.PCE10, ["PCE10"]));
  if (!Object.keys(cpi).length && !Object.keys(cpi10).length) throw new Error("Philadelphia Fed file layout changed");
  // the newest survey's quarter-by-quarter CPI forecasts (annualized): last quarter, this quarter, the next four
  const raw = quarterly(book.sheets.CPI, ["CPI1", "CPI2", "CPI3", "CPI4", "CPI5", "CPI6"]), lastK = Object.keys(raw).sort().pop();
  const path = lastK ? { y: +lastK.slice(0, 4), q: Math.floor((+lastK.slice(5, 7) - 1) / 3) + 1, v: raw[lastK] } : null;
  return { cpi, pce, cpi10, pce10, path };
}

// ---------- Inflation pressures: wages, energy, the pipeline, shelter ----------
// FRED for all but two: the NY Fed's supply-chain index (an Excel file) and
// Zillow's rent index for new leases (a CSV), both read only in the full view.
const GSCPI_XLSX = ["https://www.newyorkfed.org/medialibrary/research/interactives/gscpi/downloads/gscpi_data.xlsx"];
const ZORI_CSV = [
  "https://files.zillowstatic.com/research/public_csvs/zori/Metro_zori_uc_sfrcondomfr_sm_month.csv",
  "https://files.zillowstatic.com/research/public_csvs/zori/Metro_zori_uc_sfrcondomfr_sm_sa_month.csv",
];
// daily and weekly series as monthly averages (the current month is month to date)
async function fredMonthlyAvg(id) {
  const r = new Request(`https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${FRED_KEY}&file_type=json&observation_start=${START}&frequency=m&aggregation_method=avg`);
  r.timeoutInterval = 20;
  const j = await r.loadJSON();
  if (!j || !j.observations) throw new Error((j && j.error_message) || `no data for ${id}`);
  const out = {};
  for (const o of j.observations) if (o.value !== ".") out[o.date.slice(0, 7)] = +o.value;
  return out;
}
// several FRED series; one that fails is left out (and named) instead of sinking the rest
async function fredSet(ids, avg) {
  const got = await Promise.all(Object.entries(ids).map(async ([k, id]) => {
    try { return [k, await (avg ? fredMonthlyAvg(id) : fredMonthly(id))]; } catch (e) { return [k, null, `${id}: ${String((e && e.message) || e).slice(0, 60)}`]; }
  }));
  const out = { miss: [] };
  for (const [k, v, err] of got) { if (v && Object.keys(v).length) out[k] = v; else out.miss.push(err || `${ids[k]}: no data`); }
  if (!Object.keys(out).filter((k) => k !== "miss").length) throw new Error(out.miss.join("; "));
  return out;
}
// wages: average hourly earnings (private), the Employment Cost Index for private wages (quarterly),
// and the Atlanta Fed's Wage Growth Tracker (3-month average of median wage growth, already a growth rate)
const getWages = () => fredSet({ ahe: "CES0500000003", eci: "ECIWAG", atl: "FRBATLWGT3MMAUMHWGO" });
// energy: WTI crude ($/barrel), regular gasoline ($/gallon, weekly), Henry Hub natural gas ($/MMBtu)
const getEnergy = () => fredSet({ wti: "DCOILWTICO", gas: "GASREGW", ng: "DHHNGSP" }, true);
// the pipeline: producer prices for final demand, and import prices
const getPipe = () => fredSet({ ppi: "PPIFIS", imp: "IR" });
// shelter: CPI shelter, and rent of primary residence
const getShelter = () => fredSet({ shelter: "CUSR0000SAH1", rent: "CUSR0000SEHA" });

// NY Fed Global Supply Chain Pressure Index: standard deviations from its average
function excelMonth(v) {
  if (typeof v === "number" && v > 20000 && v < 80000) { const d = new Date(Date.UTC(1899, 11, 30) + v * 864e5); return mKey(d.getUTCFullYear(), d.getUTCMonth()); }
  if (typeof v === "string") {
    const t = Date.parse(v.replace(/-/g, " "));
    if (!isNaN(t)) { const d = new Date(t); return mKey(d.getFullYear(), d.getMonth()); }
    const m = v.match(/^(\d{4})-(\d{2})/); if (m) return `${m[1]}-${m[2]}`;
  }
  return null;
}
async function getGscpi() {
  const book = await readXlsx(GSCPI_XLSX, []);
  const name = book.names.find((n) => /monthly/i.test(n)) || book.names.find((n) => /gscpi/i.test(n)) || book.names[0];
  const out = {};
  for (const row of book.sheets[name] || []) {
    if (!row) continue;
    const k = excelMonth(row[0]), v = row.slice(1).find((x) => typeof x === "number" && Math.abs(x) < 10);
    if (k && k >= START.slice(0, 7) && v != null) out[k] = v;
  }
  if (!Object.keys(out).length) throw new Error("NY Fed supply-chain file layout changed");
  return out;
}
// Zillow Observed Rent Index, national row: typical asking rent on new leases
async function getZori() {
  const csv = await getText(ZORI_CSV);
  const lines = csv.split(/\r?\n/), head = lines[0].split(",");
  const row = lines.find((l) => /,"?United States"?,/.test(l));
  if (!row) throw new Error("no national row in Zillow's file");
  const cells = row.split(","), out = {};
  head.forEach((h, i) => { const m = h.match(/^"?(\d{4})-(\d{2})-\d{2}"?$/); if (m && cells[i] !== "" && !isNaN(+cells[i])) out[`${m[1]}-${m[2]}`] = +cells[i]; });
  if (!Object.keys(out).length) throw new Error("Zillow's file layout changed");
  return out;
}

// The pressures, each as change from a year earlier (the wage tracker and the
// supply-chain index are already rates), and whether each group is heating or cooling
function pressSeries(s) {
  const P = { wages: s.wages, energy: s.energy, pipe: s.pipe, shelter: s.shelter, gscpi: s.gscpi, zori: s.zori }, g = (grp, k) => (P[grp] && P[grp][k]) || null;
  const Y = (x) => (x ? yoy(x) : {});
  return {
    ahe: Y(g("wages", "ahe")), eci: Y(g("wages", "eci")), atl: g("wages", "atl") || {},
    wti: Y(g("energy", "wti")), gas: Y(g("energy", "gas")), ng: Y(g("energy", "ng")),
    ppi: Y(g("pipe", "ppi")), imp: Y(g("pipe", "imp")), gscpi: P.gscpi || {},
    shelter: Y(g("shelter", "shelter")), rent: Y(g("shelter", "rent")), zori: Y(P.zori),
    wtiPrice: g("energy", "wti") || {},
  };
}
// each group's main measure now vs 6 months earlier
function pressTrend(ps) {
  const groups = [
    { key: "wages", name: "Wages", k: "ahe", tol: 0.2 },
    { key: "energy", name: "Oil", k: "wti", tol: 3 },
    { key: "pipe", name: "Producer Prices", k: "ppi", tol: 0.2 },
    { key: "shelter", name: "Shelter", k: "shelter", tol: 0.2 },
  ];
  return groups.map((gr) => {
    const now = lastOf(ps[gr.k]);
    if (!now) return { ...gr, state: null };
    const then = ps[gr.k][mStr(mIdx(now.m) - 6)];
    const d = then == null ? null : now.v - then;
    return { ...gr, now: now.v, m: now.m, then, d, state: d == null ? null : d > gr.tol ? "heating" : d < -gr.tol ? "cooling" : "steady" };
  });
}
function pressHeadline(tr) {
  const ok = tr.filter((t) => t.state);
  if (!ok.length) return "Waiting for data";
  const n = (st) => ok.filter((t) => t.state === st).length, c = n("cooling"), h = n("heating");
  const mood = c > h && c >= ok.length / 2 ? "easing" : h > c && h >= ok.length / 2 ? "building" : "mixed";
  return `Pressures ${mood}: ${c} cooling, ${h} heating up, ${ok.length - c - h} steady vs 6 months ago`;
}

// ---------- Forecasts, forward from today ----------
// Fannie Mae's monthly Economic Forecast (PDF): CPI, quarter vs the same quarter a year
// earlier, for this year and the next two. Read with pdf.js in a hidden page, in the app only.
const PDFJS = [
  ["https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js", "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js"],
  ["https://cdn.jsdelivr.net/npm/pdfjs-dist@2.16.105/build/pdf.min.js", "https://cdn.jsdelivr.net/npm/pdfjs-dist@2.16.105/build/pdf.worker.min.js"],
];
let PDF_WV = null;
async function pdfLines(b64, maxPages) {
  if (!PDF_WV) {
    for (const [lib, worker] of PDFJS) {
      const wv = new WebView();
      await wv.loadHTML(`<html><head><script src="${lib}"></script><script src="${worker}"></script></head><body></body></html>`);
      if (await wv.evaluateJavaScript("typeof pdfjsLib !== 'undefined'")) { await wv.evaluateJavaScript(`window.__w = ${JSON.stringify(worker)}; 0`); PDF_WV = wv; break; }
    }
    if (!PDF_WV) throw new Error("couldn't load the PDF reader");
  }
  await PDF_WV.evaluateJavaScript(`window.__b64 = "${b64}"; window.__max = ${maxPages || 4}; 0`);
  const res = JSON.parse(await PDF_WV.evaluateJavaScript(`(function () {
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = window.__w;
      var bin = atob(window.__b64), u8 = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      window.__b64 = null;
      pdfjsLib.getDocument({ data: u8 }).promise.then(function (doc) {
        var pages = [], n = Math.min(doc.numPages, window.__max), done = 0;
        for (var p = 1; p <= n; p++) (function (p) {
          doc.getPage(p).then(function (pg) { return pg.getTextContent(); }).then(function (tc) {
            var rows = {};
            tc.items.forEach(function (it) { var y = Math.round(it.transform[5] / 2) * 2; (rows[y] = rows[y] || []).push([it.transform[4], it.str]); });
            pages[p - 1] = Object.keys(rows).sort(function (a, b) { return b - a; }).map(function (y) { return rows[y].sort(function (a, b) { return a[0] - b[0]; }).map(function (c) { return c[1]; }).join(" ").replace(/ +/g, " ").trim(); }).filter(function (s) { return s; });
            if (++done === n) { doc.destroy(); completion(JSON.stringify({ pages: pages })); }
          }).catch(function (e) { completion(JSON.stringify({ error: "page " + p + ": " + e })); });
        })(p);
      }).catch(function (e) { completion(JSON.stringify({ error: String(e && e.message || e) })); });
    } catch (e) { completion(JSON.stringify({ error: String(e && e.message || e) })); }
  })()`, true));
  if (res.error) throw new Error(res.error);
  return res.pages;
}
// "25.1 25.2 ... 27.4 2025 2026 2027" then "Consumer Price Index 2.7 2.5 ...": quarter -> value
function parseFannie(pages) {
  for (const lines of pages) {
    let head = null;
    for (const l of lines) {
      const q = l.match(/((?:\d{2}\.[1-4]\s+){4,}\d{2}\.[1-4])/);
      if (q) head = q[1].trim().split(/\s+/);
      const m = l.match(/^Consumer Price Index\s+((?:-?\d+\.\d+\s*)+)$/i);
      if (m && head) {
        const v = m[1].trim().split(/\s+/).map(Number), out = {};
        head.forEach((h, i) => { if (v[i] != null && !isNaN(v[i])) { const [yy, qq] = h.split("."); out[mKey(2000 + +yy, (+qq - 1) * 3 + 1)] = v[i]; } }); // dated mid-quarter
        if (Object.keys(out).length >= 4) return out;
      }
    }
  }
  return null;
}
async function getFannie() {
  const now = new Date();
  for (let back = 0; back <= 2; back++) {
    const d = new Date(now.getFullYear(), now.getMonth() - back, 1), tag = `${String(d.getMonth() + 1).padStart(2, "0")}${d.getFullYear()}`;
    const url = `https://www.fanniemae.com/media/document/pdf/economic-forecast-${tag}`;
    let data = null;
    try { data = await getData([url]); } catch (e) { continue; }
    const b64 = data.toBase64String();
    if (!b64.startsWith("JVBERi")) continue;
    const q = parseFannie(await pdfLines(b64, 3));
    if (!q) throw new Error(`couldn't find the CPI row in Fannie Mae's ${MON3[d.getMonth()]} ${d.getFullYear()} forecast`);
    return { pub: mKey(d.getFullYear(), d.getMonth()), q, url };
  }
  throw new Error("no Fannie Mae forecast in the last 3 months");
}
// The Cleveland Fed's model: expected average inflation over 1 to 5 years, as each year's own rate
async function getClevPath() {
  const ids = ["EXPINF1YR", "EXPINF2YR", "EXPINF3YR", "EXPINF4YR", "EXPINF5YR"];
  const all = await Promise.all(ids.map(fredMonthly));
  const m = Object.keys(all[0]).sort().pop();
  const e = all.map((x) => x[m]);
  if (!m || e.some((v) => v == null)) throw new Error("Cleveland Fed's 1-5 year series are incomplete");
  const fwd = e.map((v, i) => (i === 0 ? v : (Math.pow(1 + v / 100, i + 1) / Math.pow(1 + e[i - 1] / 100, i) - 1) * 100));
  return { m, fwd };
}

// The forecast lines, each a { "YYYY-MM": value } that starts at the latest actual CPI so it reads as
// "from here". Quarterly forecasts are dated at the quarter's middle month.
function forecasts(s) {
  const A = s.actual || {}, cpi = lastOf(A.cpi), out = {};
  if (!cpi) return out;
  const start = (o) => { const r = {}; r[cpi.m] = cpi.v; Object.assign(r, o); return r; };
  const after = (o) => { const r = {}; Object.keys(o || {}).forEach((k) => { if (k > cpi.m) r[k] = o[k]; }); return r; };
  // economists: the Philadelphia Fed survey's quarterly CPI forecasts (annualized), compounded
  // onto actual CPI into change from a year earlier
  const P = s.spf && s.spf.path, ix = A.cpiIx;
  if (P && ix) {
    const qAvg = {}; // actual quarterly average CPI levels, by "year*4+q"
    Object.keys(ix).forEach((k) => { const y = +k.slice(0, 4), q = Math.floor((+k.slice(5, 7) - 1) / 3), key = y * 4 + q; (qAvg[key] = qAvg[key] || []).push(ix[k]); });
    const lvl = {};
    Object.keys(qAvg).forEach((k) => { if (qAvg[k].length === 3) lvl[k] = qAvg[k].reduce((a, b) => a + b, 0) / 3; });
    const sq = P.y * 4 + (P.q - 1); // the survey's quarter; CPI1 = the quarter before it
    const path = {};
    for (let i = 0; i < 6; i++) {
      const qk = sq - 1 + i;
      if (lvl[qk] != null) continue; // actual data wins
      const prev = lvl[qk - 1];
      if (prev == null) break;
      lvl[qk] = prev * Math.pow(1 + P.v[i] / 100, 0.25);
      const yago = lvl[qk - 4];
      if (yago) path[mKey(Math.floor(qk / 4), (qk % 4) * 3 + 1)] = (lvl[qk] / yago - 1) * 100;
    }
    const f = after(path);
    if (Object.keys(f).length) out.fcSpf = start(f);
  }
  // Fannie Mae: quarterly CPI vs a year earlier
  if (s.fannie && s.fannie.q) { const f = after(s.fannie.q); if (Object.keys(f).length) out.fcFannie = start(f); }
  // the market model: each year's own expected rate, at the end of that year from its date
  const C = s.clevPath;
  if (C && C.fwd) { const f = {}; C.fwd.forEach((v, i) => { f[mStr(mIdx(C.m) + 12 * (i + 1))] = v; }); out.fcClev = start(after(f)); }
  // the Fed: median PCE inflation for each year (fourth quarter vs a year earlier), dated December
  const F = s.fomc && s.fomc.path;
  if (F && F.length) { const f = {}; F.forEach((p) => { f[`${p.y}-12`] = p.v; }); out.fcFed = after(f); }
  return out;
}

// ---------- The Fed's calendar: FOMC meetings and Board speeches ----------
const FED = "https://www.federalreserve.gov";
const MONTHS_RE = "January|February|March|April|May|June|July|August|September|October|November|December";
function htmlLines(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<(br|\/p|\/div|\/li|\/tr|\/td|\/th|\/h\d|\/strong|\/a|\/span)\b[^>]*>/gi, "$&\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&rsquo;/g, "'").replace(/&ldquo;|&rdquo;|&quot;/g, '"').replace(/&ndash;/g, "–")
    .split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter((l) => l);
}
// fomccalendars.htm: "2026 FOMC Meetings", then a month ("September" or "April/May"), its days
// ("15-16*": the asterisk means projections), and "(Released October 07, 2026)" under minutes
function parseFomc(lines) {
  const out = [];
  let year = null, cur = null;
  const monthIdx = (n) => MONF.findIndex((x) => x.toLowerCase() === n.toLowerCase());
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const y = l.match(/^(\d{4}) FOMC Meetings/);
    if (y) { year = +y[1]; cur = null; continue; }
    if (!year) continue;
    const mo = l.match(new RegExp(`^(${MONTHS_RE})(?:/(${MONTHS_RE}))?$`));
    if (mo) {
      const nx = lines[i + 1] || "", d = nx.match(/^(\d{1,2})(?:-(\d{1,2}))?(\*)?/);
      if (!d) continue;
      const m1 = monthIdx(mo[1]), m2 = mo[2] ? monthIdx(mo[2]) : m1, d1 = +d[1], d2 = d[2] ? +d[2] : d1;
      cur = { start: isoDay(new Date(Date.UTC(year, m1, d1))), end: isoDay(new Date(Date.UTC(year + (m2 < m1 ? 1 : 0), m2, d2))), sep: !!d[3], note: /unscheduled|notation/i.test(nx) ? nx.replace(/^[\d\-*\s]+/, "") : "" };
      out.push(cur);
      i++;
      continue;
    }
    const r = l.match(new RegExp(`^\\(Released (${MONTHS_RE}) (\\d{1,2}), (\\d{4})\\)$`));
    if (r && cur) cur.minutes = isoDay(new Date(Date.UTC(+r[3], monthIdx(r[1]), +r[2])));
  }
  return out.filter((m) => !m.note);
}
// a month's calendar page: the Speeches and Testimony sections, each entry a speaker line
// ("Speech - Governor Lisa D. Cook"), its topic, "At ..." and a time and day nearby
function parseSpeeches(lines, y, m0) {
  const out = [];
  const isTime = (l) => /^\d{1,2}:\d{2}\s*[ap]\.?m\.?$/i.test(l), isDay = (l) => /^\d{1,2}$/.test(l);
  const WHO = /^(Speech|Testimony|Discussion|Remarks|Panel Discussion|Fireside Chat|Opening Remarks|Welcoming Remarks|Video)\s+[-–]\s+(.+)$/i;
  let sec = null, start = 0;
  const flush = (a, z) => {
    // the speaker lines in this section; each entry's own lines run to the next speaker line
    const S = [];
    for (let i = a; i < z; i++) if (WHO.test(lines[i])) S.push(i);
    if (!S.length) return;
    // which side of the speaker line the day and time sit on, from the first entry
    const pre = lines.slice(a, S[0]);
    const dayBefore = pre.some(isDay), timeBefore = pre.some(isTime);
    S.forEach((si, k) => {
      const lo = k ? S[k - 1] + 1 : a, hi = k + 1 < S.length ? S[k + 1] : z;
      const before = lines.slice(lo, si), after = lines.slice(si + 1, hi);
      const pick = (arr, f, last) => { const m = arr.filter(f); return m.length ? (last ? m[m.length - 1] : m[0]) : null; };
      const dayL = dayBefore ? pick(before, isDay, true) : pick(after, isDay, false);
      const timeL = timeBefore ? pick(before, isTime, true) : pick(after, isTime, false);
      if (!dayL) return;
      let topic = "", event = "";
      for (const t of after) {
        if (isTime(t) || isDay(t) || /^(Time:|Release Date|Watch Live)/i.test(t)) continue;
        if (/^At /.test(t)) { if (!event) event = t; continue; }
        if (!topic && !event) topic = t;
      }
      const who = lines[si].match(WHO);
      out.push({ date: isoDay(new Date(Date.UTC(y, m0, +dayL))), time: timeL, kind: who[1], who: who[2], topic, event });
    });
  };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^(Speeches|Testimony)$/i.test(l)) { if (sec) flush(start, i); sec = l; start = i + 1; continue; }
    if (/^(FOMC Meetings|Beige Book|Statistical Releases|Other|Discount Rate|Conferences)$/i.test(l)) { if (sec) flush(start, i); sec = null; continue; }
  }
  if (sec) flush(start, lines.length);
  return out;
}
// Fed times are Eastern: shown in Central, an hour earlier
function etToCt(t) {
  const m = t && t.match(/^(\d{1,2}):(\d{2})\s*([ap])/i);
  if (!m) return "";
  let h = +m[1] % 12 + (m[3].toLowerCase() === "p" ? 12 : 0) - 1;
  if (h < 0) h += 24;
  return `${h % 12 || 12}:${m[2]}${h >= 12 ? "p" : "a"} CT`;
}
async function getFedCal() {
  const lines = htmlLines(await getText([`${FED}/monetarypolicy/fomccalendars.htm`]));
  const meetings = parseFomc(lines);
  if (!meetings.length) throw new Error("couldn't read the FOMC calendar");
  const speeches = [], now = new Date(), errs = [];
  for (let k = 0; k <= 1; k++) {
    const d = new Date(now.getFullYear(), now.getMonth() + k, 1), y = d.getFullYear(), m0 = d.getMonth();
    try {
      const html = await getText([`${FED}/newsevents/${y}-${MONF[m0].toLowerCase()}.htm`, `${FED}/newsevents/${y}-${String(m0 + 1).padStart(2, "0")}.htm`]);
      speeches.push(...parseSpeeches(htmlLines(html), y, m0));
    } catch (e) { if (k === 0) errs.push(String(e.message || e)); }
  }
  return { meetings, speeches, err: errs[0] || null, cal: `${FED}/newsevents/calendar.htm` };
}
// what the page shows: the next two meetings, the next minutes, and speeches from today on
function fedCalView(s) {
  const F = s.fedcal;
  if (!F) return null;
  const today = todayCT();
  const next = F.meetings.filter((m) => m.end >= today).slice(0, 2).map((m, k) => ({
    start: m.start, end: m.end, sep: m.sep, likelySep: !m.sep && !F.meetings.some((x) => x.sep && x.start.slice(0, 4) === m.start.slice(0, 4)) && ["03", "06", "09", "12"].includes(m.start.slice(5, 7)),
  }));
  // minutes come out three weeks after each meeting
  const past = F.meetings.filter((m) => m.end < today);
  const lastMeet = past[past.length - 1];
  let minutes = null;
  if (lastMeet) {
    const due = lastMeet.minutes || addDays(lastMeet.end, 21);
    if (due >= today) minutes = { of: lastMeet.end, date: due, est: !lastMeet.minutes };
  }
  if (!minutes && next[0]) minutes = { of: next[0].end, date: addDays(next[0].end, 21), est: true };
  const speeches = (F.speeches || []).filter((x) => x.date >= today).sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || ""))).slice(0, 5).map((x) => ({ ...x, ct: etToCt(x.time) }));
  return { next, minutes, speeches, err: F.err, cal: F.cal };
}

// ---------- Store ----------
function storePath() { const fm = FileManager.local(); return fm.joinPath(fm.documentsDirectory(), STORE_FILE); }
function readStore() {
  try { const fm = FileManager.local(); if (fm.fileExists(storePath())) return JSON.parse(fm.readString(storePath())); } catch (e) {}
  return { src: {} };
}
function saveStore(s) {
  try { const fm = FileManager.local(), p = storePath(); fm.writeString(p + ".tmp", JSON.stringify(s)); if (fm.fileExists(p)) fm.remove(p); fm.move(p + ".tmp", p); } catch (e) {
    try { FileManager.local().writeString(storePath(), JSON.stringify(s)); } catch (e2) {}
  }
}
// FRED's release calendar for a series: past and upcoming dates
async function releaseDates(seriesId) {
  try {
    const base = "https://api.stlouisfed.org/fred";
    const rel = await new Request(`${base}/series/release?series_id=${seriesId}&api_key=${FRED_KEY}&file_type=json`).loadJSON();
    const id = rel && rel.releases && rel.releases[0] && rel.releases[0].id;
    if (!id) return [];
    const r = await new Request(`${base}/release/dates?release_id=${id}&api_key=${FRED_KEY}&file_type=json&include_release_dates_with_no_data=true&sort_order=desc&limit=40`).loadJSON();
    return ((r && r.release_dates) || []).map((x) => x.date).sort();
  } catch (e) { return []; }
}
// Refresh what can be refreshed. In the widget (no hidden pages there) the Excel sources keep their saved copy.
async function refresh(s, inApp, say, live) {
  const step = async (key, label, fn) => {
    try {
      if (say) await say(`Updating ${label}…`);
      s[key] = await fn();
      s.src[key] = { at: Date.now(), tried: Date.now(), err: null };
    } catch (e) {
      s.src[key] = { at: (s.src[key] && s.src[key].at) || 0, tried: Date.now(), err: String((e && e.message) || e).slice(0, 120) };
    }
  };
  await Promise.all([
    step("actual", "CPI and PCE", getActual),
    step("clev", "Cleveland Fed", getCleveland),
    step("fomc", "Fed projections", getFomc),
    step("umich", "Michigan", getUmich),
    step("wages", "wages", getWages),
    step("energy", "energy prices", getEnergy),
    step("pipe", "producer and import prices", getPipe),
    step("shelter", "shelter prices", getShelter),
    step("clevPath", "the market model's path", getClevPath),
    (async () => {
      const ids = { cpi: "CPIAUCSL", pce: "PCEPI", clev: "EXPINF1YR", fomc: "PCECTPIMD", emp: "CES0500000003", eci: "ECIWAG", ppi: "PPIFIS", imp: "IR" };
      const cal = {};
      await Promise.all(Object.entries(ids).map(async ([k, id]) => { cal[k] = await releaseDates(id); }));
      s.cal = cal;
    })(),
  ]);
  saveStore(s); // keep the quick sources even if the view is closed before the slow ones finish
  if (inApp) {
    // one at a time, and only while the view is open: once it's closed the script
    // should end, or the next tap on the widget finds it still busy and Scriptable
    // just shows its script list. Anything skipped is picked up on the next open.
    const slow = [["sce", "NY Fed survey", getSce], ["spf", "Philadelphia Fed forecasters", getSpf], ["gscpi", "NY Fed supply-chain index", getGscpi],
      ["zori", "Zillow rents", getZori], ["fannie", "Fannie Mae's forecast", getFannie], ["fedcal", "the Fed's calendar", getFedCal]];
    for (const [key, label, fn] of slow) {
      if (live && !live()) break;
      await step(key, label, fn);
    }
  }
  s.at = Date.now();
  saveStore(s);
  if (say) await say("");
}

// ---------- The numbers ----------
// Latest 1-year and long-run expectations by group, and actual inflation
function model(s) {
  const L = (x) => lastOf(x);
  const umich1 = L(s.umich && s.umich.one), sce1 = L(s.sce && s.sce.one), clev1 = L(s.clev && s.clev.one), spf1 = L(s.spf && s.spf.cpi), spfP1 = L(s.spf && s.spf.pce);
  const umich5 = L(s.umich && s.umich.five), sce5 = L(s.sce && s.sce.five), sce3 = L(s.sce && s.sce.three), clev10 = L(s.clev && s.clev.ten), spf10 = L(s.spf && s.spf.cpi10), spfP10 = L(s.spf && s.spf.pce10);
  const fomc = s.fomc && s.fomc.one != null ? { m: s.fomc.m, v: s.fomc.one } : null, fomcLR = s.fomc && s.fomc.lr != null ? { m: s.fomc.m, v: s.fomc.lr } : null;
  const avg = (xs) => { const v = xs.filter((x) => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const groups = {
    consumers: avg([umich1 && umich1.v, sce1 && sce1.v]),
    forecasters: spf1 ? spf1.v : null,
    model: clev1 ? clev1.v : null,
  };
  const groupsLR = {
    consumers: avg([umich5 && umich5.v, sce5 && sce5.v]),
    forecasters: spf10 ? spf10.v : null,
    model: clev10 ? clev10.v : null,
  };
  const cpi = L(s.actual && s.actual.cpi), pce = L(s.actual && s.actual.pce), ccpi = L(s.actual && s.actual.ccpi), cpce = L(s.actual && s.actual.cpce);
  const expect = avg(Object.values(groups)), expectLR = avg(Object.values(groupsLR));
  return { umich1, sce1, clev1, spf1, spfP1, fomc, umich5, sce5, sce3, clev10, spf10, spfP10, fomcLR, groups, groupsLR, expect, expectLR, cpi, pce, ccpi, cpce };
}
// The face's headline: are people expecting more inflation than we're getting?
function headline(M) {
  if (M.expect == null || !M.cpi) return { text: "Waiting for data", gap: null };
  const gap = M.expect - M.cpi.v, g = Math.abs(gap).toFixed(1);
  if (Math.abs(gap) < 0.2) return { text: "Expectations match inflation", gap };
  return { text: `Expectations run ${g} pt ${gap > 0 ? "above" : "below"} inflation`, gap };
}

// ---------- Release schedule ----------
// Each source: its latest data, and when the next update is due (Central time).
// FRED's calendar gives exact dates for CPI, PCE, the Cleveland Fed and the Fed's
// projections; the surveys post on a usual timing, so theirs are "about" windows.
// Late sources show how late, when they were due, and why they aren't in yet.
const CT = "America/Chicago";
function ctDay(iso) { const [y, m, d] = iso.slice(0, 10).split("-").map(Number); return `${MON3[m - 1]} ${d}`; }
function ctStamp(ms) {
  try { return new Date(ms).toLocaleString("en-US", { timeZone: CT, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).replace(" AM", "a").replace(" PM", "p") + " CT"; }
  catch (e) { return new Date(ms).toLocaleString(); }
}
function agoText(ms) { const m = Math.round((Date.now() - ms) / 60000); return m < 60 ? `${Math.max(1, m)} min ago` : m < 48 * 60 ? `${Math.round(m / 60)} hrs ago` : `${Math.round(m / 1440)} days ago`; }
function nthWeekday(y, m0, wd, n) { const d = new Date(Date.UTC(y, m0, 1)); let c = 0; for (;;) { if (d.getUTCDay() === wd && ++c === n) return isoDay(d); d.setUTCDate(d.getUTCDate() + 1); } }
function addDays(iso, n) { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return isoDay(d); }
function todayCT() { try { const p = new Date().toLocaleDateString("en-US", { timeZone: CT, year: "numeric", month: "2-digit", day: "2-digit" }).split("/"); return `${p[2]}-${p[0]}-${p[1]}`; } catch (e) { return isoDay(new Date()); } }
function daysBetween(a, b) { return Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 864e5); }
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

function schedule(s) {
  const today = todayCT(), M = model(s), rows = [];
  const why = (key, extra) => {
    const st = s.src[key] || {};
    let t = st.err ? `Last check failed: ${st.err}` : st.tried ? `Checked ${agoText(st.tried)}: not posted yet` : "Not checked yet";
    return t + (extra ? ` ${extra}` : "") + ".";
  };
  // exact dates from FRED's calendar. lag: months between the data's month and its release
  const exact = (key, srcKey, name, every, latestM, dates, lag, time, extra) => {
    const past = (dates || []).filter((d) => d <= today), fut = (dates || []).filter((d) => d > today);
    const lastRel = past[past.length - 1], next = fut[0];
    const r = { key, name, every, last: latestM ? mLabel(latestM) : "–", main: next ? `${ctDay(next)}${time ? ", " + time : ""}` : "not scheduled", sub: "", late: false, sort: next || "9999" };
    if (lastRel && latestM && lag != null && latestM < mStr(mIdx(lastRel.slice(0, 7)) - lag)) {
      const d = daysBetween(lastRel, today);
      r.late = true;
      r.main = d < 1 ? "posting today" : `${plural(d, "day")} late`;
      r.sub = `was due ${ctDay(lastRel)}${time ? ", " + time : ""}`;
      r.why = why(srcKey, extra);
      r.sort = lastRel;
    }
    return r;
  };
  // usual timing: a window it normally posts in
  const approx = (key, srcKey, name, every, latestM, from, to, time, extra) => {
    const r = { key, name, every, last: latestM ? mLabel(latestM) : "–", main: "", sub: "", late: false, sort: from || "9999" };
    if (!from) { r.main = "not scheduled"; return r; }
    const win = ctDay(from) === ctDay(to) ? ctDay(from) : from.slice(5, 7) === to.slice(5, 7) ? `${ctDay(from)}–${+to.slice(8, 10)}` : `${ctDay(from)}–${ctDay(to)}`;
    if (today < from) { r.main = `about ${win}`; if (time) r.sub = `usually ${time}`; }
    else if (today <= to) { r.main = "due now"; r.sub = `usually ${win}`; r.due = true; }
    else {
      const d = daysBetween(to, today);
      r.late = true;
      r.main = `${plural(d, "day")} late`;
      r.sub = `was due by ${ctDay(to)}`;
      r.why = why(srcKey, extra);
    }
    return r;
  };
  const latest = (x) => (x ? x.m : null);

  rows.push(exact("cpi", "actual", "CPI (actual, shelter, rent)", "BLS, monthly", latest(M.cpi), s.cal && s.cal.cpi, 1, "7:30a"));
  rows.push(exact("pce", "actual", "PCE prices (actual)", "BEA, monthly", latest(M.pce), s.cal && s.cal.pce, 1, "7:30a"));

  // Michigan: preliminary around the 2nd Friday, final around the 4th
  const um = latest(M.umich1), fromFred = s.umich && s.umich.fromFred;
  if (um) {
    let n = mIdx(um) + 1 + (fromFred ? 1 : 0); // FRED's copy runs a month behind Michigan's own
    const y = Math.floor(n / 12), m0 = n % 12, f = nthWeekday(y, m0, 5, 2);
    const r = approx("umich", "umich", "U. Michigan consumers", fromFred ? "monthly; FRED's copy, a month behind" : "monthly: prelim mid-month, final late month", um, f, addDays(f, 7), "9:00a",
      fromFred ? "(Michigan's own table didn't load, so this is FRED's copy)" : "");
    // this month's preliminary is in: the final comes about two weeks later
    if (!r.late && !fromFred && um === today.slice(0, 7)) { const fin = nthWeekday(+um.slice(0, 4), +um.slice(5, 7) - 1, 5, 4); if (fin >= today) { r.sub = `final about ${ctDay(fin)}`; } }
    rows.push(r);
  } else rows.push({ key: "umich", name: "U. Michigan consumers", every: "monthly", last: "–", main: "not loaded", sub: "", late: true, why: why("umich"), sort: "0" });

  // NY Fed: the month's survey posts in the second week of the next month
  const sc = latest(M.sce1);
  if (sc) { const n = mIdx(sc) + 2, y = Math.floor(n / 12), m0 = n % 12, f = `${y}-${String(m0 + 1).padStart(2, "0")}-06`; rows.push(approx("sce", "sce", "NY Fed consumers", "monthly", sc, f, addDays(f, 9), "10:00a", "(checked only when you open this view)")); }
  else rows.push({ key: "sce", name: "NY Fed consumers", every: "monthly", last: "–", main: "not loaded", sub: "", late: true, why: why("sce", "(checked only when you open this view)"), sort: "0" });

  rows.push(exact("clev", "clev", "Cleveland Fed model", "monthly", latest(M.clev1), s.cal && s.cal.clev, 0, ""));

  // Philadelphia Fed: quarterly, mid-February, May, August and November
  const sp = latest(M.spf1) || latest(M.spf10);
  if (sp) { const n = mIdx(sp) + 3, y = Math.floor(n / 12), m0 = n % 12, f = `${y}-${String(m0 + 1).padStart(2, "0")}-10`; rows.push(approx("spf", "spf", "Professional forecasters", "quarterly (Philadelphia Fed)", sp, f, addDays(f, 11), "", "(checked only when you open this view)")); }
  else rows.push({ key: "spf", name: "Professional forecasters", every: "quarterly", last: "–", main: "not loaded", sub: "", late: true, why: why("spf", "(checked only when you open this view)"), sort: "0" });

  // the Fed's projections come with four of the eight meetings a year
  const fo = s.fomc && s.fomc.date, fut = ((s.cal && s.cal.fomc) || []).filter((d) => d > today);
  rows.push({ key: "fomc", name: "Fed projections (FOMC)", every: "4 times a year", last: fo ? `${ctDay(fo)} meeting` : "–", main: fut[0] ? `${ctDay(fut[0])}, 1:00p` : "not on FRED's calendar yet", sub: "", late: false, sort: fut[0] || "9998" });

  // inflation pressures
  const P = pressSeries(s), pl = (k) => latest(lastOf(P[k]));
  rows.push(exact("emp", "wages", "Wages: hourly earnings", "BLS jobs report, monthly", pl("ahe"), s.cal && s.cal.emp, 1, "7:30a"));
  rows.push(exact("eci", "wages", "Wages: Employment Cost Index", "BLS, quarterly", pl("eci"), s.cal && s.cal.eci, 3, "7:30a"));
  const at = pl("atl");
  if (at) { const n = mIdx(at) + 2, f = `${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, "0")}-08`; rows.push(approx("atl", "wages", "Wages: Atlanta Fed tracker", "monthly, via FRED", at, f, addDays(f, 12), "")); }
  rows.push(exact("ppi", "pipe", "Producer prices", "BLS, monthly", pl("ppi"), s.cal && s.cal.ppi, 1, "7:30a"));
  rows.push(exact("imp", "pipe", "Import prices", "BLS, monthly", pl("imp"), s.cal && s.cal.imp, 1, "7:30a"));
  const en = pl("wti");
  rows.push({ key: "energy", name: "Oil, gasoline, natural gas", every: "EIA via FRED; daily and weekly, shown as monthly averages", last: en ? mLabel(en) + (en === today.slice(0, 7) ? " so far" : "") : "–", main: "daily", sub: "gasoline Mondays", late: !!(s.src.energy && s.src.energy.err && !en), why: why("energy"), sort: "9997" });
  const gs = latest(lastOf(s.gscpi));
  if (gs) { const n = mIdx(gs) + 2, f = `${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, "0")}-02`; rows.push(approx("gscpi", "gscpi", "Supply-chain pressure", "NY Fed, monthly", gs, f, addDays(f, 7), "", "(checked only when you open this view)")); }
  else rows.push({ key: "gscpi", name: "Supply-chain pressure", every: "NY Fed, monthly", last: "–", main: "not loaded", sub: "", late: true, why: why("gscpi", "(checked only when you open this view)"), sort: "0" });
  const zr = latest(lastOf(s.zori));
  if (zr) { const n = mIdx(zr) + 2, f = `${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, "0")}-10`; rows.push(approx("zori", "zori", "New-lease rents (Zillow)", "monthly", zr, f, addDays(f, 10), "", "(checked only when you open this view)")); }
  else rows.push({ key: "zori", name: "New-lease rents (Zillow)", every: "monthly", last: "–", main: "not loaded", sub: "", late: true, why: why("zori", "(checked only when you open this view)"), sort: "0" });

  // late ones first, then by next date
  rows.sort((a, b) => (b.late - a.late) || (a.sort < b.sort ? -1 : a.sort > b.sort ? 1 : 0));
  return rows;
}

// ---------- The scorecard: is inflation heading up or down? ----------
// Eight signals, each pointing up (+1), down (-1) or sideways (0) by a simple rule.
// A plain scorecard, not a forecast: the verdict is just which way most of them point.
// Blended monthly series: the average next-year (or long-run) expectation across
// consumers, economists and the Cleveland Fed's model, the way the face averages them.
function blend(groups) {
  const keys = new Set();
  groups.forEach((g) => g.parts.forEach((p) => Object.keys(p || {}).forEach((k) => keys.add(k))));
  const out = {};
  [...keys].sort().forEach((m) => {
    const vals = groups.map((g) => {
      const v = g.parts.map((p) => {
        if (!p) return null;
        if (p[m] != null) return p[m];
        if (!g.carry) return null;
        for (let i = 1; i <= g.carry; i++) { const k = mStr(mIdx(m) - i); if (p[k] != null) return p[k]; } // quarterly surveys, carried a few months
        return null;
      }).filter((x) => x != null);
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
    }).filter((x) => x != null);
    if (vals.length >= 2) out[m] = vals.reduce((a, b) => a + b, 0) / vals.length;
  });
  return out;
}
function expBlend(s) {
  return blend([
    { parts: [s.umich && s.umich.one, s.sce && s.sce.one] },
    { parts: [s.spf && s.spf.cpi], carry: 3 },
    { parts: [s.clev && s.clev.one] },
  ]);
}
function lrBlend(s) {
  return blend([
    { parts: [s.umich && s.umich.five, s.sce && s.sce.five] },
    { parts: [s.spf && s.spf.cpi10], carry: 3 },
    { parts: [s.clev && s.clev.ten] },
  ]);
}
// CPI's last 3 months at an annual pace
function annual3(ix) {
  const out = {};
  for (const k of Object.keys(ix || {})) { const p = ix[mStr(mIdx(k) - 3)]; if (p) out[k] = (Math.pow(ix[k] / p, 4) - 1) * 100; }
  return out;
}
const pct1 = (v) => `${v.toFixed(1)}%`;
const sgn1 = (v) => `${v > 0 ? "+" : v < 0 ? "-" : ""}${Math.abs(v).toFixed(0)}`;
function signals(s) {
  const A = s.actual || {}, P = pressSeries(s), out = [];
  const L = (o) => lastOf(o), ago = (o, m, n) => (o ? o[mStr(mIdx(m) - n)] : null);
  const dirOf = (d, thr) => (d == null ? null : d > thr ? 1 : d < -thr ? -1 : 0);
  const add = (sg) => { if (sg.dir != null) { sg.strength = Math.min(5, Math.abs(sg.d) / sg.thr); out.push(sg); } };
  // 1. Momentum: the last 3 months at an annual pace vs the past year
  const cpi = L(A.cpi), c3 = A.cpiIx ? annual3(A.cpiIx) : {}, c3L = L(c3);
  if (cpi && c3L) {
    const d = c3L.v - cpi.v, dir = dirOf(d, 0.3);
    add({ key: "mom", name: "Today's inflation", m: cpi.m, value: pct1(cpi.v), d, thr: 0.3, dir,
      note: dir > 0 ? `The last 3 months ran hotter: ${pct1(c3L.v)} at an annual pace` : dir < 0 ? `The last 3 months ran cooler: ${pct1(c3L.v)} at an annual pace` : `The last 3 months ran at about the same pace (${pct1(c3L.v)} annualized)`,
      short: dir > 0 ? "Prices Rose Faster in the Last 3 Months" : dir < 0 ? "Prices Rose More Slowly in the Last 3 Months" : "Inflation's Pace Is Steady",
      what: "Consumer prices (CPI) compared with a year earlier. The arrow compares the last 3 months, at an annual pace, with the past year.",
      lines: [{ k: "cpi", label: "Past 12 months", col: "#FFFFFF", w: 2.2 }, { k: "cpi3", label: "Last 3 months, annualized", col: "#FF9F0A", w: 1.6 }] });
  }
  // 2. What people expect next year vs inflation now
  const ex = expBlend(s), exL = L(ex);
  if (cpi && exL) {
    const d = exL.v - cpi.v, dir = dirOf(d, 0.3);
    add({ key: "exp", name: "What people expect", m: exL.m, value: pct1(exL.v), d, thr: 0.3, dir,
      note: dir > 0 ? `More than inflation now (${pct1(cpi.v)}): people expect it to rise` : dir < 0 ? `Less than inflation now (${pct1(cpi.v)}): people expect it to ease` : `About where inflation is now (${pct1(cpi.v)})`,
      short: dir > 0 ? "People Expect More Inflation Than Now" : dir < 0 ? "People Expect Less Inflation Than Now" : "People Expect About the Inflation We Have",
      what: "Solid lines are the past: what each group expected for the next 12 months at the time, and their average. Past the Today line, in the shaded area, dotted lines are forecasts of CPI vs a year earlier: economists (Philadelphia Fed survey, quarter by quarter), Fannie Mae's monthly forecast, and the market model's path year by year. Dots are the Fed's own projections for each year-end (PCE prices, which run a bit below CPI). Tap a name to hide or show it.",
      chips: true, future: true,
      lines: [
        { k: "cpi", label: "Inflation now", col: "#FFFFFF", w: 2.2 },
        { k: "exp", label: "Average expected", col: "#FF9F0A", w: 2.6 },
        { k: "umich1", label: "Consumers (Michigan)", col: "#FFD60A", w: 1.3, piece: true },
        { k: "sce1", label: "Consumers (NY Fed)", col: "#FF6482", w: 1.3, piece: true },
        { k: "spf1", label: "Economists (Philly Fed)", col: "#64D2FF", w: 1.3, piece: true },
        { k: "clev1", label: "Market model (Cleveland Fed)", col: "#BF5AF2", w: 1.3, piece: true },
        { k: "fcSpf", label: "Economists (forecast)", col: "#64D2FF", w: 1.8, fc: true },
        { k: "fcFannie", label: "Fannie Mae (forecast)", col: "#30D158", w: 1.8, fc: true },
        { k: "fcClev", label: "Market model (forecast)", col: "#BF5AF2", w: 1.8, fc: true },
        { k: "fcFed", label: "The Fed (projection, PCE)", col: "#E5E5EA", w: 1.8, fc: true, dots: true },
      ] });
  }
  // 3. Wages: pay growth now vs 6 months ago
  const w = L(P.ahe);
  if (w) {
    const then = ago(P.ahe, w.m, 6), d = then == null ? null : w.v - then, dir = dirOf(d, 0.2);
    add({ key: "wages", name: "Wages", m: w.m, value: pct1(w.v), d, thr: 0.2, dir,
      note: dir > 0 ? `Pay growth speeding up (${pct1(then)} six months ago)` : dir < 0 ? `Pay growth slowing (${pct1(then)} six months ago)` : `Pay growth steady (${then != null ? pct1(then) : "–"} six months ago)`,
      short: dir > 0 ? `Pay Growth Speeding Up to ${pct1(w.v)}` : dir < 0 ? `Pay Growth Slowing to ${pct1(w.v)}` : `Pay Growth Steady at ${pct1(w.v)}`,
      what: "Average hourly pay of private-sector workers vs a year earlier (BLS), and the typical worker's raise (Atlanta Fed tracker). Faster pay growth can feed prices.",
      lines: [{ k: "ahe", label: "Hourly pay", col: "#FFFFFF", w: 2.2 }, { k: "atl", label: "Typical worker's raise", col: "#30D158", w: 1.8 }] });
  }
  // 4. Oil vs a year ago
  const o = L(P.wti), price = o && P.wtiPrice ? P.wtiPrice[o.m] : null;
  if (o) {
    const dir = dirOf(o.v, 5);
    add({ key: "oil", name: "Oil", m: o.m, value: `${sgn1(o.v)}%`, d: o.v, thr: 5, dir,
      note: (dir > 0 ? `Up ${Math.abs(o.v).toFixed(0)}% from a year ago` : dir < 0 ? `Down ${Math.abs(o.v).toFixed(0)}% from a year ago` : "About where it was a year ago") + (price ? ` ($${Math.round(price)} a barrel)` : ""),
      short: dir > 0 ? `Oil Up ${Math.abs(o.v).toFixed(0)}% in a Year` : dir < 0 ? `Oil Down ${Math.abs(o.v).toFixed(0)}% in a Year` : "Oil About Flat Over the Year",
      what: "West Texas crude oil and regular gasoline vs a year earlier (monthly averages; this month so far). Energy moves quickly into prices.",
      lines: [{ k: "wti", label: "Oil", col: "#FF9F0A", w: 2.2 }, { k: "gas", label: "Gasoline", col: "#FFD60A", w: 1.8 }] });
  }
  // 5. Producer prices: now vs 6 months ago
  const pp = L(P.ppi);
  if (pp) {
    const then = ago(P.ppi, pp.m, 6), d = then == null ? null : pp.v - then, dir = dirOf(d, 0.3);
    add({ key: "ppi", name: "Producer prices", m: pp.m, value: pct1(pp.v), d, thr: 0.3, dir,
      note: dir > 0 ? `What businesses charge each other is rising faster (${pct1(then)} six months ago)` : dir < 0 ? `What businesses charge each other is easing (${pct1(then)} six months ago)` : `Steady (${then != null ? pct1(then) : "–"} six months ago)`,
      short: dir > 0 ? `Producer Prices Rising Faster, at ${pct1(pp.v)}` : dir < 0 ? `Producer Prices Easing to ${pct1(pp.v)}` : `Producer Prices Steady at ${pct1(pp.v)}`,
      what: "Prices businesses get for what they sell (BLS producer prices, final demand) and import prices, vs a year earlier. They tend to show up in consumer prices later.",
      lines: [{ k: "ppi", label: "Producer prices", col: "#FFFFFF", w: 2.2 }, { k: "imp", label: "Import prices", col: "#64D2FF", w: 1.8 }] });
  }
  // 6. Rents on new leases vs rent in CPI
  const z = L(P.zori), r = L(P.rent);
  if (z && r) {
    const d = z.v - r.v, dir = dirOf(d, 0.5);
    add({ key: "rent", name: "Rents on new leases", m: z.m, value: pct1(z.v), d, thr: 0.5, dir,
      note: dir < 0 ? `Below rent in CPI (${pct1(r.v)}), so CPI rent should keep cooling` : dir > 0 ? `Above rent in CPI (${pct1(r.v)}), so CPI rent may pick up` : `In line with rent in CPI (${pct1(r.v)})`,
      short: dir < 0 ? "New-Lease Rents Below CPI Rent, Pointing to Cooler Shelter Costs" : dir > 0 ? "New-Lease Rents Above CPI Rent, Pointing to Firmer Shelter Costs" : "New-Lease Rents in Line With CPI Rent",
      what: "Asking rents on new leases (Zillow) vs rent in CPI, both vs a year earlier. CPI rent covers all leases, so it follows new leases with a lag of about a year.",
      lines: [{ k: "rent", label: "Rent in CPI", col: "#FFFFFF", w: 2.2 }, { k: "zori", label: "New leases (Zillow)", col: "#30D158", w: 1.8 }] });
  }
  // 7. Long-run expectations: now vs a year ago
  const lr = lrBlend(s), lrL = L(lr);
  if (lrL) {
    const then = ago(lr, lrL.m, 12), d = then == null ? null : lrL.v - then, dir = dirOf(d, 0.2);
    add({ key: "lr", name: "Long-run expectations", m: lrL.m, value: pct1(lrL.v), d, thr: 0.2, dir,
      note: (dir > 0 ? `Up ${Math.abs(d).toFixed(1)} pts in a year` : dir < 0 ? `Down ${Math.abs(d).toFixed(1)} pts in a year` : "Steady over the past year") + "; the Fed's target is 2%",
      short: dir > 0 ? `Long-Run Expectations Rising, Now ${pct1(lrL.v)}` : dir < 0 ? `Long-Run Expectations Falling, Now ${pct1(lrL.v)}` : `Long-Run Expectations Steady at ${pct1(lrL.v)}`,
      what: "Expected inflation 5 to 10 years out: the average of consumers, economists and the market-based model. If these drift up, inflation tends to stick.",
      lines: [{ k: "lr", label: "Expected, 5 to 10 years", col: "#FF9F0A", w: 2.2 }], target: 2 });
  }
  // 8. Supply chains vs normal
  const g = L(s.gscpi);
  if (g) {
    const dir = dirOf(g.v, 0.5);
    add({ key: "supply", name: "Supply chains", m: g.m, value: `${g.v > 0 ? "+" : ""}${g.v.toFixed(1)}`, d: g.v, thr: 0.5, dir,
      note: dir > 0 ? "Tighter than normal, which pushes prices up" : dir < 0 ? "Looser than normal, which takes pressure off prices" : "About normal",
      short: dir > 0 ? "Supply Chains Tighter Than Normal" : dir < 0 ? "Supply Chains Looser Than Normal" : "Supply Chains About Normal",
      what: "The NY Fed's Global Supply Chain Pressure Index: 0 is normal; +1 is unusually tight (one standard deviation above normal).",
      lines: [{ k: "gscpi", label: "Supply-chain pressure", col: "#FF9F0A", w: 2.2 }], unit: "sd", target: 0 });
  }
  const up = out.filter((x) => x.dir > 0).length, down = out.filter((x) => x.dir < 0).length, n = out.length;
  const dir = down - up >= 2 ? -1 : up - down >= 2 ? 1 : 0;
  const verdict = dir < 0 ? "Heading down" : dir > 0 ? "Heading up" : "Holding steady";
  const count = dir < 0 ? `${down} of ${n} signals point lower` : dir > 0 ? `${up} of ${n} signals point higher` : `Signals split: ${up} higher, ${down} lower, ${n - up - down} flat`;
  return { list: out, up, down, n, dir, verdict, count, exp: ex, lr, cpi3: c3 };
}

// ---------- Widget face: the verdict ----------
const DIRCOL = { "-1": "#64D2FF", "0": "#98989F", "1": "#FF9F0A" }, ARROW = { "-1": "↓", "0": "→", "1": "↑" };
// The small face: the verdict as a colored badge, then one tile per signal (arrow and a
// short name, tinted by direction), then CPI now and expected over the next year
const TILE_NAMES = [["mom", "CPI"], ["exp", "Expect"], ["wages", "Wages"], ["oil", "Oil"], ["ppi", "PPI"], ["rent", "Rents"], ["lr", "Long"], ["supply", "Supply"]];
function face(s) {
  const G = signals(s), M = model(s);
  // laid out on a 510 grid, drawn at the widget's real size (170 points) at the
  // screen's own scale, so iOS never shrinks a big image (that blurred it)
  const W = 510, K = 170 / W, dc = new DrawContext();
  dc.size = new Size(170, 170);
  dc.respectScreenScale = true;
  dc.opaque = true;
  dc.setFillColor(new Color("#1C1C1E"));
  dc.fillRect(new Rect(0, 0, 170, 170));
  const R = (x, y, w, h) => new Rect(x * K, y * K, w * K, h * K);
  const text = (str, x, y, w, h, size, hex, weight, align) => {
    const sz = size * K;
    dc.setFont(weight === "heavy" ? Font.heavySystemFont(sz) : weight === "bold" ? Font.boldSystemFont(sz) : weight === "semi" ? Font.semiboldSystemFont(sz) : Font.mediumSystemFont(sz));
    dc.setTextColor(new Color(hex));
    if (align === "right") dc.setTextAlignedRight(); else if (align === "center") dc.setTextAlignedCenter(); else dc.setTextAlignedLeft();
    dc.drawTextInRect(str, R(x, y, w, h));
  };
  const box = (x, y, w, h, r, hex, alpha) => { const p = new Path(); p.addRoundedRect(R(x, y, w, h), r * K, r * K); dc.addPath(p); dc.setFillColor(new Color(hex, alpha == null ? 1 : alpha)); dc.fillPath(); };
  const pad = 30;
  text("INFLATION", pad + 4, 36, 200, 32, 23, "#98989F", "bold");
  if (!G.n) {
    text("Open the widget once", pad, 190, W - 2 * pad, 40, 30, "#C7C7CC", "semi", "center");
    text("to load data", pad, 230, W - 2 * pad, 40, 30, "#C7C7CC", "semi", "center");
    return dc.getImage();
  }
  // the verdict badge, right-aligned; its width from the text (about 0.6 of the font size per character)
  const col = DIRCOL[String(G.dir)], badge = `${ARROW[String(G.dir)]} ${G.verdict}`, bs = 25;
  const bw = Math.min(W - 2 * pad - 150, Math.round(badge.length * bs * 0.6) + 34);
  box(W - pad - bw, 28, bw, 44, 22, col);
  text(badge, W - pad - bw, 36, bw, 34, bs, "#1C1C1E", "heavy", "center");
  // the tiles: 2 rows of 4
  const by = 90, gap = 10, tw = (W - 2 * pad - 3 * gap) / 4, th = 138;
  const tint = { "1": ["#FF9F0A", 0.18], "-1": ["#64D2FF", 0.16], "0": ["#2C2C2E", 1] };
  TILE_NAMES.forEach(([key, label], k) => {
    const x = pad + (k % 4) * (tw + gap), y = by + Math.floor(k / 4) * (th + gap);
    const sg = G.list.find((g) => g.key === key), d = sg ? String(sg.dir) : null;
    const [bg, a] = d ? tint[d] : ["#2C2C2E", 0.5];
    box(x, y, tw, th, 24, bg, a);
    text(d ? ARROW[d] : "–", x, y + 18, tw, 62, 50, d ? (d === "0" ? "#AEAEB2" : DIRCOL[d]) : "#636366", "heavy", "center");
    text(label, x, y + 86, tw, 36, 26, d ? "#F2F2F7" : "#8E8E93", "bold", "center");
  });
  // CPI over the past year → what people expect over the next year (colored by that signal)
  const cpi = M.cpi ? M.cpi.v.toFixed(1) + "%" : "–", ex = G.list.find((x) => x.key === "exp");
  const exCol = ex ? (String(ex.dir) === "0" ? "#AEAEB2" : DIRCOL[String(ex.dir)]) : "#8E8E93";
  text(cpi, pad + 6, 408, 200, 40, 32, "#FFFFFF", "heavy");
  text("past year", pad + 6, 446, 200, 28, 20, "#8E8E93", "semi");
  text("→", W / 2 - 40, 408, 80, 40, 30, "#8E8E93", "bold", "center");
  text(ex ? ex.value : "–", W / 2 + 40, 408, W / 2 - 40 - pad - 6, 40, 32, exCol, "heavy", "right");
  text("next year", W / 2 + 40, 446, W / 2 - 40 - pad - 6, 28, 20, "#8E8E93", "semi", "right");
  return dc.getImage();
}
function errorWidget(msg) {
  const w = new ListWidget();
  w.backgroundColor = new Color("#1C1C1E");
  const t = w.addText("Inflation expectations");
  t.font = Font.semiboldSystemFont(12); t.textColor = new Color("#98989F");
  w.addSpacer(6);
  const m = w.addText(msg); m.font = Font.systemFont(11); m.textColor = new Color("#FF9F0A");
  return w;
}

// ---------- Full view ----------
function payload(s) {
  const M = model(s);
  const r2 = (o) => { const out = {}; for (const [k, v] of Object.entries(o || {})) out[k] = Math.round(v * 100) / 100; return out; };
  const pick = (o) => r2(o);
  const PS = pressSeries(s), TR = pressTrend(PS), press = {};
  for (const [k, v] of Object.entries(PS)) press[k] = r2(v);
  const miss = ["wages", "energy", "pipe", "shelter"].flatMap((k) => (s[k] && s[k].miss) || []);
  const G = signals(s);
  return {
    sig: { list: G.list, up: G.up, down: G.down, n: G.n, dir: G.dir, verdict: G.verdict, count: G.count },
    press, trend: TR, pressHead: pressHeadline(TR), pressMiss: miss,
    head: headline(M).text,
    M,
    series: {
      cpi: pick(s.actual && s.actual.cpi), ccpi: pick(s.actual && s.actual.ccpi), pce: pick(s.actual && s.actual.pce), cpce: pick(s.actual && s.actual.cpce),
      umich1: pick(s.umich && s.umich.one), umich5: pick(s.umich && s.umich.five),
      sce1: pick(s.sce && s.sce.one), sce3: pick(s.sce && s.sce.three), sce5: pick(s.sce && s.sce.five),
      clev1: pick(s.clev && s.clev.one), clev10: pick(s.clev && s.clev.ten),
      spf1: pick(s.spf && s.spf.cpi), spfP1: pick(s.spf && s.spf.pce), spf10: pick(s.spf && s.spf.cpi10), spfP10: pick(s.spf && s.spf.pce10),
      cpi3: pick(G.cpi3), exp: pick(G.exp), lr: pick(G.lr),
      ...Object.fromEntries(Object.entries(forecasts(s)).map(([k, v]) => [k, pick(v)])),
    },
    fed: fedCalView(s),
    fcInfo: { spf: s.spf && s.spf.path ? `Q${s.spf.path.q} ${s.spf.path.y} survey` : null, fannie: s.fannie ? mLabel(s.fannie.pub) : null, clev: s.clevPath ? mLabel(s.clevPath.m) : null, fed: s.fomc && s.fomc.date ? s.fomc.date : null },
    fomc: s.fomc || null,
    sched: schedule(s),
    today: isoDay(new Date()),
    updated: s.at ? ctStamp(s.at) : "",
    umichFromFred: !!(s.umich && s.umich.fromFred),
  };
}

// ---------- Full-screen view ----------
// Note: the page script below avoids backticks, backslashes and dollar-brace
// on purpose, because the whole page lives inside a template literal.
const PAGE_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<title>Inflation</title>
<style>
  :root { --bg:#1C1C1E; --fg:#FFFFFF; --gray:#98989F; }
  * { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  html, body { -webkit-text-size-adjust:100%; text-size-adjust:100%; }
  body { margin:0; padding:20px 16px 40px; background:var(--bg); color:var(--fg);
         font-family:-apple-system,system-ui,sans-serif; -webkit-user-select:none; user-select:none; }
  .ticker { font-size:26px; font-weight:700; }
  .name { color:#C7C7CC; font-size:15px; font-weight:600; margin-top:2px; }
  .hint { color:var(--gray); font-size:12px; margin-top:4px; min-height:15px; line-height:1.4; }
  #sched { margin:12px 0 4px; border:1px solid #2C2C2E; border-radius:12px; padding:8px 10px 6px; background:#232325; }
  .schedHead { display:flex; justify-content:space-between; align-items:baseline; font-size:12.5px; margin-bottom:3px; }
  .schedHead span { color:#8E8E93; font-size:10.5px; }
  .schedRow { display:flex; gap:8px; align-items:baseline; font-size:12px; padding:4px 0; border-top:1px solid #2C2C2E; }
  .schedRow:first-of-type { border-top:none; }
  .schedName { flex:1; color:#E5E5EA; line-height:1.25; }
  .schedName i { display:block; font-style:normal; color:#8E8E93; font-size:10.5px; }
  .schedName i.why { color:#FF9F0A; }
  .schedLast { color:#98989F; white-space:nowrap; font-size:11.5px; }
  .schedNext { width:122px; text-align:right; white-space:nowrap; color:#E5E5EA; }
  .schedNext i { display:block; font-style:normal; color:#8E8E93; font-size:10.5px; white-space:normal; }
  .late { color:#FF9F0A; }
  .schedMore { text-align:center; color:#64A8FF; font-size:12px; padding:6px 0 2px; border-top:1px solid #2C2C2E; }
  #fed { margin:12px 0 4px; border:1px solid #2C2C2E; border-radius:12px; padding:8px 10px 8px; background:#232325; }
  .fedHead { display:flex; justify-content:space-between; align-items:baseline; font-size:12.5px; margin-bottom:2px; }
  .fedHead span { color:#8E8E93; font-size:10.5px; }
  .fedRow { display:flex; gap:8px; font-size:12.5px; padding:5px 0; border-top:1px solid #2C2C2E; line-height:1.3; }
  .fedRow:first-of-type { border-top:none; }
  .fedRow .when { width:92px; flex:none; color:#E5E5EA; font-weight:600; font-variant-numeric:tabular-nums; }
  .fedRow .when i { display:block; font-style:normal; color:#8E8E93; font-size:10.5px; font-weight:500; }
  .fedRow .what2 { flex:1; color:#E5E5EA; }
  .fedRow .what2 i { display:block; font-style:normal; color:#8E8E93; font-size:11px; }
  .fedLink { color:#64A8FF; }
  .legend.chips > span { cursor:pointer; padding:3px 8px; margin:3px 6px 3px 0; border-radius:10px; background:#2C2C2E; white-space:normal; max-width:100%; }
  .legend.chips { font-size:12px; }
  .legend.chips > span.hid { opacity:0.35; }
  .legend .dash { background:none !important; border-top:2px dashed; height:0; width:14px; }
  .legend .dotk { width:7px; height:7px; border-radius:4px; }
  .verdict { margin-top:16px; background:#2C2C2E; border-radius:14px; padding:14px 14px 12px; display:flex; align-items:center; gap:12px; }
  .verdict .arr { font-size:54px; font-weight:800; line-height:1; width:46px; text-align:center; }
  .verdict .vt { font-size:24px; font-weight:800; }
  .verdict .vc { font-size:14px; color:#E5E5EA; font-weight:600; margin-top:2px; }
  .verdict .vn { font-size:11.5px; color:var(--gray); margin-top:4px; }
  .sig { border-top:1px solid #2C2C2E; padding:10px 0; }
  .sig:first-child { border-top:none; }
  .srow { display:flex; align-items:flex-start; gap:10px; cursor:pointer; }
  .srow .a { font-size:22px; font-weight:800; width:22px; text-align:center; line-height:1.05; }
  .srow .t { flex:1; }
  .srow .t b { font-size:15.5px; }
  .srow .t div { color:#C7C7CC; font-size:13px; line-height:1.35; margin-top:2px; }
  .srow .v { font-size:16px; font-weight:700; font-variant-numeric:tabular-nums; white-space:nowrap; }
  .srow .v i { display:block; font-style:normal; color:var(--gray); font-size:10.5px; font-weight:600; text-align:right; }
  .srow .chev { color:#636366; font-size:14px; margin-left:2px; padding-top:3px; }
  .sbody { display:none; margin:8px 0 2px 32px; }
  .sig.open .sbody { display:block; }
  .sig.open .chev { transform:rotate(90deg); }
  .what { color:var(--gray); font-size:11.5px; line-height:1.4; margin-top:6px; }
  .seg { display:flex; gap:6px; margin-top:18px; flex-wrap:wrap; }
  .seg span { padding:6px 12px; border-radius:14px; background:#2C2C2E; color:#E5E5EA; font-size:13px; font-weight:600; }
  .seg span.on { background:#E5E5EA; color:#1C1C1E; }
  .block { margin-top:18px; }
  .btitle { font-size:16px; font-weight:700; }
  .bsub { color:var(--gray); font-size:12.5px; margin-top:2px; min-height:16px; font-variant-numeric:tabular-nums; }
  .legend { display:flex; flex-wrap:wrap; font-size:12.5px; font-weight:600; margin-top:6px; font-variant-numeric:tabular-nums; }
  .legend > span { margin:2px 12px 2px 0; white-space:nowrap; }
  .legend i { display:inline-block; width:12px; height:4px; border-radius:2px; vertical-align:middle; margin-right:5px; }
  .legend b { font-weight:700; margin-left:3px; }
  .legend span.off { color:#636366; }
  .wrap { position:relative; margin-top:6px; }
  svg.chart { display:block; width:100%; height:200px; }
  svg.chart.small { height:150px; }
  .touch { position:absolute; left:0; top:0; right:0; bottom:0; touch-action:pan-y; }
  details { margin-top:22px; border-top:1px solid #2C2C2E; padding-top:10px; }
  summary { font-size:15px; font-weight:700; color:#E5E5EA; cursor:pointer; list-style:none; }
  summary::-webkit-details-marker { display:none; }
  summary:before { content:"▸ "; color:#8E8E93; }
  details[open] summary:before { content:"▾ "; }
  table { width:100%; border-collapse:collapse; margin-top:8px; font-size:13px; font-variant-numeric:tabular-nums; }
  th { text-align:right; color:var(--gray); font-weight:600; font-size:11.5px; padding:4px 0 6px 8px; }
  th:first-child, td:first-child { text-align:left; padding-left:0; }
  td { text-align:right; padding:7px 0 7px 8px; border-top:1px solid #2C2C2E; vertical-align:top; }
  td small { display:block; color:var(--gray); font-size:10.5px; font-weight:400; margin-top:1px; }
  td.src { font-weight:600; }
  td.v { font-weight:700; font-size:14px; }
  .note { color:var(--gray); font-size:11px; line-height:1.45; margin-top:14px; }
  @media (max-width: 360px) { body { padding:16px 12px 32px; } .ticker { font-size:23px; } .schedNext { width:108px; } }
</style>
</head>
<body>
  <div class="ticker">Inflation</div>
  <div class="name">Is it heading up or down?</div>
  <div class="hint" id="status"></div>
  <div id="fed" style="display:none"></div>
  <div id="sched"></div>

  <div class="verdict" id="verdict"></div>
  <div id="sigs"></div>

  <div class="seg" id="segs"><span data-r="24">2Y</span><span data-r="60">5Y</span><span data-r="120">10Y</span></div>
  <div class="hint">Pinch any chart to zoom, drag with two fingers to pan (all charts follow). Touch to read a month; double-tap to go back.</div>

  <div class="block">
    <div class="btitle">Inflation now vs what people expect</div>
    <div class="bsub" id="sub1"></div>
    <div class="legend" id="leg1"></div>
    <div class="wrap"><svg class="chart" id="c1"></svg><div class="touch" id="tc1"></div></div>
    <div class="what">Inflation now: consumer prices (CPI) vs a year earlier. Expected next year: the average of consumers, economists and a market-based model. When expectations sit above inflation now, people think it will rise.</div>
  </div>

  <details id="details">
    <summary>Details: every source and notes</summary>
    <table id="tbl"></table>
    <table id="ptbl"></table>
    <div class="note" id="note"></div>
  </details>

<script>
window.onerror = function (m, src, line) { window.__drawn = true; var e = document.getElementById("status"); if (e) e.textContent = "Page error: " + m + " (line " + line + ")"; };
var D = __DATA__;
var MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
var PRESET = 60, VIEW = null, CUR = null, GEO = {}, OPEN = {}, HIDE = {};
var SW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function dayName(d) { var t = new Date(d + "T12:00:00Z"); return SW[t.getUTCDay()] + " " + MON[t.getUTCMonth()] + " " + t.getUTCDate(); }
function todayI() { return D.today ? idx(D.today.slice(0, 7)) : endAll(); }
var DIRC = { "-1": "#64D2FF", "0": "#98989F", "1": "#FF9F0A" }, ARR = { "-1": "↓", "0": "→", "1": "↑" };
function el(id) { return document.getElementById(id); }
function idx(m) { var p = m.split("-"); return (+p[0]) * 12 + (+p[1]) - 1; }
function mOf(i) { var y = Math.floor(i / 12), mo = (i % 12) + 1; return y + "-" + (mo < 10 ? "0" : "") + mo; }
function mLab(i) { var m = mOf(i); return MON[+m.slice(5, 7) - 1] + " " + m.slice(0, 4); }
function esc(t) { return String(t == null ? "" : t).split("&").join("&amp;").split("<").join("&lt;"); }
function pct(v) { return v == null ? "–" : v.toFixed(1) + "%"; }
function S(k) { return (D.series && D.series[k]) || (D.press && D.press[k]) || {}; }
function at(k, i, reach) { var m = S(k); for (var j = 0; j <= (reach || 0); j++) { var v = m[mOf(i - j)]; if (v != null) return { v: v, i: i - j }; } return null; }
function lastI(k) { var ks = Object.keys(S(k)).sort(); return ks.length ? idx(ks[ks.length - 1]) : null; }
function quarterOf(m) { return "Q" + Math.ceil(+m.slice(5, 7) / 3) + " " + m.slice(0, 4); }
function SG() { return (D.sig && D.sig.list) || []; }

// the charts: the main one, and one per signal (drawn when its row is open)
var MAIN = [{ k: "cpi", label: "Inflation now", col: "#FFFFFF", w: 2.4 }, { k: "exp", label: "Expected next year", col: "#FF9F0A", w: 2.2 }];
function charts() {
  var out = [{ id: "c1", leg: "leg1", sub: "sub1", lines: MAIN }];
  SG().forEach(function (sg, n) { if (OPEN[sg.key]) out.push({ id: "g" + n, leg: "gl" + n, sub: "gs" + n, lines: sg.lines, target: sg.target, unit: sg.unit, h: sg.future ? 220 : 150, chips: sg.chips, future: sg.future }); });
  return out;
}
function ownEnd(lines) { var e = -1; lines.forEach(function (ln) { var x = lastI(ln.k); if (x != null && x > e) e = x; }); return e; }
function allLines() { var a = MAIN.slice(); SG().forEach(function (sg) { a = a.concat(sg.lines.filter(function (ln) { return !ln.fc; })); }); return a; }
function endAll() { return ownEnd(allLines()); }
function firstAll() { var f = Infinity; allLines().forEach(function (ln) { var ks = Object.keys(S(ln.k)); if (ks.length) { ks.sort(); f = Math.min(f, idx(ks[0])); } }); return isFinite(f) ? f : endAll() - 120; }
function clampView(a, b) { var e = endAll(), f = firstAll(), span = Math.max(11, Math.min(e - f, b - a)); a = Math.max(f, Math.min(e - span, a)); return { a: a, b: a + span }; }
function viewNow() { var e = endAll(); return VIEW ? VIEW : { a: e - PRESET + 1, b: e }; }
function every(span) { return span <= 15 ? -1 : span <= 30 ? 0 : span <= 72 ? 1 : 2; }
function dateLab(m, ev) {
  var mo = m.slice(5, 7);
  if (ev === -1) return ["01", "04", "07", "10"].indexOf(mo) >= 0 ? (mo === "01" ? m.slice(0, 4) : MON[+mo - 1]) : null;
  if (ev === 0) return mo === "01" || mo === "07" ? (mo === "01" ? m.slice(0, 4) : "Jul") : null;
  return mo === "01" && (+m.slice(0, 4)) % ev === 0 ? m.slice(0, 4) : null;
}
function niceStep(r, unit) { if (unit === "sd") return r <= 2 ? 0.5 : r <= 5 ? 1 : 2; return r <= 3 ? 0.5 : r <= 7 ? 1 : r <= 14 ? 2 : r <= 40 ? 10 : r <= 100 ? 25 : 50; }
function fmtAxis(v, st, unit) { var s = st < 1 ? v.toFixed(1) : String(Math.round(v)); return unit === "sd" ? (v > 0 ? "+" : "") + s : s + "%"; }
function fmtV(v, unit) { return unit === "sd" ? (v > 0 ? "+" : "") + v.toFixed(2) : v.toFixed(1) + "%"; }
function draw(c) {
  var svg = el(c.id); if (!svg) return;
  var W = svg.clientWidth || 340, H = c.h || 200, L = 36, R = W - 8, T = 8, B = H - 22;
  var V = viewNow(), va = V.a, vb = V.b;
  // a chart with forecasts runs on past today when the dates reach today: about 30 months, never more than half the width
  var lines = c.lines.filter(function (ln) { return !HIDE[ln.k]; }), tI = todayI(), fEnd = -1;
  if (c.future && vb >= endAll() - 1) {
    lines.forEach(function (ln) { if (ln.fc) { var x = lastI(ln.k); if (x != null && x > fEnd) fEnd = x; } });
    if (fEnd > vb) vb = Math.min(fEnd + 2, vb + Math.max(12, Math.min(30, vb - va)));
  }
  var a = Math.floor(va), b = Math.ceil(vb), vals = [];
  lines.forEach(function (ln) { var m = S(ln.k); for (var i = a; i <= b; i++) { var v = m[mOf(i)]; if (v != null) vals.push(v); } });
  if (c.target != null) vals.push(c.target);
  if (vb < 0 || !vals.length) { svg.innerHTML = '<text x="' + (W / 2) + '" y="' + (H / 2) + '" fill="#8E8E93" font-size="13" text-anchor="middle">No data yet</text>'; return; }
  var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), st = niceStep(hi - lo, c.unit);
  lo = Math.floor((lo - 0.1) / st) * st; hi = Math.ceil((hi + 0.1) / st) * st;
  var X = function (i) { return L + (i - va) / Math.max(1, vb - va) * (R - L); };
  var Y = function (v) { return B - (v - lo) / (hi - lo) * (B - T); };
  GEO[c.id] = { a: va, b: vb, L: L, R: R };
  var o = '<defs><clipPath id="clip' + c.id + '"><rect x="' + L + '" y="' + T + '" width="' + (R - L) + '" height="' + (B - T) + '"/></clipPath></defs>';
  // the future: shaded, with a Today line, so forecasts can't be mistaken for data
  if (c.future && tI < vb) {
    var tx = Math.max(L, X(tI));
    o += '<rect x="' + tx + '" y="' + T + '" width="' + (R - tx) + '" height="' + (B - T) + '" fill="#FFFFFF" fill-opacity="0.06"/>';
    if (X(tI) >= L) o += '<line x1="' + tx + '" x2="' + tx + '" y1="' + T + '" y2="' + B + '" stroke="#E5E5EA" stroke-width="1"/><text x="' + (tx - 4) + '" y="' + (T + 11) + '" fill="#E5E5EA" font-size="10" font-weight="700" text-anchor="end">Today</text>';
    o += '<text x="' + (tx + 5) + '" y="' + (T + 11) + '" fill="#E5E5EA" font-size="10" font-weight="700">Forecasts ›</text>';
  }
  for (var v = lo; v <= hi + st / 2; v += st) {
    o += '<line x1="' + L + '" x2="' + R + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="#3A3A3C" stroke-width="0.6"/>';
    o += '<text x="' + (L - 5) + '" y="' + (Y(v) + 3.5) + '" fill="#8E8E93" font-size="10" text-anchor="end">' + fmtAxis(v, st, c.unit) + "</text>";
  }
  if (lo < 0 && hi > 0 && c.target !== 0) o += '<line x1="' + L + '" x2="' + R + '" y1="' + Y(0) + '" y2="' + Y(0) + '" stroke="#8E8E93" stroke-width="0.9"/>';
  var ev = every(vb - va), lastX = -99;
  for (var i = a; i <= b; i++) {
    var lab = dateLab(mOf(i), ev);
    if (lab && X(i) >= L - 1 && X(i) <= R + 1 && X(i) - lastX > 30) { o += '<text x="' + X(i) + '" y="' + (H - 6) + '" fill="#8E8E93" font-size="10" text-anchor="middle">' + lab + "</text>"; o += '<line x1="' + X(i) + '" x2="' + X(i) + '" y1="' + B + '" y2="' + (B + 3) + '" stroke="#636366"/>'; lastX = X(i); }
  }
  if (c.target != null) {
    o += '<line x1="' + L + '" x2="' + R + '" y1="' + Y(c.target) + '" y2="' + Y(c.target) + '" stroke="#E5E5EA" stroke-width="1" stroke-dasharray="5 4"/>';
    o += '<text x="' + (L + 4) + '" y="' + (Y(c.target) - 4) + '" fill="#E5E5EA" font-size="10">' + (c.unit === "sd" ? "normal" : "Fed's 2% target") + "</text>";
  }
  o += '<g clip-path="url(#clip' + c.id + ')">';
  lines.slice().reverse().forEach(function (ln) {
    var mp = S(ln.k), d = "", prev = null, dots = "";
    for (var i2 = a; i2 <= b; i2++) {
      var v2 = mp[mOf(i2)]; if (v2 == null) continue;
      if (ln.dots) { dots += '<circle cx="' + X(i2).toFixed(1) + '" cy="' + Y(v2).toFixed(1) + '" r="4" fill="#1C1C1E" stroke="' + ln.col + '" stroke-width="2"/>'; continue; }
      d += (prev != null && i2 - prev <= (ln.fc ? 15 : 4) ? "L" : "M") + X(i2).toFixed(1) + " " + Y(v2).toFixed(1);
      if (ln.fc && prev != null) dots += '<circle cx="' + X(i2).toFixed(1) + '" cy="' + Y(v2).toFixed(1) + '" r="2.2" fill="' + ln.col + '"/>';
      prev = i2;
    }
    if (d) o += '<path d="' + d + '" fill="none" stroke="' + ln.col + '" stroke-width="' + (ln.w || 2) + '" stroke-linejoin="round" stroke-linecap="round"' + (ln.fc ? ' stroke-dasharray="5 4"' : "") + (ln.piece ? ' stroke-opacity="0.8"' : "") + "/>";
    o += dots;
  });
  o += "</g>";
  if (CUR != null && CUR >= va && CUR <= vb) o += '<line x1="' + X(CUR) + '" x2="' + X(CUR) + '" y1="' + T + '" y2="' + B + '" stroke="#E5E5EA" stroke-width="1"/>';
  svg.setAttribute("viewBox", "0 0 " + W + " " + H);
  svg.style.height = H + "px";
  svg.innerHTML = o;
}
// each line's value at the touched month, or its latest
function legend(c) {
  var out = "", e = ownEnd(c.lines.filter(function (ln) { return !ln.fc; }));
  c.lines.forEach(function (ln) {
    if (c.chips && !Object.keys(S(ln.k)).length) return; // a source that didn't load: no chip
    var hit = CUR != null ? at(ln.k, CUR, ln.fc ? 0 : 2) : (function () { var li = lastI(ln.k); return li != null ? { v: S(ln.k)[mOf(li)], i: li } : null; })();
    var sw = ln.dots ? '<i class="dotk" style="background:' + ln.col + '"></i>' : ln.fc ? '<i class="dash" style="border-color:' + ln.col + '"></i>' : '<i style="background:' + ln.col + '"></i>';
    var val = hit ? fmtV(hit.v, c.unit) + (ln.fc && CUR == null ? " by " + mLab(hit.i) : "") : "–";
    out += '<span class="' + (hit ? "" : "off") + (HIDE[ln.k] ? " hid" : "") + '"' + (c.chips ? ' data-line="' + ln.k + '"' : "") + ">" + sw + esc(ln.label) + "<b>" + val + "</b></span>";
  });
  if (el(c.leg)) { el(c.leg).innerHTML = out; el(c.leg).className = "legend" + (c.chips ? " chips" : ""); }
  if (el(c.sub)) el(c.sub).textContent = CUR != null ? mLab(CUR) : e >= 0 ? "Latest, through " + mLab(e) : "";
}
function drawCharts() { charts().forEach(function (c) { draw(c); legend(c); }); }

function renderVerdict() {
  var G = D.sig || { list: [] }, col = DIRC[String(G.dir)];
  el("verdict").innerHTML = '<div class="arr" style="color:' + col + '">' + ARR[String(G.dir)] + '</div><div><div class="vt">' + esc(G.verdict || "Waiting for data") + '</div><div class="vc">' + esc(G.count || "") + '</div><div class="vn">A simple scorecard of ' + G.n + " signals, not a forecast. Tap a signal for its chart.</div></div>";
  el("sigs").innerHTML = G.list.map(function (sg, n) {
    return '<div class="sig' + (OPEN[sg.key] ? " open" : "") + '" data-k="' + sg.key + '"><div class="srow"><div class="a" style="color:' + DIRC[String(sg.dir)] + '">' + ARR[String(sg.dir)] + '</div><div class="t"><b>' + esc(sg.name) + "</b><div>" + esc(sg.note) + '</div></div><div class="v">' + esc(sg.value) + "<i>" + esc(sg.m ? mLab(idx(sg.m)) : "") + '</i></div><div class="chev">›</div></div>' +
      '<div class="sbody"><div class="bsub" id="gs' + n + '"></div><div class="legend" id="gl' + n + '"></div><div class="wrap"><svg class="chart small" id="g' + n + '"></svg><div class="touch" id="tg' + n + '"></div></div><div class="what">' + esc(sg.what) + "</div></div></div>";
  }).join("");
  bindAll();
}
function renderSched(rows, all) {
  var box = el("sched");
  rows = rows || [];
  if (!rows.length) { box.style.display = "none"; return; }
  var lateN = rows.filter(function (r) { return r.late; }).length, show = all ? rows : rows.slice(0, Math.max(3, lateN));
  box.innerHTML = '<div class="schedHead"><b>Release schedule</b><span>latest · next update (Central)</span></div>' +
    show.map(function (r) {
      var cls = r.late || r.due ? "late" : "";
      return '<div class="schedRow"><span class="schedName">' + esc(r.name) + (r.every ? "<i>" + esc(r.every) + "</i>" : "") + (r.late && r.why ? '<i class="why">' + esc(r.why) + "</i>" : "") +
        '</span><span class="schedLast">' + esc(r.last) + '</span><span class="schedNext"><span class="' + cls + '">' + esc(r.main) + "</span>" + (r.sub ? "<i>" + esc(r.sub) + "</i>" : "") + "</span></div>";
    }).join("") +
    (rows.length > show.length || all ? '<div class="schedMore" id="schedMore">' + (all ? "Show fewer" : "All " + rows.length + " sources") + "</div>" : "");
  var mo = el("schedMore");
  if (mo) mo.onclick = function () { renderSched(D.sched, !all); };
}
// the details: every source in plain words
function renderTables() {
  var f = D.fomc || {};
  function lv(k) { var li = lastI(k); return li == null ? null : { v: S(k)[mOf(li)], m: mOf(li), i: li }; }
  function mm(x) { return x ? MON[+x.m.slice(5, 7) - 1] + " " + x.m.slice(0, 4) : ""; }
  var u1 = lv("umich1"), u5 = lv("umich5"), n1 = lv("sce1"), n5 = lv("sce5"), p1 = lv("spf1"), p10 = lv("spf10"), c1 = lv("clev1"), c10 = lv("clev10");
  var rows = [
    ["Consumers", "University of Michigan survey", u1, u5, "5 to 10 years", mm(u1)],
    ["Consumers", "NY Fed survey", n1, n5, "5 years", mm(n1)],
    ["Economists", "Philadelphia Fed survey, CPI", p1, p10, "10 years", p1 ? quarterOf(p1.m) : ""],
    ["Market-based model", "Cleveland Fed", c1, c10, "10 years", mm(c1)],
    ["The Fed's own projection", "FOMC median, PCE prices", f.one != null ? { v: f.one } : null, f.lr != null ? { v: f.lr } : null, "longer run", f.date ? MON[+f.date.slice(5, 7) - 1] + " " + (+f.date.slice(8, 10)) : ""]
  ];
  var h = "<tr><th>Expected inflation</th><th>Next year</th><th>Long run</th><th>As of</th></tr>";
  rows.forEach(function (r) { h += '<tr><td class="src">' + esc(r[0]) + "<small>" + esc(r[1]) + '</small></td><td class="v">' + (r[2] ? pct(r[2].v) : "–") + '</td><td class="v">' + (r[3] ? pct(r[3].v) : "–") + "<small>" + esc(r[4]) + "</small></td><td>" + esc(r[5]) + "</td></tr>"; });
  h += "<tr><th style='text-align:left;padding-top:14px'>Prices now</th><th>vs a year ago</th><th></th><th></th></tr>";
  [["Consumer prices (CPI)", "cpi", ""], ["CPI without food and energy", "ccpi", "core"], ["PCE prices", "pce", "the Fed's preferred gauge"], ["PCE without food and energy", "cpce", "core"]].forEach(function (r) {
    var x = lv(r[1]); h += '<tr><td class="src">' + r[0] + (r[2] ? "<small>" + r[2] + "</small>" : "") + '</td><td class="v">' + (x ? pct(x.v) : "–") + "</td><td></td><td>" + mm(x) + "</td></tr>";
  });
  el("tbl").innerHTML = h;
  var pr = [["Hourly pay", "ahe", "private workers"], ["Wage costs", "eci", "Employment Cost Index, quarterly"], ["Typical worker's raise", "atl", "Atlanta Fed tracker"], ["Oil", "wti", "West Texas crude"], ["Gasoline", "gas", "regular, weekly"], ["Natural gas", "ng", "Henry Hub"],
    ["Producer prices", "ppi", "final demand"], ["Import prices", "imp", ""], ["Supply-chain pressure", "gscpi", "NY Fed index; 0 is normal"], ["Shelter in CPI", "shelter", ""], ["Rent in CPI", "rent", ""], ["Rents on new leases", "zori", "Zillow"]];
  var g = "<tr><th style='text-align:left;padding-top:14px'>Pressures</th><th>Now</th><th>6 mo ago</th><th>As of</th></tr>";
  pr.forEach(function (r) {
    var x = lv(r[1]), unit = r[1] === "gscpi" ? "sd" : "", then = x ? at(r[1], x.i - 6, r[1] === "eci" ? 2 : 0) : null;
    g += '<tr><td class="src">' + esc(r[0]) + (r[2] ? "<small>" + esc(r[2]) + "</small>" : "") + '</td><td class="v">' + (x ? fmtV(x.v, unit) : "–") + "</td><td>" + (then ? fmtV(then.v, unit) : "–") + "</td><td>" + mm(x) + "</td></tr>";
  });
  el("ptbl").innerHTML = g;
}
window.__takeOpen = function () { var u = window.__openUrl; window.__openUrl = null; return u || null; };
function renderFed() {
  var F = D.fed, box = el("fed");
  if (!F) { box.style.display = "none"; return; }
  box.style.display = "";
  var rows = [];
  (F.next || []).forEach(function (m, k) {
    var sameMonth = m.start.slice(0, 7) === m.end.slice(0, 7);
    var span = MON[+m.start.slice(5, 7) - 1] + " " + (+m.start.slice(8, 10)) + "–" + (sameMonth ? "" : MON[+m.end.slice(5, 7) - 1] + " ") + (+m.end.slice(8, 10));
    var bits = (m.sep ? "With projections (the dot plot) and a press conference" : m.likelySep ? "Press conference; projections likely (not yet marked by the Fed)" : "Press conference") + "; decision " + dayName(m.end) + ", 1:00p CT";
    rows.push('<div class="fedRow"><div class="when">' + span + "<i>" + m.start.slice(0, 4) + '</i></div><div class="what2">' + (k ? "Following FOMC meeting" : "Next FOMC meeting") + "<i>" + esc(bits) + "</i></div></div>");
  });
  if (F.minutes) rows.push('<div class="fedRow"><div class="when">' + dayName(F.minutes.date) + "<i>" + (F.minutes.est ? "about, " : "") + '1:00p CT</i></div><div class="what2">Minutes of the ' + MON[+F.minutes.of.slice(5, 7) - 1] + " meeting<i>" + (F.minutes.est ? "Usually three weeks after the meeting" : "Scheduled") + "</i></div></div>");
  (F.speeches || []).forEach(function (x) {
    rows.push('<div class="fedRow"><div class="when">' + dayName(x.date) + "<i>" + esc(x.ct || "time not posted") + '</i></div><div class="what2">' + esc(x.who) + (x.kind && !/^speech$/i.test(x.kind) ? " (" + esc(x.kind.toLowerCase()) + ")" : "") + "<i>" + esc([x.topic, x.event].filter(Boolean).join(" · ")) + "</i></div></div>");
  });
  if (!(F.speeches || []).length) rows.push('<div class="fedRow"><div class="what2"><i>' + (F.err ? "Couldn't read the Fed's speaking calendar. " : "No Fed Board speeches posted for the rest of this month or next. ") + '<span class="fedLink" data-open="' + esc(F.cal) + '">Open the Fed calendar</span></i></div></div>');
  box.innerHTML = '<div class="fedHead"><b>Fed calendar</b><span>meetings · minutes · Board speeches (Central)</span></div>' + rows.join("");
}
function renderSegs() { Array.prototype.forEach.call(document.querySelectorAll("#segs span[data-r]"), function (s) { s.className = !VIEW && +s.getAttribute("data-r") === PRESET ? "on" : ""; }); }
function renderAll() {
  renderFed();
  renderSched(D.sched, false);
  renderVerdict();
  renderSegs();
  drawCharts();
  renderTables();
  el("note").textContent = "How the scorecard works: each signal points up, down or sideways by a simple rule, and the verdict is whichever way at least two more signals point. It's a way to read the data, not a forecast. " +
    "Today's inflation: CPI's last 3 months at an annual pace vs the past 12 months (sideways within 0.3 points). What people expect: the average next-year expectation vs CPI now (within 0.3). Wages and producer prices: now vs 6 months ago (within 0.2 and 0.3). Oil: up or down more than 5% from a year ago. " +
    "Rents on new leases: vs rent in CPI (within 0.5). Long-run expectations: now vs a year ago (within 0.2). Supply chains: more than half a standard deviation from normal. " +
    "Sources: University of Michigan Surveys of Consumers; New York Fed Survey of Consumer Expectations and Global Supply Chain Pressure Index; Philadelphia Fed Survey of Professional Forecasters; Cleveland Fed inflation expectations; Federal Reserve projections; BLS (CPI, pay, wage costs, producer and import prices); Atlanta Fed Wage Growth Tracker; EIA (oil, gasoline, natural gas); BEA (PCE); Zillow Observed Rent Index. Most via FRED." +
    (D.umichFromFred ? " Michigan's own table didn't load, so its line is FRED's copy, a month behind." : "") +
    (D.pressMiss && D.pressMiss.length ? " Didn't load: " + D.pressMiss.join("; ") + "." : "") +
    (D.updated ? " Updated " + D.updated + "." : "");
}

document.addEventListener("click", function (e) {
  var t = e.target;
  if (!t || !t.closest) return;
  var ch = t.closest("[data-line]");
  if (ch) { var lk = ch.getAttribute("data-line"); HIDE[lk] = !HIDE[lk]; drawCharts(); return; }
  var op = t.closest("[data-open]");
  if (op) { window.__openUrl = op.getAttribute("data-open"); return; }
  var r = t.closest("[data-r]");
  if (r) { PRESET = +r.getAttribute("data-r"); VIEW = null; CUR = null; renderSegs(); drawCharts(); return; }
  var row = t.closest(".srow");
  if (row) { var k = row.parentNode.getAttribute("data-k"); OPEN[k] = !OPEN[k]; row.parentNode.className = "sig" + (OPEN[k] ? " open" : ""); drawCharts(); }
});

// One finger reads a month on every chart. Two fingers pinch to zoom the dates and drag to pan,
// on any chart, and all charts follow. Double-tap goes back to the selected 2Y / 5Y / 10Y.
var fingers = {}, pinch = null, pinchLock = false, lastTap = null, tapDown = null, activeId = null, rafId = 0;
function fingerList() { return Object.keys(fingers).map(function (k) { return fingers[k]; }); }
function posAt(id, x) {
  var g = GEO[id]; if (!g) return { f: 0.5, pos: 0 };
  var r = el(id).getBoundingClientRect(), f = (x - r.left - g.L) / Math.max(1, g.R - g.L);
  return { f: f, pos: g.a + f * (g.b - g.a) };
}
function readAt(id, x) { var g = GEO[id]; if (!g) return; CUR = Math.max(Math.ceil(g.a), Math.min(Math.floor(g.b), Math.round(posAt(id, x).pos))); drawCharts(); }
function two() { var f = fingerList(), dx = f[0].x - f[1].x, dy = f[0].y - f[1].y; return { dist: Math.max(10, Math.sqrt(dx * dx + dy * dy)), mid: (f[0].x + f[1].x) / 2 }; }
function onDown(id, e) {
  fingers[e.pointerId] = { x: e.clientX, y: e.clientY };
  var n = fingerList().length;
  if (n === 1) activeId = id;
  if (n === 2) {
    var st = two(), V = viewNow();
    pinch = { dist: st.dist, span: V.b - V.a, anchor: posAt(activeId, st.mid).pos };
    pinchLock = true; tapDown = null; lastTap = null; CUR = null;
  } else if (n === 1 && !pinchLock) {
    var now = Date.now();
    // the second tap of a double-tap: acted on when the finger lifts, so a pinch that starts right after a tap doesn't reset the view
    if (lastTap && now - lastTap.t < 320 && Math.abs(e.clientX - lastTap.x) < 30) { tapDown = { t: now, x: e.clientX }; return; }
    lastTap = { t: now, x: e.clientX };
    readAt(id, e.clientX);
  }
}
function onMove(id, e) {
  if (!fingers[e.pointerId]) return;
  fingers[e.pointerId] = { x: e.clientX, y: e.clientY };
  if (pinch && fingerList().length >= 2) {
    var st = two(), span = pinch.span * pinch.dist / st.dist, a = pinch.anchor - posAt(activeId, st.mid).f * span;
    VIEW = clampView(a, a + span);
    if (!rafId) rafId = requestAnimationFrame(function () { rafId = 0; drawCharts(); renderSegs(); });
  } else if (!pinchLock && !tapDown) readAt(activeId || id, e.clientX);
}
function onUp(id, e) {
  if (!fingers[e.pointerId]) return;
  delete fingers[e.pointerId];
  var n = fingerList().length;
  if (n < 2) pinch = null;
  if (n === 0) {
    if (tapDown && !pinchLock && e.type !== "pointercancel" && Date.now() - tapDown.t < 450 && Math.abs(e.clientX - tapDown.x) < 30) { VIEW = null; CUR = null; lastTap = null; renderSegs(); drawCharts(); }
    tapDown = null; pinchLock = false;
  }
}
function bind(id) {
  var t = el("t" + id);
  if (!t || t.__bound) return;
  t.__bound = true;
  t.addEventListener("pointerdown", function (e) { onDown(id, e); });
  t.addEventListener("pointermove", function (e) { onMove(id, e); });
  ["pointerup", "pointercancel", "pointerleave"].forEach(function (ev) { t.addEventListener(ev, function (e) { onUp(id, e); }); });
}
function bindAll() { bind("c1"); SG().forEach(function (sg, n) { bind("g" + n); }); }
document.addEventListener("gesturestart", function (e) { e.preventDefault(); });
window.addEventListener("resize", drawCharts);
window.setStatus = function (t) { el("status").textContent = t || ""; };
window.update = function (nd) { D = nd; if (VIEW) VIEW = clampView(VIEW.a, VIEW.b); renderAll(); };
window.shareInfo = function () { var d = new Date(); return { title: "Inflation", name: "", asOf: MON[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear() }; };

// ---------- Share as PDF: two 16:9 slides ----------
// 1) The verdict: the main chart and the scorecard. 2) The two signals moving most.
window.printPdf = function (jsPDF, fonts) {
  var W = 792, H = 445.5;
  var doc = new jsPDF({ unit: "pt", format: [W, H], orientation: "landscape" });
  var FACE = "helvetica";
  if (fonts && fonts.regular && fonts.bold) {
    doc.addFileToVFS("Narrow-Regular.ttf", fonts.regular); doc.addFont("Narrow-Regular.ttf", "Narrow", "normal");
    doc.addFileToVFS("Narrow-Bold.ttf", fonts.bold); doc.addFont("Narrow-Bold.ttf", "Narrow", "bold");
    FACE = "Narrow";
  }
  var INK = [28, 28, 30], GRY = [110, 110, 115], RULE = [222, 222, 226];
  var PC = { "#FFFFFF": [28, 28, 30], "#98989F": [140, 140, 146], "#FF9F0A": [214, 120, 0], "#FFD60A": [184, 140, 0], "#64D2FF": [0, 119, 200], "#30D158": [30, 150, 69], "#FF6482": [215, 40, 90], "#BF5AF2": [142, 59, 184], "#E5E5EA": [60, 60, 66] };
  var PDIR = { "-1": [0, 119, 200], "0": [130, 130, 136], "1": [214, 120, 0] };
  function font(bold, size, c) { doc.setFont(FACE, bold ? "bold" : "normal"); doc.setFontSize(size); doc.setTextColor(c[0], c[1], c[2]); }
  function rgb(hex) { return PC[hex] || INK; }
  function clean(t) { return String(t).split("’").join("'").split("–").join("-").split("—").join("-").split("·").join("-"); }
  var G = D.sig || { list: [] }, PV = viewNow(), a = Math.ceil(PV.a), b = Math.floor(PV.b);
  var B_END = b;
  function headline(text) {
    var size = 21, lines;
    do { font(true, size, INK); lines = doc.splitTextToSize(clean(text), W - 72); size -= 1; } while (lines.length > 1 && size > 15);
    doc.text(lines.slice(0, 2), 36, 42);
    return lines.length > 1 ? 18 : 0;
  }
  function titles(x0, x1, top, title, sub) { var cx = (x0 + x1) / 2; font(true, 11.5, INK); doc.text(clean(title), cx, top + 30, { align: "center" }); font(false, 9.5, GRY); doc.text(doc.splitTextToSize(clean(sub), x1 - x0).slice(0, 2), cx, top + 43, { align: "center" }); }
  function banner(page) {
    var bh = 44, bY = H - bh;
    doc.setFillColor(28, 28, 30); doc.rect(0, bY, W, bh, "F");
    doc.setFillColor(201, 162, 39); doc.rect(W - 176, bY + 6, 2, bh - 12, "F");
    font(false, 7.2, [235, 235, 240]);
    var src = "Sources: University of Michigan; New York Fed (consumer survey, supply-chain index); Philadelphia Fed (economists' survey); Cleveland Fed (market-based model); BLS (CPI, pay, producer and import prices); Atlanta Fed (wage tracker); EIA (oil, gasoline); Zillow (new-lease rents); mostly via FRED. " +
      "The scorecard is a simple reading of the data, not a forecast.";
    doc.text(doc.splitTextToSize(src, W - 176 - 40 - 110), 28, bY + 15);
    font(false, 7.5, [200, 200, 205]);
    doc.text("As of " + window.shareInfo().asOf, W - 188, bY + 20, { align: "right" });
    doc.text(page + " of 2", W - 188, bY + 31, { align: "right" });
    font(true, 12.5, [255, 255, 255]);
    doc.text("Inflation", W - 162, bY + 20);
    doc.text("Scorecard", W - 162, bY + 34);
  }
  function lineChart(L, R, Tt, B, c) {
    var vals = [], b0 = B_END, lines = c.lines.filter(function (ln) { return !HIDE[ln.k] && Object.keys(S(ln.k)).length; });
    var b = b0, tI = todayI();
    if (c.future && b0 >= endAll() - 1) { var fe = -1; lines.forEach(function (ln) { if (ln.fc) { var x = lastI(ln.k); if (x != null && x > fe) fe = x; } }); if (fe > b0) b = Math.min(fe + 2, b0 + Math.max(12, Math.min(30, b0 - a))); }
    c = { lines: lines, target: c.target, unit: c.unit, future: c.future };
    lines.forEach(function (ln) { var m = S(ln.k); for (var i = a; i <= b; i++) if (m[mOf(i)] != null) vals.push(m[mOf(i)]); });
    if (c.target != null) vals.push(c.target);
    if (!vals.length) return;
    var lx = L;
    // the key, wrapping as needed; the chart starts below it
    var row = 0, items = [];
    lines.forEach(function (ln) { var lab = clean(ln.label); font(true, 7.5, INK); var w = doc.getTextWidth(lab) + 22; if (lx + w > R + 4 && lx > L) { lx = L; row++; } items.push({ ln: ln, lab: lab, x: lx, row: row }); lx += w; });
    items.forEach(function (it) { var col = rgb(it.ln.col), yy = Tt - 22 + it.row * 9; font(true, 7.5, INK); doc.setFillColor(col[0], col[1], col[2]); if (it.ln.fc) { doc.rect(it.x, yy - 3, 3, 2, "F"); doc.rect(it.x + 5, yy - 3, 3, 2, "F"); } else doc.rect(it.x, yy - 3.5, 9, 3, "F"); doc.text(it.lab, it.x + 12, yy); });
    Tt += row * 9;
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), st = niceStep(hi - lo, c.unit);
    lo = Math.floor((lo - 0.1) / st) * st; hi = Math.ceil((hi + 0.1) / st) * st;
    var X = function (i) { return L + (i - a) / Math.max(1, b - a) * (R - L); }, Y = function (v) { return B - (v - lo) / (hi - lo) * (B - Tt); };
    if (c.future && tI < b) { var tx = Math.max(L, X(tI)); doc.setFillColor(242, 242, 245); doc.rect(tx, Tt, R - tx, B - Tt, "F"); doc.setDrawColor(INK[0], INK[1], INK[2]); doc.setLineWidth(0.8); doc.line(tx, Tt, tx, B); font(true, 7.5, INK); doc.text("Today", tx - 3, Tt + 9, { align: "right" }); doc.text("Forecasts", tx + 3, Tt + 9); }
    doc.setLineWidth(0.5);
    for (var v = lo; v <= hi + st / 2; v += st) { doc.setDrawColor(RULE[0], RULE[1], RULE[2]); doc.line(L, Y(v), R, Y(v)); font(false, 8.5, GRY); doc.text(fmtAxis(v, st, c.unit), L - 5, Y(v) + 3, { align: "right" }); }
    var ev = every(b - a), lastX = -99;
    for (var i = a; i <= b; i++) { var lab = dateLab(mOf(i), ev); if (lab && X(i) - lastX > 30) { doc.setDrawColor(150, 150, 155); doc.line(X(i), B, X(i), B + 3); font(false, 8.5, GRY); doc.text(lab, X(i), B + 13, { align: "center" }); lastX = X(i); } }
    if (c.target != null) { doc.setDrawColor(INK[0], INK[1], INK[2]); doc.setLineWidth(0.9); doc.setLineDashPattern([4, 3], 0); doc.line(L, Y(c.target), R, Y(c.target)); doc.setLineDashPattern([], 0); font(true, 8, INK); doc.text(c.unit === "sd" ? "normal" : "Fed's 2% target", R - 2, Y(c.target) - 4, { align: "right" }); }
    if (doc.setLineCap) doc.setLineCap("round");
    lines.slice().reverse().forEach(function (ln) {
      var col = rgb(ln.col), mp = S(ln.k), prev = null;
      doc.setDrawColor(col[0], col[1], col[2]); doc.setLineWidth((ln.w || 2) > 2.1 ? 1.8 : ln.piece ? 0.9 : 1.4);
      if (ln.fc) doc.setLineDashPattern([3, 2], 0);
      for (var i2 = a; i2 <= b; i2++) {
        var v2 = mp[mOf(i2)]; if (v2 == null) continue;
        if (ln.dots) { doc.setFillColor(255, 255, 255); doc.circle(X(i2), Y(v2), 2.6, "FD"); continue; }
        if (prev != null && i2 - prev <= (ln.fc ? 15 : 4)) doc.line(X(prev), Y(mp[mOf(prev)]), X(i2), Y(v2));
        prev = i2;
      }
      doc.setLineDashPattern([], 0);
    });
    if (doc.setLineCap) doc.setLineCap("butt");
  }
  // an arrow drawn as a small triangle (fonts lack arrow glyphs)
  function arrow(x, y, dir, c) {
    doc.setFillColor(c[0], c[1], c[2]);
    if (dir > 0) doc.triangle(x, y + 4, x + 8, y + 4, x + 4, y - 4, "F");
    else if (dir < 0) doc.triangle(x, y - 4, x + 8, y - 4, x + 4, y + 4, "F");
    else doc.triangle(x, y - 4, x, y + 4, x + 8, y, "F");
  }

  // ---- 1. The verdict ----
  var verb = G.dir < 0 ? "Inflation Looks Set to Cool: " : G.dir > 0 ? "Inflation Looks Set to Pick Up: " : "Inflation Looks Steady: ";
  var cnt = G.dir < 0 ? G.down + " of " + G.n + " Signals Point Lower" : G.dir > 0 ? G.up + " of " + G.n + " Signals Point Higher" : "Signals Are Split (" + G.up + " Higher, " + G.down + " Lower)";
  var dy = headline(verb + cnt);
  var L1 = 54, R1 = 420, T1 = 132 + dy, B1 = H - 96, L2 = 452, R2 = W - 36;
  titles(L1, R1, 56 + dy, "Inflation Now vs What People Expect", "% vs a year earlier, " + mLab(a) + " to " + mLab(b));
  lineChart(L1, R1, T1, B1, { lines: MAIN });
  titles(L2, R2, 56 + dy, "The Scorecard", "Which way each signal points");
  var rh = Math.min(30, (B1 - T1 + 26) / Math.max(1, G.list.length)), y0 = T1 - 16;
  G.list.forEach(function (sg, k) {
    var y = y0 + k * rh, c = PDIR[String(sg.dir)];
    arrow(L2, y + 4, sg.dir, c);
    font(true, 9.5, INK); doc.text(clean(sg.name), L2 + 14, y + 7);
    font(true, 9.5, c); doc.text(clean(sg.value), R2, y + 7, { align: "right" });
    font(false, 7.6, GRY); doc.text(doc.splitTextToSize(clean(sg.note), R2 - L2 - 14)[0], L2 + 14, y + 17);
  });
  banner(1);

  // ---- 2. The two signals moving most ----
  doc.addPage([W, H], "landscape");
  var top2 = G.list.filter(function (sg) { return sg.dir !== 0; }).sort(function (p, q) { return q.strength - p.strength; }).slice(0, 2);
  if (top2.length < 2) top2 = G.list.slice().sort(function (p, q) { return q.strength - p.strength; }).slice(0, 2);
  dy = headline(top2.length ? "What's Moving Most: " + top2.map(function (sg) { return sg.short; }).join("; ") : "What's Moving Most");
  var cols = [[54, 372], [444, W - 36]];
  top2.forEach(function (sg, k) {
    titles(cols[k][0], cols[k][1], 50 + dy, sg.name, sg.note);
    lineChart(cols[k][0], cols[k][1], 138 + dy, H - 104, sg);
    font(false, 7.6, GRY); doc.text(doc.splitTextToSize(clean(sg.what), cols[k][1] - cols[k][0]).slice(0, 2), cols[k][0], H - 70);
  });
  banner(2);
  return doc;
};

try { renderAll(); } catch (e) { el("status").textContent = "Page error: " + (e && e.message || e); }
window.__drawn = true; // the widget checks this, and reloads a page that never drew
</script>
__SHARE__
</body>
</html>`;

// ---------- Sharing the full-screen view as a light, printable PDF ----------
// The page itself builds the PDF: tapping Share downloads two open-source
// tools from cdnjs (html2canvas and jsPDF, falling back to jsDelivr), redraws
// the view in light colors off-screen with smaller headers and shorter charts,
// widened as needed so it fills the full width of one portrait letter page,
// and captures it at up to 3x. This script then saves the PDF and offers
// Email, Preview & share, or Save to Files.
// Note: the page code below avoids backticks, backslashes and dollar-brace
// on purpose, because it lives inside a template literal.
const SHARE_PAGE_JS = `
(function () {
  var LIB_H2C = ["https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
                 "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"];
  var LIB_PDF = ["https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
                 "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js"];
  // Dark-screen colors and their print versions. Lines that are white or pale
  // on the phone turn dark; the current year in overlays becomes the darkest.
  var MAP = {
    "#FFFFFF": "#111111", "#3A3A3C": "#DDDDDD", "#48484A": "#C8C8C8", "#636366": "#999999",
    "#98989F": "#666666", "#8E8E93": "#777777", "#1C1C1E": "#FFFFFF", "#232325": "#FFFFFF",
    "#2C2C2E": "#F2F2F2", "#E5E5EA": "#333333",
    "#A9CCFF": "#0B3D91", "#CFE2FF": "#0B3D91", "#6A9CE6": "#2F5A93", "#5A8FDB": "#5A86C4",
    "#4377C2": "#7EA2D6", "#2F5A93": "#A3BEE6", "#22406A": "#C6D6EF",
    "#64A8FF": "#0A62D0", "#64D2FF": "#0077C8", "#FFD60A": "#B38600", "#30D5C8": "#12968C",
    "#30D158": "#1E9E45", "#FF453A": "#D70015", "#FF9F0A": "#C26A00", "#BF5AF2": "#8E3BB8",
    "#AC8E68": "#8A6D45"
  };

  var css = "body{position:relative}" +
    "#shareBtn{position:absolute;top:18px;right:16px;display:flex;align-items:center;border:0;border-radius:16px;" +
    "padding:7px 12px;background:#2C2C2E;color:#FFFFFF;font:inherit;font-size:14px;font-weight:600;z-index:5}" +
    "#shareBtn svg{margin-right:6px}" +
    ".ticker,.name{padding-right:104px}" +
    ".print{--bg:#FFFFFF;--fg:#111111;--gray:#666666;--rule:#DDDDDD;background:#FFFFFF;color:#111111}" +
    ".print .ticker,.print .name{padding-right:150px}" +
    ".printHead{position:relative;min-height:40px}" +
    ".printStamp{position:absolute;top:2px;right:0;text-align:right;font-size:9.5px;line-height:1.5;color:#666666}" +
    ".print .ticker{font-size:20px}.print .name{font-size:12px;margin-top:1px}" +
    ".print .valrow{margin-top:8px}.print .value{font-size:32px}.print .change{font-size:14px}" +
    ".print .h2{font-size:15px;margin:16px 0 8px}" +
    ".print .panel,.print .block{margin-top:12px}" +
    ".print .ptitle b{font-size:13px}.print .ptitle .val{font-size:15px}" +
    ".print .head .title{font-size:14px}.print .head .value{font-size:22px}" +
    ".print .month,.print .week{font-size:12px;margin-top:6px}" +
    ".print .note{font-size:10px}" +
    "body.printing svg.chart{height:120px !important}" +
    "body.printing #chart{height:230px !important}" +
    ".printCols{display:flex;align-items:flex-start}" +
    ".printCol{flex:none}" +
    ".printCol + .printCol{margin-left:24px}" +
    ".printFoot .note{margin-top:10px}";
  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  var btn = document.createElement("button");
  btn.id = "shareBtn";
  btn.type = "button";
  btn.innerHTML = '<svg width="13" height="15" viewBox="0 0 13 15" aria-hidden="true">' +
    '<path d="M6.5 1v8.5M3 4.3 6.5 1 10 4.3" fill="none" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M3.5 7H2v7h9V7H9.5" fill="none" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
    '<span id="shareLabel">Share</span>';
  document.body.appendChild(btn);
  function label(t) { var s = document.getElementById("shareLabel"); if (s) s.textContent = t; }

  function loadScript(urls) {
    return new Promise(function (resolve, reject) {
      var i = 0;
      function next() {
        if (i >= urls.length) { reject(new Error("Couldn't download the PDF tools. Check the connection and try again.")); return; }
        var s = document.createElement("script"), done = false;
        var timer = setTimeout(function () { if (!done) { done = true; next(); } }, 15000);
        s.src = urls[i++];
        s.onload = function () { if (!done) { done = true; clearTimeout(timer); resolve(); } };
        s.onerror = function () { if (!done) { done = true; clearTimeout(timer); next(); } };
        document.head.appendChild(s);
      }
      next();
    });
  }
  // The narrow font for custom layouts, downloaded at share time. If it can't be
  // fetched, the layout falls back to a built-in sans instead of failing.
  var FONT_REG = ["https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/ibmplexsanscondensed/IBMPlexSansCondensed-Regular.ttf",
                  "https://raw.githubusercontent.com/google/fonts/main/ofl/ibmplexsanscondensed/IBMPlexSansCondensed-Regular.ttf"];
  var FONT_BOLD = ["https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/ibmplexsanscondensed/IBMPlexSansCondensed-SemiBold.ttf",
                   "https://raw.githubusercontent.com/google/fonts/main/ofl/ibmplexsanscondensed/IBMPlexSansCondensed-SemiBold.ttf"];
  var fontCache = null;
  function fetchB64(urls) {
    var i = 0;
    function next() {
      if (i >= urls.length || !window.fetch) return Promise.resolve(null);
      return window.fetch(urls[i++])
        .then(function (r) { return r.ok ? r.arrayBuffer() : Promise.reject(new Error("bad response")); })
        .then(function (buf) {
          var bytes = new Uint8Array(buf), bin = "";
          for (var k = 0; k < bytes.length; k += 32768) bin += String.fromCharCode.apply(null, bytes.subarray(k, k + 32768));
          return window.btoa(bin);
        })
        .catch(next);
    }
    return next();
  }
  function loadFonts() {
    if (fontCache) return Promise.resolve(fontCache);
    return Promise.all([fetchB64(FONT_REG), fetchB64(FONT_BOLD)]).then(function (r) {
      fontCache = r[0] && r[1] ? { regular: r[0], bold: r[1] } : null;
      return fontCache;
    });
  }
  function readyPdf() {
    return window.jspdf && window.jspdf.jsPDF ? Promise.resolve() : loadScript(LIB_PDF);
  }
  function ready() {
    var p = Promise.resolve();
    if (!window.html2canvas) p = p.then(function () { return loadScript(LIB_H2C); });
    if (!(window.jspdf && window.jspdf.jsPDF)) p = p.then(function () { return loadScript(LIB_PDF); });
    return p;
  }

  function hexOf(c) {
    if (!c) return null;
    c = String(c).trim();
    if (c.charAt(0) === "#") {
      if (c.length === 4) c = "#" + c.charAt(1) + c.charAt(1) + c.charAt(2) + c.charAt(2) + c.charAt(3) + c.charAt(3);
      return c.length === 7 ? c.toUpperCase() : null;
    }
    if (c.indexOf("rgb") === 0) {
      var parts = c.slice(c.indexOf("(") + 1, c.indexOf(")")).split(",");
      var h = "#";
      for (var i = 0; i < 3; i++) {
        var n = Math.max(0, Math.min(255, parseInt(parts[i], 10) || 0)).toString(16).toUpperCase();
        h += n.length < 2 ? "0" + n : n;
      }
      return h;
    }
    return null;
  }
  function recolor(root) {
    var all = root.querySelectorAll("*");
    for (var i = 0; i < all.length; i++) {
      var e = all[i], attrs = ["fill", "stroke", "stop-color"];
      for (var a = 0; a < attrs.length; a++) {
        var h = hexOf(e.getAttribute(attrs[a]));
        if (h && MAP[h]) e.setAttribute(attrs[a], MAP[h]);
      }
      if (e.style) {
        var c1 = hexOf(e.style.color); if (c1 && MAP[c1]) e.style.color = MAP[c1];
        var c2 = hexOf(e.style.backgroundColor); if (c2 && MAP[c2]) e.style.backgroundColor = MAP[c2];
      }
    }
  }
  // Copies must not reuse the live page's ids. Inside charts the ids are
  // renamed (gradients and clipping refer to them); elsewhere they're removed.
  function uniquify(root) {
    var all = root.querySelectorAll("[id]");
    for (var i = 0; i < all.length; i++) {
      var e = all[i];
      if (e.closest && e.closest("svg")) e.setAttribute("id", "p_" + e.getAttribute("id"));
      else e.removeAttribute("id");
    }
    var refs = root.querySelectorAll("[fill], [stroke], [clip-path]");
    for (var j = 0; j < refs.length; j++) {
      ["fill", "stroke", "clip-path"].forEach(function (a) {
        var v = refs[j].getAttribute(a);
        if (v && v.indexOf("url(#") === 0) refs[j].setAttribute(a, "url(#p_" + v.slice(5));
      });
    }
  }
  function visible(el) {
    var cs = window.getComputedStyle ? window.getComputedStyle(el) : null;
    return !(cs && cs.display === "none");
  }
  // Copy a block without its touch layers and cursors. Charts keep the exact
  // size they were just drawn at.
  function cleanCopy(el) {
    var c = el.cloneNode(true);
    var live = el.querySelectorAll("svg"), copies = c.querySelectorAll("svg");
    for (var n = 0; n < copies.length && n < live.length; n++) {
      copies[n].style.height = live[n].getBoundingClientRect().height + "px";
      copies[n].style.width = "100%";
    }
    var drop = c.querySelectorAll(".touch, #touch, [id^='cur'], .seg, .hint, button");
    for (var d = 0; d < drop.length; d++) if (drop[d].parentNode) drop[d].parentNode.removeChild(drop[d]);
    return c;
  }
  // The page's title, its content blocks, and its notes, copied from the live view
  function collect() {
    var head = document.createElement("div"), foot = document.createElement("div"), blocks = [];
    head.className = "printHead";
    foot.className = "printFoot";
    var kids = document.body.children;
    for (var i = 0; i < kids.length; i++) {
      var k = kids[i], cl = k.classList;
      if (k.tagName === "SCRIPT" || k.tagName === "STYLE" || k.id === "shareBtn" || !visible(k)) continue;
      if (cl && (cl.contains("hint") || cl.contains("seg") || cl.contains("print"))) continue;
      if (cl && (cl.contains("ticker") || cl.contains("name"))) { head.appendChild(cleanCopy(k)); continue; }
      if (cl && cl.contains("note")) { foot.appendChild(cleanCopy(k)); continue; }
      if (k.id === "panels" || k.id === "blocks") {
        for (var j = 0; j < k.children.length; j++) if (visible(k.children[j])) blocks.push(cleanCopy(k.children[j]));
        continue;
      }
      blocks.push(cleanCopy(k));
    }
    return { head: head, foot: foot, blocks: blocks };
  }
  function sheetFrom(parts, width, info) {
    var sheet = document.createElement("div");
    sheet.className = "print";
    sheet.setAttribute("style", "position:absolute;left:-10000px;top:0;padding:18px 18px 20px;box-sizing:border-box;width:" + width + "px");
    var stamp = document.createElement("div");
    stamp.className = "printStamp";
    stamp.innerHTML = "Data through " + info.asOf + "<br>Snapshot " + new Date().toLocaleString();
    parts.head.appendChild(stamp);
    var col = document.createElement("div");
    col.className = "printCol";
    for (var i = 0; i < parts.blocks.length; i++) col.appendChild(parts.blocks[i]);
    sheet.appendChild(parts.head);
    sheet.appendChild(col);
    sheet.appendChild(parts.foot);
    document.body.appendChild(sheet);
    return sheet;
  }
  // Redraw the live charts with the PDF's chart heights at a given page width
  // (0 = the phone's own width), or put them back.
  function redrawAt(width) {
    document.body.classList.add("printing");
    document.body.style.width = width ? width + "px" : "";
    window.dispatchEvent(new Event("resize"));
  }
  function restore() {
    document.body.classList.remove("printing");
    document.body.style.width = "";
    window.dispatchEvent(new Event("resize"));
  }
  // One portrait page that always fills the page width: measure the view at
  // the phone's width, then widen it just enough that its height fits the page
  // at full width, redraw the charts at that width, and capture.
  var PAGE_W = 540, PAGE_H = 720, MIN_W = 460; // points; letter minus half-inch margins
  function makePdf(info) {
    var phoneW = document.body.clientWidth || 390, sheet = null, W = MIN_W;
    try {
      redrawAt(0);
      var probe = sheetFrom(collect(), phoneW, info);
      var tall = probe.scrollHeight || 800;
      probe.parentNode.removeChild(probe);
      W = Math.max(MIN_W, phoneW, Math.ceil((tall * PAGE_W) / PAGE_H));
      redrawAt(W);
      sheet = sheetFrom(collect(), W, info);
    } finally {
      restore();
    }
    recolor(sheet);
    uniquify(sheet);
    var w = sheet.offsetWidth || W, h = sheet.scrollHeight || 800;
    var scale = Math.max(1.5, Math.min(3, Math.sqrt(16000000 / (w * h)))); // stay under iOS canvas limits
    return window.html2canvas(sheet, { scale: scale, backgroundColor: "#FFFFFF", logging: false, useCORS: true })
      .then(function (canvas) {
        var fit = Math.min(PAGE_W / w, PAGE_H / h);
        var pdf = new window.jspdf.jsPDF({ unit: "pt", format: "letter", orientation: "portrait" });
        pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", (612 - w * fit) / 2, 36, w * fit, h * fit);
        if (sheet.parentNode) sheet.parentNode.removeChild(sheet);
        return pdf.output("datauristring").split(",")[1];
      }, function (err) {
        if (sheet.parentNode) sheet.parentNode.removeChild(sheet);
        throw err;
      });
  }

  var busy = false;
  window.__shareReq = null;
  btn.addEventListener("click", function () {
    if (busy) return;
    busy = true;
    label("Making PDF…");
    var info = window.shareInfo ? window.shareInfo() : { title: document.title || "Chart", name: "", asOf: "" };
    var custom = typeof window.printPdf === "function";
    (custom
      ? readyPdf().then(loadFonts).then(function (fonts) {
          return window.printPdf(window.jspdf.jsPDF, fonts).output("datauristring").split(",")[1];
        })
      : ready().then(function () { return makePdf(info); }))
      .then(function (b64) {
        window.__shareReq = { title: info.title, name: info.name, asOf: info.asOf, pdf: b64 };
        label("Opening…");
      }, function (e) {
        window.__shareReq = { error: (e && e.message) || "Unknown problem" };
        label("Share");
      })
      .then(function () {
        busy = false;
        setTimeout(function () { label("Share"); }, 5000);
      });
  });
  window.__takeShare = function () {
    var r = window.__shareReq;
    window.__shareReq = null;
    return r ? JSON.stringify(r) : null;
  };
  window.__shareDone = function () { label("Share"); };
})();
`;

const sleep = (ms) => new Promise((r) => Timer.schedule(ms, false, r));

async function handleShare(req) {
  if (req.error) {
    const a = new Alert();
    a.title = "Couldn't make the PDF";
    a.message = req.error;
    a.addAction("OK");
    await a.present();
    return;
  }
  const fm = FileManager.local();
  const name = `${req.title} - ${req.asOf}`.replace(/[\\/:*?"<>|]/g, "-").slice(0, 80);
  const path = fm.joinPath(fm.temporaryDirectory(), `${name}.pdf`);
  fm.write(path, Data.fromBase64String(req.pdf));

  const a = new Alert();
  a.title = "Share as PDF";
  a.message = `${name}.pdf`;
  a.addAction("Email");
  a.addAction("Preview & share…");
  a.addAction("Save to Files");
  a.addCancelAction("Cancel");
  const choice = await a.presentSheet();
  try {
    if (choice === 0) {
      const m = new Mail();
      m.subject = `${req.title}${req.name ? ` (${req.name})` : ""} \u2013 ${req.asOf}`;
      m.body = `${req.title}, data through ${req.asOf}. The PDF is attached; sources are listed at the bottom of the page.`;
      m.addFileAttachment(path);
      await m.send();
    } else if (choice === 1) {
      await QuickLook.present(path, true);
    } else if (choice === 2) {
      await DocumentPicker.exportFile(path);
    }
  } catch (e) {
    // Mail isn't set up, or the preview couldn't open here: save to Files instead
    const b = new Alert();
    b.title = "Couldn't open that here";
    b.message = "Saving the PDF to Files instead, so you can share it from there.";
    b.addAction("OK");
    await b.present();
    try {
      await DocumentPicker.exportFile(path);
    } catch (e2) {}
  }
}

// While the full-screen view is open, pick up Share taps from the page.
// Anything that can't be shown over the open view is shared once it closes.
async function sharePoller(wv, isOpen) {
  const later = [];
  while (isOpen()) {
    await sleep(600);
    if (!isOpen()) break;
    // A link tapped on the page: open it in Safari over the view (or the
    // Safari app if that can't be shown)
    let url = null;
    try {
      url = await wv.evaluateJavaScript("window.__takeOpen ? window.__takeOpen() : null");
    } catch (e) {}
    if (url && /^https:\/\//.test(url)) {
      try {
        await Safari.openInApp(url, false);
      } catch (e) {
        try { Safari.open(url); } catch (e2) {}
      }
      continue;
    }
    let raw = null;
    try {
      raw = await wv.evaluateJavaScript("window.__takeShare ? window.__takeShare() : null");
    } catch (e) {}
    if (!raw) continue;
    const req = JSON.parse(raw);
    try {
      await handleShare(req);
    } catch (e) {
      later.push(req);
    }
    try {
      await wv.evaluateJavaScript("window.__shareDone && window.__shareDone()");
    } catch (e) {}
  }
  return later;
}

// Present a loaded page with sharing, running `background` alongside
async function presentWithSharing(wv, background) {
  let open = true;
  const closed = wv.present(true).then(() => {
    open = false;
  });
  const sharing = sharePoller(wv, () => open);
  const bg = (async () => { try { await background(() => open); } catch (e) {} })();
  // closing the view ends the run within about 2 seconds, even mid-download
  await Promise.race([bg, closed.then(() => sleep(2000))]);
  const later = await sharing;
  await closed;
  for (const req of later) {
    try {
      await handleShare(req);
    } catch (e) {}
  }
}


// One full view at a time: a newer run (another tap on the widget) takes over,
// and an older copy still open in the background stops loading
const RUN_FILE = "inflation-expectations-run.txt";
function runPath() { const fm = FileManager.local(); return fm.joinPath(fm.documentsDirectory(), RUN_FILE); }
function claimRun(me) { try { FileManager.local().writeString(runPath(), me); } catch (e) {} }
function stillMine(me) { try { const fm = FileManager.local(); return !fm.fileExists(runPath()) || fm.readString(runPath()) === me; } catch (e) { return true; } }

async function openApp() {
  const s = readStore();
  const me = Date.now() + "-" + Math.random().toString(36).slice(2);
  claimRun(me);
  const wv = updWV(new WebView());
  const html = () => PAGE_HTML.replace("__DATA__", () => JSON.stringify(payload(s))).replace("__SHARE__", () => "<script>" + SHARE_PAGE_JS + "</script>");
  await wv.loadHTML(...updArgs(html()));
  await presentWithSharing(wv, async (isOpen) => {
    const live = () => isOpen() && stillMine(me);
    const say = async (t) => { try { if (live()) await wv.evaluateJavaScript(`window.setStatus && window.setStatus(${JSON.stringify(t)});0`); } catch (e) {} };
    const push = async () => { try { if (live()) await wv.evaluateJavaScript(`window.update && window.update(${JSON.stringify(payload(s))});0`); } catch (e) {} };
    // Black-screen guard: the page says when it has drawn. If it hasn't (or the
    // page stopped answering), load it again, twice at most. Downloads wait for it.
    for (let k = 0; k < 3 && isOpen(); k++) {
      await sleep(k ? 1500 : 600);
      let ok = -1;
      try { ok = await Promise.race([wv.evaluateJavaScript("window.__drawn ? 1 : 0"), sleep(2500).then(() => -1)]); } catch (e) {}
      if (ok === 1 || !isOpen() || k === 2) break;
      try { await wv.loadHTML(...updArgs(html())); } catch (e) {}
    }
    if (!live()) return;
    // refresh on every open (the Excel sources only refresh here)
    await refresh(s, true, async (t) => { await say(t); }, live);
    if (live()) await push();
    else if (isOpen()) { try { await wv.evaluateJavaScript(`window.setStatus && window.setStatus("Opened again from the widget: close this copy");0`); } catch (e) {} }
  });
}

// ---------- Run ----------
if (config.runsInWidget || PREVIEW_WIDGET_IN_APP) {
  const s = readStore();
  try {
    if (!s.at || Date.now() - s.at > REFRESH_HOURS * 3600e3) await refresh(s, false, null);
    const M = model(s);
    if (!signals(s).n && !M.cpi) throw new Error(Object.values(s.src || {}).map((x) => x && x.err).filter(Boolean)[0] || "No data yet. Open the widget once.");
    const w = new ListWidget();
    w.setPadding(0, 0, 0, 0);
    w.backgroundImage = updRing(face(s));
    w.url = URLScheme.forRunningScript(); // a tap runs this script (opens the full page), like every other widget
    w.refreshAfterDate = new Date(Date.now() + REFRESH_HOURS * 3600e3);
    if (config.runsInWidget) Script.setWidget(w); else await w.presentSmall();
  } catch (e) {
    const w = errorWidget(String(e.message || e));
    w.url = URLScheme.forRunningScript();
    if (config.runsInWidget) Script.setWidget(w); else await w.presentSmall();
  }
} else {
  await openApp();
}
Script.complete();
