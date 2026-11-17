
// ---- Shared settings (saved on this phone by the Setup script) ----
// Keys and personal settings live in the phone's keychain, not in this file,
// so the file can be shared as is.
function setting(key, fallback) {
  try { if (Keychain.contains(key)) { const v = Keychain.get(key); if (v) return v; } } catch (e) {}
  return fallback;
}

// Mortgage Spread Widget for Scriptable (small widget, Stocks-style)
// Optimal Blue 30Y fixed conforming index (FRED: OBMMIC30YF, daily)
// minus 10Y Treasury constant maturity (FRED: DGS10, daily), same-day close, in bps.
// Tap the widget for the full-screen chart: both rates, the gap shaded, and the spread on a second axis,
// plus a second chart of the MOVE index (Treasury option volatility) against the spread, since bond
// volatility feeds the spread. MOVE: ICE BofA MOVE Index via Yahoo Finance (^MOVE); it isn't on FRED.
// Below them: "What's in the 10-year" (the 10-year yield split into the expected
// path of short rates and the term premium, from the Federal Reserve Board's
// Kim-Wright model, FRED THREEFYTP10) and "Where the spread is headed" (Freddie
// Mac 30-year minus the 10-year, weekly, with MBA's forecast of both from its
// monthly Mortgage Finance Forecast PDF; the PDF opens from a link under it),
// then "Where the 10-year is headed" (the 10-year by month, MBA's 10-year forecast
// and the Philadelphia Fed's Survey of Professional Forecasters median, each
// with earlier rounds fainter).
// Share as PDF: 16:9 slides, one per chart, each with a headline, end labels and a source banner.

// ---- Update check (once a day; one shared request for all the Housing Widgets) ----
// When GitHub has a newer version of this widget: a thin yellow glow around the
// widget face, and an "Update ready" card in the full view with a Run Installer button.
const UPD_REPO = "r6mjz5hk4v-glitch/housing-widgets";
const UPD_CACHE = "housing-widgets-update.json";
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
  r.timeoutInterval = 8;
  const m = await r.loadJSON();
  if (!m || !m.files) throw new Error("no manifest");
  const c = { at: Date.now(), files: m.files.filter((f) => f.sig && f.hash).map((f) => ({ sig: f.sig, hash: f.hash })) };
  fm.writeString(p, JSON.stringify(c));
  return c;
}
async function updCheck(fetchNow) {
  const fm = FileManager.local(), p = fm.joinPath(fm.documentsDirectory(), UPD_CACHE);
  let c = null;
  try { if (fm.fileExists(p)) c = JSON.parse(fm.readString(p)); } catch (e) {}
  if (!c || Date.now() - (c.at || 0) > 864e5) {
    if (fetchNow) {
      try { c = await updFetch(fm, p); }
      catch (e) { if (c) { c.at = Date.now(); try { fm.writeString(p, JSON.stringify(c)); } catch (e2) {} } } // offline: try again tomorrow
    } else updFetch(fm, p).catch(() => {}); // in the app: refresh in the background, use what's saved now
  }
  if (!c || !c.files) return false;
  const src = updOwnSource();
  if (!src) return false;
  const top = src.slice(0, 3000), mine = c.files.find((f) => top.includes(f.sig));
  return !!mine && mine.hash !== updHash(updBody(src, mine.sig));
}
let UPD_READY = false;
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
  const inst = encodeURIComponent(setting("hw_installer", "Installer"));
  // a pill floating at the bottom: it never moves the page's own layout; class "hint" keeps it out of PDFs
  const pill = '<a class="hint" href="scriptable:///run/' + inst + '" style="position:fixed;left:50%;bottom:calc(22px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:9999;margin:0;display:flex;align-items:center;gap:8px;background:#FFD60A;color:#1C1C1E;border-radius:22px;padding:11px 18px;font:700 14.5px -apple-system,system-ui,sans-serif;text-decoration:none;box-shadow:0 6px 20px rgba(0,0,0,.45);white-space:nowrap">Update ready · Run Installer ›</a>';
  return html.slice(0, at) + pill + html.slice(at);
}
function updArgs(html, base) { return base === undefined ? [updPage(html)] : [updPage(html), base]; }
// let the page's Run Installer link open Scriptable
function updWV(wv) {
  try { wv.shouldAllowRequest = (req) => { if (/^scriptable:/i.test(req.url)) { Safari.open(req.url); return false; } return true; }; } catch (e) {}
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

const DAYS_BACK = 30; // home-screen window: sparkline, dashed line and change all use it

// Detail view: up to 5 years shown, plus enough lookback that the 63-day
// moving average is fully formed at the left edge of the 5Y chart.
const DETAIL_DAYS_BACK = 5 * 365 + 100;

// Detail chart: the vertical axis is never shorter than this many bps,
// so small wiggles look small. Raise it for a calmer chart, lower it to zoom in.
const MIN_AXIS_SPAN_BPS = 50;

// Shown in the header, Stocks-style. Keep the ticker short.
const TICKER = "OB\u221210Y";
const NAME = "Mortgage Spread";
const CACHE_FILE = "ob-spread-v2.json";
// MOVE index, from Yahoo Finance's public chart feed (unofficial; if it fails, MOVE shows n/a)
const MOVE_FILE = "move-index-v1.json";
const MOVE_URL = "https://query1.finance.yahoo.com/v8/finance/chart/%5EMOVE?range=5y&interval=1d&includePrePost=false";
const MOVE_TIMEOUT_S = 15;

// Colors are inverted from Stocks on purpose: tighter = green, wider = red.

// Apple's system green and red for dark backgrounds
const GREEN = "#30D158";
const RED = "#FF453A";
const GRAY = "#98989F";
const REFRESH_HOURS = 6;
// The spread needs both legs. Optimal Blue posts first (about 7:02 am Central); the 10-year Treasury lands about 3:16 pm Central, dated the business day before, and completes the pair.
const POST = { clock: [15, 16], refresh: [15, 30], retryUntil: 19, lagDays: 1 };
const CLOCK_BY_VALUE = false; // true: clock sits left of the big value instead of replacing the name

// Set true to preview the small widget when running in the app,
// instead of opening the full-screen detail view.
const PREVIEW_WIDGET_IN_APP = false;

const MA_NOTE =
  "Moving averages are in trading days: 5 is about a week, 21 a month, 63 three months.";

// ---------- Helpers ----------
const iso = (d) => d.toISOString().slice(0, 10);

function addDays(dateStr, n) {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
}

function daysAgo(n) {
  return addDays(iso(new Date()), -n);
}

async function fred(seriesId, start) {
  const url =
    "https://api.stlouisfed.org/fred/series/observations" +
    `?series_id=${seriesId}&api_key=${FRED_KEY}&file_type=json` +
    `&observation_start=${start}`;
  const req = new Request(url);
  req.timeoutInterval = 20;
  const json = await req.loadJSON();
  if (!json.observations) {
    throw new Error(json.error_message || `No data for ${seriesId}`);
  }
  // FRED uses "." for missing values (holidays etc.)
  return json.observations
    .filter((o) => o.value !== ".")
    .map((o) => ({ date: o.date, value: parseFloat(o.value) }));
}

const byDate = (series) => new Map(series.map((o) => [o.date, o.value]));

// ---------- Saved copy (one copy, shared by the widget and the app) ----------
// The home-screen widget and the full-screen app read and write one saved
// copy in Scriptable's Documents folder, which both can see. (It used to sit
// in the cache folder, which iOS keeps separately for the widget and the app,
// so the two could drift apart.) Whichever last reached FRED keeps it current
// for both, and older data never replaces newer.
function savedPath(file) {
  const fm = FileManager.local();
  return fm.joinPath(fm.documentsDirectory(), file);
}
// The newest date in a saved result: its main series' last point, or else
// the newest last point across its series
function latestKey(d) {
  if (!d || typeof d !== "object") return "";
  const lastKey = (arr) => {
    const p = Array.isArray(arr) && arr.length ? arr[arr.length - 1] : null;
    const k = p && typeof p === "object" ? p.date || p.m || p.week || p.key : null;
    return typeof k === "string" ? k : "";
  };
  if (Array.isArray(d.pts) && d.pts.length) return lastKey(d.pts);
  let best = "";
  for (const [k, v] of Object.entries(d)) {
    if (/^(release|next|stale)/i.test(k)) continue;
    const key = lastKey(v);
    if (key > best) best = key;
  }
  return best;
}
// "Oct 20, 2026" or "Sep 2026", for "showing data through …"
function throughLabel(d, short) {
  const k = latestKey(d);
  if (!k) return "the last saved copy";
  const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const [y, m, dd] = k.split("-");
  if (dd) return short ? `${M[+m - 1]} ${+dd}` : `${M[+m - 1]} ${+dd}, ${y}`;
  return short ? `${M[+m - 1]} ’${y.slice(2)}` : `${M[+m - 1]} ${y}`;
}
// The shared copy, or the old unshared one if it's newer. The first time
// either the widget or the app runs after this update, its old copy is moved
// into the shared one if newer, so the other side sees it too even while
// FRED is down.
function readSaved(file) {
  const fm = FileManager.local();
  let shared = null;
  let old = null;
  try {
    if (fm.fileExists(savedPath(file))) shared = JSON.parse(fm.readString(savedPath(file)));
  } catch (e) {}
  try {
    const p = fm.joinPath(fm.cacheDirectory(), file);
    if (fm.fileExists(p)) old = JSON.parse(fm.readString(p));
  } catch (e) {}
  if (old && (!shared || latestKey(old) > latestKey(shared))) {
    const { stale, ...clean } = old;
    writeSaved(file, clean);
    return clean;
  }
  return shared;
}
// Written to a temporary file and swapped in, so a widget refresh and the app
// opening at the same moment can't catch a half-written copy
function writeSaved(file, data) {
  const fm = FileManager.local();
  const p = savedPath(file);
  const tmp = p + ".tmp";
  try {
    fm.writeString(tmp, JSON.stringify(data));
    if (fm.fileExists(p)) fm.remove(p);
    fm.move(tmp, p);
  } catch (e) {
    try {
      fm.writeString(p, JSON.stringify(data));
    } catch (e2) {}
  }
}

// Run producer(); save its result. If it fails, fall back to the saved copy
// (flagged stale). If FRED answers with older data than the saved copy, keep
// the saved copy.
async function withCache(file, producer) {
  const saved = readSaved(file);
  try {
    const data = await producer();
    if (saved && latestKey(saved) > latestKey(data)) return { ...saved, stale: false };
    writeSaved(file, data);
    return { ...data, stale: false };
  } catch (e) {
    if (saved) return { ...saved, stale: true };
    throw e;
  }
}

// The slice of history the home-screen sparkline shows
function recent(pts) {
  const from = daysAgo(DAYS_BACK);
  const r = pts.filter((p) => p.date >= from);
  return r.length >= 2 ? r : pts.slice(-2);
}

// ---------- Data (with offline fallback) ----------
async function getData() {
  return withCache(CACHE_FILE, async () => {
    const start = daysAgo(DETAIL_DAYS_BACK);
    const [ob, ust] = await Promise.all([
      fred("OBMMIC30YF", start),
      fred("DGS10", start),
    ]);
    // Strict same-date match: days where either leg is missing are skipped,
    // so a fresh OB print never gets paired with a stale Treasury close.
    const u = byDate(ust);
    const pts = [];
    for (const o of ob) {
      const y = u.get(o.date);
      if (y === undefined) continue;
      pts.push({ date: o.date, v: (o.value - y) * 100, ob: o.value, ust: y });
    }
    if (!pts.length) throw new Error("No overlapping data");
    return { pts };
  });
}

// ---------- MOVE index (Yahoo Finance), saved like the FRED data ----------
async function fetchMove() {
  const req = new Request(MOVE_URL);
  req.timeoutInterval = MOVE_TIMEOUT_S;
  req.headers = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    Accept: "application/json",
  };
  const j = await req.loadJSON();
  const r = j && j.chart && j.chart.result && j.chart.result[0];
  if (!r || !r.timestamp || !r.indicators || !r.indicators.quote) {
    const why = j && j.chart && j.chart.error && j.chart.error.description;
    throw new Error(why || "Yahoo sent no MOVE data");
  }
  const close = r.indicators.quote[0].close || [];
  const off = (r.meta && r.meta.gmtoffset) || 0;
  const byDay = {};
  r.timestamp.forEach((t, i) => {
    const v = close[i];
    if (v == null || !(v > 0)) return;
    byDay[new Date((t + off) * 1000).toISOString().slice(0, 10)] = Math.round(v * 100) / 100;
  });
  const move = Object.keys(byDay).sort().map((date) => ({ date, value: byDay[date] }));
  if (move.length < 20) throw new Error("Yahoo sent too little MOVE history");
  return { move };
}
// Never throws: the saved copy (flagged stale) when Yahoo fails, or no data
async function getMove() {
  let timer;
  const deadline = new Promise((_, rej) => { timer = Timer.schedule(MOVE_TIMEOUT_S * 1000 + 2000, false, () => rej(new Error("Yahoo took too long"))); });
  try {
    return await Promise.race([withCache(MOVE_FILE, fetchMove), deadline]);
  } catch (e) {
    const saved = readSaved(MOVE_FILE);
    if (saved && saved.move && saved.move.length) return { ...saved, stale: true };
    return { move: [], stale: true, error: String((e && e.message) || e) };
  } finally {
    if (timer) timer.invalidate();
  }
}

function widgetSpec(d) {
  const pts = recent(d.pts);
  const first = pts[0];
  const last = pts[pts.length - 1];
  const delta = last.v - first.v;
  const pct = first.v !== 0 ? (delta / Math.abs(first.v)) * 100 : 0;
  const wider = delta > 0;
  const sign = wider ? "+" : delta < 0 ? "-" : "";
  return {
    pts,
    hex: wider ? RED : GREEN, // wider = red, tighter/flat = green
    triangleUp: wider,
    topRight: signedWhole(delta), // change over the window, bps
    name: NAME,
    staleTag: d.stale ? (CLOCK_BY_VALUE ? "cached" : `cached · ${throughLabel(d, true)}`) : null,
    staleDate: d.stale ? throughLabel(d, true) : null,
    rightSub: `${sign}${Math.abs(pct).toFixed(2)}%`, // % change over the window
    value: whole(last.v),
    clock: postClock(d),
  };
}

function detailPayload(d) {
  return {
    ticker: TICKER,
    name: NAME,
    unit: "bps",
    dec: 0,
    chg: { scale: 1, dec: 0, unit: "bps" },
    upIsGood: false,
    zoom: true, // pinch to zoom, two-finger drag to pan, double-tap to reset
    minSpan: MIN_AXIS_SPAN_BPS,
    legs: [],
    // Both rates on the left axis with the gap shaded; the spread itself
    // is the colored line against the right axis.
    band: {
      top: { key: "ob", label: "OB 30Y", color: "#FFFFFF" },
      bottom: { key: "ust", label: "10Y", color: "#64A8FF" },
      label: "Spread",
    },
    pts: d.pts,
    note:
      "White is the Optimal Blue 30Y conforming rate, blue the same-day 10Y Treasury close. " +
      "The left axis shows the rates themselves, in percent, and the shaded gap is the " +
      "whole spread. The colored line is the spread in bps against the right axis. Pinch the chart to zoom in time, drag with two fingers to pan, and double-tap to go back to the last range button. " +
      "MOVE vs spread: the ICE BofA MOVE Index (implied volatility of 1-month Treasury options; higher = more bond-market uncertainty) on the left axis, " +
      "the same spread in bps on the right; it follows the main chart's dates. Sources: FRED (Optimal Blue, Treasury); MOVE via Yahoo Finance." +
      (d.stale ? " Showing cached data; the last fetch failed." : ""),
  };
}

// ---------- Printable PDF for this view ----------
// The approved one-page layout, drawn with jsPDF's vector calls. It runs inside
// the full-screen page; the page's Share button calls window.printPdf.
// (Page code: no backticks, backslashes or dollar-brace, since it lives in a
// template literal.)
const PRINT_PAGE_JS = `
// Share as PDF: 16:9 slides for the dates on screen. 1) both rates with the
// gap shaded and the spread on the right axis; 2) MOVE vs the spread. Each has
// a headline that states the point, the chart large, value labels at the line
// ends, and a dark banner crediting the sources. Vector, so it stays sharp.
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
  // Colors mirror the phone: the spread is green when it tightened over the
  // dates on screen and red when it widened (set below); the second chart's
  // spread is orange and MOVE light blue, as on screen, darkened for paper.
  var OBC = [40, 40, 44], USTC = [10, 98, 208], MOVC = [0, 119, 200], SPRO = [194, 106, 0];
  var SPRC = [215, 0, 21], TINT = [251, 226, 228];
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function font(bold, size, c) { doc.setFont(FACE, bold ? "bold" : "normal"); doc.setFontSize(size); doc.setTextColor(c[0], c[1], c[2]); }
  function longDate(iso) { var p = iso.split("-"); return MON[+p[1] - 1] + " " + (+p[2]) + ", " + p[0]; }
  var P = pts.slice(), first = P[0], last = P[P.length - 1], n = P.length;
  var endsNow = last.date === D.pts[D.pts.length - 1].date;
  var days = (Date.parse(last.date) - Date.parse(first.date)) / 86400000;
  // A custom zoom (no range button lit) is described in whole units, rounded
  // down: years if a year or more, else months, else weeks
  var custom = !document.querySelector("#seg button.on");
  function roundedDown(days, a, n) {
    var y = Math.floor(days / 365.25 + 1e-6), m = Math.floor(days / 30.44 + 1e-6), w = Math.floor(days / 7 + 1e-6);
    if (y >= 1) return y === 1 ? a + "Year" : n + y + " Years";
    if (m >= 1) return m === 1 ? a + "Month" : n + m + " Months";
    return w <= 1 ? a + "Week" : n + w + " Weeks";
  }
  var period = endsNow && custom ? roundedDown(days, "Over the Past ", "Over the Past ")
    : endsNow
    ? (days <= 10 ? "Over the Past Week" : days <= 45 ? "Over the Past Month" : days <= 120 ? "Over the Past 3 Months" :
       days <= 240 ? "Over the Past 6 Months" : days <= 500 ? "Over the Past Year" : days <= 2000 ? "Over the Past 5 Years" : "Over the Period Shown")
    : "From " + longDate(first.date) + " to " + longDate(last.date);
  var span = longDate(first.date) + " to " + longDate(last.date);
  // MOVE on the same days
  var mv = P.map(function (p) { var v = MOVE_BY[p.date]; return v == null ? null : v; });
  var mIdx = []; mv.forEach(function (v, i) { if (v !== null) mIdx.push(i); });
  var movePage = mIdx.length >= 5;
  // term premium on the same days, and the spread forecast (its own dates)
  var tpv = P.map(function (p) { var v = TP_BY[p.date]; return v == null ? null : v; });
  var tIdx = []; tpv.forEach(function (v, i) { if (v !== null) tIdx.push(i); });
  var tpPage = tIdx.length >= 5;
  // Term-premium slide headline: which part of the 10-year drove its move from
  // the first to the last day the premium exists (10Y change = premium change +
  // expected-path change). Arithmetic only.
  function tpHeadline(f, l) {
    var d10 = Math.round((P[l].ust - P[f].ust) * 100), dtp = Math.round((tpv[l] - tpv[f]) * 100), dex = d10 - dtp;
    var p0 = P[f].date.split("-"), since = "Since " + MON[+p0[1] - 1] + " " + p0[0];
    if (Math.abs(d10) < 5) {
      if (Math.abs(dtp) < 5) return "10-Year Roughly Flat " + since + ", With Term Premium and Fed Expectations Little Changed";
      return "10-Year Roughly Flat " + since + " as Term Premium and Fed Expectations Offset Each Other";
    }
    var up = d10 > 0, move = "the 10-Year's " + (up ? "Rise" : "Drop") + " " + since;
    var TPN = "Term Premium", EXN = "Fed Expectations";
    var tpWith = up ? dtp > 0 : dtp < 0, exWith = up ? dex > 0 : dex < 0;
    if (tpWith && !exWith) return TPN + " Drove " + move + (Math.abs(dex) >= 5 ? " as " + EXN + (dex > 0 ? " Rose" : " Fell") : "");
    if (exWith && !tpWith) return EXN + " Drove " + move + (Math.abs(dtp) >= 5 ? " as " + TPN + (dtp > 0 ? " Rose" : " Fell") : "");
    var a = Math.abs(dtp), b = Math.abs(dex);
    if (Math.min(a, b) / Math.max(a, b) > 0.75) return "Term Premium and Fed Expectations Split " + move + " About Evenly";
    return (a > b ? TPN : EXN) + " Drove Most of " + move;
  }
  var SFM = typeof sfcModel === "function" ? sfcModel() : null, TFM = typeof tfcModel === "function" ? tfcModel() : null;
  var pages = 1 + (movePage ? 1 : 0) + (tpPage ? 1 : 0) + (SFM ? 1 : 0) + (TFM ? 1 : 0), pageNo = 1;

  function headline(text) {
    var size = 21, lines;
    do { font(true, size, INK); lines = doc.splitTextToSize(text, W - 72); size -= 1; } while (lines.length > 1 && size > 15);
    doc.text(lines, 36, 42);
    return 42 + (lines.length - 1) * (size + 4);
  }
  function titles(top, title, sub, cx) {
    font(true, 11.5, INK); doc.text(title, cx || W / 2, top + 30, { align: "center" });
    font(false, 9.5, GRY); doc.text(sub, cx || W / 2, top + 43, { align: "center" });
  }
  function nice(range, target) {
    var raw = range / (target || 5), p = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), f = raw / p;
    return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p;
  }
  function scale(vals, minSpan) {
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    if (hi - lo < minSpan) { var mid = (hi + lo) / 2; lo = mid - minSpan / 2; hi = mid + minSpan / 2; }
    var st = nice(hi - lo, 5); lo = Math.floor(lo / st) * st; hi = Math.ceil(hi / st) * st; if (hi === lo) hi = lo + st;
    return { lo: lo, hi: hi, st: st };
  }
  // the chart box, the left-axis grid, the right-axis labels, and dates
  function frame(top, left, right, fmtL, fmtR, colL, colR, rx) {
    var F = { L: 78, R: rx || W - 128, T: top + 58, B: H - 92 };
    F.X = function (i) { return F.L + (n === 1 ? 0 : i / (n - 1) * (F.R - F.L)); };
    F.YL = function (v) { return F.B - (v - left.lo) / (left.hi - left.lo) * (F.B - F.T); };
    F.YR = function (v) { return F.B - (v - right.lo) / (right.hi - right.lo) * (F.B - F.T); };
    doc.setLineWidth(0.5);
    for (var v = left.lo; v <= left.hi + left.st / 2; v += left.st) {
      doc.setDrawColor(RULE[0], RULE[1], RULE[2]); doc.line(F.L, F.YL(v), F.R, F.YL(v));
      font(false, 8.5, colL); doc.text(fmtL(v), F.L - 6, F.YL(v) + 3, { align: "right" });
    }
    for (var r = right.lo; r <= right.hi + right.st / 2; r += right.st) {
      font(false, 8.5, colR); doc.text(fmtR(r), F.R + 5, F.YR(r) + 3);
    }
    doc.setDrawColor(150, 150, 155); doc.line(F.L, F.B, F.R, F.B);
    // dates: month starts (thinned to fit), or year starts on long ranges
    var monthsSpan = days / 30.4, lastX = -99, prevKey = null;
    for (var i = 0; i < n; i++) {
      var d = P[i].date, key = monthsSpan > 30 ? d.slice(0, 4) : d.slice(0, 7);
      if (key === prevKey) continue;
      prevKey = key;
      if (i === 0) continue;
      var lab = monthsSpan > 30 ? d.slice(0, 4) : MON[+d.slice(5, 7) - 1] + (d.slice(5, 7) === "01" || monthsSpan > 10 ? " '" + d.slice(2, 4) : "");
      var x = F.X(i);
      if (x - lastX < 44 || x > F.R - 10) continue;
      doc.setDrawColor(150, 150, 155); doc.line(x, F.B, x, F.B + 3);
      font(false, 8.5, GRY); doc.text(lab, x, F.B + 13, { align: "center" }); lastX = x;
    }
    if (lastX < 0) {
      font(false, 8.5, GRY);
      doc.text(longDate(first.date), F.L, F.B + 13); doc.text(longDate(last.date), F.R, F.B + 13, { align: "right" });
    }
    return F;
  }
  function line(F, ys, c, w) {
    doc.setDrawColor(c[0], c[1], c[2]); doc.setLineWidth(w); if (doc.setLineJoin) doc.setLineJoin("round");
    var px = null, py = null;
    for (var i = 0; i < n; i++) {
      var y = ys(i);
      if (y === null) continue; // a missing day is bridged
      var x = F.X(i);
      if (px !== null) doc.line(px, py, x, y);
      px = x; py = y;
    }
  }
  function endLabels(F, items) {
    items.sort(function (p, q) { return p.y - q.y; });
    for (var k = 1; k < items.length; k++) if (items[k].y - items[k - 1].y < 13) items[k].y = items[k - 1].y + 13;
    items.forEach(function (it) { font(true, 10, it.c); doc.text(it.t, F.R + 34, it.y + 3.5); });
  }
  function legend(F, items, cx) {
    var y = F.B + 30, total = 0;
    font(false, 9, INK);
    items.forEach(function (it) { it.w = doc.getTextWidth(it.t); total += 22 + it.w + 26; });
    var x = (cx ? 2 * cx - total + 26 : W - total + 26) / 2;
    items.forEach(function (it) {
      doc.setLineWidth(it.lw || 2); doc.setDrawColor(it.c[0], it.c[1], it.c[2]); doc.line(x, y - 3, x + 16, y - 3);
      font(false, 9, INK); doc.text(it.t, x + 22, y); x += 22 + it.w + 26;
    });
  }
  function banner(page, srcOver, through) {
    var bh = 44, by = H - bh;
    doc.setFillColor(28, 28, 30); doc.rect(0, by, W, bh, "F");
    doc.setFillColor(201, 162, 39); doc.rect(W - 176, by + 6, 2, bh - 12, "F");
    font(false, 7.2, [235, 235, 240]);
    var src = "Sources: Optimal Blue 30-year fixed conforming rate index (OBMMIC30YF) and 10-year Treasury constant maturity yield (DGS10), via FRED. " +
      "Spread = Optimal Blue rate minus the same-day 10-year yield." + (movePage && page === 2 ? " MOVE: ICE BofA MOVE Index (1-month Treasury option implied volatility), via Yahoo Finance." : "");
    if (srcOver) src = srcOver;
    doc.text(doc.splitTextToSize(src, W - 176 - 40 - 110), 28, by + 15);
    font(false, 7.5, [200, 200, 205]);
    doc.text("Data through " + longDate(through || last.date), W - 188, by + 20, { align: "right" });
    doc.text(page + " of " + pages, W - 188, by + 31, { align: "right" });
    font(true, 12.5, [255, 255, 255]);
    doc.text("Mortgage", W - 162, by + 20);
    doc.text("Spread", W - 162, by + 34);
  }
  function bps(v) { return Math.round(v) + " bps"; }
  function signed(v, unit) { var r = Math.round(Math.abs(v)); return r + (unit || ""); }

  // ---- 1. Rates and spread ----
  var chg = last.v - first.v, rc = Math.round(chg);
  if (!(chg > 0)) { SPRC = [30, 158, 69]; TINT = [226, 244, 231]; } // tighter or flat = green, like the phone
  var top = headline(Math.abs(rc) < 1
    ? "Mortgage Spread at " + bps(last.v) + ", Unchanged " + period
    : "Mortgage Spread at " + bps(last.v) + ", " + Math.abs(rc) + " bps " + (rc > 0 ? "Wider" : "Tighter") + " " + period);
  titles(top, "Optimal Blue 30-Year Conforming Rate vs 10-Year Treasury Yield", "Daily, rates in % (left) and the spread in bps (right) · " + span);
  var rates = []; P.forEach(function (p) { rates.push(p.ob, p.ust); });
  var left = scale(rates, 0.5), right = scale(P.map(function (p) { return p.v; }), 30);
  var F = frame(top, left, right, function (v) { return v.toFixed(2) + "%"; }, function (v) { return String(Math.round(v)); }, GRY, SPRC);
  // shaded gap between the rates
  // one shape: along the Optimal Blue line, back along the 10-year
  var poly = [];
  for (var i = 0; i < n; i++) poly.push([F.X(i), F.YL(P[i].ob)]);
  for (var i2 = n - 1; i2 >= 0; i2--) poly.push([F.X(i2), F.YL(P[i2].ust)]);
  var rel = [];
  for (var k1 = 1; k1 < poly.length; k1++) rel.push([poly[k1][0] - poly[k1 - 1][0], poly[k1][1] - poly[k1 - 1][1]]);
  doc.setFillColor(TINT[0], TINT[1], TINT[2]);
  doc.lines(rel, poly[0][0], poly[0][1], [1, 1], "F", true);
  line(F, function (i) { return F.YL(P[i].ust); }, USTC, 1.8);
  line(F, function (i) { return F.YL(P[i].ob); }, OBC, 1.8);
  line(F, function (i) { return F.YR(P[i].v); }, SPRC, 2.4);
  endLabels(F, [
    { y: F.YL(last.ob), t: last.ob.toFixed(2) + "%", c: OBC },
    { y: F.YL(last.ust), t: last.ust.toFixed(2) + "%", c: USTC },
    { y: F.YR(last.v), t: bps(last.v), c: SPRC }
  ]);
  legend(F, [{ t: "Optimal Blue 30Y conforming", c: OBC, lw: 1.8 }, { t: "10Y Treasury", c: USTC, lw: 1.8 }, { t: "Spread (right axis)", c: SPRC, lw: 2.4 }]);
  banner(1);

  // ---- 2. MOVE vs spread ----
  if (movePage) {
    doc.addPage([W, H], "landscape");
    var m0 = mv[mIdx[0]], m1 = mv[mIdx[mIdx.length - 1]], dm = m1 - m0;
    var volTxt = Math.abs(dm) < 1 ? "Bond Volatility Flat" : "Bond Volatility " + (dm > 0 ? "Up " : "Down ") + signed(dm) + " Points";
    var sprTxt = Math.abs(rc) < 1 ? "the Spread Unchanged" : "the Spread " + Math.abs(rc) + " bps " + (rc > 0 ? "Wider" : "Tighter");
    // correlation of daily levels over the days both exist
    var xs = [], ys = [];
    mIdx.forEach(function (i) { xs.push(mv[i]); ys.push(P[i].v); });
    var mx = xs.reduce(function (a, b) { return a + b; }, 0) / xs.length, my = ys.reduce(function (a, b) { return a + b; }, 0) / ys.length;
    var sxy = 0, sxx = 0, syy = 0;
    for (var k = 0; k < xs.length; k++) { sxy += (xs[k] - mx) * (ys[k] - my); sxx += (xs[k] - mx) * (xs[k] - mx); syy += (ys[k] - my) * (ys[k] - my); }
    var corr = sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null;
    top = headline(volTxt + " and " + sprTxt + " " + period);
    titles(top, "MOVE Index vs Mortgage Spread", "Daily, MOVE (left) and the spread in bps (right) · " + span +
      (corr !== null ? " · correlation of daily levels: " + corr.toFixed(2) : ""));
    var mleft = scale(mIdx.map(function (i) { return mv[i]; }), 10);
    F = frame(top, mleft, right, function (v) { return String(Math.round(v)); }, function (v) { return String(Math.round(v)); }, MOVC, SPRO);
    line(F, function (i) { return F.YR(P[i].v); }, SPRO, 2.2);
    line(F, function (i) { return mv[i] === null ? null : F.YL(mv[i]); }, MOVC, 2.2);
    var lastM = mIdx[mIdx.length - 1];
    endLabels(F, [{ y: F.YL(mv[lastM]), t: "MOVE " + Math.round(mv[lastM]), c: MOVC }, { y: F.YR(last.v), t: bps(last.v), c: SPRO }]);
    legend(F, [{ t: "MOVE Index (left axis)", c: MOVC, lw: 2.2 }, { t: "Mortgage spread, bps (right axis)", c: SPRO, lw: 2.2 }]);
    banner(++pageNo);
  }

  // ---- 3. What's in the 10-year: expected path + term premium ----
  if (tpPage) {
    doc.addPage([W, H], "landscape");
    var TPC = [200, 110, 0], EXPC = [120, 120, 125], TPT = [254, 243, 226];
    var lt = tIdx[tIdx.length - 1], ltp = tpv[lt], lexp = P[lt].ust - ltp;
    top = headline(tpHeadline(tIdx[0], lt));
    var RX = W - 330, CX = (78 + RX) / 2;
    titles(top, "10-Year Yield Split Into Expected Short Rates and Term Premium", "Daily, % (left), term premium in bps (right) · Kim-Wright model · " + span + (P[lt].date !== last.date ? " · labels as of " + longDate(P[lt].date) : ""), CX);
    var tvals = []; P.forEach(function (p, i) { tvals.push(p.ust); if (tpv[i] !== null) tvals.push(p.ust - tpv[i]); });
    var tl = scale(tvals, 0.5);
    var tbps = tIdx.map(function (i) { return tpv[i] * 100; }), tr = scale(tbps, 30);
    F = frame(top, tl, tr, function (v) { return v.toFixed(2) + "%"; }, function (v) { return String(Math.round(v)); }, GRY, TPC, RX);
    // shaded term premium, run by run
    var runT = [];
    var flushT = function () {
      if (runT.length > 1) {
        var pl = [];
        runT.forEach(function (i) { pl.push([F.X(i), F.YL(P[i].ust)]); });
        for (var k = runT.length - 1; k >= 0; k--) pl.push([F.X(runT[k]), F.YL(P[runT[k]].ust - tpv[runT[k]])]);
        var rl = []; for (var k2 = 1; k2 < pl.length; k2++) rl.push([pl[k2][0] - pl[k2 - 1][0], pl[k2][1] - pl[k2 - 1][1]]);
        doc.setFillColor(TPT[0], TPT[1], TPT[2]); doc.lines(rl, pl[0][0], pl[0][1], [1, 1], "F", true);
      }
      runT = [];
    };
    for (var it = 0; it < n; it++) { if (tpv[it] !== null) runT.push(it); else flushT(); }
    flushT();
    doc.setLineDashPattern([4, 2.5], 0);
    line(F, function (i) { return tpv[i] === null ? null : F.YL(P[i].ust - tpv[i]); }, EXPC, 1.6);
    doc.setLineDashPattern([], 0);
    line(F, function (i) { return F.YL(P[i].ust); }, USTC, 1.9);
    if (tr.lo < 0 && tr.hi > 0) { doc.setDrawColor(TPC[0], TPC[1], TPC[2]); doc.setLineWidth(0.6); doc.setLineDashPattern([2, 2], 0); doc.line(F.L, F.YR(0), F.R, F.YR(0)); doc.setLineDashPattern([], 0); }
    line(F, function (i) { return tpv[i] === null ? null : F.YR(tpv[i] * 100); }, TPC, 2);
    endLabels(F, [{ y: F.YL(P[lt].ust), t: "10Y " + P[lt].ust.toFixed(2) + "%", c: USTC }, { y: F.YL(lexp), t: "Exp. " + lexp.toFixed(2) + "%", c: EXPC }, { y: F.YR(ltp * 100), t: "TP " + Math.round(ltp * 100) + " bps", c: TPC }]);
    legend(F, [{ t: "10-year yield", c: USTC, lw: 1.9 }, { t: "Expected path (10Y minus premium)", c: EXPC, lw: 1.6 }, { t: "Term premium, bps (right axis)", c: TPC, lw: 2 }], CX);
    // side key: the same glyphs as the app's pop-up
    var KX = W - 232, KY = top + 62;
    font(true, 10, INK); doc.text("How to read it", KX, KY);
    TP_PATTERNS.forEach(function (P, k) {
      var gy = KY + 10 + k * 41;
      tpGlyphPdf(doc, P, KX, gy, 46, 30);
      font(true, 8, INK); var la = doc.splitTextToSize(P.a, 156); doc.text(la, KX + 54, gy + 9);
      font(false, 7.6, GRY); doc.text(doc.splitTextToSize("-> " + P.m, 156), KX + 54, gy + 9 + la.length * 9);
    });
    font(false, 7.2, GRY); doc.text("Glyphs are schematic, not data.", KX, KY + 10 + TP_PATTERNS.length * 41 + 4);
    banner(++pageNo, "Sources: 10-year Treasury constant maturity yield (DGS10) and term premium on a 10-year zero-coupon bond from the Kim-Wright model, Federal Reserve Board (THREEFYTP10), via FRED. " +
      "Expected path = 10-year yield minus the term premium; approximate, since the model's premium is for a zero-coupon bond. The premium posts about a week behind.");
  }

  // ---- 4. Where the spread is headed ----
  if (SFM) {
    doc.addPage([W, H], "landscape");
    var GOLD = [196, 140, 0];
    var lmq = SFM.mba.length ? SFM.mba[SFM.mba.length - 1] : null;
    top = headline(lmq ? "MBA's Forecast Implies a " + lmq.v + " bps Spread by " + lmq.q.slice(4) + " " + lmq.q.slice(0, 4) + ", vs " + SFM.last[1] + " bps Now" : "Freddie Mac 30-Year Minus 10-Year Treasury at " + SFM.last[1] + " bps");
    titles(top, "Mortgage Spread: Freddie Mac 30-Year Minus 10-Year Treasury, Actual and MBA Forecast",
      "Weekly, bps · MBA implied spread = its 30-year forecast minus its 10-year forecast" + (SFM.F.mba ? " (" + SFM.F.mba.vintage + ")" : ""));
    var stS = nice(SFM.hi - SFM.lo, 5), loS = Math.floor((SFM.lo - stS * 0.4) / stS) * stS, hiS = Math.ceil((SFM.hi + stS * 0.4) / stS) * stS;
    var LS = 70, RS = W - 150, TS = top + 58, BS = H - 92;
    var XS = function (sd) { return LS + (ymdT(sd) - SFM.t0) / (SFM.t1 - SFM.t0) * (RS - LS); };
    var YS = function (v) { return BS - (v - loS) / (hiS - loS) * (BS - TS); };
    doc.setLineWidth(0.5);
    for (var gS = loS; gS <= hiS + 1e-9; gS += stS) {
      doc.setDrawColor(RULE[0], RULE[1], RULE[2]); doc.line(LS, YS(gS), RS, YS(gS));
      font(false, 8.5, GRY); doc.text(String(Math.round(gS)), LS - 6, YS(gS) + 3, { align: "right" });
    }
    doc.setDrawColor(150, 150, 155); doc.line(LS, BS, RS, BS);
    var lxS = -99;
    fcTicks(SFM.t0, SFM.t1).forEach(function (tk) {
      var xS = LS + (tk.t - SFM.t0) / (SFM.t1 - SFM.t0) * (RS - LS);
      if (xS - lxS < 40 || xS < LS + 10 || xS > RS - 10) return;
      lxS = xS; doc.setDrawColor(150, 150, 155); doc.line(xS, BS, xS, BS + 3); font(false, 8.5, GRY); doc.text(tk.lab, xS, BS + 13, { align: "center" });
    });
    // lines stay inside the chart box when zoomed
    doc.saveGraphicsState(); doc.rect(LS, TS - 14, RS - LS, BS - TS + 14, null); doc.clip(); doc.discardPath();
    var txS = XS(SFM.last[0]);
    doc.setDrawColor(150, 150, 155); doc.setLineDashPattern([2, 2], 0); doc.line(txS, TS, txS, BS); doc.setLineDashPattern([], 0);
    font(false, 8, GRY); doc.text("Today", txS - 4, TS + 8, { align: "right" });
    doc.setDrawColor(SPRO[0], SPRO[1], SPRO[2]); doc.setLineWidth(1.9);
    for (var iS = 1; iS < SFM.act.length; iS++) doc.line(XS(SFM.act[iS - 1][0]), YS(SFM.act[iS - 1][1]), XS(SFM.act[iS][0]), YS(SFM.act[iS][1]));
    doc.setFillColor(SPRO[0], SPRO[1], SPRO[2]); doc.circle(txS, YS(SFM.last[1]), 2.8, "F");
    font(true, 9, SPRO); doc.text(SFM.last[1] + " bps", txS - 5, YS(SFM.last[1]) - 6, { align: "right" });
    var endsS = [];
    SFM.old.forEach(function (o, k) {
      var c = k ? [232, 214, 165] : [218, 190, 120];
      doc.setDrawColor(c[0], c[1], c[2]); doc.setLineWidth(1.4); doc.setLineDashPattern([3, 3], 0);
      for (var j = 1; j < o.q.length; j++) doc.line(XS(qMid(o.q[j - 1].q)), YS(o.q[j - 1].v), XS(qMid(o.q[j].q)), YS(o.q[j].v));
      doc.setLineDashPattern([], 0);
      o.q.forEach(function (x) { doc.setFillColor(c[0], c[1], c[2]); doc.circle(XS(qMid(x.q)), YS(x.v), 1.6, "F"); });
      var e = o.q[o.q.length - 1];
      if (SFM.inW(qMid(e.q))) endsS.push({ y: YS(e.v), t: o.vintage.slice(0, 3) + " " + e.v + " bps", c: [190, 160, 90] });
    });
    if (SFM.mba.length) {
      doc.setDrawColor(GOLD[0], GOLD[1], GOLD[2]); doc.setLineWidth(2); doc.setLineDashPattern([5, 3], 0);
      var pxS = txS, pyS = YS(SFM.last[1]);
      SFM.mba.forEach(function (x) { var qx = XS(qMid(x.q)), qy = YS(x.v); doc.line(pxS, pyS, qx, qy); pxS = qx; pyS = qy; });
      doc.setLineDashPattern([], 0);
      SFM.mba.forEach(function (x) { doc.setFillColor(GOLD[0], GOLD[1], GOLD[2]); doc.circle(XS(qMid(x.q)), YS(x.v), 2.2, "F"); });
      if (SFM.inW(qMid(lmq.q))) endsS.push({ y: YS(lmq.v), t: "MBA " + lmq.v + " bps", c: GOLD });
    }
    doc.restoreGraphicsState();
    if (endsS.length) {
      var exS = XS(qMid((SFM.mba.length ? SFM.mba : SFM.old[0].q)[(SFM.mba.length ? SFM.mba : SFM.old[0].q).length - 1].q)) + 8;
      endsS.sort(function (p, q) { return p.y - q.y; });
      for (var kS = 1; kS < endsS.length; kS++) if (endsS[kS].y - endsS[kS - 1].y < 13) endsS[kS].y = endsS[kS - 1].y + 13;
      endsS.forEach(function (it) { font(true, 10, it.c); doc.text(it.t, exS, it.y + 3.5); });
    }
    var lgS = [{ t: "Freddie Mac 30-yr minus 10-yr Treasury (weekly)", c: SPRO, lw: 1.9 }];
    if (SFM.F.mba) lgS.push({ t: "MBA implied, " + SFM.F.mba.vintage + (SFM.old.length ? " (earlier: " + SFM.old.map(function (o) { return o.vintage.slice(0, 3); }).join(", ") + ", lighter)" : " (quarterly)"), c: GOLD, lw: 2 });
    legend({ B: BS }, lgS);
    banner(++pageNo, "Sources: Freddie Mac Primary Mortgage Market Survey 30-year fixed rate (MORTGAGE30US) and 10-year Treasury constant maturity yield (DGS10, 7-day average ending each survey date), via FRED; MBA Mortgage Finance Forecast" +
      (SFM.F.mba ? " (" + SFM.F.mba.vintage + (SFM.F.mba.asOf ? ", " + SFM.F.mba.asOf : "") + (SFM.old.length ? "; earlier: " + SFM.old.map(function (o) { return o.vintage; }).join(", ") : "") + ")" : "") + ", 30-year rate minus 10-year yield, quarterly averages, each rounded to 0.1% by MBA.", SFM.last[0]);
  }
  // ---- 5. Where the 10-year is headed ----
  if (TFM) {
    doc.addPage([W, H], "landscape");
    var PGOLD = [196, 140, 0], PPUR = [142, 59, 184], PBL = [10, 98, 208];
    top = headline("Where the 10-Year Treasury Is Headed");
    titles(top, "10-Year Treasury Yield: Actual, MBA Forecast and Professional Forecasters", "Monthly average, % · forecasts are quarterly averages plotted mid-quarter; earlier rounds lighter");
    var stT = nice(TFM.hi - TFM.lo, 5), loT = Math.floor((TFM.lo - stT * 0.4) / stT) * stT, hiT = Math.ceil((TFM.hi + stT * 0.4) / stT) * stT;
    var LT = 70, RT = W - 160, TT = top + 58, BT = H - 92;
    var XT = function (sd) { return LT + (ymdT(sd) - TFM.t0) / (TFM.t1 - TFM.t0) * (RT - LT); };
    var YT = function (v) { return BT - (v - loT) / (hiT - loT) * (BT - TT); };
    doc.setLineWidth(0.5);
    for (var gT = loT; gT <= hiT + 1e-9; gT += stT) { doc.setDrawColor(RULE[0], RULE[1], RULE[2]); doc.line(LT, YT(gT), RT, YT(gT)); font(false, 8.5, GRY); doc.text(gT.toFixed(stT < 0.5 ? 2 : 1) + "%", LT - 6, YT(gT) + 3, { align: "right" }); }
    doc.setDrawColor(150, 150, 155); doc.line(LT, BT, RT, BT);
    var lxT = -99;
    fcTicks(TFM.t0, TFM.t1).forEach(function (tk) {
      var xT = LT + (tk.t - TFM.t0) / (TFM.t1 - TFM.t0) * (RT - LT);
      if (xT - lxT < 40 || xT < LT + 10 || xT > RT - 10) return;
      lxT = xT; doc.setDrawColor(150, 150, 155); doc.line(xT, BT, xT, BT + 3); font(false, 8.5, GRY); doc.text(tk.lab, xT, BT + 13, { align: "center" });
    });
    doc.saveGraphicsState(); doc.rect(LT, TT - 14, RT - LT, BT - TT + 14, null); doc.clip(); doc.discardPath();
    var txT = XT(TFM.last[0]), tyT = YT(TFM.last[1]);
    doc.setDrawColor(150, 150, 155); doc.setLineDashPattern([2, 2], 0); doc.line(txT, TT, txT, BT); doc.setLineDashPattern([], 0);
    font(false, 8, GRY); doc.text("Today", txT - 4, TT + 8, { align: "right" });
    doc.setDrawColor(PBL[0], PBL[1], PBL[2]); doc.setLineWidth(1.9);
    for (var iT = 1; iT < TFM.act.length; iT++) doc.line(XT(TFM.act[iT - 1][0]), YT(TFM.act[iT - 1][1]), XT(TFM.act[iT][0]), YT(TFM.act[iT][1]));
    var endsT = [];
    function qline(q, c, wd, dash, from) {
      doc.setDrawColor(c[0], c[1], c[2]); doc.setLineWidth(wd); doc.setLineDashPattern(dash, 0);
      var px = from ? from[0] : null, py = from ? from[1] : null;
      q.forEach(function (x) { var qx = XT(qMid(x.q)), qy = YT(x.v); if (px !== null) doc.line(px, py, qx, qy); px = qx; py = qy; });
      doc.setLineDashPattern([], 0);
      q.forEach(function (x) { doc.setFillColor(c[0], c[1], c[2]); doc.circle(XT(qMid(x.q)), YT(x.v), wd > 1.5 ? 2 : 1.5, "F"); });
    }
    TFM.mbaOld.forEach(function (o, k) { var c = k ? [232, 214, 165] : [218, 190, 120]; qline(o.q, c, 1.2, [3, 3]); var e = o.q[o.q.length - 1]; if (TFM.inW(qMid(e.q))) endsT.push({ y: YT(e.v), t: "MBA " + o.tag + " " + e.v.toFixed(1) + "%", c: [190, 160, 90], small: true }); });
    TFM.spfOld.forEach(function (o, k) { var c = k ? [222, 205, 235] : [200, 175, 222]; qline(o.q, c, 1.2, [1.5, 2]); var e = o.q[o.q.length - 1]; if (TFM.inW(qMid(e.q))) endsT.push({ y: YT(e.v), t: o.vintage + " " + e.v.toFixed(2) + "%", c: [170, 140, 200], small: true }); });
    if (TFM.mba.length) { qline(TFM.mba, PGOLD, 2, [5, 3], TFM.mbaJoin ? [txT, tyT] : null); var emT = TFM.mba[TFM.mba.length - 1]; if (TFM.inW(qMid(emT.q))) endsT.push({ y: YT(emT.v), t: "MBA " + emT.v.toFixed(1) + "% by " + tfcQ(emT.q), c: PGOLD }); }
    if (TFM.spfNow.length) { qline(TFM.spfNow, PPUR, 2, [1.5, 2], TFM.spfJoin ? [txT, tyT] : null); var esT = TFM.spfNow[TFM.spfNow.length - 1]; if (TFM.inW(qMid(esT.q))) endsT.push({ y: YT(esT.v), t: "Forecasters " + esT.v.toFixed(2) + "% by " + tfcQ(esT.q), c: PPUR }); }
    doc.setFillColor(PBL[0], PBL[1], PBL[2]); doc.circle(txT, tyT, 2.8, "F");
    font(true, 9, PBL); doc.text(TFM.last[1].toFixed(2) + "%", txT - 5, tyT - 6, { align: "right" });
    doc.restoreGraphicsState();
    endsT.sort(function (p, q) { return p.y - q.y; });
    for (var kT = 1; kT < endsT.length; kT++) if (endsT[kT].y - endsT[kT - 1].y < 11) endsT[kT].y = endsT[kT - 1].y + 11;
    var ovT = endsT.length ? endsT[endsT.length - 1].y - BT : 0; if (ovT > 0) endsT.forEach(function (it) { it.y -= ovT; });
    endsT.forEach(function (it) { font(!it.small, it.small ? 8 : 9.5, it.c); doc.text(it.t, RT + 8, it.y + 3.5); });
    var lgT = [{ t: "10-year Treasury (monthly average)", c: PBL, lw: 1.9 }];
    if (TFM.F.mba) lgT.push({ t: "MBA, " + TFM.F.mba.vintage, c: PGOLD, lw: 2 });
    if (TFM.spfNew) lgT.push({ t: "Professional forecasters (median), " + TFM.spfNew.vintage + " survey", c: PPUR, lw: 2 });
    legend({ B: BT }, lgT);
    banner(++pageNo, "Sources: 10-year Treasury constant maturity yield (DGS10), via FRED, monthly averages; MBA Mortgage Finance Forecast, 10-year Treasury yield, quarterly averages rounded to 0.1%" +
      (TFM.F.mba ? " (" + TFM.F.mba.vintage + (TFM.mbaOld.length ? "; earlier: " + TFM.mbaOld.map(function (o) { return o.name; }).join(", ") : "") + ")" : "") +
      "; Federal Reserve Bank of Philadelphia, Survey of Professional Forecasters, median 10-year Treasury rate forecast (TBOND)" + (TFM.spfNew ? " (" + TFM.spfNew.vintage + " survey" + (TFM.spfOld.length ? "; earlier: " + TFM.spfOld.map(function (o) { return o.vintage; }).join(", ") : "") + ")" : "") + ".", TFM.last[0]);
  }

  return doc;
};
`;


// ---------- Posting schedule: refresh timing and next-post countdown ----------
// POST holds this widget's FRED posting time (Central). The clock on the
// widget counts down to clock; iOS is asked to redraw at refresh, a few
// minutes later. iOS treats that as "no earlier than", so it can land late.
// lagDays: 0 = the value posted today is dated today (SOFR); 1 = it's dated
// the business day before (Treasury yields, Optimal Blue).
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// The date, weekday and time-of-day in Central time for a moment
function centralParts(t) {
  const p = {};
  new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago", hourCycle: "h23", weekday: "short",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(t).forEach((x) => (p[x.type] = x.value));
  return { ymd: `${p.year}-${p.month}-${p.day}`, weekday: p.weekday, hour: +p.hour % 24, minute: +p.minute };
}
// A Central clock time on a given date, as a Date (handles daylight saving)
function centralTime(ymd, hh, mm) {
  const [y, mo, d] = ymd.split("-").map(Number);
  const want = Date.UTC(y, mo - 1, d, hh, mm);
  let t = want + 6 * 3600 * 1000; // start from Central Standard Time
  for (let i = 0; i < 2; i++) {
    const c = centralParts(new Date(t));
    const [cy, cm, cd] = c.ymd.split("-").map(Number);
    t += want - Date.UTC(cy, cm - 1, cd, c.hour, c.minute);
  }
  return new Date(t);
}
function isWeekend(wd) {
  return wd === "Sat" || wd === "Sun";
}
// The weekday before a date (Monday -> Friday)
function prevWeekday(ymd) {
  let t = Date.UTC(...ymd.split("-").map((x, i) => +x - (i === 1 ? 1 : 0)));
  do t -= 24 * 3600 * 1000; while ([0, 6].includes(new Date(t).getUTCDay()));
  return new Date(t).toISOString().slice(0, 10);
}
// True when today's post time has passed, the value still isn't in, and
// it's not too late in the day to keep looking for it
function postIsLate(d, now, h, m) {
  const today = centralParts(now);
  if (isWeekend(today.weekday)) return false;
  if (now < centralTime(today.ymd, h, m) || today.hour >= POST.retryUntil) return false;
  const want = POST.lagDays ? prevWeekday(today.ymd) : today.ymd;
  const latest = d.pts.length ? d.pts[d.pts.length - 1].date : "";
  return latest < want;
}
// The next weekday at a Central time, strictly after now
function nextWeekdayAt(now, [h, m]) {
  for (let add = 0; add < 8; add++) {
    const day = centralParts(new Date(now.getTime() + add * 24 * 3600 * 1000));
    if (isWeekend(day.weekday)) continue;
    const t = centralTime(day.ymd, h, m);
    if (t > now) return t;
  }
  return null;
}
function nextRefresh(d, now = new Date()) {
  const HOUR = 3600 * 1000;
  if (d.stale) return new Date(now.getTime() + HOUR); // the fetch failed: try again in an hour
  if (postIsLate(d, now, ...POST.refresh)) return new Date(now.getTime() + HOUR);
  let t = nextWeekdayAt(now, POST.refresh);
  // Over a weekend the clock shows "Mon 7:02a"; redraw once it's within a
  // day so the live countdown takes over
  const c = postClock(d, now);
  if (c && c.label) {
    const flip = new Date(c.at.getTime() - 24 * HOUR + 60 * 1000);
    if (!t || flip < t) t = flip;
  }
  return t;
}
// { due: true } when today's value is late; otherwise { at } within a day
// (the widget shows a live countdown) or { at, label } like "Mon 7:02a"
function postClock(d, now = new Date()) {
  if (d.stale) return null;
  if (postIsLate(d, now, ...POST.clock)) return { due: true };
  const at = nextWeekdayAt(now, POST.clock);
  if (!at) return null;
  if (at - now <= 24 * 3600 * 1000) return { at };
  const h = at.getHours() % 12 || 12;
  const m = String(at.getMinutes()).padStart(2, "0");
  return { at, label: `${DAY_NAMES[at.getDay()]} ${h}:${m}${at.getHours() >= 12 ? "p" : "a"}` };
}

// ---------- Chart (Stocks-style sparkline) ----------
// Drawn at double size on purpose: the widget then only ever scales the
// image down to fit, which keeps the line sharp on any phone.
const SPARK_SCALE = 2;

function drawChart(pts, w, h, hex) {
  const S = SPARK_SCALE;
  const W = w * S;
  const H = h * S;
  const ctx = new DrawContext();
  ctx.size = new Size(W, H);
  ctx.opaque = false;
  ctx.respectScreenScale = true;

  const vals = pts.map((p) => p.v);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (hi - lo < 1e-9) {
    hi += 0.5;
    lo -= 0.5;
  }

  // The line uses nearly the full height, like Apple's; a little room is
  // left underneath so the fill has somewhere to finish fading.
  const top = 2 * S;
  const bottom = H * 0.9;
  const x = (i) => (pts.length === 1 ? W / 2 : S + (i * (W - 2 * S)) / (pts.length - 1));
  const y = (v) => bottom - ((v - lo) / (hi - lo)) * (bottom - top);
  const ys = vals.map(y);

  // Vertical fade. DrawContext has no gradients, so stack many thin
  // translucent layers: every layer covers the top, fewer reach the bottom.
  // Tuned to Apple's Stocks widget: about 27% strength at the top of the
  // chart, fading evenly to nothing at the bottom.
  const LAYERS = 28;
  const lineTop = Math.min(...ys);
  ctx.setFillColor(new Color(hex, 0.0112));
  for (let k = 1; k <= LAYERS; k++) {
    const level = lineTop + ((H - lineTop) * k) / LAYERS;
    const layer = new Path();
    layer.move(new Point(x(0), level));
    ys.forEach((yy, i) => layer.addLine(new Point(x(i), Math.min(yy, level))));
    layer.addLine(new Point(x(pts.length - 1), level));
    layer.closeSubpath();
    ctx.addPath(layer);
    ctx.fillPath();
  }

  // Dashed baseline at the period's starting value (Stocks' previous close)
  ctx.setStrokeColor(new Color(hex, 0.6));
  ctx.setLineWidth(1 * S);
  for (let dx = 0; dx < W; dx += 5 * S) {
    const dash = new Path();
    dash.move(new Point(dx, ys[0]));
    dash.addLine(new Point(Math.min(dx + 3 * S, W), ys[0]));
    ctx.addPath(dash);
    ctx.strokePath();
  }

  // The line, slightly heavier than before
  const line = new Path();
  ys.forEach((yy, i) => {
    const pt = new Point(x(i), yy);
    if (i === 0) line.move(pt);
    else line.addLine(pt);
  });
  ctx.addPath(line);
  ctx.setStrokeColor(new Color(hex));
  ctx.setLineWidth(2.5 * S);
  ctx.strokePath();

  // Round off the corners where segments meet, so the joins look clean
  ctx.setFillColor(new Color(hex));
  const r = 1.25 * S;
  ys.forEach((yy, i) => ctx.fillEllipse(new Rect(x(i) - r, yy - r, 2 * r, 2 * r)));

  return ctx.getImage();
}

// ---------- Widget ----------
function darkBackground(w) {
  const g = new LinearGradient();
  g.colors = [new Color("#2C2C2E"), new Color("#1C1C1E")];
  g.locations = [0, 1];
  w.backgroundGradient = g;
  if (UPD_READY) w.backgroundImage = updRing(null);
}

// spec: { pts, hex, triangleUp, topRight, name, nameHex, rightSub, value, clock }
// The next-post clock replaces the name on row 2, unless the name carries
// meaning of its own (the ARM verdict): then it sits left of the big value.
function addClock(stack, clock) {
  const icon = stack.addImage(SFSymbol.named("clock").image);
  icon.imageSize = new Size(11, 11);
  icon.tintColor = new Color(GRAY);
  stack.addSpacer(3);
  let t;
  if (clock.due) {
    t = stack.addText("due");
  } else if (clock.label) {
    t = stack.addText(clock.label);
  } else {
    t = stack.addDate(clock.at);
    t.applyTimerStyle();
  }
  t.font = Font.semiboldSystemFont(12);
  t.textColor = new Color(GRAY);
  t.lineLimit = 1;
  t.leftAlignText();
}

// Shown in place of the name (or beside the big value) when FRED couldn't be
// reached: an amber "cached" tag with the date of the newest data on hand
function addStaleTag(stack, text) {
  const amber = new Color("#FF9F0A");
  const icon = stack.addImage(SFSymbol.named("exclamationmark.triangle.fill").image);
  icon.imageSize = new Size(10, 10);
  icon.tintColor = amber;
  stack.addSpacer(3);
  const t = stack.addText(text);
  t.font = Font.semiboldSystemFont(11);
  t.textColor = amber;
  t.lineLimit = 1;
  t.minimumScaleFactor = 0.75;
}

function renderWidget(spec) {
  const white = new Color("#FFFFFF");
  const color = new Color(spec.hex);
  const clockOnNameRow = spec.clock && !CLOCK_BY_VALUE;

  const w = new ListWidget();
  darkBackground(w);
  w.setPadding(16, 17, 9, 17);

  // Row 1: triangle + ticker, change on the right
  const r1 = w.addStack();
  r1.centerAlignContent();
  const tri = r1.addText(spec.triangleUp ? "▲" : "▼");
  tri.font = Font.systemFont(13);
  tri.textColor = color;
  r1.addSpacer(3);
  const ticker = r1.addText(TICKER);
  ticker.font = Font.semiboldSystemFont(14);
  ticker.textColor = white;
  ticker.lineLimit = 1;
  ticker.minimumScaleFactor = 0.7;
  r1.addSpacer();
  const chg = r1.addText(spec.topRight);
  chg.font = Font.semiboldSystemFont(12);
  chg.textColor = color;
  chg.lineLimit = 1;

  // Row 2: name (or the clock) on the left, secondary figure on the right
  const r2 = w.addStack();
  r2.centerAlignContent();
  if (spec.staleTag && !CLOCK_BY_VALUE) {
    addStaleTag(r2, spec.staleTag);
  } else if (clockOnNameRow) {
    addClock(r2, spec.clock);
  } else {
    const name = r2.addText(spec.name);
    name.font = Font.semiboldSystemFont(12);
    name.textColor = new Color(spec.nameHex || GRAY);
    name.lineLimit = 1;
  }
  r2.addSpacer(4);
  r2.addSpacer();
  const sub = r2.addText(spec.rightSub);
  sub.font = Font.semiboldSystemFont(12);
  sub.textColor = color;
  sub.lineLimit = 1;

  // A small fixed gap, so the chart is the only stretchy thing in the column
  // and iOS lets it take the full content width instead of shrinking it.
  w.addSpacer(5);

  const img = w.addImage(drawChart(spec.pts, 136, 66, spec.hex));
  img.centerAlignImage();

  // Big value, right-aligned (with the clock bottom-left when it lives here)
  const r3 = w.addStack();
  if (spec.staleTag && CLOCK_BY_VALUE) {
    // the name row carries the verdict here, so the tag sits beside the value
    r3.bottomAlignContent();
    const c = r3.addStack();
    c.layoutVertically();
    const top = c.addStack();
    top.centerAlignContent();
    addStaleTag(top, spec.staleTag);
    const when = c.addText(spec.staleDate || "");
    when.font = Font.semiboldSystemFont(11);
    when.textColor = new Color("#FF9F0A");
    when.lineLimit = 1;
    r3.addSpacer(4);
  } else if (spec.clock && CLOCK_BY_VALUE) {
    r3.bottomAlignContent();
    const c = r3.addStack();
    c.centerAlignContent();
    addClock(c, spec.clock);
    r3.addSpacer(4);
  }
  r3.addSpacer();
  const value = r3.addText(spec.value);
  value.font = Font.mediumSystemFont(40);
  value.textColor = white;
  value.lineLimit = 1;
  value.minimumScaleFactor = 0.6;

  // Tapping the widget runs this script in the app, which opens the detail view
  w.url = URLScheme.forRunningScript();

  w.refreshAfterDate = new Date(Date.now() + REFRESH_HOURS * 3600 * 1000);
  return w;
}

function errorWidget(msg) {
  const w = new ListWidget();
  darkBackground(w);
  const t = w.addText(TICKER + " widget error");
  t.font = Font.semiboldSystemFont(11);
  t.textColor = new Color("#FFFFFF");
  w.addSpacer(4);
  const m = w.addText(String(msg));
  m.font = Font.systemFont(9);
  m.textColor = new Color(GRAY);
  return w;
}

// Whole-number text with a plain hyphen for negatives, and no "-0"
function whole(v) {
  const r = Math.round(v);
  return (r < 0 ? "-" : "") + Math.abs(r);
}
function signedWhole(v) {
  const r = Math.round(v);
  return (r > 0 ? "+" : r < 0 ? "-" : "") + Math.abs(r);
}

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
  try {
    await background(() => open);
  } catch (e) {}
  const later = await sharing;
  await closed;
  for (const req of later) {
    try {
      await handleShare(req);
    } catch (e) {}
  }
}

// ---------- Detail view (shown when the script runs in the app) ----------
// Note: the page script below avoids backticks, backslashes and dollar-brace
// on purpose, because the whole page lives inside a template literal.
const DETAIL_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  :root { --bg:#1C1C1E; --fg:#FFFFFF; --gray:#98989F; --rule:#3A3A3C; }
  * { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  body { margin:0; padding:20px 18px 32px; background:var(--bg); color:var(--fg);
         font-family:-apple-system,system-ui,sans-serif;
         -webkit-user-select:none; user-select:none; }
  .ticker { font-size:28px; font-weight:700; }
  .name { color:var(--gray); font-size:15px; font-weight:600; margin-top:2px; }
  .valrow { display:flex; align-items:baseline; margin-top:14px; }
  .value { font-size:46px; font-weight:600; font-variant-numeric:tabular-nums; }
  .unit { color:var(--gray); font-size:15px; font-weight:600; margin-left:8px; }
  .change { font-size:17px; font-weight:600; margin-left:auto; font-variant-numeric:tabular-nums; }
  .sub { color:var(--gray); font-size:13px; margin-top:2px; min-height:18px;
         font-variant-numeric:tabular-nums; }
  .seg { display:flex; background:#2C2C2E; border-radius:9px; padding:2px; margin:18px 0 12px; }
  .seg button { flex:1; border:0; background:transparent; color:var(--fg); font:inherit;
                font-size:14px; font-weight:600; padding:7px 0; border-radius:7px; }
  .seg button.on { background:#636366; }
  .legend { display:flex; flex-wrap:wrap; margin:0 0 8px; font-size:13px; font-weight:600;
            font-variant-numeric:tabular-nums; }
  .legend i { display:inline-block; width:14px; height:4px; border-radius:2px;
              vertical-align:middle; margin-right:5px; }
  .legend > span { margin:2px 16px 2px 0; }
  .legend span span { color:var(--gray); font-weight:500; margin-left:4px; }
  .legend > span[data-k] { padding:5px 0; }
  .legend > span.off { opacity:0.35; text-decoration:line-through; }
  #chartWrap { position:relative; }
  #chart { display:block; width:100%; height:300px; touch-action:none; }
  #touch { position:absolute; left:0; top:0; right:0; bottom:0; touch-action:none; }
  .stats { display:grid; grid-template-columns:1fr 1fr; gap:0 24px; margin-top:14px; }
  .stat { display:flex; justify-content:space-between; padding:9px 0;
          border-bottom:1px solid var(--rule); font-size:14px;
          font-variant-numeric:tabular-nums; }
  .stat span:first-child { color:var(--gray); }
  .h2 { font-size:20px; font-weight:700; margin:28px 0 10px; }
  .bar { display:flex; height:14px; border-radius:7px; overflow:hidden; margin-bottom:10px; }
  .mixrow { display:grid; grid-template-columns:1fr 64px 64px 64px; padding:9px 0;
            border-bottom:1px solid var(--rule); font-size:14px;
            font-variant-numeric:tabular-nums; }
  .mixrow span { text-align:right; }
  .mixrow span:first-child { text-align:left; }
  .mixrow.head { color:var(--gray); font-size:12px; font-weight:600; }
  .mixrow.total { font-weight:700; border-bottom:0; }
  .dot { display:inline-block; width:9px; height:9px; border-radius:50%; margin-right:7px; }
  .note { color:var(--gray); font-size:11px; line-height:1.45; margin-top:16px; }
  #sched { margin:10px 0 4px; border:1px solid #2C2C2E; border-radius:12px; padding:8px 10px 6px; background:#232325; }
  .schedHead { display:flex; justify-content:space-between; align-items:baseline; font-size:12.5px; margin-bottom:3px; }
  .schedHead span { color:#8E8E93; font-size:10.5px; }
  .schedRow { display:flex; gap:8px; align-items:baseline; font-size:12px; padding:3px 0; border-top:1px solid #2C2C2E; }
  .schedRow:first-of-type { border-top:none; }
  .schedName { flex:1; color:#E5E5EA; line-height:1.25; }
  .schedName i { display:block; font-style:normal; color:#8E8E93; font-size:10.5px; }
  .schedLast { color:#98989F; white-space:nowrap; font-size:11.5px; }
  .schedNext { color:#FFFFFF; font-weight:700; white-space:nowrap; min-width:92px; text-align:right; font-variant-numeric:tabular-nums; }
  .schedNext i { display:block; font-style:normal; font-weight:500; color:#98989F; font-size:10.5px; }
  .schedName i.schedWhy { color:#FFB35C; margin-top:2px; }
  .schedMore { color:#64A8FF; font-size:12px; font-weight:700; text-align:center; padding:5px 0 1px; cursor:pointer; }
  .howBtn { font-size:12.5px; font-weight:700; color:#64A8FF; border:1px solid #64A8FF; border-radius:10px; padding:4px 9px; cursor:pointer; white-space:nowrap; }
  .howWrap { display:none; position:fixed; left:0; top:0; right:0; bottom:0; background:rgba(0,0,0,0.6); z-index:50; overflow-y:auto; -webkit-overflow-scrolling:touch; }
  .howWrap.on { display:block; }
  .howSheet { background:#1C1C1E; margin:40px 10px 30px; border-radius:16px; padding:18px 16px 20px; border:1px solid #3A3A3C; }
  .howSheet h3 { margin:0; font-size:20px; } .howSheet .sub2 { color:#98989F; font-size:12.5px; margin:4px 0 8px; line-height:1.4; }
  .howSheet .it { display:flex; gap:10px; margin-top:12px; align-items:flex-start; } .howSheet .gl { flex:0 0 72px; }
  .howSheet .it b { display:block; font-size:14.5px; color:#FFFFFF; } .howSheet .it span { display:block; color:#C7C7CC; font-size:13px; line-height:1.4; } .howSheet .it span.mn { color:#FFFFFF; font-weight:600; margin:1px 0 3px; }
  .howSheet .done { display:block; text-align:center; margin-top:18px; padding:10px; border-radius:10px; background:#2C2C2E; font-weight:700; color:#64A8FF; cursor:pointer; }
  .fcsub { color:var(--gray); font-size:13px; margin:-4px 0 8px; line-height:1.4; font-variant-numeric:tabular-nums; }
  .fclink { color:var(--gray); font-size:13px; font-weight:600; padding:10px 0 0; }
  .fclink span { color:#64A8FF; cursor:pointer; padding:4px 0; }
  .fcleg i.dash { background:none; border-top:3px dashed #FFD60A; height:0; }
  .legend i.dashg { background:none; border-top:3px dashed #C7C7CC; height:0; }
  html, body { -webkit-text-size-adjust:100%; text-size-adjust:100%; }
  @media (max-width: 360px) {
    body { padding:16px 12px 28px; }
    .ticker { font-size:24px; }
    .value { font-size:38px; }
    .seg button { font-size:12px; }
    .stats { gap:0 14px; }
    .stat { font-size:13px; }
    .mixrow { grid-template-columns:1fr 52px 52px 52px; font-size:13px; }
  }
</style>
</head>
<body>
  <div class="ticker" id="ticker"></div>
  <div class="name" id="name"></div>
  <div id="sched" style="display:none"></div>
  <div id="staleNote" style="display:none;color:#FF9F0A;font-size:13px;font-weight:600;margin-top:6px"></div>
  <div class="valrow">
    <span class="value" id="value"></span><span class="unit" id="unit"></span>
  </div>
  <div class="sub" id="sub"></div>

  <div class="seg" id="seg">
    <button data-r="1W">1W</button>
    <button data-r="1M">1M</button>
    <button data-r="3M">3M</button>
    <button data-r="6M">6M</button>
    <button data-r="1Y">1Y</button>
    <button data-r="5Y">5Y</button>
  </div>


  <div class="legend" id="legend"></div>

  <div id="chartWrap">
    <svg id="chart" xmlns="http://www.w3.org/2000/svg"></svg>
    <div id="touch"></div>
  </div>

  <div id="moveBox" style="display:none">
    <div class="h2" style="margin:24px 0 8px">MOVE vs spread</div>
    <div class="legend" id="moveLegend"></div>
    <div id="moveWrap" style="position:relative">
      <svg id="moveChart" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%;height:240px"></svg>
      <div id="touch2" style="position:absolute;left:0;top:0;right:0;bottom:0;touch-action:pan-y"></div>
    </div>
    <div class="sub" id="moveNote" style="color:#FF9F0A"></div>
  </div>

  <div id="tpBox" style="display:none">
    <div class="h2" style="margin:24px 0 8px;display:flex;align-items:center;justify-content:space-between">What&#39;s in the 10-year<span class="howBtn" id="tpHow">How to read</span></div>
    <div class="legend" id="tpLegend"></div>
    <div style="position:relative">
      <svg id="tpChart" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%;height:220px"></svg>
      <div id="touch3" style="position:absolute;left:0;top:0;right:0;bottom:0;touch-action:pan-y"></div>
    </div>
    <div class="note" id="tpNote"></div>
  </div>

  <div id="sfcSec" style="display:none">
    <div class="h2" style="margin:28px 0 8px">Where the spread is headed</div>
    <div class="fcsub" id="sfcSub"></div>
    <div class="legend fcleg" id="sfcLeg"></div>
    <div style="position:relative"><svg id="sfcChart" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%;height:230px"></svg><div id="sfcTouch" style="position:absolute;left:0;top:0;right:0;bottom:0;touch-action:pan-y"></div></div>
    <div class="fclink" id="sfcLink" style="display:none"></div>
    <div class="note" id="sfcNote"></div>
  </div>

  <div id="tfcSec" style="display:none">
    <div class="h2" style="margin:28px 0 8px">Where the 10-year is headed</div>
    <div class="fcsub" id="tfcSub"></div>
    <div class="legend fcleg" id="tfcLeg"></div>
    <div style="position:relative"><svg id="tfcChart" xmlns="http://www.w3.org/2000/svg" style="display:block;width:100%;height:230px"></svg><div id="tfcTouch" style="position:absolute;left:0;top:0;right:0;bottom:0;touch-action:pan-y"></div></div>
    <div class="note" id="tfcNote"></div>
  </div>

  <div class="stats" id="stats"></div>

  <div id="mix" style="display:none">
    <div class="h2">Market mix</div>
    <div class="bar" id="mixBar"></div>
    <div id="mixRows"></div>
    <div class="note" id="mixNote"></div>
  </div>

  <div class="note" id="note"></div>

<div class="howWrap" id="howWrap"><div class="howSheet" id="howSheet"></div></div>
<script>
var D = __DATA__;
var GREEN = "#5FC663", RED = "#EB4D3D";
var MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
var DAYS = { "1W": 7, "1M": 30, "3M": 91, "6M": 182, "1Y": 365, "5Y": 1826 };
// Moving averages, in trading days
var MAS = [
  { n: 5, label: "5D", color: "#FFD60A" },
  { n: 21, label: "21D", color: "#64D2FF" },
  { n: 63, label: "63D", color: "#BF5AF2" }
];
var UNIT_SUFFIX = D.unit === "%" ? "%" : " " + D.unit;
var svg = document.getElementById("chart");
var pts = [], mas = [], geo = null, color = GREEN;

function el(id) { return document.getElementById(id); }
// "Oct 2", plus the year when it differs from the latest point's year
var LAST_YEAR = D.pts[D.pts.length - 1].date.slice(0, 4);
function fmtDate(s) {
  var p = s.split("-");
  return MONTHS[+p[1] - 1] + " " + (+p[2]) + (p[0] !== LAST_YEAR ? ", " + p[0] : "");
}
function shiftDate(s, days) {
  var d = new Date(s + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}
// Value in the chart's own units, plain hyphen for negatives, never "-0"
function fmtV(v) {
  var s = Math.abs(v).toFixed(D.dec);
  return (v < 0 && parseFloat(s) !== 0 ? "-" : "") + s;
}
// A change between two values, in the change units (bps)
function fmtC(delta) {
  var c = delta * D.chg.scale;
  var s = Math.abs(c).toFixed(D.chg.dec);
  var zero = parseFloat(s) === 0;
  return (zero ? "" : c > 0 ? "+" : "-") + s + " " + D.chg.unit;
}
function colorFor(delta) {
  var bad = D.upIsGood ? delta < 0 : delta > 0;
  return bad ? RED : GREEN;
}

// Simple moving average over the full history; null until n points exist.
function sma(values, n) {
  var out = [], sum = 0;
  for (var i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= n) sum -= values[i - n];
    out.push(i >= n - 1 ? sum / n : null);
  }
  return out;
}
var ALL_VALS = D.pts.map(function (p) { return p.v; });

// What gets drawn over the main line: the payload's own lines (one per
// product) when it has them, otherwise the three moving averages.
var LINE_MODE = !!(D.lines && D.lines.length);
// Band mode: two rate lines on a left axis with the gap between them shaded,
// and the main value (the gap itself) as a line on the right axis.
var BAND = D.band || null;
// Band mode draws the actual rate levels, in percent, on the left axis
// (the Change view was removed).
var bandView = "levels";
var OVERLAYS = BAND
  ? []
  : LINE_MODE
  ? D.lines.map(function (l) {
      return {
        label: l.label,
        color: l.color,
        all: D.pts.map(function (p) {
          var v = p[l.key];
          return v === undefined || v === null ? null : v;
        })
      };
    })
  : MAS.map(function (m) {
      return { label: m.label, color: m.color, all: sma(ALL_VALS, m.n) };
    });
// Lines switched off by tapping their legend entry. Resets each time the chart opens.
var HIDDEN = OVERLAYS.map(function () { return false; });
// In line mode the main line is bold white so it stands apart from the colored lines.
var MAIN_WHITE = "#FFFFFF";

function legend(i) {
  var html = "";
  if (BAND) {
    var bp = pts[i];
    var tail = function (key) {
      if (bandView !== "change") return "";
      var c = Math.round((bp[key] - pts[0][key]) * 100);
      return " (" + (c > 0 ? "+" : c < 0 ? "-" : "") + Math.abs(c) + ")";
    };
    var items = [
      [BAND.top.color, BAND.top.label, bp[BAND.top.key].toFixed(2) + tail(BAND.top.key)],
      [BAND.bottom.color, BAND.bottom.label, bp[BAND.bottom.key].toFixed(2) + tail(BAND.bottom.key)],
      [color, BAND.label, fmtV(bp.v)]
    ];
    for (var b = 0; b < items.length; b++) {
      html += '<span><i style="background:' + items[b][0] + '"></i>' + items[b][1] +
              '<span>' + items[b][2] + '</span></span>';
    }
    el("legend").innerHTML = html;
    return;
  }
  for (var k = 0; k < OVERLAYS.length; k++) {
    var v = mas[k][i];
    html += '<span data-k="' + k + '"' + (HIDDEN[k] ? ' class="off"' : '') +
            '><i style="background:' + OVERLAYS[k].color + '"></i>' + OVERLAYS[k].label +
            '<span>' + (v === null ? "n/a" : fmtV(v)) + '</span></span>';
  }
  el("legend").innerHTML = html;
}

// Header shows the latest point, or the point under your finger while scrubbing.
function header(i) {
  if (i === null) i = pts.length - 1;
  var p = pts[i];
  legend(i);
  var delta = p.v - pts[0].v;
  el("value").textContent = fmtV(p.v);
  var sub = fmtDate(p.date);
  for (var k = 0; k < D.legs.length; k++) {
    var lv = p[D.legs[k].key];
    var txt = (lv === undefined || lv === null) ? "n/a" : lv.toFixed(2) + "%";
    if (D.legs.length <= 2) sub += "  ·  " + D.legs[k].label + " " + txt;
    el("leg" + k).textContent = txt;
  }
  el("sub").textContent = sub;
}

// The chart shows a window of the full history: D.pts[win.a .. win.b].
// Range buttons set it; pinching (where enabled) reshapes it freely.
var N = D.pts.length;
var win = { a: 0, b: N - 1 };
var curRange = "3M";
var MIN_WIN_SPAN = 4; // never zoom in past five points, about a week

function highlight(r) {
  var btns = document.querySelectorAll("#seg button");
  for (var b = 0; b < btns.length; b++) {
    btns[b].className = btns[b].getAttribute("data-r") === r ? "on" : "";
  }
}

function applyWindow(a, b) {
  a = Math.max(0, Math.round(a));
  b = Math.min(N - 1, Math.round(b));
  if (b - a < 1) a = Math.max(0, b - 1);
  win.a = a; win.b = b;
  pts = D.pts.slice(a, b + 1);
  mas = OVERLAYS.map(function (o) { return o.all.slice(a, b + 1); });

  var vals = pts.map(function (p) { return p.v; });
  var hi = Math.max.apply(null, vals), lo = Math.min.apply(null, vals);
  var avg = vals.reduce(function (s, v) { return s + v; }, 0) / vals.length;
  var delta = pts[pts.length - 1].v - pts[0].v;
  color = colorFor(delta);

  el("sHigh").textContent = fmtV(hi) + UNIT_SUFFIX;
  el("sLow").textContent = fmtV(lo) + UNIT_SUFFIX;
  el("sAvg").textContent = fmtV(avg) + UNIT_SUFFIX;

  render();
  header(null);
}

function select(r) {
  curRange = r;
  var lastDate = D.pts[N - 1].date;
  var from = shiftDate(lastDate, DAYS[r]);
  var start = 0;
  while (start < N - 2 && D.pts[start].date < from) start++;
  highlight(r);
  applyWindow(start, N - 1);
}

function render() {
  var w = svg.clientWidth || 340, h = svg.clientHeight || 300;
  // Scale to fit if the real width turns out different, until refit redraws
  svg.setAttribute("viewBox", "0 0 " + w + " " + h);
  svg.setAttribute("preserveAspectRatio", "xMinYMin meet");
  var m = { l: BAND ? 38 : 4, r: 40, t: 10, b: 24 };
  var vals = pts.map(function (p) { return p.v; });
  // Scale to the main line and every overlay line in view
  for (var a = 0; a < mas.length; a++) {
    if (HIDDEN[a]) continue; // hidden lines don't stretch the axis
    for (var j = 0; j < mas[a].length; j++) {
      if (mas[a][j] !== null) vals.push(mas[a][j]);
    }
  }
  var hi = Math.max.apply(null, vals), lo = Math.min.apply(null, vals);
  var pad = (hi - lo) * 0.1; hi += pad; lo -= pad;
  // Enforce the minimum axis height, centered on the data
  if (hi - lo < D.minSpan) {
    var mid = (hi + lo) / 2;
    hi = mid + D.minSpan / 2;
    lo = mid - D.minSpan / 2;
  }
  var x = function (i) { return m.l + i * (w - m.l - m.r) / (pts.length - 1); };
  var y = function (v) { return m.t + (hi - v) / (hi - lo) * (h - m.t - m.b); };
  geo = { x: x, y: y, w: w, h: h, m: m };

  var s = "";
  s += '<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">' +
       '<stop offset="0" stop-color="' + color + '" stop-opacity="0.12"/>' +
       '<stop offset="1" stop-color="' + color + '" stop-opacity="0"/>' +
       '</linearGradient></defs>';

  // Gridlines on round numbers, labels on the right like Stocks.
  // Steps are in bps; a percent chart uses the same steps divided by 100.
  var u = D.unit === "%" ? 0.01 : 1;
  var span = (hi - lo) / u;
  var step = (span <= 60 ? 10 : span <= 150 ? 25 : span <= 300 ? 50 : 100) * u;
  // Band mode: right-axis numbers take the main line's color and get no
  // gridlines of their own, so the grid belongs to the left axis only.
  for (var k = Math.ceil(lo / step - 1e-9); k * step <= hi + 1e-9; k++) {
    var v = k * step, gy = y(v);
    if (!BAND) {
      s += '<line x1="' + m.l + '" x2="' + (w - m.r) + '" y1="' + gy + '" y2="' + gy +
           '" stroke="#3A3A3C" stroke-width="1"/>';
    }
    s += '<text x="' + (w - m.r + 6) + '" y="' + (gy + 4) + '" fill="' +
         (BAND ? color : "#98989F") + '" font-size="11">' + fmtV(v) + '</text>';
  }

  // Left axis for the two rates: percent levels, or bps change since the
  // start of the range, depending on the view
  var yr = null, bandTop = [], bandBot = [];
  if (BAND) {
    var chgView = bandView === "change";
    var t0 = pts[0][BAND.top.key], b0 = pts[0][BAND.bottom.key];
    var rhi = -Infinity, rlo = Infinity;
    for (var ri = 0; ri < pts.length; ri++) {
      var tv = pts[ri][BAND.top.key], bv0 = pts[ri][BAND.bottom.key];
      if (chgView) { tv = (tv - t0) * 100; bv0 = (bv0 - b0) * 100; }
      bandTop.push(tv); bandBot.push(bv0);
      rhi = Math.max(rhi, tv, bv0);
      rlo = Math.min(rlo, tv, bv0);
    }
    var rpad = (rhi - rlo) * 0.08; rhi += rpad; rlo -= rpad;
    var rmin = chgView ? 20 : 0.2; // never zoom in past 20 bps of height
    if (rhi - rlo < rmin) {
      var rmid = (rhi + rlo) / 2;
      rhi = rmid + rmin / 2; rlo = rmid - rmin / 2;
    }
    yr = function (v) { return m.t + (rhi - v) / (rhi - rlo) * (h - m.t - m.b); };
    var ru = chgView ? 1 : 0.01;
    var rspan = (rhi - rlo) / ru;
    var rstep = (rspan <= 60 ? 10 : rspan <= 150 ? 25 : rspan <= 300 ? 50 : 100) * ru;
    for (var rk = Math.ceil(rlo / rstep - 1e-9); rk * rstep <= rhi + 1e-9; rk++) {
      var rv = rk * rstep, rgy = yr(rv);
      var isZero = chgView && rk === 0;
      var rlabel = chgView
        ? (rk > 0 ? "+" : rk < 0 ? "-" : "") + Math.abs(Math.round(rv))
        : rv.toFixed(2);
      s += '<line x1="' + m.l + '" x2="' + (w - m.r) + '" y1="' + rgy + '" y2="' + rgy +
           '" stroke="' + (isZero ? "#8E8E93" : "#3A3A3C") + '" stroke-width="1"/>';
      s += '<text x="' + (m.l - 6) + '" y="' + (rgy + 4) +
           '" fill="#98989F" font-size="11" text-anchor="end">' + rlabel + '</text>';
    }
  }

  // Optional labeled threshold lines (only drawn when inside the axis range)
  var bands = D.bands || [];
  for (var bi = 0; bi < bands.length; bi++) {
    var bv = bands[bi].v;
    if (bv <= lo || bv >= hi) continue;
    var bgy = y(bv);
    s += '<line x1="' + m.l + '" x2="' + (w - m.r) + '" y1="' + bgy + '" y2="' + bgy +
         '" stroke="' + bands[bi].color + '" stroke-opacity="0.7" stroke-width="1" stroke-dasharray="2 4"/>';
    s += '<text x="' + (m.l + 2) + '" y="' + (bgy - 4) + '" fill="' + bands[bi].color +
         '" font-size="10" font-weight="600">' + bands[bi].label + '</text>';
  }

  var d = "";
  for (var i = 0; i < pts.length; i++) {
    d += (i ? "L" : "M") + x(i).toFixed(1) + " " + y(pts[i].v).toFixed(1) + " ";
  }
  var base = h - m.b;
  var mainColor = LINE_MODE ? MAIN_WHITE : color;

  // Overlay lines, skipping any gaps
  var over = "";
  for (var k2 = 0; k2 < OVERLAYS.length; k2++) {
    if (HIDDEN[k2]) continue;
    var md = "", pen = false;
    for (var q = 0; q < pts.length; q++) {
      var mv = mas[k2][q];
      if (mv === null) { pen = false; continue; }
      md += (pen ? "L" : "M") + x(q).toFixed(1) + " " + y(mv).toFixed(1) + " ";
      pen = true;
    }
    if (md) {
      over += '<path d="' + md + '" fill="none" stroke="' + OVERLAYS[k2].color +
              '" stroke-width="' + (LINE_MODE ? 1.5 : 2.5) +
              '" stroke-linejoin="round" stroke-linecap="round"/>';
    }
  }

  // Dashed baseline at the range's starting value
  var by = y(pts[0].v);
  var baseline = '<line x1="' + m.l + '" x2="' + (w - m.r) + '" y1="' + by + '" y2="' + by +
       '" stroke="' + mainColor + '" stroke-opacity="0.4" stroke-width="1" stroke-dasharray="4 3"/>';

  if (BAND) {
    // Shaded gap between the two rates, the rates themselves, then the
    // gap as its own line against the right axis.
    var topD = "", botD = "", backD = "";
    for (var bq = 0; bq < pts.length; bq++) {
      var bx = x(bq).toFixed(1);
      topD += (bq ? "L" : "M") + bx + " " + yr(bandTop[bq]).toFixed(1) + " ";
      botD += (bq ? "L" : "M") + bx + " " + yr(bandBot[bq]).toFixed(1) + " ";
    }
    for (var br = pts.length - 1; br >= 0; br--) {
      backD += "L" + x(br).toFixed(1) + " " + yr(bandBot[br]).toFixed(1) + " ";
    }
    s += '<path d="' + topD + backD + 'Z" fill="' + color + '" fill-opacity="0.14"/>';
    s += '<path d="' + topD + '" fill="none" stroke="' + BAND.top.color +
         '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
    s += '<path d="' + botD + '" fill="none" stroke="' + BAND.bottom.color +
         '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
    s += baseline;
    s += '<path d="' + d + '" fill="none" stroke="' + color +
         '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
  } else if (LINE_MODE) {
    // Product lines underneath, bold white weighted average on top
    s += baseline + over;
    s += '<path d="' + d + '" fill="none" stroke="' + mainColor +
         '" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>';
  } else {
    // Faint fill and a thin, dimmed daily line, so the moving averages lead
    s += '<path d="' + d + "L" + x(pts.length - 1).toFixed(1) + " " + base +
         " L" + x(0).toFixed(1) + " " + base + ' Z" fill="url(#g)"/>';
    s += baseline;
    s += '<path d="' + d + '" fill="none" stroke="' + color +
         '" stroke-opacity="0.6" stroke-width="1" stroke-linejoin="round" stroke-linecap="round"/>';
    s += over;
  }

  // Date labels: start and end of the range
  s += '<text x="' + m.l + '" y="' + (h - 6) + '" fill="#98989F" font-size="11">' +
       fmtDate(pts[0].date) + '</text>';
  s += '<text x="' + (w - m.r) + '" y="' + (h - 6) +
       '" fill="#98989F" font-size="11" text-anchor="end">' +
       fmtDate(pts[pts.length - 1].date) + '</text>';

  // Scrub cursor, hidden until touched
  s += '<g id="cur" visibility="hidden">' +
       '<line id="curLine" y1="' + m.t + '" y2="' + base + '" stroke="#FFFFFF" stroke-opacity="0.5" stroke-width="1"/>' +
       '<circle id="curDot" r="5" fill="' + mainColor + '" stroke="#1C1C1E" stroke-width="2"/></g>';

  svg.innerHTML = s;
}

function scrub(clientX) {
  if (!geo) return;
  var rect = svg.getBoundingClientRect();
  var px = clientX - rect.left;
  var span = geo.w - geo.m.l - geo.m.r;
  var i = Math.round((px - geo.m.l) / span * (pts.length - 1));
  i = Math.max(0, Math.min(pts.length - 1, i));
  var cx = geo.x(i), cy = geo.y(pts[i].v);
  el("cur").setAttribute("visibility", "visible");
  el("curLine").setAttribute("x1", cx);
  el("curLine").setAttribute("x2", cx);
  el("curDot").setAttribute("cx", cx);
  el("curDot").setAttribute("cy", cy);
  header(i);
}
function endScrub() {
  var c = el("cur");
  if (c) c.setAttribute("visibility", "hidden");
  header(null);
}

// ---- Touch handling ----
// One finger scrubs. Where the payload enables zoom: two fingers pinch to
// zoom the time axis and drag to pan, and a double-tap resets to the last
// range button. All touches land on a layer that is never redrawn, so a
// gesture keeps working while the chart underneath is rebuilt.
var touchLayer = el("touch");
var fingers = {};        // pointerId -> { x, y }
var pinch = null;        // state captured when the second finger lands
var pinchLock = false;   // true from pinch start until every finger lifts
var pendingWin = null, rafId = 0, lastTap = null;

function fingerIds() { return Object.keys(fingers); }
function plotBox() {
  var rect = svg.getBoundingClientRect();
  return { left: rect.left + geo.m.l, width: geo.w - geo.m.l - geo.m.r };
}
function pinchNow() {
  var k = fingerIds(), p = fingers[k[0]], q = fingers[k[1]];
  var dx = p.x - q.x, dy = p.y - q.y;
  return { dist: Math.max(Math.sqrt(dx * dx + dy * dy), 10), mid: (p.x + q.x) / 2 };
}
function fracAt(clientX) {
  var box = plotBox();
  return Math.max(0, Math.min(1, (clientX - box.left) / box.width));
}
function scheduleWindow(a, b) {
  pendingWin = [a, b];
  if (rafId) return;
  rafId = requestAnimationFrame(function () {
    rafId = 0;
    var p = pendingWin; pendingWin = null;
    if (Math.round(p[0]) === win.a && Math.round(p[1]) === win.b) return;
    highlight(null); // a custom window matches no range button
    applyWindow(p[0], p[1]);
  });
}

function onDown(e) {
  fingers[e.pointerId] = { x: e.clientX, y: e.clientY };
  var n = fingerIds().length;
  if (n === 2 && D.zoom) {
    var st = pinchNow(), span = win.b - win.a;
    // Remember which data point sits between the fingers; it stays there.
    pinch = { dist: st.dist, span: span, anchor: win.a + fracAt(st.mid) * span };
    pinchLock = true;
    var c = el("cur");
    if (c) c.setAttribute("visibility", "hidden");
    header(null);
  } else if (n === 1 && !pinchLock) {
    var now = Date.now();
    if (D.zoom && lastTap && now - lastTap.t < 320 && Math.abs(e.clientX - lastTap.x) < 30) {
      lastTap = null;
      select(curRange); // double-tap: back to the last range button
      return;
    }
    lastTap = { t: now, x: e.clientX };
    scrub(e.clientX);
  }
}
function onMove(e) {
  if (!fingers[e.pointerId]) return; // hovering mouse, or a finger we never saw land
  fingers[e.pointerId] = { x: e.clientX, y: e.clientY };
  if (pinch && fingerIds().length >= 2) {
    var st = pinchNow();
    // Fingers apart = fewer points in view. The anchored point follows the
    // midpoint of the fingers, which is also what makes a two-finger drag pan.
    var span = Math.max(Math.min(MIN_WIN_SPAN, N - 1), Math.min(N - 1, pinch.span * pinch.dist / st.dist));
    var a = pinch.anchor - fracAt(st.mid) * span, b = a + span;
    if (a < 0) { b -= a; a = 0; }
    if (b > N - 1) { a -= b - (N - 1); b = N - 1; }
    scheduleWindow(Math.max(0, a), b);
  } else if (!pinchLock) {
    scrub(e.clientX);
  }
}
function onUp(e) {
  delete fingers[e.pointerId];
  var n = fingerIds().length;
  if (n < 2) pinch = null;
  if (n === 0) {
    if (!pinchLock) endScrub();
    pinchLock = false;
  }
}
touchLayer.addEventListener("pointerdown", onDown);
touchLayer.addEventListener("pointermove", onMove);
touchLayer.addEventListener("pointerup", onUp);
touchLayer.addEventListener("pointercancel", onUp);
touchLayer.addEventListener("pointerleave", onUp);
// Keep the page itself from zooming under a pinch
document.addEventListener("gesturestart", function (e) { e.preventDefault(); });

var btns = document.querySelectorAll("#seg button");
for (var b = 0; b < btns.length; b++) {
  btns[b].addEventListener("click", function () { select(this.getAttribute("data-r")); });
}
window.addEventListener("resize", function () { render(); header(null); });
// Redraw once the page knows its real width: some phones lay the page out
// after the first draw, which left charts cut off or squeezed.
function refit() {
  var cw = svg.clientWidth;
  if (cw && geo && Math.abs(cw - geo.w) > 1) { render(); header(null); }
}
[60, 250, 700, 1500].forEach(function (ms) { setTimeout(refit, ms); });
window.addEventListener("load", refit);
if (window.ResizeObserver) new ResizeObserver(refit).observe(svg);

// Tap a legend entry to hide or show its line. The legend is rebuilt on
// every update, so listen on the container, not the entries.
el("legend").addEventListener("click", function (e) {
  var t = e.target;
  while (t && t !== this && !(t.getAttribute && t.getAttribute("data-k") !== null)) t = t.parentNode;
  if (!t || t === this) return;
  var k = +t.getAttribute("data-k");
  HIDDEN[k] = !HIDDEN[k];
  render();
  header(null);
});

// Band mode: a taller chart
if (BAND) {
  svg.style.height = "380px";
}

// Stats grid: four range stats, then one row per rate behind the number
(function () {
  var rows = [["High", "sHigh"], ["Low", "sLow"], ["Average", "sAvg"]];
  for (var k = 0; k < D.legs.length; k++) rows.push([D.legs[k].label, "leg" + k]);
  var html = "";
  for (var r = 0; r < rows.length; r++) {
    html += '<div class="stat"><span>' + rows[r][0] + '</span><span id="' + rows[r][1] + '"></span></div>';
  }
  el("stats").innerHTML = html;
})();

// Market mix section (only for charts that carry one)
(function () {
  if (!D.mix) return;
  var bar = "", rows = '<div class="mixrow head"><span>Product</span><span>Share</span><span>Rate</span><span>Adds</span></div>';
  for (var k = 0; k < D.mix.rows.length; k++) {
    var r = D.mix.rows[k];
    bar += '<div style="width:' + r.share + '%;background:' + r.color + '"></div>';
    rows += '<div class="mixrow"><span><i class="dot" style="background:' + r.color + '"></i>' + r.label +
            '</span><span>' + r.share.toFixed(1) + '%</span><span>' + r.rate.toFixed(2) +
            '%</span><span>' + (r.share * r.rate / 100).toFixed(2) + '</span></div>';
  }
  rows += '<div class="mixrow total"><span>Weighted average</span><span>100%</span><span>' +
          D.mix.total.toFixed(2) + '%</span><span></span></div>';
  el("mixBar").innerHTML = bar;
  el("mixRows").innerHTML = rows;
  el("mixNote").textContent = D.mix.note;
  el("mix").style.display = "block";
})();

// ---- MOVE vs spread: a second chart that follows the main chart's dates ----
var MOVE_BY = {};
(D.move || []).forEach(function (p) { MOVE_BY[p.date] = p.value; });
var HAS_MOVE = (D.move || []).length > 0;
var MOVE_HEX = "#64D2FF", SPREAD_HEX = "#FF9F0A", mgeo = null;
function niceSteps(span, opts) { for (var q = 0; q < opts.length; q++) if (span / opts[q] <= 6) return opts[q]; return opts[opts.length - 1]; }
function renderMove() {
  if (!HAS_MOVE && !D.moveNote) return;
  el("moveBox").style.display = "";
  el("moveNote").textContent = D.moveNote || "";
  var msvg = el("moveChart"), w = msvg.clientWidth || 340, h = msvg.clientHeight || 240;
  msvg.setAttribute("viewBox", "0 0 " + w + " " + h);
  var m = { l: 38, r: 40, t: 10, b: 24 };
  var mv = pts.map(function (p) { var v = MOVE_BY[p.date]; return v == null ? null : v; });
  var have = mv.filter(function (v) { return v !== null; });
  if (!have.length) { mgeo = null; msvg.innerHTML = '<text x="' + w / 2 + '" y="' + h / 2 + '" fill="#98989F" font-size="13" text-anchor="middle">No MOVE data for these dates</text>'; return; }
  var lhi = Math.max.apply(null, have), llo = Math.min.apply(null, have), lp = Math.max(2, (lhi - llo) * 0.08); lhi += lp; llo -= lp;
  var sv = pts.map(function (p) { return p.v; }), rhi = Math.max.apply(null, sv), rlo = Math.min.apply(null, sv), rp = (rhi - rlo) * 0.08; rhi += rp; rlo -= rp;
  if (rhi - rlo < 20) { var rm = (rhi + rlo) / 2; rhi = rm + 10; rlo = rm - 10; }
  var x = function (i) { return m.l + i * (w - m.l - m.r) / Math.max(1, pts.length - 1); };
  var yl = function (v) { return m.t + (lhi - v) / (lhi - llo) * (h - m.t - m.b); };
  var yr = function (v) { return m.t + (rhi - v) / (rhi - rlo) * (h - m.t - m.b); };
  mgeo = { x: x, yl: yl, yr: yr, m: m, h: h, mv: mv };
  var s = "", ls = niceSteps(lhi - llo, [2, 5, 10, 20, 25, 50]), rs = niceSteps(rhi - rlo, [5, 10, 25, 50, 100]);
  for (var k = Math.ceil(llo / ls); k * ls <= lhi; k++) {
    var gy = yl(k * ls);
    s += '<line x1="' + m.l + '" x2="' + (w - m.r) + '" y1="' + gy + '" y2="' + gy + '" stroke="#3A3A3C" stroke-width="1"/>';
    s += '<text x="' + (m.l - 6) + '" y="' + (gy + 4) + '" fill="' + MOVE_HEX + '" font-size="11" text-anchor="end">' + (k * ls) + '</text>';
  }
  for (var k2 = Math.ceil(rlo / rs); k2 * rs <= rhi; k2++) {
    s += '<text x="' + (w - m.r + 6) + '" y="' + (yr(k2 * rs) + 4) + '" fill="' + SPREAD_HEX + '" font-size="11">' + (k2 * rs) + '</text>';
  }
  var dm = "", pen = false, ds = "";
  for (var i = 0; i < pts.length; i++) {
    if (mv[i] !== null) { dm += (pen ? "L" : "M") + x(i).toFixed(1) + " " + yl(mv[i]).toFixed(1) + " "; pen = true; }
    ds += (i ? "L" : "M") + x(i).toFixed(1) + " " + yr(pts[i].v).toFixed(1) + " ";
  }
  s += '<path d="' + ds + '" fill="none" stroke="' + SPREAD_HEX + '" stroke-width="2" stroke-linejoin="round"/>';
  s += '<path d="' + dm + '" fill="none" stroke="' + MOVE_HEX + '" stroke-width="2" stroke-linejoin="round"/>';
  s += '<text x="' + m.l + '" y="' + (h - 6) + '" fill="#98989F" font-size="11">' + fmtDate(pts[0].date) + '</text>';
  s += '<text x="' + (w - m.r) + '" y="' + (h - 6) + '" fill="#98989F" font-size="11" text-anchor="end">' + fmtDate(pts[pts.length - 1].date) + '</text>';
  s += '<line id="mcur" visibility="hidden" y1="' + m.t + '" y2="' + (h - m.b) + '" stroke="#FFFFFF" stroke-opacity="0.5" stroke-width="1"/>';
  msvg.innerHTML = s;
}
// The MOVE legend: values at the scrubbed (or latest) day, change since the range start
function moveLegend(i) {
  if (!HAS_MOVE || !pts.length) return;
  if (i === null || i === undefined) i = pts.length - 1;
  var mv0 = null, j;
  for (j = 0; j < pts.length; j++) if (MOVE_BY[pts[j].date] != null) { mv0 = MOVE_BY[pts[j].date]; break; }
  var mvi = MOVE_BY[pts[i].date], s0 = pts[0].v, si = pts[i].v;
  var sgn = function (c, dp) { var t = Math.abs(c).toFixed(dp); return (parseFloat(t) === 0 ? "" : c > 0 ? "+" : "-") + t; };
  el("moveLegend").innerHTML =
    '<span><i style="background:' + MOVE_HEX + '"></i>MOVE<span>' + (mvi == null ? "n/a" : mvi.toFixed(1) + (mv0 != null ? " (" + sgn(mvi - mv0, 1) + ")" : "")) + "</span></span>" +
    '<span><i style="background:' + SPREAD_HEX + '"></i>Spread<span>' + fmtV(si) + " bps (" + sgn(si - s0, 0) + ")</span></span>";
}
// Hook the second chart into the main chart's drawing, header and scrubbing
var renderMain = render, headerMain = header, scrubMain = scrub, endScrubMain = endScrub;
render = function () { renderMain(); renderMove(); };
header = function (i) { headerMain(i); moveLegend(i); };
scrub = function (clientX) {
  scrubMain(clientX);
  if (!mgeo || !geo) return;
  var rect = svg.getBoundingClientRect(), span = geo.w - geo.m.l - geo.m.r;
  var i = Math.max(0, Math.min(pts.length - 1, Math.round((clientX - rect.left - geo.m.l) / span * (pts.length - 1))));
  var c = el("mcur"); if (c) { c.setAttribute("x1", mgeo.x(i)); c.setAttribute("x2", mgeo.x(i)); c.setAttribute("visibility", "visible"); }
};
endScrub = function () { endScrubMain(); var c = el("mcur"); if (c) c.setAttribute("visibility", "hidden"); };
var touch2 = el("touch2");
touch2.addEventListener("pointerdown", onDown);
touch2.addEventListener("pointermove", onMove);
touch2.addEventListener("pointerup", onUp);
touch2.addEventListener("pointercancel", onUp);
touch2.addEventListener("pointerleave", onUp);

// ---- What's in the 10-year: the yield split into the expected path of short
// rates and the term premium (Kim-Wright). Follows the main chart's dates.
var TP_BY = {}, TP_DATES = [];
(D.tp || []).forEach(function (p) { TP_BY[p.date] = p.value; TP_DATES.push(p.date); });
var HAS_TP = TP_DATES.length > 0, TP_HEX = "#FF9F0A", UST_HEX = "#64A8FF", EXP_HEX = "#C7C7CC", tgeo = null;
function renderTp() {
  if (!HAS_TP) return;
  el("tpBox").style.display = "";
  var tsv = el("tpChart"), w = tsv.clientWidth || 340, h = tsv.clientHeight || 220;
  tsv.setAttribute("viewBox", "0 0 " + w + " " + h);
  var m = { l: 38, r: 40, t: 10, b: 24 };
  var tp = pts.map(function (p) { var v = TP_BY[p.date]; return v == null ? null : v; });
  var vals = []; pts.forEach(function (p, i) { vals.push(p.ust); if (tp[i] !== null) vals.push(p.ust - tp[i]); });
  var hi = Math.max.apply(null, vals), lo = Math.min.apply(null, vals), pd = Math.max(0.1, (hi - lo) * 0.08); hi += pd; lo -= pd;
  var x = function (i) { return m.l + i * (w - m.l - m.r) / Math.max(1, pts.length - 1); };
  var y = function (v) { return m.t + (hi - v) / (hi - lo) * (h - m.t - m.b); };
  // right axis: the term premium itself, in bps, fitted to what's on screen
  var tb = []; tp.forEach(function (v) { if (v !== null) tb.push(v * 100); });
  var rhi = Math.max.apply(null, tb), rlo = Math.min.apply(null, tb), rp = Math.max(5, (rhi - rlo) * 0.08); rhi += rp; rlo -= rp;
  var yr = function (v) { return m.t + (rhi - v) / (rhi - rlo) * (h - m.t - m.b); };
  tgeo = { x: x, m: m, h: h, tp: tp };
  var st = niceSteps(hi - lo, [0.1, 0.25, 0.5, 1]), s = "";
  for (var k = Math.ceil(lo / st - 1e-9); k * st <= hi + 1e-9; k++) {
    var gy = y(k * st);
    s += '<line x1="' + m.l + '" x2="' + (w - m.r) + '" y1="' + gy + '" y2="' + gy + '" stroke="#3A3A3C" stroke-width="1"/>';
    s += '<text x="' + (m.l - 6) + '" y="' + (gy + 4) + '" fill="#98989F" font-size="11" text-anchor="end">' + (k * st).toFixed(st < 0.5 ? 2 : 1) + "%</text>";
  }
  var rst = niceSteps(rhi - rlo, [10, 25, 50, 100, 200]);
  for (var k4 = Math.ceil(rlo / rst); k4 * rst <= rhi; k4++) s += '<text x="' + (w - m.r + 6) + '" y="' + (yr(k4 * rst) + 4) + '" fill="' + TP_HEX + '" font-size="11">' + (k4 * rst) + "</text>";
  if (rlo < 0 && rhi > 0) { // the zero line, only when the premium crosses it on screen
    s += '<line x1="' + m.l + '" x2="' + (w - m.r) + '" y1="' + yr(0) + '" y2="' + yr(0) + '" stroke="' + TP_HEX + '" stroke-opacity="0.55" stroke-width="1" stroke-dasharray="2 3"/>';
    s += '<text x="' + (m.l + 3) + '" y="' + (yr(0) - 4) + '" fill="' + TP_HEX + '" fill-opacity="0.8" font-size="9.5">0 bps</text>';
  }
  // the gap between the 10-year and the expected path is the term premium, shaded run by run
  var run = [];
  function flush() {
    if (run.length > 1) {
      var d = "";
      run.forEach(function (i, k2) { d += (k2 ? "L" : "M") + x(i).toFixed(1) + " " + y(pts[i].ust).toFixed(1); });
      for (var k3 = run.length - 1; k3 >= 0; k3--) d += "L" + x(run[k3]).toFixed(1) + " " + y(pts[run[k3]].ust - tp[run[k3]]).toFixed(1);
      s += '<path d="' + d + 'Z" fill="' + TP_HEX + '" fill-opacity="0.13" stroke="none"/>';
    }
    run = [];
  }
  for (var i = 0; i < pts.length; i++) { if (tp[i] !== null) run.push(i); else flush(); }
  flush();
  var du = "", de = "", dt = "", pen = false;
  for (var j = 0; j < pts.length; j++) {
    du += (j ? "L" : "M") + x(j).toFixed(1) + " " + y(pts[j].ust).toFixed(1) + " ";
    if (tp[j] !== null) {
      de += (pen ? "L" : "M") + x(j).toFixed(1) + " " + y(pts[j].ust - tp[j]).toFixed(1) + " ";
      dt += (pen ? "L" : "M") + x(j).toFixed(1) + " " + yr(tp[j] * 100).toFixed(1) + " ";
      pen = true;
    } else pen = false;
  }
  s += '<path d="' + dt + '" fill="none" stroke="' + TP_HEX + '" stroke-width="2" stroke-linejoin="round"/>';
  s += '<path d="' + de + '" fill="none" stroke="' + EXP_HEX + '" stroke-width="1.8" stroke-dasharray="5 3" stroke-linejoin="round"/>';
  s += '<path d="' + du + '" fill="none" stroke="' + UST_HEX + '" stroke-width="2" stroke-linejoin="round"/>';
  s += '<text x="' + m.l + '" y="' + (h - 6) + '" fill="#98989F" font-size="11">' + fmtDate(pts[0].date) + "</text>";
  s += '<text x="' + (w - m.r) + '" y="' + (h - 6) + '" fill="#98989F" font-size="11" text-anchor="end">' + fmtDate(pts[pts.length - 1].date) + "</text>";
  s += '<line id="tcur" visibility="hidden" y1="' + m.t + '" y2="' + (h - m.b) + '" stroke="#FFFFFF" stroke-opacity="0.5" stroke-width="1"/>';
  tsv.innerHTML = s;
  el("tpNote").textContent = "Blue: the 10-year Treasury yield (the same one as above). Dashed: the 10-year minus the term premium, roughly where markets expect short-term rates to average over the next 10 years. " +
    "Orange line (right axis, bps) and the shaded gap: the term premium, the extra yield investors want for locking in for 10 years instead of rolling short-term bills; when it's negative the dashed line sits above the blue one. " +
    "Term premium: Kim-Wright model, Federal Reserve Board (FRED THREEFYTP10), estimated for a zero-coupon 10-year bond, so the split is approximate; it posts about a week behind, so the last few days have no split. " +
    "The NY Fed's ACM model gives a similar but not identical estimate." + (D.tpStale ? " FRED unreachable: term premium from the saved copy." : "");
}
// The legend: values at the scrubbed (or latest) day; the term premium is its latest estimate on or before that day
function tpLegend(i) {
  if (!HAS_TP || !pts.length) return;
  if (i === null || i === undefined) i = pts.length - 1;
  var j = i; while (j >= 0 && TP_BY[pts[j].date] == null) j--;
  var u = pts[i].ust, tpv = j >= 0 ? TP_BY[pts[j].date] : null;
  el("tpLegend").innerHTML =
    '<span><i style="background:' + UST_HEX + '"></i>10Y<span>' + u.toFixed(2) + "%</span></span>" +
    (tpv !== null ? '<span><i class="dashg"></i>Expected path<span>' + (pts[j].ust - tpv).toFixed(2) + "%</span></span>" +
      '<span><i style="background:' + TP_HEX + '"></i>Term premium<span>' + Math.round(tpv * 100) + " bps" + (j !== i ? " (" + fmtDate(pts[j].date) + ")" : "") + "</span></span>" : "");
}
// ---- How to read the term premium: six moves, each a small neutral glyph
// (blue 10-year, dashed expected path, shaded gap), in values 2 to 9
var TP_PATTERNS = [
  { a: "10Y up, gap widens, dashed flat", m: "Bond market wants more pay for more uncertainty", d: "Inflation, deficits, Treasury supply or rate swings; not the Fed.", u: [5, 8], e: [4, 4] },
  { a: "10Y up, dashed rises with it", m: "Markets expect a tougher Fed", d: "The expected path is doing the lifting.", u: [4, 7], e: [3, 6] },
  { a: "10Y down, dashed falls with it", m: "Markets expect Fed cuts", d: "The expected path is doing the falling.", u: [7, 4], e: [6, 3] },
  { a: "Dashed falls, gap widens, 10Y flat or up", m: "Fed easing, but bond market wants more pay for uncertainty", d: "Cuts expected, but investors want more pay to hold long bonds (as in late 2024).", u: [6, 6.6], e: [5, 3] },
  { a: "10Y down, gap shrinks", m: "Flight to safety, or the Fed buying bonds", d: "Investors crowd into Treasuries, or the Fed soaks up supply.", u: [7, 4.5], e: [4, 4] },
  { a: "Dashed above blue", m: "Negative term premium", d: "Bonds prized as insurance against stocks; heavy Fed buying (as in 2016-21).", u: [4, 4.2], e: [6, 6.2] }
];
// glyph geometry in a w x h box at (x, y): blue line, dashed line, arrowhead
function tpGeom(P, x, y, w, h) {
  var Y = function (v) { return y + h - 6 - (v - 2) / 7 * (h - 12); }, x0 = x + 8, x1 = x + w - 10;
  var dx = x1 - x0, dy = Y(P.u[1]) - Y(P.u[0]), L = Math.sqrt(dx * dx + dy * dy), ux = dx / L, uy = dy / L, sz = Math.max(4, w / 12);
  var tip = [x1 + ux * 2, Y(P.u[1]) + uy * 2];
  return { u: [[x0, Y(P.u[0])], [x1, Y(P.u[1])]], e: [[x0, Y(P.e[0])], [x1, Y(P.e[1])]],
    head: [tip, [tip[0] - ux * sz - uy * sz * 0.6, tip[1] - uy * sz + ux * sz * 0.6], [tip[0] - ux * sz + uy * sz * 0.6, tip[1] - uy * sz - ux * sz * 0.6]] };
}
function tpGlyphSvg(P, w, h) {
  var G = tpGeom(P, 0, 0, w, h), f = function (p) { return p[0].toFixed(1) + "," + p[1].toFixed(1); };
  return '<svg width="' + w + '" height="' + h + '" xmlns="http://www.w3.org/2000/svg"><rect x="0.5" y="0.5" width="' + (w - 1) + '" height="' + (h - 1) + '" rx="6" fill="#2C2C2E" stroke="#3A3A3C"/>' +
    '<polygon points="' + [G.u[0], G.u[1], G.e[1], G.e[0]].map(f).join(" ") + '" fill="#FF9F0A" fill-opacity="0.35"/>' +
    '<line x1="' + G.e[0][0] + '" y1="' + G.e[0][1] + '" x2="' + G.e[1][0] + '" y2="' + G.e[1][1] + '" stroke="#C7C7CC" stroke-width="1.8" stroke-dasharray="4 3"/>' +
    '<line x1="' + G.u[0][0] + '" y1="' + G.u[0][1] + '" x2="' + G.u[1][0] + '" y2="' + G.u[1][1] + '" stroke="#64A8FF" stroke-width="2.6" stroke-linecap="round"/>' +
    '<polygon points="' + G.head.map(f).join(" ") + '" fill="#64A8FF"/></svg>';
}
// the same glyph drawn in a jsPDF document, for the slide's side key
function tpGlyphPdf(doc, P, x, y, w, h) {
  var G = tpGeom(P, x, y, w, h);
  doc.setFillColor(242, 242, 247); doc.setDrawColor(209, 209, 214); doc.setLineWidth(0.5); doc.roundedRect(x, y, w, h, 3, 3, "FD");
  var poly = [G.u[0], G.u[1], G.e[1], G.e[0]], rel = [];
  for (var k = 1; k < poly.length; k++) rel.push([poly[k][0] - poly[k - 1][0], poly[k][1] - poly[k - 1][1]]);
  doc.setFillColor(248, 205, 140); doc.lines(rel, poly[0][0], poly[0][1], [1, 1], "F", true);
  doc.setDrawColor(120, 120, 125); doc.setLineWidth(1); doc.setLineDashPattern([2.5, 1.8], 0); doc.line(G.e[0][0], G.e[0][1], G.e[1][0], G.e[1][1]); doc.setLineDashPattern([], 0);
  doc.setDrawColor(10, 98, 208); doc.setLineWidth(1.6); doc.line(G.u[0][0], G.u[0][1], G.u[1][0], G.u[1][1]);
  doc.setFillColor(10, 98, 208); doc.triangle(G.head[0][0], G.head[0][1], G.head[1][0], G.head[1][1], G.head[2][0], G.head[2][1], "F");
}
function openTpHow() {
  el("howSheet").innerHTML = '<h3>How to read the term premium</h3><div class="sub2">Blue: 10-year yield. Dashed: expected short-rate path. Shaded gap: term premium. Each glyph shows one kind of move.</div>' +
    TP_PATTERNS.map(function (P) { return '<div class="it"><div class="gl">' + tpGlyphSvg(P, 72, 48) + "</div><div><b>" + P.a + '</b><span class="mn">→ ' + P.m + "</span><span>" + P.d + "</span></div></div>"; }).join("") +
    '<div class="sub2" style="margin-top:14px">Glyphs are schematic, not data. &quot;Usually means&quot; is the common reading, not a rule.</div><div class="done" id="howDone">Done</div>';
  el("howWrap").className = "howWrap on";
}
el("tpHow").addEventListener("click", openTpHow);
el("howWrap").addEventListener("click", function (ev) { if (ev.target.id === "howWrap" || ev.target.id === "howDone") el("howWrap").className = "howWrap"; });

var renderMain2 = render, headerMain2 = header, scrubMain2 = scrub, endScrubMain2 = endScrub;
render = function () { renderMain2(); renderTp(); };
header = function (i) { headerMain2(i); tpLegend(i); };
scrub = function (clientX) {
  scrubMain2(clientX);
  if (!tgeo || !geo) return;
  var rect = svg.getBoundingClientRect(), span = geo.w - geo.m.l - geo.m.r;
  var i = Math.max(0, Math.min(pts.length - 1, Math.round((clientX - rect.left - geo.m.l) / span * (pts.length - 1))));
  var c = el("tcur"); if (c) { c.setAttribute("x1", tgeo.x(i)); c.setAttribute("x2", tgeo.x(i)); c.setAttribute("visibility", "visible"); }
};
endScrub = function () { endScrubMain2(); var c = el("tcur"); if (c) c.setAttribute("visibility", "hidden"); };
var touch3 = el("touch3");
touch3.addEventListener("pointerdown", onDown);
touch3.addEventListener("pointermove", onMove);
touch3.addEventListener("pointerup", onUp);
touch3.addEventListener("pointercancel", onUp);
touch3.addEventListener("pointerleave", onUp);

// ---- Where the spread is headed: Freddie Mac 30-year minus the 10-year,
// weekly, and MBA's implied spread (its 30-year forecast minus its 10-year)
var FC_GOLD = "#FFD60A", SFC_HEX = "#FF9F0A", SFV = null;
// ---- Zoom for the forecast charts: pinch the time axis, two-finger pan,
// double-tap back to the default view. One finger still scrolls the page.
var DAY_MS = 86400000;
// date ticks for a window: years, then quarters, then months as it narrows
function fcTicks(t0, t1) {
  var yrs = (t1 - t0) / DAY_MS / 365.25, step = yrs > 3 ? 12 : yrs > 1.2 ? 3 : 1, out = [];
  var d = new Date(t0), y = d.getUTCFullYear(), mo = d.getUTCMonth();
  for (var k = 0; k < 400; k++) {
    var t = Date.UTC(y, mo, 1, 12);
    if (t > t1) break;
    if (t >= t0 && mo % step === 0) out.push({ t: t, lab: step === 12 ? String(y) : MONTHS[mo] + (step === 3 || mo === 0 ? " '" + String(y).slice(2) : "") });
    mo++; if (mo > 11) { mo = 0; y++; }
  }
  return out;
}
function fcZoomable(ovId, svId, model, setV, redraw) {
  var ov = el(ovId), f = {}, pz = null, tap = null, raf = 0;
  function frac(cx) { var sv = el(svId), g = sv.__g || { l: 8, r: 300 }, r = sv.getBoundingClientRect(); return Math.max(0, Math.min(1, (cx - r.left - g.l) / Math.max(1, g.r - g.l))); }
  function two() { var k = Object.keys(f), p = f[k[0]], q = f[k[1]], dx = p.x - q.x, dy = p.y - q.y; return { d: Math.max(10, Math.sqrt(dx * dx + dy * dy)), mid: (p.x + q.x) / 2 }; }
  ov.addEventListener("pointerdown", function (e) {
    f[e.pointerId] = { x: e.clientX, y: e.clientY };
    var n = Object.keys(f).length, M = model();
    if (!M) return;
    if (n === 2) { var st = two(); pz = { d: st.d, span: M.t1 - M.t0, at: M.t0 + frac(st.mid) * (M.t1 - M.t0) }; tap = null; }
    else if (n === 1) {
      var now = Date.now();
      if (tap && now - tap.t < 320 && Math.abs(e.clientX - tap.x) < 30) { tap = null; setV(null); redraw(); }
      else tap = { t: now, x: e.clientX };
    }
  });
  ov.addEventListener("pointermove", function (e) {
    if (!f[e.pointerId]) return;
    f[e.pointerId] = { x: e.clientX, y: e.clientY };
    if (!pz || Object.keys(f).length < 2) return;
    var M = model(); if (!M) return;
    var st = two(), full = M.full1 - M.full0, span = Math.max(120 * DAY_MS, Math.min(full, pz.span * pz.d / st.d));
    var a = Math.max(M.full0, Math.min(M.full1 - span, pz.at - frac(st.mid) * span));
    setV({ a: a, b: a + span });
    if (!raf) raf = requestAnimationFrame(function () { raf = 0; redraw(); });
  });
  function up(e) { delete f[e.pointerId]; if (Object.keys(f).length < 2) pz = null; }
  ["pointerup", "pointercancel", "pointerleave"].forEach(function (ev) { ov.addEventListener(ev, up); });
}

function ymdT(s) { return Date.parse(s + "T12:00:00Z"); }
function qMid(q) { var y = +q.slice(0, 4), n = +q.slice(5); return y + "-" + ["02", "05", "08", "11"][n - 1] + "-15"; }
function qEnd(q) { var y = +q.slice(0, 4), n = +q.slice(5); return y + "-" + ["03-31", "06-30", "09-30", "12-31"][n - 1]; }
var UST_BY = {}; D.pts.forEach(function (p) { UST_BY[p.date] = p.ust; });
// each Freddie week: its rate minus the average 10-year close of the 7 days ending that day
function sfcModel() {
  var F = D.sfc; if (!F || !F.pmms || !F.pmms.length) return null;
  var act = F.act && F.act.length ? F.act : [];
  if (!act.length) F.pmms.forEach(function (p) {
    var t = ymdT(p[0]), sum = 0, n = 0;
    for (var k = 0; k < 7; k++) { var u = UST_BY[new Date(t - k * 86400000).toISOString().slice(0, 10)]; if (u != null) { sum += u; n++; } }
    if (n) act.push([p[0], Math.round((p[1] - sum / n) * 100)]);
  });
  if (act.length < 2) return null;
  var last = act[act.length - 1];
  var mba = F.mba ? F.mba.q.filter(function (x) { return qEnd(x.q) > last[0]; }).map(function (x) { return { q: x.q, v: Math.round((x.v - x.t) * 100) }; }) : [];
  // earlier MBA forecasts, each from the quarter it came out in
  var old = (F.mbaOld || []).map(function (o) {
    var from = Math.floor(o.st / 100) + "-" + String(o.st % 100).padStart(2, "0") + "-01";
    return { vintage: o.vintage, st: o.st, q: o.q.filter(function (x) { return qEnd(x.q) >= from && x.t != null; }).map(function (x) { return { q: x.q, v: Math.round((x.v - x.t) * 100) }; }) };
  }).filter(function (o) { return o.q.length; });
  var end = last[0]; mba.forEach(function (x) { if (qEnd(x.q) > end) end = qEnd(x.q); });
  old.forEach(function (o) { o.q.forEach(function (x) { if (qEnd(x.q) > end) end = qEnd(x.q); }); });
  // the window: the zoom, or by default the last 3 years plus the forecast
  var full0 = ymdT(act[0][0]), full1 = ymdT(end) + 40 * DAY_MS, def0 = Math.max(full0, ymdT(last[0]) - 3 * 365.25 * DAY_MS);
  var a = SFV ? SFV.a : def0, b = SFV ? SFV.b : full1;
  var inW = function (sd) { var t = ymdT(sd); return t >= a && t <= b; };
  var vals = [];
  act.forEach(function (p) { if (inW(p[0])) vals.push(p[1]); });
  mba.forEach(function (x) { if (inW(qMid(x.q))) vals.push(x.v); });
  old.forEach(function (o) { o.q.forEach(function (x) { if (inW(qMid(x.q))) vals.push(x.v); }); });
  if (!vals.length) vals = [last[1]];
  return { F: F, act: act, last: last, mba: mba, old: old, t0: a, t1: b, full0: full0, full1: full1, inW: inW, lo: Math.min.apply(null, vals), hi: Math.max.apply(null, vals) };
}
function renderSpreadFc() {
  var M = sfcModel(), sec = el("sfcSec");
  if (!M) { sec.style.display = "none"; return; }
  sec.style.display = "";
  var sv = el("sfcChart"), w = sv.clientWidth || 360, h = sv.clientHeight || 230;
  var m = { l: 8, r: 40, t: 12, b: 24 };
  sv.setAttribute("viewBox", "0 0 " + w + " " + h);
  var st = niceSteps(M.hi - M.lo, [10, 25, 50, 100]), lo = Math.floor((M.lo - st * 0.4) / st) * st, hi = Math.ceil((M.hi + st * 0.4) / st) * st;
  var X = function (s2) { return m.l + (ymdT(s2) - M.t0) / (M.t1 - M.t0) * (w - m.l - m.r); };
  var Y = function (v) { return m.t + (hi - v) / (hi - lo) * (h - m.t - m.b); };
  var s = "";
  for (var g = lo; g <= hi + 1e-9; g += st) {
    s += '<line x1="' + m.l + '" x2="' + (w - m.r) + '" y1="' + Y(g) + '" y2="' + Y(g) + '" stroke="#3A3A3C"/>';
    s += '<text x="' + (w - m.r + 6) + '" y="' + (Y(g) + 4) + '" fill="#98989F" font-size="11">' + g + "</text>";
  }
  sv.__g = { l: m.l, r: w - m.r };
  var lastX = -99;
  fcTicks(M.t0, M.t1).forEach(function (tk) {
    var xx = m.l + (tk.t - M.t0) / (M.t1 - M.t0) * (w - m.l - m.r);
    if (xx - lastX < 40 || xx < m.l + 12 || xx > w - m.r - 12) return;
    lastX = xx;
    s += '<line x1="' + xx + '" x2="' + xx + '" y1="' + (h - m.b) + '" y2="' + (h - m.b + 4) + '" stroke="#636366"/>';
    s += '<text x="' + xx + '" y="' + (h - 6) + '" fill="#98989F" font-size="11" text-anchor="middle">' + tk.lab + "</text>";
  });
  s += '<defs><clipPath id="sfcClip"><rect x="' + m.l + '" y="0" width="' + (w - m.l - m.r) + '" height="' + (h - m.b) + '"/></clipPath></defs><g clip-path="url(#sfcClip)">';
  var tx = X(M.last[0]);
  s += '<line x1="' + tx + '" x2="' + tx + '" y1="' + m.t + '" y2="' + (h - m.b) + '" stroke="#8E8E93" stroke-dasharray="2 3"/>';
  s += '<text x="' + (tx - 4) + '" y="' + (m.t + 10) + '" fill="#8E8E93" font-size="10" text-anchor="end">Today</text>';
  var dl = "";
  M.act.forEach(function (p, k) { dl += (k ? "L" : "M") + X(p[0]).toFixed(1) + " " + Y(p[1]).toFixed(1); });
  s += '<path d="' + dl + '" fill="none" stroke="' + SFC_HEX + '" stroke-width="2" stroke-linejoin="round"/>';
  s += '<circle cx="' + tx + '" cy="' + Y(M.last[1]) + '" r="4" fill="' + SFC_HEX + '" stroke="#1C1C1E" stroke-width="1.5"/>';
  var oldLabs = [];
  M.old.forEach(function (o, k) {
    var op = k ? 0.3 : 0.5, d = "";
    o.q.forEach(function (x, j) { d += (j ? "L" : "M") + X(qMid(x.q)).toFixed(1) + " " + Y(x.v).toFixed(1); });
    s += '<path d="' + d + '" fill="none" stroke="' + FC_GOLD + '" stroke-opacity="' + op + '" stroke-width="1.6" stroke-dasharray="4 4" stroke-linejoin="round"/>';
    o.q.forEach(function (x) { s += '<circle cx="' + X(qMid(x.q)).toFixed(1) + '" cy="' + Y(x.v).toFixed(1) + '" r="2" fill="' + FC_GOLD + '" fill-opacity="' + op + '"/>'; });
    var e = o.q[o.q.length - 1], ly = Y(e.v) + 14;
    oldLabs.forEach(function (y0) { if (Math.abs(ly - y0) < 12) ly = y0 + 12; });
    oldLabs.push(ly);
    s += '<text x="' + X(qMid(e.q)).toFixed(1) + '" y="' + ly.toFixed(1) + '" fill="' + FC_GOLD + '" fill-opacity="' + (op + 0.2) + '" font-size="10" font-weight="600" text-anchor="end">' + o.vintage.slice(0, 3) + "</text>";
  });
  if (M.mba.length) {
    var dm = "M" + tx.toFixed(1) + " " + Y(M.last[1]).toFixed(1);
    M.mba.forEach(function (x) { dm += "L" + X(qMid(x.q)).toFixed(1) + " " + Y(x.v).toFixed(1); });
    s += '<path d="' + dm + '" fill="none" stroke="' + FC_GOLD + '" stroke-width="2.4" stroke-dasharray="6 4" stroke-linejoin="round"/>';
    M.mba.forEach(function (x) { s += '<circle cx="' + X(qMid(x.q)).toFixed(1) + '" cy="' + Y(x.v).toFixed(1) + '" r="3" fill="' + FC_GOLD + '"/>'; });
    var lm = M.mba[M.mba.length - 1], mtop = Math.max.apply(null, M.mba.map(function (x) { return x.v; }));
    s += '<text x="' + X(qMid(lm.q)).toFixed(1) + '" y="' + (Y(mtop) - 10).toFixed(1) + '" fill="' + FC_GOLD + '" font-size="10.5" font-weight="700" text-anchor="end">MBA ' + lm.v + " bps</text>";
  }
  sv.innerHTML = s + "</g>";
  var lm2 = M.mba.length ? M.mba[M.mba.length - 1] : null;
  el("sfcSub").innerHTML = "Freddie 30-yr minus 10-yr " + '<b style="color:#fff">' + M.last[1] + " bps</b> (" + fmtDate(M.last[0]) + ")" +
    (lm2 ? " · MBA: " + lm2.v + " bps by " + lm2.q.slice(4) + " " + lm2.q.slice(0, 4) : "");
  el("sfcLeg").innerHTML = '<span><i style="background:' + SFC_HEX + '"></i>Freddie Mac 30-yr minus 10Y</span>' +
    (M.F.mba ? '<span><i class="dash"></i>MBA implied (' + M.F.mba.vintage + ")</span>" : "") +
    (M.old.length ? '<span><i class="dash" style="opacity:0.45"></i>Earlier: ' + M.old.map(function (o) { return o.vintage.slice(0, 3); }).join(", ") + "</span>" : "");
  var lk = el("sfcLink");
  var all = M.F.mba ? [M.F.mba].concat(M.F.mbaOld || []) : [];
  if (all.length) {
    lk.style.display = "";
    lk.innerHTML = "MBA forecast PDFs: " + all.map(function (o) { return '<span data-st="' + o.st + '">' + o.vintage + "</span>"; }).join(" · ");
  } else lk.style.display = "none";
  el("sfcNote").textContent = "Pinch to zoom in time (back to 2015), drag with two fingers to pan, double-tap to reset. Orange: Freddie Mac's weekly 30-year fixed rate (FRED MORTGAGE30US) minus the average 10-year Treasury close of the 7 days ending that day, in bps. It runs at a different level than the Optimal Blue spread above. " +
    (M.F.mba ? "Gold: MBA's Mortgage Finance Forecast (" + M.F.mba.vintage + (M.F.mba.asOf ? ", dated " + M.F.mba.asOf : "") + "): its 30-year rate forecast minus its 10-year Treasury forecast, quarterly averages plotted mid-quarter and joined to the latest week. Fainter gold: the two forecasts before it, each from the quarter it came out in; tap a month under the chart to open that PDF. MBA rounds both to 0.1%, so each quarter is good to about 10 bps. Updated automatically when MBA posts a new month." : "MBA's forecast hasn't loaded yet; it's read from MBA's monthly PDF.");
}
window.setSpreadFc = function (fc) { D.sfc = fc; renderSpreadFc(); renderTenFc(); };
fcZoomable("sfcTouch", "sfcChart", sfcModel, function (v) { SFV = v; }, renderSpreadFc);
// ---- Where the 10-year is headed: the 10-year Treasury (monthly average, then
// the latest close), MBA's 10-year forecast and the Philadelphia Fed's
// professional forecasters (median), each with its earlier rounds fainter
var SPF_HEX = "#BF5AF2", TFV = null;
function tfcModel() {
  var F = D.sfc; if (!F || !F.ten || F.ten.length < 6) return null;
  var act = F.ten.slice(), lp = D.pts[D.pts.length - 1];
  if (lp && lp.ust != null && lp.date > act[act.length - 1][0]) act.push([lp.date, lp.ust]);
  var last = act[act.length - 1], today = last[0];
  // a forecast is joined to today's yield only if it's recent (made within ~6
  // weeks); an older one starts at its own first quarter, so a stale forecast
  // doesn't draw a jump at today
  var ageDays = function (sd) { return (ymdT(today) - ymdT(sd)) / DAY_MS; };
  var mbaFrom = F.mba ? Math.floor(F.mba.st / 100) + "-" + String(F.mba.st % 100).padStart(2, "0") + "-01" : today;
  var mbaJoin = !!F.mba && ageDays(Math.floor(F.mba.st / 100) + "-" + String(F.mba.st % 100).padStart(2, "0") + "-11") <= 45;
  var mba = F.mba ? F.mba.q.filter(function (x) { return x.t != null && (mbaJoin ? qEnd(x.q) > today : qEnd(x.q) >= mbaFrom); }).map(function (x) { return { q: x.q, v: x.t }; }) : [];
  var mbaOld = (F.mbaOld || []).map(function (o) {
    var from = Math.floor(o.st / 100) + "-" + String(o.st % 100).padStart(2, "0") + "-01";
    return { tag: o.vintage.slice(0, 3), name: o.vintage, q: o.q.filter(function (x) { return qEnd(x.q) >= from && x.t != null; }).map(function (x) { return { q: x.q, v: x.t }; }) };
  }).filter(function (o) { return o.q.length; });
  var spf = (F.spf || []).slice(), spfNew = spf.length ? spf[spf.length - 1] : null, spfOld = spf.slice(0, -1).reverse();
  // each survey comes out about mid-way through its quarter (Feb, May, Aug, Nov)
  var spfJoin = !!spfNew && ageDays(qMid(spfNew.q[0].q)) <= 45;
  var spfNow = spfNew ? (spfJoin ? spfNew.q.filter(function (x) { return qEnd(x.q) > today; }) : spfNew.q.slice()) : [];
  var end = today;
  [mba, spfNow].concat(mbaOld.map(function (o) { return o.q; })).concat(spfOld.map(function (o) { return o.q; })).forEach(function (arr) { arr.forEach(function (x) { if (qEnd(x.q) > end) end = qEnd(x.q); }); });
  var full0 = ymdT(act[0][0]), full1 = ymdT(end) + 40 * DAY_MS, def0 = Math.max(full0, ymdT(today) - 3 * 365.25 * DAY_MS);
  var a = TFV ? TFV.a : def0, b = TFV ? TFV.b : full1;
  var inW = function (sd) { var t = ymdT(sd); return t >= a && t <= b; }, vals = [];
  act.forEach(function (p) { if (inW(p[0])) vals.push(p[1]); });
  [mba, spfNow].concat(mbaOld.map(function (o) { return o.q; })).concat(spfOld.map(function (o) { return o.q; })).forEach(function (arr) { arr.forEach(function (x) { if (inW(qMid(x.q))) vals.push(x.v); }); });
  if (!vals.length) vals = [last[1]];
  return { F: F, act: act, last: last, mba: mba, mbaJoin: mbaJoin, mbaOld: mbaOld, spfNew: spfNew, spfNow: spfNow, spfJoin: spfJoin, spfOld: spfOld, t0: a, t1: b, full0: full0, full1: full1, inW: inW, lo: Math.min.apply(null, vals), hi: Math.max.apply(null, vals) };
}
function tfcQ(q) { return "Q" + q.slice(5) + " " + q.slice(0, 4); }
function renderTenFc() {
  var M = tfcModel(), sec = el("tfcSec");
  if (!M) { sec.style.display = "none"; return; }
  sec.style.display = "";
  var sv = el("tfcChart"), w = sv.clientWidth || 360, h = sv.clientHeight || 230, m = { l: 8, r: 44, t: 12, b: 24 };
  sv.setAttribute("viewBox", "0 0 " + w + " " + h);
  var st = niceSteps(M.hi - M.lo, [0.25, 0.5, 1]), lo = Math.floor((M.lo - st * 0.4) / st) * st, hi = Math.ceil((M.hi + st * 0.4) / st) * st;
  var X = function (s2) { return m.l + (ymdT(s2) - M.t0) / (M.t1 - M.t0) * (w - m.l - m.r); }, Y = function (v) { return m.t + (hi - v) / (hi - lo) * (h - m.t - m.b); };
  var s = "";
  for (var g = lo; g <= hi + 1e-9; g += st) s += '<line x1="' + m.l + '" x2="' + (w - m.r) + '" y1="' + Y(g) + '" y2="' + Y(g) + '" stroke="#3A3A3C"/><text x="' + (w - m.r + 6) + '" y="' + (Y(g) + 4) + '" fill="#98989F" font-size="11">' + g.toFixed(st < 0.5 ? 2 : 1) + "%</text>";
  sv.__g = { l: m.l, r: w - m.r };
  var lastX = -99;
  fcTicks(M.t0, M.t1).forEach(function (tk) {
    var xx = m.l + (tk.t - M.t0) / (M.t1 - M.t0) * (w - m.l - m.r);
    if (xx - lastX < 40 || xx < m.l + 12 || xx > w - m.r - 12) return;
    lastX = xx;
    s += '<line x1="' + xx + '" x2="' + xx + '" y1="' + (h - m.b) + '" y2="' + (h - m.b + 4) + '" stroke="#636366"/><text x="' + xx + '" y="' + (h - 6) + '" fill="#98989F" font-size="11" text-anchor="middle">' + tk.lab + "</text>";
  });
  s += '<defs><clipPath id="tfcClip"><rect x="' + m.l + '" y="0" width="' + (w - m.l - m.r) + '" height="' + (h - m.b) + '"/></clipPath></defs><g clip-path="url(#tfcClip)">';
  var tx = X(M.last[0]), ty = Y(M.last[1]);
  s += '<line x1="' + tx + '" x2="' + tx + '" y1="' + m.t + '" y2="' + (h - m.b) + '" stroke="#8E8E93" stroke-dasharray="2 3"/><text x="' + (tx - 4) + '" y="' + (m.t + 10) + '" fill="#8E8E93" font-size="10" text-anchor="end">Today</text>';
  var dl = ""; M.act.forEach(function (p, k) { dl += (k ? "L" : "M") + X(p[0]).toFixed(1) + " " + Y(p[1]).toFixed(1); });
  s += '<path d="' + dl + '" fill="none" stroke="#64A8FF" stroke-width="2" stroke-linejoin="round"/>';
  var tags = [];
  function tag(x, y, t, c, op, bold) {
    var tw = t.length * (bold ? 6.3 : 5.7) + 2, lx = Math.min(w - m.r - tw - 2, x - tw / 2), ly = y - 7;
    var hit = function (yy) { return tags.some(function (q) { return lx < q[0] + q[2] + 2 && q[0] < lx + tw + 2 && Math.abs(yy - q[1]) < 10; }); };
    if (hit(ly)) { ly = y + 14; if (hit(ly)) return ""; }
    tags.push([lx, ly, tw]);
    return '<text x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" fill="' + c + '" fill-opacity="' + op + '" font-size="9.5" font-weight="' + (bold ? 800 : 600) + '" stroke="#1C1C1E" stroke-width="3" paint-order="stroke">' + t + "</text>";
  }
  function line(q, c, op, wd, dash, from) {
    var d = from ? "M" + from[0].toFixed(1) + " " + from[1].toFixed(1) : "";
    q.forEach(function (x, j) { d += (d ? "L" : "M") + X(qMid(x.q)).toFixed(1) + " " + Y(x.v).toFixed(1); });
    var o = '<path d="' + d + '" fill="none" stroke="' + c + '" stroke-opacity="' + op + '" stroke-width="' + wd + '" stroke-dasharray="' + dash + '" stroke-linejoin="round"/>';
    q.forEach(function (x) { o += '<circle cx="' + X(qMid(x.q)).toFixed(1) + '" cy="' + Y(x.v).toFixed(1) + '" r="' + (op < 1 ? 2 : 2.8) + '" fill="' + c + '" fill-opacity="' + op + '"/>'; });
    return o;
  }
  var labs = "";
  M.mbaOld.forEach(function (o, k) { var op = k ? 0.3 : 0.5; s += line(o.q, FC_GOLD, op, 1.4, "4 4"); var e = o.q[o.q.length - 1]; labs += tag(X(qMid(e.q)), Y(e.v), o.tag, FC_GOLD, op + 0.25, false); });
  M.spfOld.forEach(function (o, k) { var op = k ? 0.3 : 0.5; s += line(o.q, SPF_HEX, op, 1.4, "2 3"); var e = o.q[o.q.length - 1]; labs += tag(X(qMid(e.q)), Y(e.v), o.vintage.split(" ")[0] + " '" + o.vintage.slice(-2), SPF_HEX, op + 0.25, false); });
  if (M.mba.length) { s += line(M.mba, FC_GOLD, 1, 2.2, "6 4", M.mbaJoin ? [tx, ty] : null); var em = M.mba[M.mba.length - 1]; labs = tag(X(qMid(em.q)), Y(em.v), "MBA " + em.v.toFixed(1) + "%", FC_GOLD, 1, true) + labs; }
  if (M.spfNow.length) { s += line(M.spfNow, SPF_HEX, 1, 2.2, "2 3", M.spfJoin ? [tx, ty] : null); var es = M.spfNow[M.spfNow.length - 1]; labs = tag(X(qMid(es.q)), Y(es.v), "Fcstrs " + es.v.toFixed(1) + "%", SPF_HEX, 1, true) + labs; }
  s += '<circle cx="' + tx + '" cy="' + ty + '" r="4" fill="#64A8FF" stroke="#1C1C1E" stroke-width="1.5"/>';
  sv.innerHTML = s + labs + "</g>";
  var em2 = M.mba.length ? M.mba[M.mba.length - 1] : null, es2 = M.spfNow.length ? M.spfNow[M.spfNow.length - 1] : null;
  el("tfcSub").innerHTML = "10-year Treasury " + '<b style="color:#fff">' + M.last[1].toFixed(2) + "%</b> (" + fmtDate(M.last[0]) + ")" +
    (em2 ? ' · <span style="color:' + FC_GOLD + '">MBA ' + em2.v.toFixed(1) + "% by " + tfcQ(em2.q) + "</span>" : "") + (es2 ? ' · <span style="color:' + SPF_HEX + '">forecasters ' + es2.v.toFixed(2) + "% by " + tfcQ(es2.q) + (M.spfJoin ? "" : " (" + ["Feb", "May", "Aug", "Nov"][+M.spfNew.q[0].q.slice(5) - 1] + " survey)") + "</span>" : "");
  el("tfcLeg").innerHTML = '<span><i style="background:#64A8FF"></i>10-year Treasury</span>' +
    (M.F.mba ? '<span><i class="dash"></i>MBA (' + M.F.mba.vintage + ")</span>" : "") +
    (M.spfNew ? '<span><i class="dash" style="border-top-color:' + SPF_HEX + ';border-top-style:dotted"></i>Forecasters (' + M.spfNew.vintage + " survey)</span>" : "") +
    (M.mbaOld.length || M.spfOld.length ? '<span><i class="dash" style="opacity:0.45"></i>Earlier rounds, fainter</span>' : "");
  el("tfcNote").textContent = "Pinch to zoom in time (back to 2015), drag with two fingers to pan, double-tap to reset. Blue: the 10-year Treasury yield (FRED DGS10), monthly averages joined to the latest close. Gold: MBA's Mortgage Finance Forecast for the 10-year, quarterly averages plotted mid-quarter, rounded to 0.1%" +
    (M.mbaOld.length ? "; fainter gold: the forecasts before it (" + M.mbaOld.map(function (o) { return o.name; }).join(", ") + ")" : "") + ". Purple: the median forecast of the Philadelphia Fed's Survey of Professional Forecasters (about 35 forecasters, quarterly), for the survey quarter and the four after" +
    (M.spfOld.length ? "; fainter purple: the three surveys before it (" + M.spfOld.map(function (o) { return o.vintage; }).join(", ") + ")" : "") + ". A forecast made in the last six weeks is joined to today's yield; an older one starts at its own first quarter, so it doesn't draw a jump at today. Tags name each round." + (M.F.spfError && !M.spfNew ? " The forecasters' survey didn't load: " + M.F.spfError + "." : "");
}
fcZoomable("tfcTouch", "tfcChart", tfcModel, function (v) { TFV = v; }, renderTenFc);
var mbaWanted = false;
window.__takeMba = function () { var w = mbaWanted; mbaWanted = false; return w; };
el("sfcLink").addEventListener("click", function (e) {
  var t = e.target && e.target.closest ? e.target.closest("[data-st]") : null;
  if (!t) return;
  mbaWanted = t.getAttribute("data-st");
  var was = t.textContent;
  t.textContent = "Opening…";
  setTimeout(function () { t.textContent = was; }, 2500);
});

// ---- Release schedule: sources by next update, the first few shown, tap for all
var schedAll = false, SM = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], SW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function schedMd(t) { return SM[t.getMonth()] + " " + t.getDate(); }
function schedWin(r) { var a = new Date(r.next), b = new Date(r.to || r.next); return schedMd(a) === schedMd(b) ? schedMd(a) : a.getMonth() === b.getMonth() ? schedMd(a) + "–" + b.getDate() : schedMd(a) + "–" + schedMd(b); }
function schedAgo(iso) { var m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 60 ? Math.max(1, m) + " min ago" : m < 48 * 60 ? Math.round(m / 60) + " hrs ago" : Math.round(m / 1440) + " days ago"; }
// { main, sub, late } for the next-update column
function schedState(r) {
  if (!r.next) return { main: '<span style="color:#8E8E93">not scheduled</span>', sub: "" };
  var now = Date.now(), from = Date.parse(r.next), to = Date.parse(r.to || r.next) + 864e5;
  if (!r.approx) {
    if (from < now) return { main: '<span style="color:#FF9F0A">posting</span>', sub: "" };
    var t = new Date(from), h = t.getHours() % 12 || 12, mi = t.getMinutes();
    return { main: (from - now < 6 * 864e5 ? SW[t.getDay()] + " " : "") + schedMd(t) + ", " + h + (mi ? ":" + (mi < 10 ? "0" : "") + mi : "") + (t.getHours() >= 12 ? "p" : "a"), sub: "" };
  }
  if (now < from) return { main: "about " + schedWin(r), sub: "" };
  if (now <= to) { var dd = Math.floor((now - from) / 864e5), endD = new Date(Date.parse(r.to || r.next)); return { main: '<span style="color:#FF9F0A">due now</span>', sub: "since " + schedMd(new Date(from)) + (dd >= 1 ? " (" + dd + (dd === 1 ? " day" : " days") + ")" : "") + (r.to && r.to !== r.next ? "<br>late after " + schedMd(endD) : ""), late: true }; }
  var days = Math.max(1, Math.floor((now - to) / 864e5) + 1);
  return { main: '<span style="color:#FF9F0A">' + days + (days === 1 ? " day" : " days") + " late</span>", sub: "was due by " + schedMd(new Date(Date.parse(r.to || r.next))), late: true };
}
// why it isn't in yet, from the widget's last look at the source
function schedWhy(r) {
  var s = "";
  if (r.cadence && r.cadence.indexOf("not fetched") === 0) return "Not fetched automatically: its numbers are typed into the script each spring, so this stays late until the script is updated.";
  if (r.err) s = "Last check failed: " + r.err;
  else if (r.checked) s = (Date.parse(r.checked) < Date.parse(r.next) ? "Last checked " + schedAgo(r.checked) + ", before it was due" : "Checked " + schedAgo(r.checked) + ": not posted yet");
  else s = "Not posted yet";
  return s + (r.cadence ? " (" + r.cadence + ")" : "") + ".";
}
function schedEsc(t) { return String(t).split("&").join("&amp;").split("<").join("&lt;"); }
function renderSched(rows) {
  var box = document.getElementById("sched");
  if (!box) return;
  rows = (rows || []).slice().sort(function (p, q) { return (p.next ? Date.parse(p.next) : 9e15) - (q.next ? Date.parse(q.next) : 9e15); });
  if (!rows.length) { box.style.display = "none"; return; }
  box.style.display = "";
  var show = schedAll ? rows : rows.slice(0, 3);
  box.innerHTML = '<div class="schedHead"><b>Release schedule</b><span>latest · next update (your time)</span></div>' +
    show.map(function (r) {
      var st = schedState(r);
      return '<div class="schedRow"><span class="schedName">' + schedEsc(r.name) + (r.every ? "<i>" + schedEsc(r.every) + "</i>" : "") + (st.late ? '<i class="schedWhy">' + schedEsc(schedWhy(r)) + "</i>" : "") + '</span><span class="schedLast">' + schedEsc(r.last) + '</span><span class="schedNext">' + st.main + (st.sub ? "<i>" + st.sub + "</i>" : "") + "</span></div>";
    }).join("") +
    (rows.length > 3 ? '<div class="schedMore">' + (schedAll ? "Show fewer" : "All " + rows.length + " sources") + "</div>" : "");
}
document.addEventListener("click", function (e) { var t = e.target && e.target.closest ? e.target.closest(".schedMore") : null; if (!t) return; schedAll = !schedAll; renderSched(window.__sched); });
window.__sched = D.sched; renderSched(D.sched);
el("ticker").textContent = D.ticker;
el("name").textContent = D.name;
if (D.staleNote) { el("staleNote").textContent = D.staleNote; el("staleNote").style.display = ""; }
el("unit").textContent = D.unit;
el("note").textContent = D.note;
select("3M");
renderSpreadFc(); renderTenFc();
window.addEventListener("resize", function () { renderSpreadFc(); renderTenFc(); });
// For the Share button: what this view is and how current
window.shareInfo = function () {
  var p = D.pts[D.pts.length - 1].date.split("-");
  return { title: D.ticker, name: D.name, asOf: MONTHS[+p[1] - 1] + " " + (+p[2]) + ", " + p[0] };
};
</script>
<script>__PRINT__</script>
<script>__SHARE__</script>
</body>
</html>`;

// ---------- Term premium: Kim-Wright model (Federal Reserve Board) via FRED ----------
// Daily, percent, posted about a week behind. The 10-year yield minus it is the
// model's expected average short rate over the next 10 years.
const TP_FILE = "term-premium-v1.json";
async function getTermPremium() {
  try {
    return await withCache(TP_FILE, async () => ({ tp: await fred("THREEFYTP10", daysAgo(DETAIL_DAYS_BACK)) }));
  } catch (e) {
    return { tp: [], stale: true, error: String((e && e.message) || e) };
  }
}

// ---------- Where the spread is headed: MBA's forecast ----------
// MBA's Mortgage Finance Forecast has quarterly rows for the 30-year fixed rate
// (Freddie Mac's) and the 10-year Treasury yield; their difference is MBA's
// implied spread. Both are rounded to 0.1%, so it's good to about 10 bps.
const SFC_FILE = "spread-forecast-v1.json";
const FC_CHECK_DAYS = 5; // how often to look for a newer MBA forecast (monthly release)
const FC_YEARS_BACK = 3; // shown by default (pinch to zoom out further)
const FC_HISTORY_FROM = "2015-01-01"; // how far back zooming out can go
const MBA_PDF = (y, mon) => `https://www.mba.org/docs/default-source/research-and-forecasts/forecasts/${y}/mortgage-finance-forecast-${mon}-${y}.pdf`;
const MBA_ARCHIVE = "https://www.mba.org/forecasts-and-commentary/mortgage-finance-forecast-archives";
const PDFJS = [
  ["https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js", "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js"],
  ["https://cdn.jsdelivr.net/npm/pdfjs-dist@2.16.105/build/pdf.min.js", "https://cdn.jsdelivr.net/npm/pdfjs-dist@2.16.105/build/pdf.worker.min.js"],
];
const MON3 = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const daysSince = (iso) => (iso ? (Date.now() - Date.parse(iso)) / 86400000 : Infinity);

// A PDF's first-page text, as lines, read with pdf.js in a hidden page
async function pdfLines(data) {
  for (const [lib, worker] of PDFJS) {
    const wv = updWV(new WebView());
    // the worker script is loaded up front too, so pdf.js runs it in-page
    await wv.loadHTML(...updArgs(`<html><head><script src="${lib}"></script><script src="${worker}"></script></head><body></body></html>`));
    if (!(await wv.evaluateJavaScript("typeof pdfjsLib !== 'undefined'"))) continue;
    await wv.evaluateJavaScript(`window.__b64 = "${data.toBase64String()}"; window.__w = "${worker}"; 0`);
    const res = await wv.evaluateJavaScript(`(function () {
      try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = window.__w;
        var bin = atob(window.__b64), u8 = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        pdfjsLib.getDocument({ data: u8 }).promise.then(function (doc) {
          return doc.getPage(1).then(function (pg) { return pg.getTextContent(); });
        }).then(function (tc) {
          var rows = {};
          tc.items.forEach(function (it) { var y = Math.round(it.transform[5] / 2) * 2; (rows[y] = rows[y] || []).push([it.transform[4], it.str]); });
          completion(JSON.stringify(Object.keys(rows).sort(function (a, b) { return b - a; }).map(function (y) { return rows[y].sort(function (a, b) { return a[0] - b[0]; }).map(function (c) { return c[1]; }).join(" ").replace(/\\s+/g, " ").trim(); }).filter(function (s) { return s; })));
        }).catch(function (e) { completion(JSON.stringify({ error: String(e && e.message || e) })); });
      } catch (e) { completion(JSON.stringify({ error: String(e && e.message || e) })); }
    })()`, true);
    const r = JSON.parse(res);
    if (Array.isArray(r)) return r;
  }
  return null;
}

// MBA's table: a line of years ("2026 2027 2028"), a line of quarters, then
// rows like "30-Year Fixed Rate Mortgage (%) 6.1 6.4 ..." and "10-Year Treasury
// Yield (%) 4.2 4.4 ...". The first 4 x (number of years) values are quarterly
// averages; the rest are annual.
function parseMba(lines) {
  const row = (re) => {
    const i = lines.findIndex((l) => re.test(l));
    return i < 0 ? null : { i, vals: lines[i].split(" ").filter((t) => /^\d+(\.\d+)?$/.test(t)).map(Number) };
  };
  const m30 = row(/30-?\s?Year Fixed Rate/i), t10 = row(/10-?\s?Year Treasury/i);
  if (!m30 || !t10) return null;
  let years = null;
  for (let j = m30.i - 1; j >= 0 && !years; j--) if (/^(20\d\d\s*){2,}$/.test(lines[j].trim())) years = lines[j].trim().split(/\s+/).map(Number);
  if (!years || m30.vals.length < years.length * 4 || t10.vals.length < years.length * 4) return null;
  const q = [];
  years.forEach((y, k) => [1, 2, 3, 4].forEach((n) => q.push({ q: y + "Q" + n, v: m30.vals[k * 4 + n - 1], t: t10.vals[k * 4 + n - 1] })));
  if (q.some((x) => !(x.v > 2 && x.v < 15 && x.t > 0 && x.t < 12))) return null;
  const dm = lines.join(" ").match(/(January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, 20\d\d/);
  return { q, asOf: dm ? dm[0] : null };
}

// The newest 3 MBA Mortgage Finance Forecasts: this month's and the 3 before at
// MBA's usual address, then the archive page's links, newest first. Forecasts
// already read are kept, not downloaded again; the oldest drops off when a new
// month posts.
async function fetchMbas(have) {
  const KEEP = 3, haveBy = {};
  (have || []).forEach((m) => (haveBy[m.st] = m));
  const tries = [], d = new Date();
  for (let i = 0; i < 4; i++) {
    const t = new Date(d.getFullYear(), d.getMonth() - i, 1);
    tries.push({ url: MBA_PDF(t.getFullYear(), MON3[t.getMonth()]), st: t.getFullYear() * 100 + t.getMonth() + 1 });
  }
  try {
    const r0 = new Request(MBA_ARCHIVE);
    r0.timeoutInterval = 15;
    r0.headers = { "User-Agent": UA };
    const html = await r0.loadString(), re = /href="([^"]*mortgage-finance-forecast-([a-z]+)-(20\d\d)\.pdf[^"]*)"/gi;
    let m;
    while ((m = re.exec(html))) {
      const mi = MON3.indexOf(m[2].slice(0, 3).toLowerCase());
      if (mi < 0) continue;
      const url = m[1].replace(/&amp;/g, "&");
      tries.push({ url: url.startsWith("http") ? url : "https://www.mba.org" + url, st: +m[3] * 100 + mi + 1 });
    }
  } catch (e) {}
  tries.sort((a, b) => b.st - a.st);
  const out = [], done = new Set();
  for (const t of tries) {
    if (out.length >= KEEP) break;
    if (done.has(t.st)) continue;
    if (haveBy[t.st]) { out.push(haveBy[t.st]); done.add(t.st); continue; } // already read
    try {
      const r = new Request(t.url);
      r.timeoutInterval = 30;
      const data = await r.load();
      const b64 = data ? data.toBase64String() : "";
      if (!b64.startsWith("JVBERi")) continue; // a 404 page, not a PDF
      done.add(t.st);
      const lines = await pdfLines(data);
      const got = lines && parseMba(lines);
      if (!got) continue;
      try { FileManager.local().write(mbaFile(t.st), data); } catch (e) {}
      out.push({ ...got, st: t.st, vintage: MON3[t.st % 100 - 1].replace(/^./, (c) => c.toUpperCase()) + " " + Math.floor(t.st / 100), url: t.url });
    } catch (e) {}
  }
  // offline or MBA's site misbehaving: keep what was saved
  (have || []).forEach((m) => { if (!out.some((o) => o.st === m.st)) out.push(m); });
  return out.sort((a, b) => b.st - a.st).slice(0, KEEP);
}

// ---------- Where the 10-year is headed: professional forecasters ----------
// The Philadelphia Fed's Survey of Professional Forecasters (quarterly, out mid-
// February, May, August and November): the median 10-year Treasury forecast
// for the survey quarter and the four after (TBOND2..TBOND6). The spreadsheet
// is read in a hidden web page; its link is read from the variable's page.
// Runs inside a hidden web page: unzip the xlsx and return every sheet's rows,
// each row as { column letter: text }. Calls completion() with JSON.
function XLSX_READER() {
  (async function () {
    try {
      var bin = atob(window.__b64), u8 = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      window.__b64 = null;
      var dv = new DataView(u8.buffer), eocd = -1;
      for (var p = u8.length - 22; p >= 0 && p > u8.length - 70000; p--) if (dv.getUint32(p, true) === 0x06054b50) { eocd = p; break; }
      if (eocd < 0) throw new Error("not an xlsx");
      var n = dv.getUint16(eocd + 10, true), off = dv.getUint32(eocd + 16, true), files = {};
      for (var k = 0; k < n; k++) {
        var nl = dv.getUint16(off + 28, true), el = dv.getUint16(off + 30, true), cl = dv.getUint16(off + 32, true);
        var name = new TextDecoder().decode(u8.subarray(off + 46, off + 46 + nl));
        files[name] = { m: dv.getUint16(off + 10, true), cs: dv.getUint32(off + 20, true), lo: dv.getUint32(off + 42, true) };
        off += 46 + nl + el + cl;
      }
      async function read(name) {
        var f = files[name]; if (!f) return null;
        var lo = f.lo, start = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true), data = u8.subarray(start, start + f.cs);
        if (f.m === 0) return new TextDecoder().decode(data);
        var out = new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw")));
        return new TextDecoder().decode(await out.arrayBuffer());
      }
      var unx = function (s) { return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'"); };
      var wb = await read("xl/workbook.xml"), rels = await read("xl/_rels/workbook.xml.rels");
      var sheets = [], m, re = /<sheet [^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g;
      while ((m = re.exec(wb))) { var rm = new RegExp('Id="' + m[2] + '"[^>]*Target="([^"]+)"').exec(rels) || new RegExp('Target="([^"]+)"[^>]*Id="' + m[2] + '"').exec(rels); sheets.push({ name: unx(m[1]), file: rm ? "xl/" + rm[1].replace(/^\/?xl\//, "") : null }); }
      var ssx = await read("xl/sharedStrings.xml"), ss = [];
      if (ssx) { var re2 = /<si>([\s\S]*?)<\/si>/g, mm; while ((mm = re2.exec(ssx))) { var t = "", re3 = /<t[^>]*>([\s\S]*?)<\/t>/g, m3; while ((m3 = re3.exec(mm[1]))) t += m3[1]; ss.push(unx(t)); } }
      var out = {};
      for (var si = 0; si < sheets.length; si++) {
        var xml = sheets[si].file ? await read(sheets[si].file) : null;
        if (!xml) continue;
        var rows = [], reR = /<row [^>]*>([\s\S]*?)<\/row>/g, mr;
        while ((mr = reR.exec(xml))) {
          var cells = {}, any = false, reC = /<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, mc;
          while ((mc = reC.exec(mr[1]))) {
            var attrs = mc[2], inner = mc[3] || "", v = /<v>([\s\S]*?)<\/v>/.exec(inner), is = /<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>/.exec(inner), val = null;
            if (/t="s"/.test(attrs) && v) val = ss[+v[1]]; else if (is) val = unx(is[1]); else if (v) val = unx(v[1]);
            if (val !== null && val !== "") { cells[mc[1]] = String(val).trim(); any = true; }
          }
          if (any) rows.push(cells);
        }
        out[sheets[si].name] = rows;
      }
      completion(JSON.stringify({ sheets: out }));
    } catch (e) { completion(JSON.stringify({ error: String(e && e.message || e) })); }
  })();
}
async function readXlsx(url) {
  const r = new Request(url);
  r.timeoutInterval = 60;
  r.headers = { "User-Agent": UA };
  const data = await r.load();
  const b64 = data ? data.toBase64String() : "";
  if (!b64.startsWith("UEsD")) return null; // a web page, not a spreadsheet
  const wv = updWV(new WebView());
  await wv.loadHTML(...updArgs("<html><body></body></html>"));
  await wv.evaluateJavaScript(`window.__b64 = "${b64}"; 0`);
  const res = JSON.parse(await wv.evaluateJavaScript(`(${XLSX_READER.toString()})()`, true));
  if (res.error) throw new Error(res.error);
  return res.sheets;
}
function spfPage(v) { return `https://www.philadelphiafed.org/surveys-and-data/${v.toLowerCase()}`; }
function spfPlain(kind, v) { return `https://www.philadelphiafed.org/-/media/FRBP/Assets/Surveys-And-Data/survey-of-professional-forecasters/data-files/files/${kind}_${v}_Level.xlsx`; }
async function spfUrl(kind, v) {
  try {
    const r = new Request(spfPage(v));
    r.timeoutInterval = 20; r.headers = { "User-Agent": UA };
    const html = await r.loadString(), m = html.match(new RegExp(`href="([^"]*${kind}_${v}_Level\\.xlsx[^"]*)"`, "i"));
    if (m) { const u = m[1].replace(/&amp;/g, "&"); return u.startsWith("http") ? u : "https://www.philadelphiafed.org" + u; }
  } catch (e) {}
  return spfPlain(kind, v);
}
// Rows with YEAR, QUARTER and V1..V6 (V1 is the quarter before the survey, V2
// the survey quarter, V3..V6 the four after). Returns [{ s: quarter index of
// the survey, f: [V1..V6] }], quarter index = year x 4 + quarter - 1.
function parseSpf(sheets, v, range) {
  let best = [];
  Object.keys(sheets || {}).forEach((name) => {
    const rows = sheets[name] || [];
    for (let h = 0; h < Math.min(rows.length, 15); h++) {
      const cols = {};
      Object.keys(rows[h]).forEach((c) => (cols[String(rows[h][c]).trim().toUpperCase()] = c));
      if (!cols.YEAR || !cols.QUARTER || !cols[v + "2"]) continue;
      const out = [];
      for (let i = h + 1; i < rows.length; i++) {
        const y = parseInt(rows[i][cols.YEAR]), q = parseInt(rows[i][cols.QUARTER]);
        if (!(y > 1960 && q >= 1 && q <= 4)) continue;
        const f = [1, 2, 3, 4, 5, 6].map((k) => { const c = cols[v + k], x = c ? parseFloat(rows[i][c]) : NaN; return isFinite(x) && x >= range[0] && x <= range[1] ? Math.round(x * 100) / 100 : null; });
        if (f.some((x) => x != null)) out.push({ s: y * 4 + q - 1, f });
      }
      if (out.length > best.length) best = out;
      break;
    }
  });
  return best;
}
async function fetchSpfTbond() {
  const sheets = await readXlsx(await spfUrl("Median", "TBOND")) || await readXlsx(spfPlain("Median", "TBOND"));
  if (!sheets) throw new Error("the forecasters' spreadsheet wasn't at its usual address");
  const rounds = parseSpf(sheets, "TBOND", [0, 20]);
  if (rounds.length < 8) throw new Error("couldn't find the TBOND columns (sheets: " + Object.keys(sheets).join(", ") + ")");
  return rounds.slice(-4);
}
// Freddie Mac's weekly rate every time; MBA's PDF only every few days
async function refreshSpreadForecast() {
  const out = { ...(readSaved(SFC_FILE) || {}) };
  try {
    const [pm, ten] = await Promise.all([fred("MORTGAGE30US", FC_HISTORY_FROM), fred("DGS10", FC_HISTORY_FROM)]);
    out.pmms = pm.map((o) => [o.date, o.value]);
    // each Freddie week: its rate minus the average 10-year close of the 7 days ending that day, bps
    const u = byDate(ten), act = [];
    for (const [d, v] of out.pmms) {
      let sum = 0, n = 0;
      for (let k = 0; k < 7; k++) { const x = u.get(addDays(d, -k)); if (x !== undefined) { sum += x; n++; } }
      if (n) act.push([d, Math.round((v - sum / n) * 100)]);
    }
    out.act = act;
    // the 10-year by month (average of the daily closes), for the 10-year forecast chart
    const mo = {};
    ten.forEach((o) => { const k = o.date.slice(0, 7); (mo[k] = mo[k] || []).push(o.value); });
    out.ten = Object.keys(mo).sort().map((k) => [k + "-15", Math.round((mo[k].reduce((a, b) => a + b, 0) / mo[k].length) * 100) / 100]);
  } catch (e) {}
  // the forecasters' survey: daily in a survey month (Feb, May, Aug, Nov), weekly otherwise
  if (daysSince(out.spfChecked) >= (new Date().getMonth() % 3 === 1 ? 1 : 7)) {
    try { out.spf = await fetchSpfTbond(); delete out.spfError; } catch (e) { out.spfError = e.message || String(e); }
    out.spfChecked = new Date().toISOString();
  }
  let mbas = out.mbas || (out.mba ? [out.mba] : []);
  // look every few days; daily while fewer than 3 have been read
  const newest = mbas.length ? Math.max(...mbas.map((m) => m.st)) : 0, due = newest && new Date() >= new Date(Math.floor(newest / 100), newest % 100, 11);
  if (daysSince(out.mbasChecked) >= (mbas.length < 3 || due ? 1 : FC_CHECK_DAYS)) {
    const got = await fetchMbas(mbas);
    if (got.length) mbas = got;
    out.mbasChecked = new Date().toISOString();
  }
  out.mbas = mbas;
  delete out.mba;
  if (out.pmms) writeSaved(SFC_FILE, out);
  return out;
}
function spreadFcPayload(fc) {
  if (!fc || !fc.pmms || !fc.pmms.length) return null;
  const mbas = fc.mbas || (fc.mba ? [fc.mba] : []);
  const ql = (qi) => `Q${(qi % 4) + 1} ${Math.floor(qi / 4)}`, qk = (qi) => `${Math.floor(qi / 4)}Q${(qi % 4) + 1}`;
  const spf = (fc.spf || []).map((r) => ({ vintage: ql(r.s), q: r.f.slice(1).map((v, k) => (v == null ? null : { q: qk(r.s + k), v })).filter(Boolean) })).filter((r) => r.q.length);
  return { pmms: fc.pmms, act: fc.act || null, mba: mbas[0] || null, mbaOld: mbas.slice(1), ten: fc.ten || null, spf, spfError: fc.spfError || null };
}
// MBA's PDF itself, in iOS's PDF viewer over the open view
function mbaFile(st) { return savedPath("mba-mortgage-finance-forecast-" + st + ".pdf"); }
async function openMbaPdf(mba) {
  const fm = FileManager.local(), path = mbaFile(mba.st);
  if (!fm.fileExists(path)) {
    const r = new Request(mba.url);
    r.timeoutInterval = 30;
    const data = await r.load();
    if (!data || !data.toBase64String().startsWith("JVBERi")) throw new Error("MBA's site didn't return the PDF");
    fm.write(path, data);
  }
  await QuickLook.present(path, true);
}

async function presentDetail(payload) {
  // A script can supply its own PDF layout (PRINT_PAGE_JS); others use the general one
  const print = typeof PRINT_PAGE_JS !== "undefined" ? PRINT_PAGE_JS : "";
  const html = DETAIL_HTML.replace("__DATA__", () => JSON.stringify(payload))
    .replace("__PRINT__", () => print)
    .replace("__SHARE__", () => SHARE_PAGE_JS);
  const wv = updWV(new WebView());
  await wv.loadHTML(...updArgs(html));
  await presentWithSharing(wv, async (isOpen) => {
    let fc = payload.sfc;
    try {
      fc = spreadFcPayload(await refreshSpreadForecast()) || fc;
      if (fc && isOpen()) await wv.evaluateJavaScript(`window.setSpreadFc(${JSON.stringify(fc)});0`);
    } catch (e) {}
    // taps on the MBA link under the spread forecast
    while (isOpen()) {
      await sleep(500);
      let want = false;
      try { want = await wv.evaluateJavaScript("window.__takeMba ? window.__takeMba() : false"); } catch (e) {}
      const pick = want && fc && [fc.mba].concat(fc.mbaOld || []).find((m) => m && m.st === +want);
      if (!pick) continue;
      try {
        await openMbaPdf(pick);
      } catch (e) {
        const a = new Alert();
        a.title = "Couldn't open MBA's PDF";
        a.message = e.message || String(e);
        a.addAction("OK");
        await a.present();
      }
    }
  });
}

// ---------- Release schedule (shown at the top of the full screen) ----------
// One row per source: the latest data in hand and when the next update is due.
// FRED publishes each release's calendar, future dates included, so those rows
// are exact (date from FRED, clock time from the source's usual schedule). The
// others follow each source's usual pattern and are marked approximate.
const SCHED_FILE = "release-calendar-v1.json";
function schedFile() { const fm = FileManager.local(); return fm.joinPath(fm.documentsDirectory(), SCHED_FILE); }
function schedRead() { try { const fm = FileManager.local(), p = schedFile(); if (fm.fileExists(p)) return JSON.parse(fm.readString(p)); } catch (e) {} return {}; }
function schedWrite(o) { try { FileManager.local().writeString(schedFile(), JSON.stringify(o)); } catch (e) {} }
const schedIso = (d) => d.toISOString().slice(0, 10);
// FRED release dates for a series (cached per series; refreshed every 3 days or
// once the next known date has passed)
async function schedFredDates(seriesId, apiKey) {
  const all = schedRead(), kept = all[seriesId], today = schedIso(new Date());
  if (kept && kept.checked && (Date.now() - new Date(kept.checked).getTime()) / 864e5 < 3 && (kept.dates || []).some((d) => d >= today)) return kept.dates;
  try {
    const base = "https://api.stlouisfed.org/fred";
    const rel = await new Request(`${base}/series/release?series_id=${seriesId}&api_key=${apiKey}&file_type=json`).loadJSON();
    const id = rel && rel.releases && rel.releases[0] && rel.releases[0].id;
    if (!id) throw new Error("no release");
    const r = await new Request(`${base}/release/dates?release_id=${id}&api_key=${apiKey}&file_type=json&include_release_dates_with_no_data=true&sort_order=desc&limit=60`).loadJSON();
    const dates = ((r && r.release_dates) || []).map((x) => x.date).sort();
    all[seriesId] = { dates, checked: new Date().toISOString() };
    schedWrite(all);
    return dates;
  } catch (e) { return (kept && kept.dates) || []; }
}
// a New York clock time on a date, as a Date (handles daylight saving)
function schedNy(date, hh, mm) {
  const [y, mo, d] = date.split("-").map(Number), want = Date.UTC(y, mo - 1, d, hh, mm);
  let t = want + 5 * 3600 * 1000;
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  for (let i = 0; i < 2; i++) { const p = {}; fmt.formatToParts(new Date(t)).forEach((x) => (p[x.type] = x.value)); t += want - Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute); }
  return new Date(t);
}
// the n-th weekday (0 = Sunday) of a month (m0 = 0..11), as "YYYY-MM-DD"
function schedNth(y, m0, wd, n) { const d = new Date(Date.UTC(y + Math.floor(m0 / 12), ((m0 % 12) + 12) % 12, 1)); while (d.getUTCDay() !== wd) d.setUTCDate(d.getUTCDate() + 1); d.setUTCDate(d.getUTCDate() + 7 * (n - 1)); return schedIso(d); }
function schedDay(y, m0, day) { return schedIso(new Date(Date.UTC(y, m0, day))); }
// next weekday (Mon-Fri) after today
function schedNextBiz() { const d = new Date(); do { d.setDate(d.getDate() + 1); } while (d.getDay() === 0 || d.getDay() === 6); return d; }
// A FRED row: { name, last, series, at: [hh, mm] New York time, every }
async function schedFredRow(r, apiKey) {
  const dates = await schedFredDates(r.series, apiKey), now = Date.now();
  let next = null;
  for (const d of dates) { const t = schedNy(d, r.at[0], r.at[1]); if (t.getTime() > now) { next = t; break; } }
  return { name: r.name, last: r.last || "", next: next ? next.toISOString() : null, approx: false, every: r.every || "" };
}
// An estimated row: win is a date ("YYYY-MM-DD") or a window [from, to]; chk is
// what the widget knows about its last look: { checked (ISO), err, cadence }
function schedEst(name, last, win, every, chk) {
  const w = Array.isArray(win) ? win : [win, win], iso = (d) => (d ? (typeof d === "string" ? d + "T17:00:00Z" : d.toISOString()) : null);
  return { name, last: last || "", next: iso(w[0]), to: iso(w[1]), approx: true, every: every || "", checked: (chk && chk.checked) || null, err: (chk && chk.err) || null, cadence: (chk && chk.cadence) || "" };
}
// A daily row: the next weekday at a New York clock time (market holidays aren't skipped)
function schedDaily(name, last, at, every) {
  const now = Date.now(), d = new Date();
  for (let i = 0; i < 8; i++) {
    const ds = schedIso(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate() + i))), wd = new Date(ds + "T12:00:00Z").getUTCDay();
    if (wd === 0 || wd === 6) continue;
    const t = schedNy(ds, at[0], at[1]);
    if (t.getTime() > now) return { name, last: last || "", next: t.toISOString(), approx: false, every: every || "" };
  }
  return { name, last: last || "", next: null, approx: false, every: every || "" };
}
// A weekly row: the next given weekday (0 = Sunday) at a New York clock time
function schedWeekly(name, last, wd, at, every) {
  const now = Date.now(), d = new Date();
  for (let i = 0; i < 9; i++) {
    const ds = schedIso(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate() + i)));
    if (new Date(ds + "T12:00:00Z").getUTCDay() !== wd) continue;
    const t = schedNy(ds, at[0], at[1]);
    if (t.getTime() > now) return { name, last: last || "", next: t.toISOString(), approx: false, every: every || "" };
  }
  return { name, last: last || "", next: null, approx: false, every: every || "" };
}
const SCHED_MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const schedMonName = (m) => (m ? SCHED_MON[+m.slice(5, 7) - 1] + " " + m.slice(0, 4) : "");
const schedDateName = (d) => (d ? SCHED_MON[+d.slice(5, 7) - 1] + " " + +d.slice(8, 10) : "");
const schedQName = (qi) => `Q${(qi % 4) + 1} ${Math.floor(qi / 4)}`;
// The Philadelphia Fed's survey after the one in hand (quarter index), out about
// mid-month in February, May, August and November
function schedPlus(ds, n) { const d = new Date(ds + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return schedIso(d); }
function schedSpfNext(lastQi) { const q = lastQi + 1, y = Math.floor(q / 4), m0 = (q % 4) * 3 + 1; return schedDay(y, m0, 13); }

// This widget's sources, next update first
async function spreadSchedule(data, mv, tp, fc) {
  const lastD = (arr, k) => (arr && arr.length ? arr[arr.length - 1][k || "date"] : null);
  const rows = [
    schedDaily("Optimal Blue rate + 10-yr (the spread)", schedDateName(lastD(data.pts)), [16, 16], "FRED, business days"),
    schedDaily("MOVE index", schedDateName(lastD(mv.move)), [17, 0], "Yahoo Finance, after the close"),
    schedWeekly("Freddie Mac 30-yr (PMMS)", fc && fc.pmms && fc.pmms.length ? schedDateName(fc.pmms[fc.pmms.length - 1][0]) : "", 4, [12, 0], "weekly, Thursday noon"),
  ];
  const tpRow = await schedFredRow({ name: "Term premium (Kim-Wright)", last: schedDateName(lastD(tp.tp)), series: "THREEFYTP10", at: [16, 0], every: "Fed Board via FRED, weekly" }, FRED_KEY);
  tpRow.approx = true;
  // no date on FRED's calendar: about a week after the latest reading
  const tpl = lastD(tp.tp);
  if (!tpRow.next && tpl) { tpRow.next = schedPlus(tpl, 7) + "T17:00:00Z"; tpRow.to = schedPlus(tpl, 14) + "T17:00:00Z"; tpRow.checked = new Date().toISOString(); tpRow.cadence = "checks each time you open it"; if (tp.stale) tpRow.err = tp.error || "FRED unreachable"; }
  rows.push(tpRow);
  // MBA posts each month's forecast around mid-month
  const mbas = (fc && (fc.mbas || (fc.mba ? [fc.mba] : []))) || [];
  if (mbas.length) { const st = Math.max(...mbas.map((m) => m.st)), y = Math.floor(st / 100), m0 = st % 100; rows.push(schedEst("MBA forecast", mbas.find((m) => m.st === st).vintage, [schedDay(y, m0, 11), schedDay(y, m0, 20)], "monthly, mid-month", { checked: fc.mbasChecked, cadence: "checks daily while due, else every few days" })); }
  const sp = fc && fc.spf && fc.spf.length ? fc.spf[fc.spf.length - 1].s : null;
  if (sp != null) { const d0 = schedSpfNext(sp); rows.push(schedEst("Pro forecasters (Philadelphia Fed)", schedQName(sp) + " survey", [d0, schedPlus(d0, 6)], "quarterly, mid Feb/May/Aug/Nov", { checked: fc.spfChecked, err: fc.spfError, cadence: "checks daily in survey months" })); }
  return rows;
}

// ---------- Run ----------
// On the home screen: draw the widget. Tapped or run in the app: show the detail view.
if (config.runsInWidget || PREVIEW_WIDGET_IN_APP) {
  let widget;
  try {
    const data = await getData();
    widget = renderWidget(widgetSpec(data));
    // A script can time its own redraws to its data's posting schedule
    if (typeof nextRefresh === "function") {
      const t = nextRefresh(data);
      if (t) widget.refreshAfterDate = t;
    }
  } catch (e) {
    widget = errorWidget(e.message || e);
  }
  if (config.runsInWidget) Script.setWidget(widget);
  else await widget.presentSmall();
} else {
  try {
    const [data, mv, tp] = await Promise.all([getData(), getMove(), getTermPremium()]);
    const payload = detailPayload(data);
    if (data.stale) payload.staleNote = "FRED unreachable · showing data through " + throughLabel(data);
    payload.move = mv.move || [];
    payload.moveNote = !payload.move.length
      ? "MOVE n/a" + (mv.error ? " (" + mv.error + ")" : "")
      : mv.stale ? "Yahoo unreachable · MOVE through " + throughLabel(mv) : "";
    payload.tp = tp.tp || [];
    payload.tpStale = !!tp.stale && payload.tp.length > 0;
    payload.sfc = spreadFcPayload(readSaved(SFC_FILE));
    try { payload.sched = await spreadSchedule(data, mv, tp, readSaved(SFC_FILE)); } catch (e) { payload.sched = []; }
    await presentDetail(payload);
  } catch (e) {
    await errorWidget(e.message || e).presentSmall();
  }
}
Script.complete();
