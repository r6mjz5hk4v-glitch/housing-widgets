
// ---- Shared settings (saved on this phone by the Setup script) ----
// Keys and personal settings live in the phone's keychain, not in this file,
// so the file can be shared as is.
function setting(key, fallback) {
  try { if (Keychain.contains(key)) { const v = Keychain.get(key); if (v) return v; } } catch (e) {}
  return fallback;
}

// Unemployment Rate Widget for Scriptable (small widget)
// The U.S. unemployment rate from the BLS jobs report (Employment Situation)
// via FRED (UNRATE, monthly, seasonally adjusted), with the Sahm rule
// recession indicator (SAHMREALTIME) and NBER recessions (USREC). All FRED.
// Home screen: the latest rate, its change from a year earlier, four years of
// history, the Sahm reading, and a clock to the next jobs report.
// Tap for the full-screen view: what is pushing unemployment up or down.
// Layoffs (initial claims), re-employment (continuing claims) and hiring
// (JOLTS hires rate), each as its pressure vs 2019, sorted into upward /
// neutral / downward, then one chart of all three, the unemployment rate with
// Sahm-rule months shaded, and the prime-age employment rate as a cross-check.
// One timeline: weekly claims on their own dates, monthly series mid-month.
// Share as PDF: three 16:9 slides (summary, pressures, unemployment and
// employment). This replaces the separate Jobless Claims widget.
// Extra FRED series: ICSA, CCSA (claims, weekly), PAYEMS (payrolls),
// JTSHIR (hires rate), LNS12300060 (prime-age employment-population ratio),
// JTSJOR (job openings rate) for the Beveridge curve (openings vs unemployment),
// the hero chart: top of the full screen, PDF slide 1 and the widget face. Its
// optional history (1951-2000) is Barnichon's composite help-wanted index from
// the San Francisco Fed, downloaded once.
// Note: October 2025 has no reading (the survey wasn't run during the
// government shutdown), so the lines bridge that month.

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

// Full-screen view: opens on the last 5 years; pinching in stops at 6 months.
const DEFAULT_MONTHS = 60;
const MIN_MONTHS = 6;
// Months of history on the home-screen widget
const WIDGET_MONTHS = 48;
// The Sahm rule's recession signal: the 3-month average rate 0.5 point above its 12-month low
const SAHM_TRIGGER = 0.5;
// Pressures: within this % of 2019 counts as neutral
const NEUTRAL_PCT = 5;
// The pressures chart's axis stops here, so 2020's spike doesn't flatten the rest
const PRESSURE_CAP_HI = 150;
const PRESSURE_CAP_LO = -60;

const TICKER = "UNEMPLOYMENT";
const NAME = "Unemployment rate";
const CACHE_FILE = "unemployment-v1.json";

// Apple's system green and red for dark backgrounds
const GREEN = "#30D158";
const RED = "#FF453A";
const GRAY = "#98989F";
const REFRESH_HOURS = 6;

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

// spec: { pts, hex, triangleUp, topRight, name, nameHex, rightSub, value }
function renderWidget(spec) {
  const white = new Color("#FFFFFF");
  const color = new Color(spec.hex);

  const w = new ListWidget();
  darkBackground(w);
  w.setPadding(16, 17, 9, 17);

  // Row 1: triangle + ticker, change on the right
  const r1 = w.addStack();
  r1.centerAlignContent();
  const tri = r1.addText(spec.triangleUp ? "\u25B2" : "\u25BC");
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

  // Row 2: name on the left, secondary figure on the right
  const r2 = w.addStack();
  r2.centerAlignContent();
  const name = r2.addText(spec.name);
  name.font = Font.semiboldSystemFont(12);
  name.textColor = new Color(spec.nameHex || GRAY);
  name.lineLimit = 1;
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

  // Big value, right-aligned
  const r3 = w.addStack();
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

// ---------- Monthly helpers ----------
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_INDEX = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

// "2026-06" plus n months
function monthAdd(m, n) {
  const [y, mo] = m.split("-").map(Number);
  const t = y * 12 + (mo - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}
// "2026-06" -> "Jun '26"
function fmtMonth(m) {
  const [y, mo] = m.split("-");
  return `${MON[+mo - 1]} \u2019${y.slice(2)}`;
}
// Percent change from the same month a year earlier; months without a
// year-earlier value are left out.
function yoySeries(pts) {
  const by = new Map(pts.map((p) => [p.m, p.v]));
  const out = [];
  for (const p of pts) {
    const prev = by.get(monthAdd(p.m, -12));
    if (prev) out.push({ m: p.m, v: (p.v / prev - 1) * 100 });
  }
  return out;
}
// The 12 months ending at `last`, each a value or null for a missing month
function lastTwelve(pts, last) {
  const by = new Map(pts.map((p) => [p.m, p.v]));
  const out = [];
  for (let i = 11; i >= 0; i--) {
    const m = monthAdd(last, -i);
    out.push(by.has(m) ? by.get(m) : null);
  }
  return out;
}
function signPct(v) {
  const s = Math.abs(v).toFixed(1);
  return (parseFloat(s) === 0 ? "" : v > 0 ? "+" : "-") + s + "%";
}

// ---------- Drawing helpers ----------
function hexOf(rgb) {
  return "#" + rgb.map((n) => n.toString(16).padStart(2, "0")).join("");
}
function paintBackground(ctx, W, H) {
  const top = [0x2c, 0x2c, 0x2e];
  const bottom = [0x1c, 0x1c, 0x1e];
  const BANDS = 34;
  for (let i = 0; i < BANDS; i++) {
    const f = i / (BANDS - 1);
    ctx.setFillColor(new Color(hexOf(top.map((c, j) => Math.round(c + (bottom[j] - c) * f)))));
    ctx.fillRect(new Rect(0, (H * i) / BANDS, W, H / BANDS + 1));
  }
}
function drawText(ctx, str, rect, font, hex, align) {
  ctx.setFont(font);
  ctx.setTextColor(new Color(hex));
  if (align === "right") ctx.setTextAlignedRight();
  else if (align === "center") ctx.setTextAlignedCenter();
  else ctx.setTextAlignedLeft();
  ctx.drawTextInRect(str, rect);
}
function newCanvas(W, H) {
  const ctx = new DrawContext();
  ctx.size = new Size(W, H);
  ctx.opaque = true;
  ctx.respectScreenScale = true;
  paintBackground(ctx, W, H);
  return ctx;
}
function strokeSeg(ctx, x1, y1, x2, y2) {
  const p = new Path();
  p.move(new Point(x1, y1));
  p.addLine(new Point(x2, y2));
  ctx.addPath(p);
  ctx.strokePath();
}
// A faint dashed outline marking a month with no number
function dashedSlot(ctx, x, y, w, h) {
  ctx.setStrokeColor(new Color(GRAY, 0.7));
  ctx.setLineWidth(0.75);
  for (let yy = y; yy < y + h; yy += 4) {
    strokeSeg(ctx, x, yy, x, Math.min(yy + 2, y + h));
    strokeSeg(ctx, x + w, yy, x + w, Math.min(yy + 2, y + h));
  }
  for (let xx = x; xx < x + w; xx += 4) {
    strokeSeg(ctx, xx, y, Math.min(xx + 2, x + w), y);
    strokeSeg(ctx, xx, y + h, Math.min(xx + 2, x + w), y + h);
  }
}
// Monthly bars of year-over-year change around a zero line. Each bar is one
// month vs the same month a year earlier; the newest month is brightest.
function drawYoyBars(ctx, vals, box, goodUp) {
  const known = vals.filter((v) => v !== null).map(Math.abs);
  const max = Math.max(1, ...known);
  const mid = box.y + box.h / 2;
  ctx.setFillColor(new Color("#48484A"));
  ctx.fillRect(new Rect(box.x, mid - 0.5, box.w, 1));
  const bw = box.w / vals.length;
  vals.forEach((v, i) => {
    const x = box.x + i * bw + 1.5;
    const w = bw - 3;
    if (v === null) {
      dashedSlot(ctx, x, box.y + 2, w, box.h - 4);
      return;
    }
    const len = Math.max(0.8, (Math.abs(v) / max) * (box.h / 2 - 1));
    const flat = parseFloat(Math.abs(v).toFixed(1)) === 0;
    const good = goodUp ? v > 0 : v < 0;
    ctx.setFillColor(new Color(flat ? GRAY : good ? GREEN : RED, i === vals.length - 1 ? 1 : 0.55));
    const r = new Path();
    r.addRoundedRect(new Rect(x, v >= 0 ? mid - len : mid, w, len), 1.5, 1.5);
    ctx.addPath(r);
    ctx.fillPath();
  });
}
function finishWidget(img) {
  const w = new ListWidget();
  w.backgroundImage = updRing(img);
  w.addSpacer();
  w.url = URLScheme.forRunningScript(); // tap opens the full-screen view
  w.refreshAfterDate = new Date(Date.now() + REFRESH_HOURS * 3600 * 1000);
  return w;
}

// ---------- Next-release clock ----------
// FRED publishes each release's schedule, future dates included. It gives
// dates but not times, so each widget supplies its source's usual release
// time in New York time.
async function fredReleaseDates(seriesId) {
  const base = "https://api.stlouisfed.org/fred";
  const rel = await new Request(`${base}/series/release?series_id=${seriesId}&api_key=${FRED_KEY}&file_type=json`).loadJSON();
  const id = rel && rel.releases && rel.releases[0] && rel.releases[0].id;
  if (!id) return [];
  const r = await new Request(
    `${base}/release/dates?release_id=${id}&api_key=${FRED_KEY}&file_type=json` +
      "&include_release_dates_with_no_data=true&sort_order=desc&limit=40"
  ).loadJSON();
  return ((r && r.release_dates) || []).map((x) => x.date).sort();
}
// A date at a New York clock time, as a Date (handles daylight saving)
function nyTime(date, hh, mm) {
  const [y, mo, d] = date.split("-").map(Number);
  const want = Date.UTC(y, mo - 1, d, hh, mm);
  let t = want + 5 * 3600 * 1000; // start from Eastern Standard Time
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", hourCycle: "h23", year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
  for (let i = 0; i < 2; i++) {
    const p = {};
    fmt.formatToParts(new Date(t)).forEach((x) => (p[x.type] = x.value));
    t += want - Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute);
  }
  return new Date(t);
}
function nextRelease(dates, hh, mm) {
  const now = Date.now();
  for (const d of dates || []) {
    const t = nyTime(d, hh, mm);
    if (t.getTime() > now) return t;
  }
  return null;
}
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_MS = 24 * 3600 * 1000;
// Over a week away: "Oct 26". Within a week: "Thu 3:30p" (your local time).
// Within a day: nothing here; the live countdown takes over.
function clockLabel(t, dateOnly) {
  if (dateOnly) return `${MON[t.getMonth()]} ${t.getDate()}`;
  const ms = t.getTime() - Date.now();
  if (ms <= DAY_MS) return null;
  if (ms <= 6 * DAY_MS) {
    const m = t.getMinutes();
    const h = t.getHours() % 12 || 12;
    return `${DAY_NAMES[t.getDay()]} ${h}${m ? ":" + String(m).padStart(2, "0") : ""}${t.getHours() >= 12 ? "p" : "a"}`;
  }
  return `${MON[t.getMonth()]} ${t.getDate()}`;
}
// Header right side: a clock icon, with the release day when it's over a day
// away. Shows "cached" instead when the data couldn't be refreshed.
function headerClock(ctx, stale, next, dateOnly) {
  if (stale) {
    drawText(ctx, "cached", new Rect(70, 13, 86, 16), Font.semiboldSystemFont(11), "#FF9F0A", "right");
    return;
  }
  if (!next) return;
  const x = 151;
  const y = 20;
  ctx.setStrokeColor(new Color(GRAY));
  ctx.setLineWidth(1.3);
  const c = new Path();
  c.addEllipse(new Rect(x - 5, y - 5, 10, 10));
  ctx.addPath(c);
  ctx.strokePath();
  strokeSeg(ctx, x, y, x, y - 3);
  strokeSeg(ctx, x, y, x + 2.2, y + 1.2);
  const label = clockLabel(next, dateOnly);
  if (label) drawText(ctx, label, new Rect(60, 13, 83, 16), Font.systemFont(11), GRAY, "right");
}
// Like finishWidget, plus the live countdown on release day, and redraws
// timed to switch into countdown mode and to pick up the new data
function finishClockWidget(img, next, dateOnly) {
  const w = new ListWidget();
  w.backgroundImage = updRing(img);
  w.setPadding(12, 14, 12, 26);
  const row = w.addStack();
  row.addSpacer();
  const now = Date.now();
  if (!dateOnly && next && next.getTime() > now && next.getTime() - now <= DAY_MS) {
    const d = row.addDate(next);
    d.applyTimerStyle();
    d.font = Font.systemFont(11);
    d.textColor = new Color(GRAY);
    d.lineLimit = 1;
    d.rightAlignText();
  }
  w.addSpacer();
  w.url = URLScheme.forRunningScript(); // tap opens the full-screen view
  let at = now + REFRESH_HOURS * 3600 * 1000;
  if (next) {
    const t = next.getTime();
    if (t - DAY_MS > now) at = Math.min(at, t - DAY_MS + 60 * 1000);
    at = Math.min(at, t + 20 * 60 * 1000);
  }
  w.refreshAfterDate = new Date(at);
  return w;
}

// ---------- Cache helpers ----------
// "cache" files are the shared saved copy (see readSaved); "docs" files as before
function readJson(dir, file) {
  if (dir !== "docs") return readSaved(file);
  const fm = FileManager.local();
  const path = fm.joinPath(fm.documentsDirectory(), file);
  try {
    if (fm.fileExists(path)) return JSON.parse(fm.readString(path));
  } catch (e) {}
  return null;
}
function writeJson(dir, file, data) {
  if (dir !== "docs") return writeSaved(file, data);
  const fm = FileManager.local();
  const path = fm.joinPath(fm.documentsDirectory(), file);
  try {
    fm.writeString(path, JSON.stringify(data));
  } catch (e) {}
}

// ---------- Full screen: pressures on unemployment ----------
// One page, one timeline in days: weekly claims sit on their own dates,
// monthly series at mid-month, so everything lines up and claims show up
// first. Pinch or drag with two fingers on any chart and all follow; hold to
// read a date on all of them; double-tap to reset.
// Note: the page script below avoids backticks, backslashes and dollar-brace
// on purpose, because the whole page lives inside a template literal.
const JOBS_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  :root { --bg:#1C1C1E; --fg:#FFFFFF; --gray:#98989F; --rule:#3A3A3C; }
  * { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  body { margin:0; padding:20px 16px 36px; background:var(--bg); color:var(--fg);
         font-family:-apple-system,system-ui,sans-serif; -webkit-user-select:none; user-select:none; }
  .ticker { font-size:26px; font-weight:800; letter-spacing:-0.3px; }
  .name { color:var(--gray); font-size:13.5px; font-weight:600; margin-top:3px; line-height:1.35; }
  .hint { color:var(--gray); font-size:12px; margin-top:6px; line-height:1.35; }
  .head { font-size:17px; font-weight:700; line-height:1.3; margin-top:14px; }
  .grp { font-size:11.5px; font-weight:700; color:var(--gray); letter-spacing:0.5px; text-transform:uppercase; margin:26px 0 0; }
  .sec { margin-top:14px; padding-top:12px; border-top:1px solid var(--rule); }
  .sec.res { border:1.5px solid #64A8FF; border-radius:14px; padding:12px 10px 8px; margin-top:16px; }
  .st { display:flex; align-items:baseline; gap:8px; }
  .st b { font-size:16px; }
  .st .dot { width:9px; height:9px; border-radius:5px; flex:none; align-self:center; }
  .st .val { margin-left:auto; font-size:17px; font-weight:700; font-variant-numeric:tabular-nums; }
  .vd { font-size:12.5px; line-height:1.4; margin-top:4px; color:#D1D1D6; min-height:18px; }
  .vd b { font-weight:700; }
  .howBtn { font-size:12.5px; font-weight:700; color:#64A8FF; border:1px solid #64A8FF; border-radius:10px; padding:4px 9px; cursor:pointer; white-space:nowrap; }
  .howWrap { display:none; position:fixed; left:0; top:0; right:0; bottom:0; background:rgba(0,0,0,0.6); z-index:50; overflow-y:auto; -webkit-overflow-scrolling:touch; }
  .howWrap.on { display:block; }
  .howSheet { background:#1C1C1E; margin:40px 10px 30px; border-radius:16px; padding:18px 16px 20px; border:1px solid #3A3A3C; }
  .howSheet h3 { margin:0; font-size:20px; } .howSheet .sub2 { color:#98989F; font-size:12.5px; margin:4px 0 8px; }
  .howSheet .it { display:flex; gap:10px; margin-top:12px; } .howSheet .bd { flex:0 0 22px; height:22px; border-radius:11px; color:#1C1C1E; font-weight:800; font-size:13px; text-align:center; line-height:22px; }
  .howSheet .it { align-items:flex-start; } .howSheet .gl { flex:0 0 72px; }
  .howSheet .it b { display:block; font-size:14.5px; color:#FFFFFF; } .howSheet .it span { display:block; color:#C7C7CC; font-size:13px; line-height:1.4; } .howSheet .it span.mn { color:#FFFFFF; font-weight:600; margin:1px 0 3px; }
  .howSheet .done { display:block; text-align:center; margin-top:18px; padding:10px; border-radius:10px; background:#2C2C2E; font-weight:700; color:#64A8FF; cursor:pointer; }
  .bchips { display:flex; flex-wrap:wrap; gap:6px; margin:6px 0 2px; }
  .bchip.rz { color:#FFFFFF; border:1px solid #636366; background:transparent; }
  .bchip { border-radius:10px; padding:5px 9px; background:#2C2C2E; font-size:12.5px; font-weight:700; cursor:pointer; }
  .bchip.off { opacity:0.35; }
  .bchip i { display:inline-block; width:12px; height:4px; border-radius:2px; vertical-align:middle; margin-right:5px; }
  .vd .ctx { color:#98989F; font-size:11.5px; margin-top:4px; line-height:1.4; }
  .ds { font-size:11px; line-height:1.4; color:var(--gray); margin-top:4px; }
  svg.chart { display:block; width:100%; height:170px; margin-top:6px; }
  .wrap { position:relative; }
  .touch { position:absolute; left:0; top:0; right:0; bottom:0; touch-action:pan-y; }
  .note { color:var(--gray); font-size:10.5px; line-height:1.45; margin-top:24px; }
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
</style>
</head>
<body>
<div class="ticker">Jobs</div>
<div class="name">Unemployment rate: what is pushing it up or down · BLS and Labor Dept. via FRED</div>
<div id="sched" style="display:none"></div>
<div class="hint" id="progress"></div>
<div class="head" id="headline"></div>
<div class="hint" id="when"></div>

<div class="sec" id="bevSec" style="border-top:none;margin-top:8px"><div class="st"><span class="dot" style="background:#30D5C8"></span><b>Beveridge curve: openings vs unemployment</b><span class="val" id="vBev" style="color:#30D5C8"></span></div>
  <div class="bchips" id="bevChips"></div>
  <div class="wrap"><svg class="chart" id="cBev" style="height:300px"></svg><div class="touch" id="tBev"></div></div>
  <div class="ds">Each dot is a month since December 2000: the unemployment rate across, job openings as a % of jobs plus openings (JOLTS) up. Colors mark eras: <span style="color:#8E8E93;font-weight:600">2001–07</span>, <span style="color:#64A8FF;font-weight:600">2008–19</span>, <span style="color:#FF9F0A;font-weight:600">2020–21</span>, <span style="color:#30D5C8;font-weight:600">2022–now</span>. Arrowheads every six months point forward in time; pinch to zoom in (arrows get dates, then every month gets one), double-tap to reset. Moving down the curve (fewer openings, little change in unemployment) means hiring demand cooling without layoffs; moving right means unemployment rising. The whole curve shifting outward means job seekers and openings are matching less easily. All dates, not the zoom. History (1951–2000, one dot per year) uses Barnichon’s composite help-wanted index, a proxy for openings, scaled to JOLTS over 2001–14.</div></div>
<div class="grp">Recession signals</div>
<div class="sec"><div class="st"><span class="dot" style="background:#FFD60A"></span><b>Sahm rule</b><span class="val" id="v5"></span></div><div class="vd" id="vd5"></div>
  <div class="wrap"><svg class="chart" id="c5"></svg><div class="touch" id="t5"></div></div>
  <div class="ds"><span style="color:#FFD60A;font-weight:600">The Sahm rule: the 3-month average unemployment rate minus its lowest 3-month average of the prior 12 months.</span> A reading at or above the <span style="color:#FF453A;font-weight:600">dashed red 0.50 line</span> has signaled the start of every U.S. recession since 1970.</div></div>
<div class="sec"><div class="st"><span class="dot" style="background:#FF9F0A"></span><b>Recession odds: yield curve and Anxious Index</b><span class="val" id="v7" style="color:#FF9F0A;text-align:right;line-height:1.2;font-size:14.5px;white-space:nowrap"></span></div><div class="vd" id="vd7"></div>
  <div class="bchips" id="g7"></div>
  <div class="wrap"><svg class="chart" id="c7"></svg><div class="touch" id="t7"></div></div>
  <div class="ds"><span style="color:#FF9F0A;font-weight:600">Orange, the NY Fed&#39;s model:</span> the odds of a recession in a given month, forecast a year earlier from the gap between the 10-year Treasury and the 3-month bill (monthly averages). Each point sits at the month it forecasts, so the line runs a year past today. Shaded, right of the dashed line: the forecast for the coming year. Left: past forecasts, to compare with the <span style="color:#AEAEB2;font-weight:600">gray recession columns</span>. A forecast never changes once made; each month adds one new point at the end. Computed here from FRED with the NY Fed&#39;s published formula, so it can differ from theirs by a few tenths. <span style="color:#BF5AF2;font-weight:600">Purple, the Philadelphia Fed&#39;s Anxious Index:</span> the average chance professional forecasters give of real GDP falling in the quarter after each quarterly survey, plotted at that quarter. <span style="color:#BF5AF2;font-weight:600">Dotted purple:</span> each survey&#39;s odds for the four quarters after it, the latest bold, the three before it faint and tagged. A one-quarter dip in GDP, not a full recession.</div></div>
<div class="grp">Flows</div>
<div class="sec" id="s1"><div class="st"><span class="dot" id="d1"></span><b>Layoffs</b><span class="val" id="v1" style="text-align:right;line-height:1.2"></span></div><div class="vd" id="vd1"></div>
  <div class="bchips" id="g1"></div>
  <div class="wrap"><svg class="chart" id="c1"></svg><div class="touch" id="t1"></div></div>
  <div class="ds"><span style="color:#FF453A;font-weight:600">Red: initial unemployment claims, 4-week average</span> (Labor Dept., weekly): people who filed for benefits. The <span style="color:#FFFFFF;font-weight:600">dotted line</span> is the 2019 average; above it pushes unemployment up. There are more jobs than in 2019, so the call (upward / neutral / downward) uses claims per 1,000 jobs, shown in the readout. <span style="color:#FF9F0A;font-weight:600">Orange: JOLTS layoffs and discharges</span> (BLS employer survey, monthly, about six weeks behind) as a weekly pace, the monthly total divided by the weeks in the month. It counts everyone let go, filed or not, so the gap above the red line is layoffs that never became a claim. <span style="color:#C7C7CC;font-weight:600">Gray dots: news mentions</span> (GDELT, since 2017): the share of US English-language news articles that say &ldquo;layoff&rdquo; or &ldquo;layoffs&rdquo;, 13-week average, on its own scale at the right, fitted to the dates shown. The readout compares it with its 2019 average. Watch for headlines running ahead of (or behind) actual claims.</div></div>
<div class="sec" id="s8"><div class="st"><span class="dot" style="background:#64A8FF"></span><b>Expected vs actual job loss</b><span class="val" id="v8" style="color:#64A8FF;text-align:right;line-height:1.2;font-size:14.5px;white-space:nowrap"></span></div>
  <div class="bchips"><span class="bchip" style="color:#64A8FF;cursor:default"><i style="background:#64A8FF"></i>Expected (survey)</span><span class="bchip" style="color:#FF9F0A;cursor:default"><i style="background:#FF9F0A"></i>Actual layoffs</span></div>
  <div class="wrap"><svg class="chart" id="c8" style="height:200px"></svg><div class="touch" id="t8"></div></div>
  <div class="ds" id="k8" style="color:#C7C7CC;font-size:11.5px"></div>
  <div class="ds"><span style="color:#64A8FF;font-weight:600">Blue:</span> workers&#39; average chance of losing their job in the next 12 months (NY Fed Survey of Consumer Expectations), plotted at the month it&#39;s about, so the line runs a year past today. <span style="color:#64A8FF;font-weight:600">Dotted:</span> the forecast; the last four surveys fan out from today, older three dimmed. <span style="color:#FF9F0A;font-weight:600">Orange:</span> the share of jobs actually lost to layoffs and discharges over the past 12 months (JOLTS). Where <span style="color:#64A8FF;font-weight:600">blue</span> sits above <span style="color:#FF9F0A;font-weight:600">orange</span>, workers feared more job loss than came.</div></div>
<div class="sec" id="s3"><div class="st"><span class="dot" id="d3"></span><b>Hiring</b><span style="color:#98989F;font-size:12.5px">JOLTS hires rate</span><span class="val" id="v3"></span></div><div class="vd" id="vd3"></div>
  <div class="wrap"><svg class="chart" id="c3"></svg><div class="touch" id="t3"></div></div>
  <div class="ds"><span style="color:#BF5AF2;font-weight:600">Hires each month as a % of jobs</span> (JOLTS); the <span style="color:#FFFFFF;font-weight:600">dotted line</span> is the 2019 average. Below the line (<span style="color:#FF453A;font-weight:600">red shading</span>) means slower hiring than 2019, which pushes unemployment up. Monthly, about six weeks behind.</div></div>
<div class="grp">Stickiness</div>
<div class="sec" id="s2"><div class="st"><span class="dot" id="d2"></span><b>Continuing claims</b><span class="val" id="v2"></span></div><div class="vd" id="vd2"></div>
  <div class="wrap"><svg class="chart" id="c2"></svg><div class="touch" id="t2"></div></div>
  <div class="ds"><span style="color:#FF9F0A;font-weight:600">People still collecting benefits, 4-week average</span>: how long job searches take. The <span style="color:#FFFFFF;font-weight:600">dotted line</span> is the 2019 average; above it pushes unemployment up. The call uses claims per 1,000 jobs, shown in the readout.</div></div>
<div class="sec" id="s9"><div class="st"><span class="dot" style="background:#30D158"></span><b>Expected vs actual job finding</b><span class="val" id="v9" style="color:#30D158;text-align:right;line-height:1.2;font-size:14.5px;white-space:nowrap"></span></div>
  <div class="bchips" id="g9"><span class="bchip" style="color:#30D158;cursor:default"><i style="background:#30D158"></i>Expected (survey)</span><span class="bchip" style="color:#FF9F0A;cursor:default"><i style="background:#FF9F0A"></i>Actual job finding</span></div>
  <div class="wrap"><svg class="chart" id="c9"></svg><div class="touch" id="t9"></div></div>
  <div class="ds"><span style="color:#30D158;font-weight:600">Green: workers&#39; average chance of finding a job they&#39;d accept within 3 months</span> if they lost theirs today (NY Fed Survey of Consumer Expectations, monthly). The <span style="color:#FFFFFF;font-weight:600">dashed line</span> is the survey&#39;s average since 2013. <span style="color:#FF9F0A;font-weight:600">Orange:</span> what actually happened, the share of unemployed people who found work, as the odds of finding a job within 3 months (BLS labor force flows). It counts everyone unemployed, not just people who lost a job, so it&#39;s a close match, not an exact one.</div></div>
<div class="sec"><div class="st"><span class="dot" style="background:#30D5C8"></span><b>Prime-age employment</b><span class="val" id="v6" style="color:#30D5C8"></span></div><div class="vd" id="vd6"></div>
  <div class="wrap"><svg class="chart" id="c6"></svg><div class="touch" id="t6"></div></div>
  <div class="ds"><span style="color:#30D5C8;font-weight:600">Share of people aged 25–54 with a job</span>; the <span style="color:#FFFFFF;font-weight:600">dashed line</span> is the 2019 average. A cross-check, not a pressure: unemployment can fall because people stop looking, but this only rises when more people work.</div></div>
<div class="grp">The result</div>
<div class="sec res"><div class="st"><span class="dot" style="background:#64A8FF"></span><b>Unemployment rate</b><span class="val" id="v4" style="color:#64A8FF"></span></div><div class="vd" id="vd4"></div>
  <div class="wrap"><svg class="chart" id="c4"></svg><div class="touch" id="t4"></div></div>
  <div class="ds" id="k4" style="color:#C7C7CC;font-size:11.5px"></div>
  <div class="ds"><span style="color:#64A8FF;font-weight:600">The unemployment rate</span> (BLS household survey, monthly). <span style="color:#AEAEB2;font-weight:600">Gray bands</span> are recessions; the line <span style="color:#FF453A;font-weight:600">turns red</span> in months the Sahm rule was at or above 0.50. Dotted, right of today: professional forecasters&#39; median forecast by quarter (Philadelphia Fed Survey of Professional Forecasters), <span style="color:#FFFFFF;font-weight:600">the latest survey in white</span> and <span style="color:#64A8FF;font-weight:600">the three before it dimmed blue</span>.</div></div>
<div class="grp" id="wGrp">Workers&#39; view</div>
<div class="sec" id="wSec"><div class="st"><span class="dot" style="background:#FFFFFF"></span><b>Job Security Map</b><span class="val" id="vW" style="text-align:right;font-size:14px;line-height:1.25"></span></div>
  <div class="bchips" id="wChips"></div>
  <svg class="chart" id="cW" style="height:320px"></svg>
  <div class="ds">Each point is a month (3-month average) of the NY Fed Survey of Consumer Expectations: across, the chance of losing your job in the next 12 months; up, the chance of finding another within 3 months if you did. Arrowheads each January point forward in time. The <span style="color:#AEAEB2;font-weight:600">dashed lines</span> split the corners at each question&#39;s average since 2013: <span style="color:#30D158;font-weight:600">Secure</span>, <span style="color:#FFD60A;font-weight:600">Churning</span>, <span style="color:#64A8FF;font-weight:600">Stuck</span>, <span style="color:#FF453A;font-weight:600">Cornered</span>. Line colors mark eras (see the chips).</div></div>

<div class="hint" style="margin-top:14px">Hold any chart to read a date on all of them · pinch to zoom · double-tap to reset</div>

<div class="note" id="note"></div>
<div class="howWrap" id="howWrap"><div class="howSheet" id="howSheet"></div></div>
<script>
var D = __DATA__;
var MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
var RED = "#FF453A", GRN = "#30D158", BLU = "#64A8FF", TEAL = "#30D5C8", GOLD = "#FFD60A", GRAYC = "#98989F";
var SER = [
  { key: "lay", label: "Layoffs", color: RED, gap: 10 },
  { key: "cont", label: "Continuing claims", color: "#FF9F0A", gap: 10 },
  { key: "hire", label: "Hiring shortfall", color: "#BF5AF2", gap: 80 }
];
var STAT = { up: { word: "Upward pressure", c: RED }, neutral: { word: "Neutral", c: GRAYC }, down: { word: "Downward pressure", c: GRN } };
function el(id) { return document.getElementById(id); }
function esc(s) { return String(s).split("&").join("&amp;").split("<").join("&lt;").split(">").join("&gt;"); }
function day(s) { return Math.round(Date.parse(s + "T12:00:00Z") / 86400000); }
function dstr(n) { return new Date(n * 86400000).toISOString().slice(0, 10); }
function fmtD(s, monthly) { var p = s.split("-"); return monthly ? MONTHS[+p[1] - 1] + " " + p[0] : MONTHS[+p[1] - 1] + " " + (+p[2]) + ", " + p[0]; }
function sgn(v, dec) { var a = Math.abs(v).toFixed(dec || 0); return (parseFloat(a) === 0 ? "" : v > 0 ? "+" : "−") + a; }
function niceStep(range, n) { var raw = range / (n || 5), p = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), f = raw / p; return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p; }

var S = {};
function prep() {
  function conv(arr, monthly) { return (arr || []).map(function (p) { return { n: day(p.d), v: p.v, d: p.d, m: monthly }; }); }
  S.lay = conv(D.press.lay); S.cont = conv(D.press.cont); S.hire = conv(D.press.hire, true);
  S.ur = conv(D.ur, true); S.sahm = conv(D.sahm, true); S.epop = conv(D.epop, true); S.rprob = conv(D.rprob, true);
  S.jloss = conv(D.jloss, true); S.jfind = conv(D.jfind, true); S.layAct = conv(D.layAct, true); S.findAct = conv(D.findAct, true); S.layWk = conv(D.layWk || [], true);
  S.news = conv(D.newsWk || []); S.newsF = D.news19 ? 1 : 0;
  S.newsM = S.news.map(function (p) { return { n: p.n, v: p.v, d: p.d, r: p.v / D.news19 }; });
  S.jloss.forEach(function (p, i) { p.s = D.jloss[i].s; });
  S.anx = conv(D.anx, true); S.anx.forEach(function (p, i) { p.q = D.anx[i].q; p.s = D.anx[i].s; });
  S.anxFc = (D.anxFc || []).map(function (r) { var pts = conv(r.pts, true); pts.forEach(function (p, i) { p.q = r.pts[i].q; }); return { s: r.s, pts: pts }; });
  S.urFc = (D.urFc || []).map(function (r) { var pts = conv(r.pts, true); pts.forEach(function (p, i) { p.q = r.pts[i].q; }); return { s: r.s, pts: pts }; });
  S.rawLay = conv(D.raw.lay); S.rawCont = conv(D.raw.cont); S.rawHire = conv(D.raw.hire, true);
  S.kLay = conv((D.rawK || {}).lay); S.kCont = conv((D.rawK || {}).cont);
}
var FIRST = 0, LAST = 0, view = { a: 0, b: 0 }, cursor = null, MIN_SPAN = 180;
function resetView() { view.b = LAST; view.a = Math.max(FIRST, LAST - D.defaultDays); }
function setView(a, b) {
  var span = Math.max(MIN_SPAN, Math.min(LAST - FIRST, b - a));
  a = Math.max(FIRST, Math.min(LAST - span, a));
  view.a = a; view.b = a + span; renderCharts();
}
function at(arr, n, maxGap) {
  var lo = 0, hi = arr.length - 1, best = -1;
  while (lo <= hi) { var mid = (lo + hi) >> 1; if (arr[mid].n <= n) { best = mid; lo = mid + 1; } else hi = mid - 1; }
  if (best < 0) return null;
  return n - arr[best].n <= (maxGap || 45) ? arr[best] : null;
}
function readDay() { return cursor != null ? cursor : view.b; }
function visible(arr) { return arr.filter(function (p) { return p.n >= view.a && p.n <= view.b; }); }
function statusOf(v) { return v > D.neutralPct ? "up" : v < -D.neutralPct ? "down" : "neutral"; }

// ---- What each chart says at day n. The three drivers are read together:
// each note explains its own line in the light of the other two, plus which
// way it has moved over the past 3 months. Shared by the phone (the date
// being read) and the PDF (the last date shown).
function base1(key, n) {
  var sr = null; SER.forEach(function (x) { if (x.key === key) sr = x; });
  var p = at(S[key], n, sr.gap);
  return p ? { p: p, st: statusOf(p.v), a: Math.abs(Math.round(p.v)) } : null;
}
// direction over ~3 months, from the underlying level (claims per job, hires rate)
function trend3(key, n) {
  var arr = key === "lay" ? S.rawLay : key === "cont" ? S.rawCont : S.rawHire, gap = key === "hire" ? 80 : 10;
  var now = at(arr, n, gap); if (!now) return "";
  var then = at(arr, now.n - 91, gap + 20); if (!then) return "";
  var d = key === "hire" ? now.v - then.v : (now.v / then.v - 1) * 100, th = key === "hire" ? 0.1 : 3;
  return d > th ? "rising" : d < -th ? "falling" : "steady";
}
// the 3-month move, with "though" when it runs against the verdict
function trendTxt(key, n) {
  var t = trend3(key, n), me = base1(key, n);
  if (!t) return "";
  if (t === "steady") return ", steady over the past 3 months";
  var worse = key === "hire" ? t === "falling" : t === "rising", st = me ? me.st : "neutral";
  var against = (st === "down" && worse) || (st === "up" && !worse);
  return (against ? ", though " : ", ") + t + " over the past 3 months";
}
function verdict(key, n) {
  var L = base1("lay", n), C = base1("cont", n), Hh = base1("hire", n), me = key === "lay" ? L : key === "cont" ? C : Hh;
  if (!me) return null;
  var st = me.st, a = me.a, t, up = function (x) { return x && x.st === "up"; };
  if (key === "lay") {
    var r = at(S.rawLay, n, 10), raw = r ? " (" + r.v.toFixed(2) + " per 1,000 jobs)" : "";
    t = (st === "up" ? "initial claims are " + a + "% above 2019" : st === "down" ? "initial claims are " + a + "% below 2019" : "initial claims are within " + D.neutralPct + "% of 2019") + raw + trendTxt("lay", n) + ", ";
    if (st === "up") t += "so more people are being laid off" + (up(Hh) ? ", with fewer hires to absorb them." : ", though hiring is holding up.");
    else if (up(C)) t += "so the higher continuing claims aren’t coming from more layoffs.";
    else t += st === "down" ? "so fewer people are being laid off than in 2019." : "so layoffs aren’t adding pressure.";
  } else if (key === "cont") {
    var r2 = at(S.rawCont, n, 10), raw2 = r2 ? " (" + r2.v.toFixed(1) + " per 1,000 jobs)" : "";
    t = (st === "up" ? "continuing claims are " + a + "% above 2019" : st === "down" ? "continuing claims are " + a + "% below 2019" : "continuing claims are within " + D.neutralPct + "% of 2019") + raw2 + trendTxt("cont", n) + ", ";
    if (st === "up") t += up(Hh) ? "so people are staying on benefits longer; with hiring below 2019, there are fewer openings to move into" + (up(L) ? ", on top of more layoffs." : ".")
      : up(L) ? "partly from more layoffs, even though hiring is at or above 2019."
      : "so people are staying on benefits longer even though layoffs and hiring are at or better than 2019, which points to a mismatch between job seekers and openings.";
    else if (st === "neutral") t += up(Hh) ? "so despite slower hiring, the unemployed are finding work at about the 2019 pace." : "so job searches take about as long as in 2019.";
    else t += "so people are finding work faster than in 2019.";
  } else {
    var r3 = at(S.rawHire, n, 80), raw3 = r3 ? " (hires rate " + r3.v.toFixed(1) + "% vs " + D.base.hire.toFixed(1) + "% in 2019, " + fmtD(r3.d, true) + ")" : "";
    if (st === "up") t = "employers are hiring " + a + "% less than in 2019" + raw3 + trendTxt("hire", n) + ". That can mean slower job-finding for the unemployed or just less job-hopping, as in a hiring freeze; continuing claims tell which: " +
      (!C ? "no reading yet." : up(C) ? "here, slower job-finding (continuing claims " + C.a + "% above 2019)." : "here, mostly less job-hopping (continuing claims " + (C.st === "neutral" ? "near" : C.a + "% below") + " 2019).");
    else if (st === "down") t = "employers are hiring " + a + "% more than in 2019" + raw3 + trendTxt("hire", n) + ", so the unemployed find jobs faster.";
    else t = "hiring is within " + D.neutralPct + "% of its 2019 pace" + raw3 + trendTxt("hire", n) + ".";
  }
  return { st: st, p: me.p, word: STAT[st].word, c: STAT[st].c, text: t, value: sgn(me.p.v) + "% vs 2019" };
}
// One line on what the three drivers add up to
function diagnosis(n) {
  var L = base1("lay", n), C = base1("cont", n), Hh = base1("hire", n);
  if (!L || !C || !Hh) return null;
  var up = function (x) { return x.st === "up"; };
  var lw = function () { return L.st === "neutral" ? "layoffs near 2019" : "layoffs " + L.a + "% " + (L.p.v > 0 ? "above" : "below") + " 2019"; };
  var hw = function () { return Hh.st === "neutral" ? "hiring near 2019" : "hiring " + Hh.a + "% " + (Hh.p.v > 0 ? "below" : "above") + " 2019"; };
  var cw = function () { return C.st === "neutral" ? "continuing claims near 2019" : "continuing claims " + C.a + "% " + (C.p.v > 0 ? "above" : "below") + " 2019"; };
  var name, tail;
  if (up(L) && up(Hh)) { name = "Broad weakening"; tail = up(C) ? ", and the unemployed are staying on benefits longer." : "."; }
  else if (up(L)) { name = "Churn"; tail = up(C) ? ", but people are staying on benefits longer." : ", so laid-off workers are finding jobs."; }
  else if (up(Hh)) { name = "Low-hire, low-fire"; tail = up(C) ? ", so the unemployed are stuck longer." : C.st === "neutral" ? ": so far it looks like less job-hopping, not longer job searches." : ": the unemployed are still finding work quickly."; }
  else if (up(C)) { name = "Mismatch"; tail = ": layoffs and hiring are at or better than 2019, yet people stay on benefits longer."; }
  else { name = L.st === "down" || Hh.st === "down" || C.st === "down" ? "Tighter than 2019" : "Balanced, near 2019"; tail = "."; }
  var hs = function (w) { return w.split(" 2019").join(""); };
  return { name: name, text: name + ": " + lw() + ", " + hw() + ", " + cw() + tail, head: name + ": " + lw() + ", " + hs(hw()) + ", " + hs(cw()) };
}
// The latest facts from every chart at day n, minus the one being described
function facts(n, skip) {
  var out = [];
  if (skip !== "lay") { var k1 = at(S.kLay, n, 10), r1 = at(S.rawLay, n, 10), b1 = base1("lay", n); if (k1 && r1 && b1) out.push("initial claims " + fmtK(k1.v) + " (" + r1.v.toFixed(2) + " per 1,000 jobs, " + (b1.st === "neutral" ? "near 2019" : sgn(b1.p.v) + "% vs 2019") + ")"); }
  if (skip !== "cont") { var k2 = at(S.kCont, n, 10), r2 = at(S.rawCont, n, 10), b2 = base1("cont", n); if (k2 && r2 && b2) out.push("continuing claims " + fmtK(k2.v) + " (" + r2.v.toFixed(1) + " per 1,000 jobs, " + (b2.st === "neutral" ? "near 2019" : sgn(b2.p.v) + "% vs 2019") + ")"); }
  if (skip !== "hire") { var h = at(S.rawHire, n, 80); if (h) out.push("hires rate " + h.v.toFixed(1) + "% in " + fmtD(h.d, true).split(" ")[0] + " (2019: " + D.base.hire.toFixed(1) + "%)"); }
  if (skip !== "ur") { var u = at(S.ur, n); if (u) { var ya = at(S.ur, u.n - 365, 40); out.push("unemployment " + u.v.toFixed(1) + "%" + (ya ? " (" + sgn(u.v - ya.v, 1) + " pts vs a year earlier)" : "")); } }
  if (skip !== "sahm") { var sm = at(S.sahm, n); if (sm) out.push("Sahm rule " + sm.v.toFixed(2) + " (signal at " + D.sahmTrigger.toFixed(2) + ")"); }
  if (skip !== "epop") { var e = at(S.epop, n); if (e) out.push("prime-age employment " + e.v.toFixed(1) + "% (" + sgn(e.v - D.epopBase, 1) + " pts vs 2019)"); }
  return out.length ? "Other charts: " + out.join("; ") + "." : "";
}
function urVerdict(n) {
  var u = at(S.ur, n);
  if (!u) return null;
  var ya = at(S.ur, u.n - 365, 40);
  var dg = diagnosis(n);
  return { u: u, text: "unemployment is " + u.v.toFixed(1) + "% in " + fmtD(u.d, true) + (ya ? ", " + sgn(u.v - ya.v, 1) + " pts vs a year earlier" : "") + "." +
    (dg ? " Behind it, " + dg.name.toLowerCase() + ": " + dg.text.slice(dg.name.length + 2) : "") };
}
function sahmVerdict(n) {
  var s = at(S.sahm, n);
  if (!s) return null;
  var on = s.v >= D.sahmTrigger;
  return { s: s, on: on, word: on ? "Recession signal" : "No recession signal",
    text: "the Sahm rule is " + s.v.toFixed(2) + " in " + fmtD(s.d, true) + (on ? ", at or above the " : ", below the ") + D.sahmTrigger.toFixed(2) + " line." };
}
function epVerdict(n) {
  var e = at(S.epop, n);
  if (!e) return null;
  var dv = e.v - D.epopBase;
  return { e: e, text: e.v.toFixed(1) + "% of 25–54-year-olds have a job (" + fmtD(e.d, true) + "), " + sgn(dv, 1) + " pts vs 2019" +
    (dv >= 0 ? ", so unemployment isn’t being flattered by people giving up." : "; watch whether low unemployment reflects people leaving the labor force.") };
}

// ---- Phone charts
function frame(svg, lo, hi, fmt, rpad) {
  var r = svg.getBoundingClientRect(), w = Math.max(260, r.width), h = Math.max(120, r.height);
  var L = 38, R = w - (rpad || 10), T = 6, B = h - 20;
  svg.__geo = { L: L, w: R - L };
  var F = { id: svg.id, X: function (n) { return L + (n - view.a) / (view.b - view.a) * (R - L); }, Y: function (v) { return B - (v - lo) / (hi - lo) * (B - T); }, L: L, R: R, T: T, B: B, h: h };
  var s = '<defs><clipPath id="cp' + svg.id + '"><rect x="' + L + '" y="' + T + '" width="' + (R - L) + '" height="' + (B - T) + '"/></clipPath></defs>';
  (D.rec || []).forEach(function (b) {
    var a = Math.max(view.a, day(b.from + "-01")), z = Math.min(view.b, day(b.to + "-28") + 3);
    if (z > a) s += '<rect x="' + F.X(a).toFixed(1) + '" y="' + T + '" width="' + (F.X(z) - F.X(a)).toFixed(1) + '" height="' + (B - T) + '" fill="#FFFFFF" fill-opacity="0.07"/>';
  });
  var st = niceStep(hi - lo, 4);
  for (var v = Math.ceil(lo / st) * st; v <= hi + 1e-9; v += st) {
    s += '<line x1="' + L + '" x2="' + R + '" y1="' + F.Y(v).toFixed(1) + '" y2="' + F.Y(v).toFixed(1) + '" stroke="#3A3A3C" stroke-width="0.6"/>';
    s += '<text x="' + (L - 5) + '" y="' + (F.Y(v) + 3.5).toFixed(1) + '" fill="#98989F" font-size="10" text-anchor="end">' + fmt(v) + '</text>';
  }
  var years = (view.b - view.a) / 365.25, lastX = -99, y0 = +dstr(view.a).slice(0, 4), y1 = +dstr(view.b).slice(0, 4);
  for (var y = y0; y <= y1; y++) for (var q = 0; q < 4; q++) {
    if (years > 2.5 && q) continue;
    var mo = q * 3 + 1, n = day(y + "-" + (mo < 10 ? "0" : "") + mo + "-01");
    if (n < view.a || n > view.b) continue;
    var every = years > 14 ? 5 : years > 7 ? 2 : 1;
    if (!q && years > 2.5 && y % every) continue;
    var lab = q ? MONTHS[mo - 1] : String(y), x = F.X(n);
    if (x - lastX < 32 || x > R - 10) continue;
    s += '<text x="' + x.toFixed(1) + '" y="' + (h - 5) + '" fill="#98989F" font-size="10" text-anchor="middle">' + lab + '</text>';
    lastX = x;
  }
  F.head = s;
  return F;
}
function path(F, arr, color, width, gap) {
  var d = "", pen = false, prev = null, mg = gap || 50;
  for (var i = 0; i < arr.length; i++) {
    var p = arr[i];
    if (p.n < view.a - 40 || p.n > view.b + 40) { pen = false; continue; }
    if (prev && p.n - prev.n > mg) pen = false;
    d += (pen ? "L" : "M") + F.X(p.n).toFixed(1) + "," + F.Y(p.v).toFixed(1); pen = true; prev = p;
  }
  return '<path d="' + d + '" clip-path="url(#cp' + F.id + ')" fill="none" stroke="' + color + '" stroke-width="' + width + '" stroke-linejoin="round" stroke-linecap="round"/>';
}
function cursorLine(F) {
  if (cursor == null) return "";
  var x = F.X(cursor);
  return '<line x1="' + x + '" x2="' + x + '" y1="' + F.T + '" y2="' + F.B + '" stroke="#FFFFFF" stroke-width="1" stroke-dasharray="3 2"/>';
}
function dot(F, p, color, lo, hi) {
  if (!p) return "";
  var v = lo == null ? p.v : Math.max(lo, Math.min(hi, p.v));
  return '<circle cx="' + F.X(p.n).toFixed(1) + '" cy="' + F.Y(v).toFixed(1) + '" r="3.6" fill="' + color + '" stroke="#1C1C1E" stroke-width="1.5"/>';
}
// Notes are just the tag (upward / neutral / downward pressure, or the Sahm signal)
function setVerdict(id, word, c) { el(id).innerHTML = word ? '<b style="color:' + c + '">' + esc(word) + "</b>" : ""; el(id).style.display = word ? "" : "none"; }

// Claims: the 4-week average count itself, dotted 2019 average, red above it
function fmtK(v) { return v >= 1000 ? (v / 1000).toFixed(2) + "M" : Math.round(v) + "K"; }
var jlOff = false, nwOff = false, NEWSC = "#C7C7CC";
function dotsPath(F, arr, color, width, gap) { return path(F, arr, color, width, gap).split('stroke-linejoin="round" stroke-linecap="round"').join('stroke-dasharray="0.1 4.2" stroke-linejoin="round" stroke-linecap="round"'); }
// The news line gets its own scale: its range over the dates shown, stretched to
// the chart's full height (lo..hi in claims units), so its peaks never flatten
function newsFit(arr, a, b, lo, hi) {
  var v = arr.filter(function (p) { return p.n >= a && p.n <= b; }).map(function (p) { return p.v; });
  if (!v.length) return null;
  var nlo = Math.min.apply(null, v), nhi = Math.max.apply(null, v), pd = (nhi - nlo) * 0.1 || nhi * 0.1 || 0.01;
  nlo = Math.max(0, nlo - pd); nhi += pd;
  var f = { lo: nlo, hi: nhi, map: function (x) { return lo + (x - nlo) / (nhi - nlo) * (hi - lo); } };
  f.pts = arr.map(function (p) { return { n: p.n, v: f.map(p.v), d: p.d, r: p.r }; });
  return f;
}
function newsDec(st) { return st >= 0.1 ? 1 : st >= 0.01 ? 2 : 3; }
// its scale: % of articles, ticks at the right edge
function newsAxis(F, nf) {
  var st = niceStep(nf.hi - nf.lo, 4), s = "";
  for (var v = Math.ceil(nf.lo / st) * st; v <= nf.hi + 1e-12; v += st) s += '<text x="' + (F.R + 4) + '" y="' + (F.Y(nf.map(v)) + 3.5).toFixed(1) + '" fill="' + NEWSC + '" font-size="9.5" text-anchor="start">' + v.toFixed(newsDec(st)) + "%</text>";
  return s;
}
function claimsScale(arr, base, extra) {
  var v = arr.concat(extra || []).filter(function (p) { return p.n >= view.a && p.n <= view.b; }).map(function (p) { return p.v; });
  if (!v.length) return null;
  v.push(base);
  var lo = Math.min.apply(null, v), hi = Math.min(base * (1 + D.capHi / 100), Math.max.apply(null, v)), pad = (hi - lo) * 0.08;
  return { lo: Math.max(0, lo - pad), hi: hi + pad };
}
var CLAIMS = [{ key: "lay", k: "kLay", raw: "rawLay", per: function (v) { return v.toFixed(2); } }, { key: "cont", k: "kCont", raw: "rawCont", per: function (v) { return v.toFixed(1); } }];
function drawDrivers() {
  var n = readDay();
  CLAIMS.forEach(function (c, k) {
    var jl = k === 0 && (S.layWk || []).length && !jlOff ? S.layWk : null;
    var nw = k === 0 && S.newsM.length && S.newsF && !nwOff ? S.newsM : null;
    var svg = el("c" + (k + 1)), sr = SER[k], base = D.baseK[c.key], sc = claimsScale(S[c.k], base, jl);
    if (!sc) { svg.innerHTML = ""; return; }
    var nf = nw ? newsFit(nw, view.a, view.b, sc.lo, sc.hi) : null;
    var F = frame(svg, sc.lo, sc.hi, fmtK, nf ? 40 : 10), s = F.head, yb = F.Y(base);
    if (k !== 0) s += '<rect x="' + F.L + '" y="' + F.T + '" width="' + (F.R - F.L) + '" height="' + Math.max(0, yb - F.T).toFixed(1) + '" fill="#FF453A" fill-opacity="0.07"/>'; // no shading on Layoffs
    s += '<line x1="' + F.L + '" x2="' + F.R + '" y1="' + yb.toFixed(1) + '" y2="' + yb.toFixed(1) + '" stroke="#FFFFFF" stroke-opacity="0.6" stroke-dasharray="2 3" stroke-width="1.4"/>';
    s += '<text x="' + (F.R - 2) + '" y="' + (yb - 4).toFixed(1) + '" fill="#FFFFFF" fill-opacity="0.7" font-size="9.5" text-anchor="end">2019 avg ' + fmtK(base) + '</text>';
    if (nf) s += dotsPath(F, nf.pts, NEWSC, 2.2, 10) + newsAxis(F, nf);
    if (jl) s += path(F, jl, "#FF9F0A", 1.8, 40);
    s += path(F, S[c.k], sr.color, 2.4);
    var r = at(S[c.k], n, 10), rp = at(S[c.raw], n, 10), vd = verdict(c.key, n), rj = jl ? at(jl, n, 70) : null, rn = nf ? at(nf.pts, n, 10) : null;
    svg.innerHTML = s + cursorLine(F) + (rn ? dot(F, rn, NEWSC, sc.lo, sc.hi) : "") + (rj ? dot(F, rj, "#FF9F0A", sc.lo, sc.hi) : "") + dot(F, r, sr.color, sc.lo, sc.hi);
    if (k === 0) el("g1").innerHTML = (S.layWk || []).length || S.newsM.length ? '<span class="bchip" style="color:' + RED + ';cursor:default"><i style="background:' + RED + '"></i>Claims, 4-wk avg.</span>' +
      ((S.layWk || []).length ? '<span class="bchip' + (jlOff ? " off" : "") + '" data-k="jl" style="color:#FF9F0A"><i style="background:#FF9F0A"></i>JOLTS layoffs, weekly pace</span>' : "") +
      (S.newsM.length && S.newsF ? '<span class="bchip' + (nwOff ? " off" : "") + '" data-k="nw" style="color:' + NEWSC + '"><i style="background:' + NEWSC + '"></i>News: &ldquo;layoffs&rdquo;</span>' : "") : "";
    el("d" + (k + 1)).style.background = vd ? vd.c : GRAYC;
    el("v" + (k + 1)).innerHTML = (r ? esc(fmtK(r.v)) + (rp ? ' <span style="font-size:12px;font-weight:600">· ' + c.per(rp.v) + "/1k jobs</span>" : "") : "n/a") + (rj ? '<br><span style="color:#FF9F0A">' + esc(fmtK(rj.v)) + '/wk</span><span style="font-size:11px;font-weight:600;color:#FF9F0A"> JOLTS ' + rpFor(rj) + "</span>" : "") + (rn ? '<br><span style="font-size:11px;font-weight:600;color:' + NEWSC + '">News ' + rn.r.toFixed(1) + "x 2019</span>" : "");
    el("v" + (k + 1)).style.color = vd ? vd.c : GRAYC;
    setVerdict("vd" + (k + 1), vd && vd.word, vd && vd.c, vd ? vd.text : "");
  });
}
el("g1").addEventListener("click", function (ev) { var t = ev.target && ev.target.closest ? ev.target.closest(".bchip[data-k]") : null; if (!t) return; if (t.getAttribute("data-k") === "nw") nwOff = !nwOff; else jlOff = !jlOff; drawDrivers(); });
// Hiring: the JOLTS hires rate itself, dotted 2019 average, red below it
function drawHire() {
  var svg = el("c3"), v = visible(S.rawHire).map(function (p) { return p.v; });
  if (!v.length) { svg.innerHTML = ""; return; }
  v.push(D.base.hire);
  var lo = Math.min.apply(null, v) - 0.15, hi = Math.max.apply(null, v) + 0.15;
  var F = frame(svg, lo, hi, function (x) { return x.toFixed(1) + "%"; }), s = F.head, yb = F.Y(D.base.hire);
  s += '<rect x="' + F.L + '" y="' + yb.toFixed(1) + '" width="' + (F.R - F.L) + '" height="' + Math.max(0, F.B - yb).toFixed(1) + '" fill="#FF453A" fill-opacity="0.07"/>';
  s += '<line x1="' + F.L + '" x2="' + F.R + '" y1="' + yb.toFixed(1) + '" y2="' + yb.toFixed(1) + '" stroke="#FFFFFF" stroke-opacity="0.6" stroke-dasharray="2 3" stroke-width="1.4"/>';
  s += '<text x="' + (F.R - 2) + '" y="' + (yb - 4).toFixed(1) + '" fill="#FFFFFF" fill-opacity="0.7" font-size="9.5" text-anchor="end">2019 avg ' + D.base.hire.toFixed(1) + '%</text>';
  s += path(F, S.rawHire, "#BF5AF2", 2.4);
  var n = readDay(), r = at(S.rawHire, n, 80), vd = verdict("hire", n);
  svg.innerHTML = s + cursorLine(F) + dot(F, r, "#BF5AF2");
  el("d3").style.background = vd ? vd.c : GRAYC;
  el("v3").textContent = r ? r.v.toFixed(1) + "% (2019: " + D.base.hire.toFixed(1) + "%)" : "n/a";
  el("v3").style.color = vd ? vd.c : GRAYC;
  setVerdict("vd3", vd && vd.word, vd && vd.c, vd ? vd.text : "");
}
// The forecasters' unemployment path runs past today: this chart's window
// stretches to the end of the latest forecast
function urExt() { var R0 = (S.urFc || []).slice(-1)[0]; if (!R0 || !R0.pts.length) return 0; return Math.max(0, R0.pts[R0.pts.length - 1].n + 25 - LAST); }
function drawUr() {
  var svg = el("c4"), ext = urExt(), keep = { a: view.a, b: view.b }, n = readDay();
  view.b = keep.b + ext;
  try {
    var v = visible(S.ur).map(function (p) { return p.v; });
    if (!v.length) { svg.innerHTML = ""; return; }
    (S.urFc || []).forEach(function (r) { visible(r.pts).forEach(function (p) { v.push(p.v); }); });
    var lo = Math.max(0, Math.min.apply(null, v) - 0.3), hi = Math.max.apply(null, v) + 0.3;
    var F = frame(svg, lo, hi, function (x) { return x.toFixed(1) + "%"; }), s = F.head;
    svg.__geo.ext = ext;
    var tx = F.X(LAST);
    if (ext && tx < F.R) {
      s += '<rect x="' + tx.toFixed(1) + '" y="' + F.T + '" width="' + (F.R - tx).toFixed(1) + '" height="' + (F.B - F.T) + '" fill="#64A8FF" fill-opacity="0.08"/>';
      s += '<line x1="' + tx.toFixed(1) + '" x2="' + tx.toFixed(1) + '" y1="' + F.T + '" y2="' + F.B + '" stroke="#FFFFFF" stroke-opacity="0.6" stroke-dasharray="3 3"/>';
      s += '<text x="' + (tx + 4).toFixed(1) + '" y="' + (F.T + 11) + '" fill="#64A8FF" font-size="10" font-weight="700">Forecast</text>';
    }
    s += urPath(F, 2.6);
    s += urForecasts(F);
    var vd = urVerdict(n);
    svg.innerHTML = s + cursorLine(F) + dot(F, vd && vd.u, vd && hotAt(vd.u) ? RED : BLU);
    el("v4").textContent = vd ? vd.u.v.toFixed(1) + "%" : "n/a";
    setVerdict("vd4", "", BLU);
    var RR = S.urFc || [];
    el("k4").innerHTML = RR.length ? "Forecasters&#39; median, by survey: " + RR.slice().reverse().map(function (r, k) { var e = r.pts[r.pts.length - 1]; return '<span style="color:#64A8FF;' + (k ? "opacity:0.6" : "font-weight:700") + '">' + esc(r.s) + " " + e.v.toFixed(1) + "% by " + esc(e.q) + "</span>"; }).join(" · ") : "";
  } finally { view.a = keep.a; view.b = keep.b; }
}
// Each round as a dotted line, older three dimmed, the newest starting from the
// latest actual reading; tagged with its survey quarter where there's room
function urForecasts(F) {
  var RR = S.urFc || [], s = "", tags = [], lastU = S.ur[S.ur.length - 1];
  RR.forEach(function (r, k) {
    var latest = k === RR.length - 1, pts = r.pts.slice();
    if (latest && lastU) pts = [lastU].concat(pts.filter(function (p) { return p.n > lastU.n; }));
    s += dashedPath(F, pts, latest ? "#FFFFFF" : "#64A8FF", latest ? 2 : 1.3, 100).split('stroke="').join('stroke-opacity="' + (latest ? 1 : 0.45) + '" stroke="');
    r.pts.forEach(function (p) { if (p.n > LAST - 100) s += '<circle cx="' + F.X(p.n).toFixed(1) + '" cy="' + F.Y(p.v).toFixed(1) + '" r="' + (latest ? 2.6 : 1.8) + '" fill="' + (latest ? "#FFFFFF" : "#64A8FF") + '" fill-opacity="' + (latest ? 1 : 0.5) + '"/>'; });
  });
  RR.slice().reverse().forEach(function (r, k) {
    var e = r.pts[r.pts.length - 1], x = F.X(e.n), y = F.Y(e.v), t = r.s.split(" ")[0] + " &#39;" + r.s.slice(-2), tw = 30, lx = Math.min(F.R - tw, x - tw / 2), ly = y - 7;
    if (tags.some(function (q) { return lx < q[0] + q[2] + 2 && q[0] < lx + tw + 2 && Math.abs(ly - q[1]) < 10; })) { ly = y + 14; if (tags.some(function (q) { return lx < q[0] + q[2] + 2 && q[0] < lx + tw + 2 && Math.abs(ly - q[1]) < 10; })) return; }
    tags.push([lx, ly, tw]);
    s += '<text x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" fill="' + (k ? "#64A8FF" : "#FFFFFF") + '" fill-opacity="' + (k ? 0.7 : 1) + '" font-size="9" font-weight="' + (k ? 600 : 800) + '" stroke="#1C1C1E" stroke-width="3" paint-order="stroke">' + t + "</text>";
  });
  return s;
}
// The unemployment line: blue, red where the Sahm rule was at or above its trigger
function hotAt(p) { var q = at(S.sahm, p.n, 20); return !!(q && q.v >= D.sahmTrigger); }
function urPath(F, width) {
  var out = "", run = "", runHot = null, prev = null;
  function flush() { if (run) out += '<path d="' + run + '" clip-path="url(#cp' + F.id + ')" fill="none" stroke="' + (runHot ? RED : BLU) + '" stroke-width="' + width + '" stroke-linejoin="round" stroke-linecap="round"/>'; run = ""; }
  S.ur.forEach(function (p) {
    if (p.n < view.a - 40 || p.n > view.b + 40) { flush(); prev = null; return; }
    var h = hotAt(p), xy = F.X(p.n).toFixed(1) + "," + F.Y(p.v).toFixed(1);
    if (prev && p.n - prev.n > 50) { flush(); prev = null; }
    if (!prev) { run = "M" + xy; runHot = h; prev = p; return; }
    if (h !== runHot) { flush(); run = "M" + F.X(prev.n).toFixed(1) + "," + F.Y(prev.v).toFixed(1); runHot = h; }
    run += "L" + xy; prev = p;
  });
  flush();
  return out;
}
function drawSahm() {
  var svg = el("c5"), v = visible(S.sahm).map(function (p) { return p.v; });
  if (!v.length) { svg.innerHTML = ""; return; }
  var lo = Math.min(0, Math.min.apply(null, v)), hi = Math.max(D.sahmTrigger + 0.15, Math.max.apply(null, v) + 0.1);
  var F = frame(svg, lo, hi, function (x) { return x.toFixed(niceStep(hi - lo, 4) < 0.5 ? 1 : 0); }), s = F.head;
  var yt = F.Y(D.sahmTrigger);
  s += '<rect x="' + F.L + '" y="' + F.T + '" width="' + (F.R - F.L) + '" height="' + Math.max(0, yt - F.T).toFixed(1) + '" fill="#FF453A" fill-opacity="0.12"/>';
  s += '<line x1="' + F.L + '" x2="' + F.R + '" y1="' + yt.toFixed(1) + '" y2="' + yt.toFixed(1) + '" stroke="#FF453A" stroke-width="1.4" stroke-dasharray="5 3"/>';
  s += '<text x="' + (F.L + 4) + '" y="' + (yt - 4).toFixed(1) + '" fill="#FF453A" font-size="10" font-weight="700">Recession signal ' + D.sahmTrigger.toFixed(2) + '</text>';
  s += path(F, S.sahm, GOLD, 2.4);
  var n = readDay(), vd = sahmVerdict(n);
  svg.innerHTML = s + cursorLine(F) + dot(F, vd && vd.s, GOLD);
  el("v5").textContent = vd ? vd.s.v.toFixed(2) : "n/a";
  el("v5").style.color = vd && vd.on ? RED : GOLD;
  setVerdict("vd5", vd ? vd.word : "", vd && vd.on ? RED : GRN, vd ? vd.text : "");
}
// Recession odds (NY Fed yield-curve model), plotted at the month each reading
// forecasts, so this chart runs a year past today: left of "Today" are past
// forecasts (check them against the gray recession columns), right is the forecast
var RP_EXT = 366, rpOff = {};
function rpFor(p) { var m = p.d.slice(0, 7); return MONTHS[+m.slice(5, 7) - 1] + " " + m.slice(0, 4); }
function drawRprob() {
  var svg = el("c7"), keep = { a: view.a, b: view.b };
  view.b = keep.b + RP_EXT; // this chart's own, longer window
  try {
    var anxOn = (S.anx || []).length > 0 && !rpOff.anx, ycOn = !rpOff.yc;
    el("g7").innerHTML = (S.anx || []).length ? '<span class="bchip' + (rpOff.yc ? " off" : "") + '" data-k="yc" style="color:#FF9F0A"><i style="background:#FF9F0A"></i>Yield curve: recession, 12 mo. ahead</span><span class="bchip' + (rpOff.anx ? " off" : "") + '" data-k="anx" style="color:#BF5AF2"><i style="background:#BF5AF2"></i>Anxious Index: GDP falls next quarter</span>' : "";
    var v = (ycOn ? visible(S.rprob || []) : []).concat(anxOn ? visible(S.anx) : []).map(function (p) { return p.v; });
    if (anxOn) (S.anxFc || []).forEach(function (r) { visible(r.pts).forEach(function (p) { v.push(p.v); }); });
    if (!v.length) { svg.innerHTML = ""; el("v7").textContent = "n/a"; return; }
    var hi = Math.min(100, Math.max(20, Math.max.apply(null, v) * 1.12));
    var F = frame(svg, 0, hi, function (x) { return Math.round(x) + "%"; }), s = F.head;
    svg.__geo.ext = RP_EXT;
    var tx = F.X(LAST);
    if (tx < F.R) {
      s += '<rect x="' + tx.toFixed(1) + '" y="' + F.T + '" width="' + (F.R - tx).toFixed(1) + '" height="' + (F.B - F.T) + '" fill="#FF9F0A" fill-opacity="0.08"/>';
      s += '<line x1="' + tx.toFixed(1) + '" x2="' + tx.toFixed(1) + '" y1="' + F.T + '" y2="' + F.B + '" stroke="#FFFFFF" stroke-opacity="0.6" stroke-dasharray="3 3"/>';
      s += '<text x="' + (tx + 4).toFixed(1) + '" y="' + (F.T + 11) + '" fill="#FF9F0A" font-size="10" font-weight="700">Forecast</text>';
      if (tx - F.L > 90) s += '<text x="' + (tx - 4).toFixed(1) + '" y="' + (F.T + 11) + '" fill="#98989F" font-size="10" text-anchor="end">Past forecasts · Today</text>';
    }
    if (anxOn) s += path(F, S.anx, "#BF5AF2", 2, 100) + anxForecasts(F);
    if (ycOn) s += path(F, S.rprob, "#FF9F0A", 2.4);
    // the readout: the latest forecast, or the forecast for the month being read
    var last = S.rprob[S.rprob.length - 1], r = cursor != null ? at(S.rprob, cursor, 40) : last;
    var ax = anxOn ? (cursor != null ? at(S.anx, cursor, 100) : S.anx[S.anx.length - 1]) : null;
    svg.innerHTML = s + cursorLine(F) + (ycOn ? dot(F, r, "#FF9F0A") : "") + (ax ? dot(F, ax, "#BF5AF2") : "");
    el("v7").innerHTML = (ycOn && r ? Math.round(r.v) + "% for " + rpFor(r) : "") + (ax ? (ycOn && r ? "<br>" : "") + '<span style="font-size:11px;font-weight:600;color:#BF5AF2">Anxious </span><span style="color:#BF5AF2">' + Math.round(ax.v) + '%</span><span style="font-size:11px;font-weight:600;color:#BF5AF2"> for ' + esc(ax.q) + "</span>" : "") || "n/a";
    setVerdict("vd7", "", GRAYC);
  } finally { view.a = keep.a; view.b = keep.b; }
}
// Each of the last four surveys' odds for the four quarters after it: the
// newest bold and dotted, joined to its Anxious Index point; older ones faint
function anxForecasts(F) {
  var RR = S.anxFc || [], s = "", tags = [];
  RR.forEach(function (r, k) {
    var latest = k === RR.length - 1;
    s += dashedPath(F, r.pts, "#BF5AF2", latest ? 1.8 : 1.1, 100).split('stroke="').join('stroke-opacity="' + (latest ? 1 : 0.4) + '" stroke="');
    r.pts.forEach(function (p) { s += '<circle cx="' + F.X(p.n).toFixed(1) + '" cy="' + F.Y(p.v).toFixed(1) + '" r="' + (latest ? 2.6 : 1.8) + '" fill="#BF5AF2" fill-opacity="' + (latest ? 1 : 0.45) + '"/>'; });
  });
  RR.slice().reverse().forEach(function (r, k) {
    var e = r.pts[r.pts.length - 1], x = F.X(e.n), y = F.Y(e.v), t = r.s.split(" ")[0] + " &#39;" + r.s.slice(-2), tw = 30, lx = Math.min(F.R - tw, x - tw / 2), ly = y - 7;
    if (lx < F.L) return;
    if (tags.some(function (q) { return lx < q[0] + q[2] + 2 && q[0] < lx + tw + 2 && Math.abs(ly - q[1]) < 10; })) { ly = y + 14; if (tags.some(function (q) { return lx < q[0] + q[2] + 2 && q[0] < lx + tw + 2 && Math.abs(ly - q[1]) < 10; })) return; }
    tags.push([lx, ly, tw]);
    s += '<text x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" fill="#BF5AF2" fill-opacity="' + (k ? 0.65 : 1) + '" font-size="9" font-weight="' + (k ? 600 : 800) + '" stroke="#1C1C1E" stroke-width="3" paint-order="stroke">' + t + "</text>";
  });
  return s;
}
el("g7").addEventListener("click", function (ev) { var t = ev.target && ev.target.closest ? ev.target.closest(".bchip") : null; if (!t) return; var k = t.getAttribute("data-k"); rpOff[k] = !rpOff[k]; if (rpOff.yc && rpOff.anx) rpOff[k === "yc" ? "anx" : "yc"] = false; drawRprob(); });
function drawEpop() {
  var svg = el("c6"), v = visible(S.epop).map(function (p) { return p.v; });
  if (!v.length) { svg.innerHTML = ""; return; }
  v.push(D.epopBase);
  var lo = Math.min.apply(null, v) - 0.3, hi = Math.max.apply(null, v) + 0.3;
  var F = frame(svg, lo, hi, function (x) { return x.toFixed(1) + "%"; }), s = F.head, yb = F.Y(D.epopBase);
  s += '<line x1="' + F.L + '" x2="' + F.R + '" y1="' + yb.toFixed(1) + '" y2="' + yb.toFixed(1) + '" stroke="#FFFFFF" stroke-opacity="0.55" stroke-dasharray="4 3"/>';
  s += '<text x="' + (F.R - 2) + '" y="' + (yb - 4).toFixed(1) + '" fill="#FFFFFF" fill-opacity="0.7" font-size="9.5" text-anchor="end">2019 avg</text>';
  s += path(F, S.epop, TEAL, 2.4);
  var n = readDay(), vd = epVerdict(n);
  svg.innerHTML = s + cursorLine(F) + dot(F, vd && vd.e, TEAL);
  el("v6").textContent = vd ? vd.e.v.toFixed(1) + "%" : "n/a";
  setVerdict("vd6", "", GRAYC);
}
// Openings vs unemployment (the Beveridge curve), colored by era
var ERAS = [
  { from: "2000-12", to: "2007-12", name: "2001–07", c: "#8E8E93", o: 0.55, w: 1.4 },
  { from: "2008-01", to: "2019-12", name: "2008–19", c: "#64A8FF", o: 0.6, w: 1.4 },
  { from: "2020-01", to: "2021-12", name: "2020–21", c: "#FF9F0A", o: 0.55, w: 1.4 },
  { from: "2022-01", to: "2099-12", name: "2022–now", c: "#30D5C8", o: 1, w: 2.4 },
];
var BEV_UMAX = 10.5;
// chips: history starts hidden, every era shown
var bevOff = { hist: true };
function eraOf(m) { for (var i = 0; i < ERAS.length; i++) if (m >= ERAS[i].from && m <= ERAS[i].to) return i; return 0; }
function bevVisible() { return (D.bev || []).filter(function (p) { return !bevOff["e" + eraOf(p.m)]; }); }
function bevHistOn() { return !bevOff.hist && (D.bevHist || []).length > 0; }
function bevScale() {
  var pts = bevVisible().map(function (p) { return { u: p.u, o: p.o }; });
  if (bevHistOn()) pts = pts.concat(D.bevHist);
  if (!pts.length) pts = (D.bev || []).slice();
  var us = pts.map(function (p) { return Math.min(p.u, BEV_UMAX); }), os = pts.map(function (p) { return p.o; });
  return { u0: Math.floor(Math.min.apply(null, us) - 0.3), u1: Math.min(BEV_UMAX, Math.ceil(Math.max.apply(null, us) + 0.3)), o0: Math.floor(Math.min.apply(null, os) * 2 - 0.5) / 2, o1: Math.ceil(Math.max.apply(null, os) * 2 + 0.5) / 2 };
}
var HIST_LABELS = { 1951: 1, 1969: 1, 1982: 1, 2000: 1 };
// ---- How to read it ----
// Five patterns, each with a small neutral glyph (a gray curve and one move).
// No pattern colors: on the chart, color only ever means era.
var PATTERNS = [
  { k: 1, a: "Openings down, unemployment up", m: "Demand for workers weakening", d: "Employers post fewer jobs and unemployment rises. The usual path into a recession." },
  { k: 2, a: "Openings up, unemployment down", m: "Demand for workers strengthening", d: "Employers post more jobs and unemployment falls. The usual path through a recovery." },
  { k: 3, a: "Openings down, unemployment flat", m: "Tight labor market cooling", d: "Openings fall but unemployment barely moves, as employers trim postings before they cut staff. Only works while openings are high; lower on the curve, cooling shows up as rising unemployment." },
  { k: 4, a: "Whole curve moves out", m: "Harder to match people to jobs (in = easier). During a recovery, a \u201cloop back\u201d is normal, not a shift.", d: "More openings at every unemployment rate: job seekers and openings are matching less easily (skills, location, hiring frictions). Inward means matching improved. During a recovery, a \u201cloop back\u201d is normal, not a shift: openings recover before unemployment does, so the way back runs higher than the way down." },
  { k: 5, a: "Unemployment jumps, openings flat", m: "Sudden layoff shock", d: "Unemployment jumps without openings slowly fading first, as in spring 2020." },
];
// a glyph in a w x h box at (x, y): the curve, maybe a shifted curve, one arrow
function glyphGeom(x, y, w, h, kind) {
  var X = function (u) { return x + 2 + (u - 2.5) / 8 * (w - 4); }, Y = function (o) { return y + h - 2 - (o - 0.8) / 6.5 * (h - 4); };
  var cur = function (k) { var p = []; for (var u = 2.7; u <= 10.41; u += 0.2) p.push([X(u), Y(k / u)]); return p; };
  var g = { curve: cur(12), shifted: kind === 4 ? cur(19) : null, arrow: null };
  if (kind === 1) g.arrow = [X(3.6), Y(12 / 3.6) - 2, X(7.6), Y(12 / 7.6) - 2];
  if (kind === 2) g.arrow = [X(8.6), Y(12 / 8.6) - 2, X(4.4), Y(12 / 4.4) - 2];
  if (kind === 3) g.arrow = [X(3.0), Y(6.9), X(3.05), Y(12 / 3.05) + 1];
  if (kind === 4) g.arrow = [X(5.0), Y(12 / 5.0) + 1, X(6.6), Y(19 / 6.6) - 1];
  if (kind === 5) g.arrow = [X(3.4), Y(4.2), X(8.8), Y(4.1)];
  return g;
}
function arrowHead(A, sz) {
  var dx = A[2] - A[0], dy = A[3] - A[1], l = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / l, uy = dy / l;
  return [[A[2], A[3]], [A[2] - ux * sz - uy * sz * 0.6, A[3] - uy * sz + ux * sz * 0.6], [A[2] - ux * sz + uy * sz * 0.6, A[3] - uy * sz - ux * sz * 0.6]];
}
function glyphSvg(kind, w, h) {
  var G = glyphGeom(0, 0, w, h, kind), pts = function (p) { return p.map(function (q) { return q[0].toFixed(1) + "," + q[1].toFixed(1); }).join(" "); };
  var s = '<svg width="' + w + '" height="' + h + '" xmlns="http://www.w3.org/2000/svg"><rect x="0.5" y="0.5" width="' + (w - 1) + '" height="' + (h - 1) + '" rx="6" fill="#2C2C2E" stroke="#3A3A3C"/>';
  s += '<polyline points="' + pts(G.curve) + '" fill="none" stroke="#8E8E93" stroke-width="2"/>';
  if (G.shifted) s += '<polyline points="' + pts(G.shifted) + '" fill="none" stroke="#FFFFFF" stroke-width="1.6" stroke-dasharray="4 3"/>';
  var A = G.arrow, hd = arrowHead(A, 7);
  s += '<line x1="' + A[0].toFixed(1) + '" y1="' + A[1].toFixed(1) + '" x2="' + A[2].toFixed(1) + '" y2="' + A[3].toFixed(1) + '" stroke="#FFFFFF" stroke-width="2.8" stroke-linecap="round"/>';
  s += '<polygon points="' + pts(hd) + '" fill="#FFFFFF"/>';
  return s + "</svg>";
}
function openHow() {
  el("howSheet").innerHTML = '<h3>How to read a Beveridge curve</h3><div class="sub2">Upper left = tight labor market (many openings, few unemployed); lower right = slack. Each glyph shows one kind of move.</div>' +
    PATTERNS.map(function (P) { return '<div class="it"><div class="gl">' + glyphSvg(P.k, 72, 48) + '</div><div><b>' + esc(P.a) + '</b><span class="mn">→ ' + esc(P.m.split(". During")[0]) + "</span><span>" + esc(P.d) + "</span></div></div>"; }).join("") +
    '<div class="sub2" style="margin-top:14px">Glyphs are schematic, not data. Colors on the chart mark eras only.</div><div class="done" id="howDone">Done</div>';
  el("howWrap").className = "howWrap on";
}
el("howWrap").addEventListener("click", function (ev) { if (ev.target.id === "howWrap" || ev.target.id === "howDone") el("howWrap").className = "howWrap"; });
// Arrowheads every 6 months (January and July), pointing forward in time.
// Direction comes from a few months either side, so tiny wiggles don't flip it.
// X, Y map to pixels; returns [{ x, y, ux, uy, e }] with a unit direction.
function bevArrows(B, X, Y, every) {
  var out = [], step = every || 6;
  for (var i = 1; i < B.length; i++) {
    var mo = +B[i].m.slice(5, 7);
    if ((mo - 1) % step !== 0) continue;
    var ei = eraOf(B[i].m);
    if (bevOff["e" + ei]) continue;
    var a = B[Math.max(0, i - 2)], z = B[Math.min(B.length - 1, i + 2)];
    var dx = X(z.u) - X(a.u), dy = Y(z.o) - Y(a.o), len = Math.sqrt(dx * dx + dy * dy);
    if (len < 4) continue;
    out.push({ x: X(B[i].u), y: Y(B[i].o), ux: dx / len, uy: dy / len, e: ei, m: B[i].m });
  }
  return out;
}
// ---- Beveridge zoom: a window in data units (null = full view). Pinch zooms
// both axes up to 8x; dates appear on more arrows the closer you get.
var bz = null, BZ_MAX = 8, MON3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function bevWin() { var sc = bevScale(); return bz ? { u0: bz.u0, u1: bz.u1, o0: bz.o0, o1: bz.o1, k: (sc.u1 - sc.u0) / (bz.u1 - bz.u0), base: sc } : { u0: sc.u0, u1: sc.u1, o0: sc.o0, o1: sc.o1, k: 1, base: sc }; }
function bevStep(span) { return span > 6 ? 1 : span > 2.5 ? 0.5 : span > 1.2 ? 0.25 : 0.1; }
function drawBev() {
  var B = D.bev || [], svg = el("cBev");
  el("bevSec").style.display = B.length > 12 ? "" : "none";
  if (B.length <= 12) return;
  var w = svg.clientWidth || 360, h = svg.clientHeight || 300, L = 34, R = w - 10, T = 10, Bm = h - 30, sc = bevWin(), zk = sc.k;
  svg.__bgeo = { L: L, R: R, T: T, Bm: Bm };
  var X = function (u) { return L + ((bz ? u : Math.min(u, sc.u1 + 0.4)) - sc.u0) / (sc.u1 - sc.u0) * (R - L); }, Y = function (o) { return Bm - (o - sc.o0) / (sc.o1 - sc.o0) * (Bm - T); };
  var s = '<defs><clipPath id="cpBev"><rect x="' + L + '" y="' + (bz ? T : 0) + '" width="' + (R - L) + '" height="' + (bz ? Bm - T : h) + '"/></clipPath></defs>';
  var ustep = bevStep(sc.u1 - sc.u0), ostep = Math.min(1, bevStep(sc.o1 - sc.o0));
  for (var u = Math.ceil(sc.u0 / ustep - 1e-9) * ustep; u <= sc.u1 + 1e-9; u += ustep) s += '<line x1="' + X(u) + '" x2="' + X(u) + '" y1="' + T + '" y2="' + Bm + '" stroke="#3A3A3C"/><text x="' + X(u) + '" y="' + (Bm + 14) + '" fill="#8E8E93" font-size="10" text-anchor="middle">' + (+u.toFixed(2)) + "%</text>";
  for (var o = Math.ceil(sc.o0 / ostep - 1e-9) * ostep; o <= sc.o1 + 1e-9; o += ostep) s += '<line x1="' + L + '" x2="' + R + '" y1="' + Y(o) + '" y2="' + Y(o) + '" stroke="#3A3A3C"/><text x="' + (L - 4) + '" y="' + (Y(o) + 3.5) + '" fill="#8E8E93" font-size="10" text-anchor="end">' + (+o.toFixed(2)) + "%</text>";
  s += '<text x="' + R + '" y="' + (Bm + 27) + '" fill="#8E8E93" font-size="10" text-anchor="end">Unemployment rate →</text>';
  s += '<text x="' + (L + 4) + '" y="' + (T + 10) + '" fill="#8E8E93" font-size="10">↑ Job openings rate</text>';
  s += '<g clip-path="url(#cpBev)">';
  if (bevHistOn()) {
    var HH = D.bevHist, dh = "";
    HH.forEach(function (p, k) { dh += (k ? "L" : "M") + X(p.u).toFixed(1) + "," + Y(p.o).toFixed(1); });
    s += '<path d="' + dh + '" fill="none" stroke="#C7C7CC" stroke-opacity="0.22" stroke-width="1"/>';
    HH.forEach(function (p) {
      s += '<circle cx="' + X(p.u).toFixed(1) + '" cy="' + Y(p.o).toFixed(1) + '" r="2.6" fill="#C7C7CC" fill-opacity="0.45"/>';
      if (HIST_LABELS[p.y] || zk >= 4 || (zk >= 2 && p.y % 5 === 0)) s += '<text x="' + (X(p.u) + 5).toFixed(1) + '" y="' + (Y(p.o) - 4).toFixed(1) + '" fill="#C7C7CC" fill-opacity="0.85" font-size="9.5">' + p.y + "</text>";
    });
  }
  for (var i = 1; i < B.length; i++) {
    var ei = eraOf(B[i].m), e = ERAS[ei];
    if (bevOff["e" + ei]) continue;
    s += '<line x1="' + X(B[i - 1].u).toFixed(1) + '" y1="' + Y(B[i - 1].o).toFixed(1) + '" x2="' + X(B[i].u).toFixed(1) + '" y2="' + Y(B[i].o).toFixed(1) + '" stroke="' + e.c + '" stroke-opacity="' + e.o + '" stroke-width="' + e.w + '" stroke-linecap="round"/>';
  }
  B.forEach(function (p) { var ei = eraOf(p.m), e = ERAS[ei]; if (e.w > 2 && !bevOff["e" + ei]) s += '<circle cx="' + X(p.u).toFixed(1) + '" cy="' + Y(p.o).toFixed(1) + '" r="2" fill="' + e.c + '"/>'; });
  // keep arrow dates clear of the axis title and the latest-month label
  var arr = bevArrows(B, X, Y, zk >= 6 ? 1 : zk >= 3 ? 3 : 6), lp = B[B.length - 1], lpx = X(lp.u), lpr = lpx > (L + R) / 2;
  var labs = [[L, T + 10, 110], [lpr ? lpx - 70 : lpx, Y(lp.o) - 7, 70]];
  arr.forEach(function (a) {
    var e = ERAS[a.e], sz = e.w > 2 ? 7 : 5.5, px = -a.uy, py = a.ux;
    var tip = [a.x + a.ux * sz, a.y + a.uy * sz], l = [a.x - a.ux * sz * 0.6 + px * sz * 0.65, a.y - a.uy * sz * 0.6 + py * sz * 0.65], r = [a.x - a.ux * sz * 0.6 - px * sz * 0.65, a.y - a.uy * sz * 0.6 - py * sz * 0.65];
    s += '<polygon points="' + [tip, l, r].map(function (q) { return q[0].toFixed(1) + "," + q[1].toFixed(1); }).join(" ") + '" fill="' + e.c + '" fill-opacity="' + Math.min(1, e.o + 0.3) + '"/>';
    // dates on arrows once zoomed in: years on January arrows, then every arrow
    var jan = a.m.slice(5, 7) === "01";
    if (zk < 1.6 || (zk < 3 && !jan) || a.x < L || a.x > R || a.y < T || a.y > Bm) return;
    var t = zk < 3 ? a.m.slice(0, 4) : MON3[+a.m.slice(5, 7) - 1] + " ’" + a.m.slice(2, 4), side = px >= 0 ? 1 : -1;
    var tw = t.length * 5.6, lx = a.x + px * side * 10;
    if (side > 0 && lx + tw > R) side = -1; else if (side < 0 && lx - tw < L) side = 1;
    lx = a.x + px * side * 10; var ly = a.y + py * side * 10 + 3.5, x0 = side > 0 ? lx : lx - tw;
    if (x0 < L + 1) { x0 = L + 1; lx = side > 0 ? x0 : x0 + tw; } else if (x0 + tw > R - 1) { x0 = R - 1 - tw; lx = side > 0 ? x0 : x0 + tw; }
    if (ly > Bm - 2 || ly < T + 9) return;
    if (labs.some(function (b) { return x0 < b[0] + b[2] + 3 && b[0] < x0 + tw + 3 && Math.abs(ly - b[1]) < 11; })) return;
    labs.push([x0, ly, tw]);
    s += '<text x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" fill="' + e.c + '" font-size="9.5" font-weight="600" text-anchor="' + (side > 0 ? "start" : "end") + '" stroke="#1C1C1E" stroke-width="3" paint-order="stroke">' + t + "</text>";
  });
  s += "</g>";
  // 2020's spike runs off the right edge
  var spike = bevOff.e2 || bz ? [] : B.filter(function (p) { return p.u > sc.u1 + 0.4; });
  if (spike.length) { var top = spike.reduce(function (a2, p) { return p.u > a2.u ? p : a2; }); s += '<text x="' + (R - 2) + '" y="' + (Y(top.o) - 6).toFixed(1) + '" fill="#FF9F0A" font-size="10" text-anchor="end">→ ' + top.u.toFixed(1) + "% (" + fmtD(top.m + "-15", true) + ")</text>"; }
  // the latest month, and the month being read
  var last = B[B.length - 1], rd = null;
  if (cursor != null) { var cm = dstr(cursor).slice(0, 7); B.forEach(function (p) { if (p.m <= cm) rd = p; }); }
  [rd, last].forEach(function (p, k) {
    if (!p || (k === 1 && rd === last) || bevOff["e" + eraOf(p.m)]) return;
    var x = X(p.u), y = Y(p.o), right = x > (L + R) / 2;
    s += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="4.5" fill="' + (k ? "#FFFFFF" : "#FFD60A") + '" stroke="#1C1C1E" stroke-width="1.5"/>';
    s += '<text x="' + (right ? x - 8 : x + 8).toFixed(1) + '" y="' + (y - 7).toFixed(1) + '" fill="' + (k ? "#FFFFFF" : "#FFD60A") + '" font-size="11" font-weight="700" text-anchor="' + (right ? "end" : "start") + '">' + fmtD(p.m + "-15", true) + "</text>";
  });
  svg.innerHTML = s;
  var chips = (D.bevHist || []).length ? '<span class="bchip' + (bevOff.hist ? " off" : "") + '" data-k="hist" style="color:#C7C7CC"><i style="background:#C7C7CC;opacity:0.6"></i>History 1951–2000</span>' : "";
  chips += ERAS.map(function (e, ei) { return '<span class="bchip' + (bevOff["e" + ei] ? " off" : "") + '" data-k="e' + ei + '" style="color:' + e.c + '"><i style="background:' + e.c + ";opacity:" + e.o + '"></i>' + e.name + "</span>"; }).join("");
  el("bevChips").innerHTML = chips + '<span class="howBtn">How to read</span>' + (bz ? '<span class="bchip rz" data-k="rz">Reset zoom ' + zk.toFixed(1) + "×</span>" : "");
  var show = rd || last;
  el("vBev").innerHTML = show.u.toFixed(1) + '%<span style="font-size:11px;font-weight:600"> unemp. </span>' + show.o.toFixed(1) + '%<span style="font-size:11px;font-weight:600"> openings</span>';
}
el("bevChips").addEventListener("click", function (ev) {
  if (ev.target && ev.target.closest && ev.target.closest(".howBtn")) { openHow(); return; }
  var t = ev.target && ev.target.closest ? ev.target.closest(".bchip") : null;
  if (!t) return;
  var k = t.getAttribute("data-k");
  if (k === "rz") bz = null; else bevOff[k] = !bevOff[k];
  drawBev();
});
// ---- What workers expect (NY Fed Survey of Consumer Expectations) ----
// Expected job loss: each survey reading sits at the month it's about (a year
// on), next to actual layoffs over the past 12 months. Right of "Today" is the
// forecast; the last four surveys fan out from today's actual, older three dimmed.
function dashedPath(F, arr, color, width, gap) { return path(F, arr, color, width, gap).split('stroke-linejoin').join('stroke-dasharray="4 3" stroke-linejoin'); }
function drawJloss() {
  var has = (S.jloss || []).length > 0;
  el("s8").style.display = has ? "" : "none";
  if (!has) return;
  var svg = el("c8"), keep = { a: view.a, b: view.b };
  view.b = keep.b + RP_EXT;
  try {
    var v = visible(S.jloss).concat(visible(S.layAct)).map(function (p) { return p.v; });
    if (!v.length) { svg.innerHTML = ""; el("v8").textContent = "n/a"; return; }
    var lo = Math.max(0, Math.floor(Math.min.apply(null, v) - 1)), hi = Math.ceil(Math.max.apply(null, v) + 1);
    var F = frame(svg, lo, hi, function (x) { return Math.round(x) + "%"; }), s = F.head;
    svg.__geo.ext = RP_EXT;
    var tx = F.X(LAST);
    if (tx < F.R) {
      s += '<rect x="' + tx.toFixed(1) + '" y="' + F.T + '" width="' + (F.R - tx).toFixed(1) + '" height="' + (F.B - F.T) + '" fill="#64A8FF" fill-opacity="0.08"/>';
      s += '<line x1="' + tx.toFixed(1) + '" x2="' + tx.toFixed(1) + '" y1="' + F.T + '" y2="' + F.B + '" stroke="#FFFFFF" stroke-opacity="0.6" stroke-dasharray="3 3"/>';
      s += '<text x="' + (tx + 4).toFixed(1) + '" y="' + (F.T + 11) + '" fill="#64A8FF" font-size="10" font-weight="700">Forecast</text>';
      if (tx - F.L > 90) s += '<text x="' + (tx - 4).toFixed(1) + '" y="' + (F.T + 11) + '" fill="#98989F" font-size="10" text-anchor="end">Past forecasts · Today</text>';
    }
    s += path(F, S.layAct, "#FF9F0A", 2.4);
    var past = S.jloss.filter(function (p) { return p.n <= LAST; }), fut = S.jloss.filter(function (p) { return p.n > LAST; });
    if (past.length && fut.length) fut = [past[past.length - 1]].concat(fut);
    s += path(F, past, BLU, 1.8) + dashedPath(F, fut, BLU, 1.8);
    var la = S.layAct[S.layAct.length - 1], last4 = S.jloss.slice(-4), tags = [];
    if (la) last4.forEach(function (p, k) {
      var latest = k === last4.length - 1, op = latest ? 1 : 0.35;
      s += '<line x1="' + F.X(la.n).toFixed(1) + '" y1="' + F.Y(la.v).toFixed(1) + '" x2="' + F.X(p.n).toFixed(1) + '" y2="' + F.Y(p.v).toFixed(1) + '" clip-path="url(#cpc8)" stroke="' + BLU + '" stroke-width="' + (latest ? 1.8 : 1.1) + '" stroke-dasharray="2 3" stroke-opacity="' + op + '"/>';
      s += '<circle cx="' + F.X(p.n).toFixed(1) + '" cy="' + F.Y(p.v).toFixed(1) + '" r="' + (latest ? 3.6 : 2.6) + '" fill="' + BLU + '" fill-opacity="' + op + '"/>';
    });
    // each fan dot tagged with its survey month, newest first, where there's room (pinch in for more)
    last4.slice().reverse().forEach(function (p, k) {
      var x = F.X(p.n), y = F.Y(p.v), t = srvMon(p.s), tw = t.length * 5.4 + 2, lx = x - tw / 2, ly = y - 7;
      if (lx + tw > F.R) lx = F.R - tw; if (lx < F.L) return;
      if (tags.some(function (q) { return lx < q[0] + q[2] + 2 && q[0] < lx + tw + 2 && Math.abs(ly - q[1]) < 10; })) { ly = y + 13; if (tags.some(function (q) { return lx < q[0] + q[2] + 2 && q[0] < lx + tw + 2 && Math.abs(ly - q[1]) < 10; })) return; }
      tags.push([lx, ly, tw]);
      s += '<text x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" fill="#64A8FF" fill-opacity="' + (k ? 0.6 : 1) + '" font-size="9" font-weight="' + (k ? 600 : 800) + '" stroke="#1C1C1E" stroke-width="3" paint-order="stroke">' + t + "</text>";
    });
    var r = cursor != null ? at(S.jloss, cursor, 40) : S.jloss[S.jloss.length - 1], ra = cursor != null ? at(S.layAct, cursor, 40) : la;
    svg.innerHTML = s + cursorLine(F) + dot(F, ra, "#FF9F0A") + (cursor != null ? dot(F, r, BLU) : "");
    el("v8").innerHTML = r ? r.v.toFixed(1) + '%<span style="font-size:11px;font-weight:600"> for ' + rpFor(r) + "</span>" + (ra ? '<br><span style="color:#FF9F0A">' + ra.v.toFixed(1) + '%</span><span style="font-size:11px;font-weight:600;color:#FF9F0A"> to ' + rpFor(ra) + "</span>" : "") : "n/a";
    el("k8").innerHTML = (cursor != null && r ? 'Reading the forecast from the <b style="color:#64A8FF">' + srvMon(r.s, true) + " survey</b> · " : "") + "Latest surveys: " + last4.slice().reverse().map(function (p, k) { return '<span style="color:#64A8FF;' + (k ? "opacity:0.6" : "font-weight:700") + '">' + srvMon(p.s) + " " + p.v.toFixed(1) + "%</span>"; }).join(" · ");
  } finally { view.a = keep.a; view.b = keep.b; }
}
// "2026-10" -> "Oct", or "Oct 2026" with the year
var SRV_MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function srvMon(m, yr) { return m ? SRV_MON[+m.slice(5, 7) - 1] + (yr ? " " + m.slice(0, 4) : "") : ""; }
// Expected job finding: at the survey month, the dashed line is the survey's
// average; orange is what actually happened (unemployed people finding work)
function drawJfind() {
  var has = (S.jfind || []).length > 0;
  el("s9").style.display = has ? "" : "none";
  if (!has) return;
  var svg = el("c9"), act = S.findAct || [], v = visible(S.jfind).concat(visible(act)).map(function (p) { return p.v; });
  el("g9").style.display = act.length ? "" : "none";
  if (!v.length) { svg.innerHTML = ""; el("v9").textContent = "n/a"; return; }
  if (D.findMean != null) v.push(D.findMean);
  var lo = Math.floor(Math.min.apply(null, v) - 2), hi = Math.ceil(Math.max.apply(null, v) + 2);
  var F = frame(svg, lo, hi, function (x) { return Math.round(x) + "%"; }), s = F.head;
  if (D.findMean != null) {
    var yb = F.Y(D.findMean);
    s += '<line x1="' + F.L + '" x2="' + F.R + '" y1="' + yb.toFixed(1) + '" y2="' + yb.toFixed(1) + '" stroke="#FFFFFF" stroke-opacity="0.55" stroke-dasharray="4 3"/>';
    s += '<text x="' + (F.R - 2) + '" y="' + (yb - 4).toFixed(1) + '" fill="#FFFFFF" fill-opacity="0.7" font-size="9.5" text-anchor="end">Average since 2013: ' + D.findMean.toFixed(1) + '%</text>';
  }
  s += path(F, act, "#FF9F0A", 2) + path(F, S.jfind, GRN, 2.4);
  var r = cursor != null ? at(S.jfind, cursor, 40) : S.jfind[S.jfind.length - 1], ra = cursor != null ? at(act, cursor, 40) : act[act.length - 1];
  svg.innerHTML = s + cursorLine(F) + dot(F, ra, "#FF9F0A") + dot(F, r, GRN);
  el("v9").innerHTML = r ? r.v.toFixed(1) + '%<span style="font-size:11px;font-weight:600"> exp. ' + rpFor(r) + "</span>" + (ra ? '<br><span style="color:#FF9F0A">' + ra.v.toFixed(1) + '%</span><span style="font-size:11px;font-weight:600;color:#FF9F0A"> act. ' + rpFor(ra) + "</span>" : "") : "n/a";
}
// The Job Security Map: across, the chance of losing your job; up, the chance of
// finding another. 3-month averages, colored by era, arrows each January. The
// dashed lines split the four corners at each question's average since 2013.
var WERAS = [
  { from: "2013-01", to: "2019-12", name: "2013–19", c: "#8E8E93", o: 0.6, w: 1.4 },
  { from: "2020-01", to: "2021-12", name: "2020–21", c: "#FF453A", o: 0.75, w: 1.4 },
  { from: "2022-01", to: "2024-12", name: "2022–24", c: "#64D2FF", o: 0.8, w: 1.5 },
  { from: "2025-01", to: "2099-12", name: "2025–now", c: "#FF9F0A", o: 1, w: 2.2 },
];
var WQ = [["#30D158", "SECURE", "rarely let go, quickly rehired"], ["#FFD60A", "CHURNING", "let go, but rehired fast"], ["#64A8FF", "STUCK", "safe where you are, few ways out"], ["#FF453A", "CORNERED", "let go and hard to rehire"]];
var wOff = {};
function wEra(m) { for (var i = 0; i < WERAS.length; i++) if (m >= WERAS[i].from && m <= WERAS[i].to) return i; return 0; }
function wScale() {
  var P = D.worker || [], xs = P.map(function (p) { return p.x; }), ys = P.map(function (p) { return p.y; });
  return { x0: Math.floor(Math.min.apply(null, xs) - 1), x1: Math.ceil(Math.max.apply(null, xs) + 1), y0: Math.floor((Math.min.apply(null, ys) - 2) / 5) * 5, y1: Math.ceil((Math.max.apply(null, ys) + 2) / 5) * 5 };
}
function drawWorker() {
  var P = D.worker || [], svg = el("cW");
  var has = P.length > 12;
  el("wSec").style.display = has ? "" : "none"; el("wGrp").style.display = has ? "" : "none";
  if (!has) return;
  var w = svg.clientWidth || 360, h = svg.clientHeight || 320, L = 44, R = w - 10, T = 10, Bm = h - 30, sc = wScale();
  var X = function (x) { return L + (x - sc.x0) / (sc.x1 - sc.x0) * (R - L); }, Y = function (y) { return Bm - (y - sc.y0) / (sc.y1 - sc.y0) * (Bm - T); };
  var mx = X(D.lossMean != null ? D.lossMean : (sc.x0 + sc.x1) / 2), my = Y(D.findMean != null ? D.findMean : (sc.y0 + sc.y1) / 2), s = "";
  [[L, T, mx, my], [mx, T, R, my], [L, my, mx, Bm], [mx, my, R, Bm]].forEach(function (q, i) { s += '<rect x="' + q[0].toFixed(1) + '" y="' + q[1].toFixed(1) + '" width="' + Math.max(0, q[2] - q[0]).toFixed(1) + '" height="' + Math.max(0, q[3] - q[1]).toFixed(1) + '" fill="' + WQ[i][0] + '" fill-opacity="0.06"/>'; });
  var xstep = sc.x1 - sc.x0 > 10 ? 4 : 2;
  for (var gx = Math.ceil(sc.x0 / xstep) * xstep; gx <= sc.x1; gx += xstep) s += '<line x1="' + X(gx) + '" x2="' + X(gx) + '" y1="' + T + '" y2="' + Bm + '" stroke="#3A3A3C" stroke-width="0.6"/><text x="' + X(gx) + '" y="' + (Bm + 14) + '" fill="#8E8E93" font-size="10" text-anchor="middle">' + gx + "%</text>";
  for (var gy = sc.y0; gy <= sc.y1; gy += 5) s += '<line x1="' + L + '" x2="' + R + '" y1="' + Y(gy) + '" y2="' + Y(gy) + '" stroke="#3A3A3C" stroke-width="0.6"/><text x="' + (L - 4) + '" y="' + (Y(gy) + 3.5) + '" fill="#8E8E93" font-size="10" text-anchor="end">' + gy + "%</text>";
  s += '<line x1="' + mx.toFixed(1) + '" x2="' + mx.toFixed(1) + '" y1="' + T + '" y2="' + Bm + '" stroke="#8E8E93" stroke-opacity="0.7" stroke-dasharray="3 3"/><line x1="' + L + '" x2="' + R + '" y1="' + my.toFixed(1) + '" y2="' + my.toFixed(1) + '" stroke="#8E8E93" stroke-opacity="0.7" stroke-dasharray="3 3"/>';
  WQ.forEach(function (q, i) {
    var x = i % 2 ? R - 5 : L + 5, y = i < 2 ? T + 12 : Bm - 17, an = i % 2 ? "end" : "start";
    s += '<text x="' + x + '" y="' + y + '" fill="' + q[0] + '" fill-opacity="0.85" font-size="10" font-weight="800" text-anchor="' + an + '" stroke="#1C1C1E" stroke-width="3" paint-order="stroke">' + q[1] + '</text><text x="' + x + '" y="' + (y + 11) + '" fill="#8E8E93" font-size="9" text-anchor="' + an + '" stroke="#1C1C1E" stroke-width="3" paint-order="stroke">' + q[2] + "</text>";
  });
  s += '<text x="' + R + '" y="' + (Bm + 27) + '" fill="#8E8E93" font-size="10" text-anchor="end">Chance of losing your job, next 12 months →</text>';
  for (var i = 1; i < P.length; i++) {
    var ei = wEra(P[i].m), e = WERAS[ei];
    if (wOff["e" + ei] || P[i].m !== monthAddP(P[i - 1].m, 1)) continue;
    s += '<line x1="' + X(P[i - 1].x).toFixed(1) + '" y1="' + Y(P[i - 1].y).toFixed(1) + '" x2="' + X(P[i].x).toFixed(1) + '" y2="' + Y(P[i].y).toFixed(1) + '" stroke="' + e.c + '" stroke-opacity="' + e.o + '" stroke-width="' + e.w + '" stroke-linecap="round"/>';
  }
  // arrows each January, with the year where there's room
  var labs = [[L, T, 120], [R - 120, T, 120], [L, Bm - 17, 150], [R - 150, Bm - 17, 150]], lp0 = P[P.length - 1], lpx0 = X(lp0.x), lpr0 = lpx0 > (L + R) / 2;
  labs.push([lpr0 ? lpx0 - 66 : lpx0 + 4, Y(lp0.y) + 15, 62]);
  for (var j = 1; j < P.length; j++) {
    if (P[j].m.slice(5, 7) !== "01") continue;
    var ej = wEra(P[j].m), ee = WERAS[ej];
    if (wOff["e" + ej]) continue;
    var a0 = P[Math.max(0, j - 2)], z0 = P[Math.min(P.length - 1, j + 2)], dx = X(z0.x) - X(a0.x), dy = Y(z0.y) - Y(a0.y), ln = Math.sqrt(dx * dx + dy * dy);
    if (ln < 3) continue;
    var ux = dx / ln, uy = dy / ln, ax = X(P[j].x), ay = Y(P[j].y), sz = ee.w > 2 ? 6.5 : 5, px = -uy, py = ux;
    var tip = [ax + ux * sz, ay + uy * sz], l1 = [ax - ux * sz * 0.6 + px * sz * 0.65, ay - uy * sz * 0.6 + py * sz * 0.65], r1 = [ax - ux * sz * 0.6 - px * sz * 0.65, ay - uy * sz * 0.6 - py * sz * 0.65];
    s += '<polygon points="' + [tip, l1, r1].map(function (q) { return q[0].toFixed(1) + "," + q[1].toFixed(1); }).join(" ") + '" fill="' + ee.c + '"/>';
    var yr = P[j].m.slice(0, 4), tw = 24, lx = ax + 6, ly = ay - 5;
    if (lx + tw > R) lx = ax - 6 - tw;
    if (labs.some(function (b) { return lx < b[0] + b[2] + 2 && b[0] < lx + tw + 2 && Math.abs(ly - b[1]) < 11; })) continue;
    labs.push([lx, ly, tw]);
    s += '<text x="' + lx.toFixed(1) + '" y="' + ly.toFixed(1) + '" fill="#C7C7CC" font-size="9" stroke="#1C1C1E" stroke-width="3" paint-order="stroke">' + yr + "</text>";
  }
  var last = P[P.length - 1], rd = null;
  if (cursor != null) { var cm = dstr(cursor).slice(0, 7); P.forEach(function (p) { if (p.m <= cm) rd = p; }); }
  [rd, last].forEach(function (p, k) {
    if (!p || (k === 1 && rd === last) || wOff["e" + wEra(p.m)]) return;
    var x = X(p.x), y = Y(p.y), right = x > (L + R) / 2;
    s += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="4.5" fill="' + (k ? "#FFFFFF" : "#FFD60A") + '" stroke="#1C1C1E" stroke-width="1.5"/>';
    s += '<text x="' + (right ? x - 8 : x + 8).toFixed(1) + '" y="' + (y + 15).toFixed(1) + '" fill="' + (k ? "#FFFFFF" : "#FFD60A") + '" font-size="11" font-weight="700" text-anchor="' + (right ? "end" : "start") + '" stroke="#1C1C1E" stroke-width="3" paint-order="stroke">' + fmtD(p.m + "-15", true) + "</text>";
  });
  svg.innerHTML = s + '<text transform="translate(8,' + ((T + Bm) / 2) + ') rotate(-90)" fill="#8E8E93" font-size="10" text-anchor="middle">Chance of finding a job within 3 months →</text>';
  el("wChips").innerHTML = WERAS.map(function (e, ei) { return '<span class="bchip' + (wOff["e" + ei] ? " off" : "") + '" data-k="e' + ei + '" style="color:' + e.c + '"><i style="background:' + e.c + ";opacity:" + e.o + '"></i>' + e.name + "</span>"; }).join("") + '<span class="howBtn" id="wHowBtn">How to read</span>';
  var show = rd || last;
  el("vW").innerHTML = '<span style="color:#64A8FF">Lose ' + show.x.toFixed(1) + '%</span> · <span style="color:#30D158">Find ' + show.y.toFixed(1) + '%</span><br><span style="font-size:11.5px;font-weight:600;color:#98989F">' + fmtD(show.m + "-15", true) + ", 3-month avg.</span>";
}
function monthAddP(m, n) { var y = +m.slice(0, 4), mo = +m.slice(5, 7) - 1 + n; y += Math.floor(mo / 12); mo = ((mo % 12) + 12) % 12; return y + "-" + (mo < 9 ? "0" : "") + (mo + 1); }
el("wChips").addEventListener("click", function (ev) {
  if (ev.target && ev.target.closest && ev.target.closest(".howBtn")) { openWorkerHow(); return; }
  var t = ev.target && ev.target.closest ? ev.target.closest(".bchip") : null;
  if (!t) return;
  var k = t.getAttribute("data-k"); wOff[k] = !wOff[k]; drawWorker();
});
// ---- How to read the Job Security Map: six moves, each with a glyph. Paths are
// in a 0..1 box (x right = more fear of losing a job, y up = more confidence
// in finding one); the jump-and-snap-back is two curves.
var WPAT = [
  { c: "#30D158", t: "Up and to the left", m: "Healthy expansion", big: [[0.52, 0.56], [0.28, 0.82]], g: [[0.70, 0.30], [0.30, 0.72]], d: "Fewer people expect to lose their job and more expect to land a new one fast. The usual path through a healthy expansion." },
  { c: "#FF453A", t: "Down and to the right", m: "The usual path into a recession", big: [[0.56, 0.44], [0.80, 0.16]], g: [[0.30, 0.72], [0.72, 0.28]], d: "Fear of losing a job rises while confidence in finding one falls. The usual path into a recession." },
  { c: "#64A8FF", t: "Straight down", m: "Low hire, low fire: safe if you stay, hard to move", big: [[0.13, 0.80], [0.13, 0.24]], g: [[0.40, 0.80], [0.40, 0.22]], d: "Losing a job feels no likelier, but finding one feels much harder. Low hire, low fire: secure if you stay put, hard to move." },
  { c: "#64D2FF", t: "Straight up", m: "Hiring thaws before people feel safer", big: [[0.33, 0.10], [0.33, 0.40]], g: [[0.40, 0.20], [0.40, 0.78]], d: "Finding work gets easier while job-loss fear holds steady. Hiring picks up before people feel safer; often early in a recovery." },
  { c: "#BF5AF2", t: "Jump right, then snap back", m: "Sudden layoff shock and quick rebound (2020)", bz: [[0.60, 0.70], [0.86, 0.60], [0.97, 0.38], [0.88, 0.32], [0.80, 0.27], [0.70, 0.48], [0.64, 0.62]], gz: [[0.22, 0.70], [0.62, 0.62], [0.92, 0.30], [0.78, 0.22], [0.64, 0.16], [0.48, 0.44], [0.32, 0.64]], d: "A sudden layoff shock: fear spikes and confidence drops at once, then both reverse quickly (spring 2020)." },
  { c: "#FFD60A", t: "Sideways to the right, staying high", m: "Lots of turnover, not distress", big: [[0.58, 0.86], [0.90, 0.86]], g: [[0.22, 0.76], [0.80, 0.76]], d: "More people expect to be let go but also expect to land quickly: lots of turnover, not distress." },
];
var WBADGE = [[0.36, 0.60], [0.73, 0.36], [0.19, 0.52], [0.39, 0.25], [0.80, 0.47], [0.74, 0.78]];
function wQuad(w, h, op) {
  var s = "", mx = w / 2, my = h / 2;
  [[0, 0], [mx, 0], [0, my], [mx, my]].forEach(function (q, i) { s += '<rect x="' + q[0] + '" y="' + q[1] + '" width="' + mx + '" height="' + my + '" fill="' + WQ[i][0] + '" fill-opacity="' + op + '"/>'; });
  return s + '<line x1="' + mx + '" x2="' + mx + '" y1="0" y2="' + h + '" stroke="#48484A" stroke-dasharray="3 3"/><line x1="0" x2="' + w + '" y1="' + my + '" y2="' + my + '" stroke="#48484A" stroke-dasharray="3 3"/>';
}
function wPt(p, w, h) { return (p[0] * w).toFixed(1) + "," + ((1 - p[1]) * h).toFixed(1); }
function wHead(a, b, c, w, h, sz) { var ang = Math.atan2(-(b[1] - a[1]) * h, (b[0] - a[0]) * w) * 180 / Math.PI; return '<path d="M-' + sz + ",-" + (sz * 0.75) + " L" + (sz * 0.4) + ",0 L-" + sz + "," + (sz * 0.75) + ' Z" fill="' + c + '" transform="translate(' + (b[0] * w).toFixed(1) + "," + ((1 - b[1]) * h).toFixed(1) + ") rotate(" + ang.toFixed(1) + ')"/>'; }
function wMove(P2, w, h, sw, sz, big) {
  var z = big ? P2.bz : P2.gz, ln = big ? P2.big : P2.g;
  if (z) return '<path d="M' + wPt(z[0], w, h) + " C" + wPt(z[1], w, h) + " " + wPt(z[2], w, h) + " " + wPt(z[3], w, h) + " C" + wPt(z[4], w, h) + " " + wPt(z[5], w, h) + " " + wPt(z[6], w, h) + '" fill="none" stroke="' + P2.c + '" stroke-width="' + sw + '" stroke-linecap="round"/>' + wHead(z[5], z[6], P2.c, w, h, sz);
  return '<path d="M' + wPt(ln[0], w, h) + "L" + wPt(ln[1], w, h) + '" stroke="' + P2.c + '" stroke-width="' + sw + '" stroke-linecap="round"/>' + wHead(ln[0], ln[1], P2.c, w, h, sz);
}
function openWorkerHow() {
  var W2 = Math.min(360, (el("howSheet").clientWidth || 340) - 4), H2 = 236, s = wQuad(W2, H2, 0.09);
  WQ.forEach(function (q, i) { var x = i % 2 ? W2 - 6 : 6, y = i < 2 ? 15 : H2 - 19, an = i % 2 ? "end" : "start"; s += '<text x="' + x + '" y="' + y + '" font-size="10" font-weight="800" fill="' + q[0] + '" text-anchor="' + an + '">' + q[1] + '</text><text x="' + x + '" y="' + (y + 11) + '" font-size="8.5" fill="#8E8E93" text-anchor="' + an + '">' + q[2] + "</text>"; });
  WPAT.forEach(function (P2, i) { s += wMove(P2, W2, H2, 2.6, 7, true); var bx = WBADGE[i][0] * W2, by = (1 - WBADGE[i][1]) * H2; s += '<circle cx="' + bx.toFixed(1) + '" cy="' + by.toFixed(1) + '" r="10" fill="' + P2.c + '"/><text x="' + bx.toFixed(1) + '" y="' + (by + 4).toFixed(1) + '" font-size="11.5" font-weight="800" fill="#000" text-anchor="middle">' + (i + 1) + "</text>"; });
  el("howSheet").innerHTML = '<h3>How to read the Job Security Map</h3><div class="sub2">Schematic, not data: the paths the map traces and what each one means</div>' +
    '<div style="color:#98989F;font-size:11.5px;margin:6px 0 4px">↑ Chance of finding a job within 3 months</div><svg width="' + W2 + '" height="' + H2 + '" style="display:block;border-left:1px solid #48484A;border-bottom:1px solid #48484A">' + s + '</svg><div style="color:#98989F;font-size:11.5px;text-align:right;margin-top:4px">Chance of losing your job, next 12 months →</div>' +
    WPAT.map(function (P2, i) { var g = 52; return '<div class="it"><div style="flex:0 0 52px"><svg width="' + g + '" height="' + g + '" style="display:block;border-radius:8px;background:#141416;border:1px solid #2C2C2E">' + wQuad(g, g, 0.12) + wMove(P2, g, g, 2.2, 5, false) + '</svg></div><div><b style="color:' + P2.c + '"><span class="bd" style="display:inline-block;width:19px;height:19px;line-height:19px;font-size:11px;color:#1C1C1E;font-weight:800;background:' + P2.c + ';margin-right:6px;vertical-align:1px;margin-top:0">' + (i + 1) + "</span>" + esc(P2.t) + "</b><span>" + esc(P2.d) + "</span></div></div>"; }).join("") +
    '<div class="sub2" style="margin-top:14px">The dashed lines on the chart split the corners at each question&#39;s average since 2013. Colors on the chart mark eras only.</div><div class="done" id="howDone">Done</div>';
  el("howWrap").className = "howWrap on";
}
function renderCharts() {
  drawDrivers(); drawHire(); drawUr(); drawSahm(); drawRprob(); drawEpop(); drawBev(); drawJloss(); drawJfind(); drawWorker();
  el("when").textContent = cursor != null ? "Reading " + fmtD(dstr(cursor)) : "Latest readings · hold any chart to read a date";
}
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
function renderSummary() {
  window.__sched = D.sched; renderSched(D.sched);
  el("headline").style.display = "none";
  el("note").textContent = D.note + (D.sceNote ? " " + D.sceNote : "") + (D.newsNote ? " " + D.newsNote : "") + (D.spfNote ? " " + D.spfNote : "");
  el("progress").textContent = D.progress || "";
  el("progress").style.color = /unreachable|cached/i.test(D.progress || "") ? "#FF9F0A" : "";
}

// ---- Touch: one finger reads a date on all charts; two fingers pinch and pan
var fingers = {}, pinch = null, pinchLock = false, rafId = 0, pending = null, lastTap = null, active = "c1";
function ids() { return Object.keys(fingers); }
function posAt(x) {
  var svg = el(active), g = svg.__geo || { L: 38, w: 300 }, r = svg.getBoundingClientRect();
  var f = Math.max(0, Math.min(1, (x - r.left - g.L) / g.w));
  return { f: f, n: view.a + f * (view.b + (g.ext || 0) - view.a) };
}
function pinchNow() { var k = ids(), p = fingers[k[0]], q = fingers[k[1]], dx = p.x - q.x, dy = p.y - q.y; return { dist: Math.max(10, Math.sqrt(dx * dx + dy * dy)), mid: (p.x + q.x) / 2 }; }
function schedule(a, b) { pending = [a, b]; if (rafId) return; rafId = requestAnimationFrame(function () { rafId = 0; var v = pending; pending = null; setView(v[0], v[1]); }); }
var tapDown = null; // the second tap of a possible double-tap, until its finger lifts
function onDown(id, e) {
  fingers[e.pointerId] = { x: e.clientX, y: e.clientY };
  var n = ids().length;
  if (n === 1) active = id;
  if (n === 2) { var st = pinchNow(); pinch = { dist: st.dist, span: view.b - view.a, anchor: posAt(st.mid).n }; pinchLock = true; tapDown = null; cursor = null; lastTap = null; }
  else if (n === 1 && !pinchLock) {
    var now = Date.now();
    if (lastTap && now - lastTap.t < 320 && Math.abs(e.clientX - lastTap.x) < 30) {
      // the second tap of a double-tap: acted on when the finger lifts, so a pinch that starts right after a tap doesn't reset the view
      tapDown = { t: now, x: e.clientX };
      return;
    }
    lastTap = { t: now, x: e.clientX };
    cursor = Math.round(posAt(e.clientX).n); renderCharts();
  }
}
function onMove(id, e) {
  if (!fingers[e.pointerId]) return;
  fingers[e.pointerId] = { x: e.clientX, y: e.clientY };
  if (pinch && ids().length >= 2) {
    var st = pinchNow(), span = Math.max(MIN_SPAN, Math.min(LAST - FIRST, pinch.span * pinch.dist / st.dist));
    var a = pinch.anchor - posAt(st.mid).f * span;
    schedule(a, a + span);
  } else if (!pinchLock) { cursor = Math.round(posAt(e.clientX).n); renderCharts(); }
}
function onUp(id, e) {
  delete fingers[e.pointerId];
  var n = ids().length;
  if (n < 2) pinch = null;
  if (n === 0) { if (tapDown && !pinchLock && e.type !== "pointercancel" && Date.now() - tapDown.t < 450 && Math.abs(e.clientX - tapDown.x) < 30) { lastTap = null; cursor = null; resetView(); renderCharts(); } tapDown = null; if (!pinchLock) { cursor = null; renderCharts(); } pinchLock = false; }
}
["1", "2", "3", "4", "5", "6", "7", "8", "9"].forEach(function (k) {
  var t = el("t" + k), id = "c" + k;
  t.addEventListener("pointerdown", function (e) { onDown(id, e); });
  t.addEventListener("pointermove", function (e) { onMove(id, e); });
  t.addEventListener("pointerup", function (e) { onUp(id, e); });
  t.addEventListener("pointercancel", function (e) { onUp(id, e); });
  t.addEventListener("pointerleave", function (e) { onUp(id, e); });
});
// Beveridge: two fingers pinch (both axes) and pan; double-tap resets. One
// finger still scrolls the page.
var bf = {}, bp = null, bTap = null;
function bevData(x, y) {
  var svg = el("cBev"), g = svg.__bgeo, r = svg.getBoundingClientRect(), W0 = bevWin();
  var fx = (x - r.left - g.L) / (g.R - g.L), fy = (g.Bm - (y - r.top)) / (g.Bm - g.T);
  return { fx: fx, fy: fy, u: W0.u0 + fx * (W0.u1 - W0.u0), o: W0.o0 + fy * (W0.o1 - W0.o0) };
}
function bevTwo() { var k = Object.keys(bf), p = bf[k[0]], q = bf[k[1]], dx = p.x - q.x, dy = p.y - q.y; return { d: Math.max(10, Math.sqrt(dx * dx + dy * dy)), x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }; }
var bRaf = 0;
el("tBev").addEventListener("pointerdown", function (e) {
  bf[e.pointerId] = { x: e.clientX, y: e.clientY };
  var n = Object.keys(bf).length;
  if (n === 2) { var st = bevTwo(), W0 = bevWin(), a = bevData(st.x, st.y); bp = { d: st.d, us: W0.u1 - W0.u0, os: W0.o1 - W0.o0, u: a.u, o: a.o }; bTap = null; bTapDown = null; bPinched = true; }
  else if (n === 1) {
    var now = Date.now();
    // the second tap of a double-tap: acted on when the finger lifts, so a pinch that starts right after a tap doesn't reset the zoom
    if (bTap && now - bTap.t < 320 && Math.abs(e.clientX - bTap.x) < 30 && Math.abs(e.clientY - bTap.y) < 30) { bTapDown = { t: now, x: e.clientX, y: e.clientY }; return; }
    bTap = { t: now, x: e.clientX, y: e.clientY };
  }
});
el("tBev").addEventListener("pointermove", function (e) {
  if (!bf[e.pointerId]) return;
  bf[e.pointerId] = { x: e.clientX, y: e.clientY };
  if (!bp || Object.keys(bf).length < 2) return;
  var st = bevTwo(), base = bevScale(), bu = base.u1 - base.u0, bo = base.o1 - base.o0;
  var f = Math.max(1 / BZ_MAX, Math.min(1, (bp.us / bu) * bp.d / st.d));
  if (f >= 0.999) { bz = null; } else {
    var svg = el("cBev"), g = svg.__bgeo, r = svg.getBoundingClientRect();
    var fx = (st.x - r.left - g.L) / (g.R - g.L), fy = (g.Bm - (st.y - r.top)) / (g.Bm - g.T), us = bu * f, os = bo * f;
    var u0 = bp.u - fx * us, o0 = bp.o - fy * os;
    u0 = Math.max(base.u0 - us * 0.3, Math.min(base.u1 + 4 - us * 0.7, u0)); o0 = Math.max(base.o0 - os * 0.3, Math.min(base.o1 - os * 0.7, o0));
    bz = { u0: u0, u1: u0 + us, o0: o0, o1: o0 + os };
  }
  if (!bRaf) bRaf = requestAnimationFrame(function () { bRaf = 0; drawBev(); });
});
var bTapDown = null, bPinched = false;
function bevUp(e) {
  if (!bf[e.pointerId]) return;
  delete bf[e.pointerId];
  var n = Object.keys(bf).length;
  if (n < 2) bp = null;
  if (n === 0) {
    if (bTapDown && !bPinched && e.type !== "pointercancel" && Date.now() - bTapDown.t < 450 && Math.abs(e.clientX - bTapDown.x) < 30) { bTap = null; bz = null; drawBev(); }
    bTapDown = null; bPinched = false;
  }
}
["pointerup", "pointercancel", "pointerleave"].forEach(function (ev) { el("tBev").addEventListener(ev, bevUp); });
document.addEventListener("gesturestart", function (e) { e.preventDefault(); });
window.addEventListener("resize", function () { if (D) renderCharts(); });

window.update = function (n) {
  var keep = D && view.b && view.b !== LAST ? { a: view.a, b: view.b } : null;
  D = n; prep();
  FIRST = day(D.first); LAST = day(D.last);
  if (keep) { view.a = keep.a; view.b = keep.b; } else resetView();
  cursor = null;
  renderSummary(); renderCharts();
  window.__rendered = true;
};
window.shareInfo = function () { return { title: "Jobs", name: "Jobs and unemployment", asOf: fmtD(D.last) }; };

// Share as PDF: four 16:9 slides, at most two charts each, for the dates on
// screen. 1) all three drivers on one chart; 2) layoffs and continuing
// claims; 3) hiring gap and prime-age employment; 4) unemployment rate and
// the Sahm rule. Under every chart: a verdict line (does it push unemployment
// up, down, or not at all, with the number) and what the chart measures.
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
  var PRED = [200, 40, 40], PGRN = [30, 140, 70], PGRY = [120, 120, 125];
  var PC = { lay: [205, 45, 45], cont: [214, 128, 0], hire: [128, 60, 190] }, PUR = [10, 98, 208], PTEAL = [0, 140, 130], PGOLD = [176, 132, 0];
  var PSTAT = { up: PRED, neutral: PGRY, down: PGRN };
  function font(bold, size, c) { doc.setFont(FACE, bold ? "bold" : "normal"); doc.setFontSize(size); doc.setTextColor(c[0], c[1], c[2]); }
  function clean(t) { return String(t).split("−").join("-").split("–").join("-").split("’").join("'").split("—").join("-").split("“").join('"').split("”").join('"'); }
  var hasRp = (S.rprob || []).some(function (p) { return p.n >= view.a && p.n <= view.b; });
  var hasJl = (S.jloss || []).length > 0, hasJf = (S.jfind || []).length > 0, hasExp = hasJl || hasJf, hasW = (D.worker || []).length > 12;
  var Sm = D.summary, pages = ((D.bev || []).length > 12 ? 5 : 4) + (hasExp ? 1 : 0) + (hasW ? 1 : 0), a = view.a, b = view.b;
  function headline(text) {
    var size = 21, lines;
    do { font(true, size, INK); lines = doc.splitTextToSize(clean(text), W - 72); size -= 1; } while (lines.length > 1 && size > 15);
    doc.text(lines, 36, 42);
    return 42 + (lines.length - 1) * (size + 4);
  }
  function banner(page) {
    var bh = 44, by = H - bh;
    doc.setFillColor(28, 28, 30); doc.rect(0, by, W, bh, "F");
    doc.setFillColor(201, 162, 39); doc.rect(W - 176, by + 6, 2, bh - 12, "F");
    font(false, 7, [235, 235, 240]);
    var src = "Sources: BLS via FRED (UNRATE, prime-age employment LNS12300060, JOLTS hires JTSHIR, openings JTSJOR, layoffs JTSLDR, payrolls PAYEMS, flows LNS17100000, UNEMPLOY); " +
      "Labor Dept. via FRED (claims ICSA, CCSA); Sahm rule SAHMREALTIME; NBER recessions (gray); recession odds: NY Fed yield-curve model (GS10, TB3MS); NY Fed Survey of Consumer Expectations; Philadelphia Fed Survey of Professional Forecasters; GDELT (layoff news). " +
      "Claims are 4-week averages; dotted lines are 2019 averages; calls compare claims per 1,000 payroll jobs with 2019 (within " + D.neutralPct + "% is neutral).";
    var srcL = doc.splitTextToSize(src, W - 176 - 40 - 110);
    doc.text(srcL, 28, by + (srcL.length > 4 ? 9 : 12), { lineHeightFactor: srcL.length > 4 ? 1.02 : 1.15 });
    font(false, 7.5, [200, 200, 205]);
    doc.text(clean(fmtD(dstr(a))) + " to " + clean(fmtD(dstr(b))), W - 188, by + 20, { align: "right" });
    doc.text(page + " of " + pages, W - 188, by + 31, { align: "right" });
    font(true, 12.5, [255, 255, 255]);
    doc.text("Labor", W - 162, by + 20);
    doc.text("Market", W - 162, by + 34);
  }
  // a chart box with gridlines, left-axis labels, recessions and dates
  function frameP(L, R, T, B, lo, hi, fmt, zeroStrong) {
    var F = { L: L, R: R, T: T, B: B, lo: lo, hi: hi };
    F.X = function (n) { return F.L + (n - a) / (b - a) * (F.R - F.L); };
    F.Y = function (v) { return F.B - (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo) * (F.B - F.T); };
    (D.rec || []).forEach(function (r) {
      var x0 = Math.max(a, day(r.from + "-01")), x1 = Math.min(b, day(r.to + "-28") + 3);
      if (x1 > x0) { doc.setFillColor(236, 236, 240); doc.rect(F.X(x0), F.T, F.X(x1) - F.X(x0), F.B - F.T, "F"); }
    });
    var st = niceStep(hi - lo, 5);
    for (var v = Math.ceil(lo / st) * st; v <= hi + 1e-9; v += st) {
      var z = Math.abs(v) < st / 1000 && zeroStrong;
      doc.setDrawColor(RULE[0], RULE[1], RULE[2]); doc.setLineWidth(0.5);
      if (!z) doc.line(F.L, F.Y(v), F.R, F.Y(v));
      font(false, 8, GRY); doc.text(fmt(v), F.L - 5, F.Y(v) + 3, { align: "right" });
    }
    doc.setLineWidth(0.5); doc.setDrawColor(150, 150, 155); doc.line(F.L, F.B, F.R, F.B);
    var years = (b - a) / 365.25, lastX = -99, y0 = +dstr(a).slice(0, 4), y1 = +dstr(b).slice(0, 4);
    for (var y = y0; y <= y1; y++) for (var q = 0; q < 4; q++) {
      if (years > 2.5 && q) continue;
      var mo = q * 3 + 1, n = day(y + "-" + (mo < 10 ? "0" : "") + mo + "-01");
      if (n < a || n > b) continue;
      var lab = q ? MONTHS[mo - 1] : String(y), x = F.X(n);
      if (x - lastX < 34 || x > F.R - 8) continue;
      doc.setDrawColor(150, 150, 155); doc.line(x, F.B, x, F.B + 3);
      font(false, 8, GRY); doc.text(lab, x, F.B + 12, { align: "center" }); lastX = x;
    }
    return F;
  }
  function dashed(F, v, c, w, label) {
    doc.setDrawColor(c[0], c[1], c[2]); doc.setLineWidth(w || 0.9);
    if (doc.setLineDashPattern) doc.setLineDashPattern([4, 3], 0);
    doc.line(F.L, F.Y(v), F.R, F.Y(v));
    if (doc.setLineDashPattern) doc.setLineDashPattern([], 0);
    if (label) { font(true, 7.5, c); doc.text(label, F.L + 4, F.Y(v) - 3); }
  }
  function lineP(F, arr, c, w, gap) {
    doc.setDrawColor(c[0], c[1], c[2]); doc.setLineWidth(w); if (doc.setLineJoin) doc.setLineJoin("round");
    var px = null, py = null, pn = null;
    arr.forEach(function (p) {
      if (p.n < a || p.n > b) return;
      var x = F.X(p.n), y = F.Y(p.v);
      if (px !== null && p.n - pn <= (gap || 50)) doc.line(px, py, x, y);
      px = x; py = y; pn = p.n;
    });
  }
  function endLabels(F, items) {
    items.sort(function (p, q) { return p.y - q.y; });
    for (var k = 1; k < items.length; k++) if (items[k].y - items[k - 1].y < 13) items[k].y = items[k - 1].y + 13;
    var ov = items.length ? items[items.length - 1].y - F.B : 0;
    if (ov > 0) items.forEach(function (it) { it.y -= ov; });
    items.forEach(function (it) {
      font(true, 10, it.c); doc.text(clean(it.v), F.R + 6, it.y + 3.5);
      if (it.t) { var tw = doc.getTextWidth(clean(it.v)); font(false, 9, it.c); doc.text(clean(it.t), F.R + 10 + tw, it.y + 3.5); }
    });
  }
  // the chart title above, and under the chart: the verdict (bold lead word
  // in its color) and what the chart measures
  function chartTitle(x, w, title, sub, top) {
    font(true, 12, INK); doc.text(clean(title), x, top + 26);
    if (sub) { font(false, 8.5, GRY); doc.text(clean(sub), x, top + 38); }
  }
  function caption(x, w, y, lead, leadC, text, what) {
    var yy = y - 11;
    if (lead) { font(true, 9.5, leadC); doc.text(clean(lead), x, y); yy = y; }
    if (what) { font(false, 7.8, GRY); var wl = doc.splitTextToSize(clean(what), w).slice(0, 4); doc.text(wl, x, yy + 12, { lineHeightFactor: 1.15 }); }
  }

  var L1 = 36, half = (W - 72 - 36) / 2, L2 = 36 + half + 36;
  function dotted(F, v, c, label) {
    doc.setDrawColor(c[0], c[1], c[2]); doc.setLineWidth(1); if (doc.setLineDashPattern) doc.setLineDashPattern([1.5, 2.5], 0);
    doc.line(F.L, F.Y(v), F.R, F.Y(v)); if (doc.setLineDashPattern) doc.setLineDashPattern([], 0);
    font(true, 7.5, c); var tw = doc.getTextWidth(clean(label));
    doc.setFillColor(255, 255, 255); doc.rect(F.L + 2, F.Y(v) - 10, tw + 4, 8.5, "F");
    doc.text(clean(label), F.L + 4, F.Y(v) - 3);
  }
  function cap(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
  function tc(t) { var small = { and: 1, but: 1, or: 1, of: 1, the: 1, vs: 1, a: 1, on: 1, in: 1, as: 1, to: 1, for: 1, at: 1, near: 0 }; return String(t).split(" ").map(function (w, i) { return i && small[w] ? w : w.split("-").map(function (q) { return q.charAt(0).toUpperCase() + q.slice(1); }).join("-"); }).join(" "); }

  // ---- 1. Unemployment rate | Sahm rule ----
  var vu = urVerdict(b), vs = sahmVerdict(b);
  var pg = 0, hasBev = (D.bev || []).length > 12;
  // ---- 1. The hero: openings vs unemployment (the Beveridge curve), all dates, chips respected ----
  if (hasBev) {
    var top = headline("Beveridge Curve: Openings vs Unemployment");
    var BV = D.bev, sc = bevScale(), HIST = bevHistOn() ? D.bevHist : [], PL = 96, PR = W - 250, PT = top + 26, PB = H - 44 - 54;
    var bx = function (u) { return PL + (Math.min(u, sc.u1 + 0.4) - sc.u0) / (sc.u1 - sc.u0) * (PR - PL); }, byy = function (o) { return PB - (o - sc.o0) / (sc.o1 - sc.o0) * (PB - PT); };
    doc.setDrawColor(RULE[0], RULE[1], RULE[2]); doc.setLineWidth(0.5);
    for (var uu = Math.ceil(sc.u0); uu <= sc.u1 + 1e-9; uu++) { doc.line(bx(uu), PT, bx(uu), PB); font(false, 8.5, GRY); doc.text(uu + "%", bx(uu), PB + 12, { align: "center" }); }
    for (var oo = Math.ceil(sc.o0); oo <= sc.o1 + 1e-9; oo += 1) { doc.line(PL, byy(oo), PR, byy(oo)); font(false, 8.5, GRY); doc.text(oo.toFixed(0) + "%", PL - 6, byy(oo) + 3, { align: "right" }); }
    font(true, 9, INK); doc.text("Unemployment rate", PR, PB + 26, { align: "right" });
    doc.text("Job openings rate", PL - 40, PT - 8);
    var PE = [[150, 150, 155], [10, 98, 208], [214, 128, 0], [0, 140, 130]], PO = [0.5, 0.55, 0.6, 1], PW = [1, 1, 1, 2];
    doc.saveGraphicsState(); doc.rect(PL, PT - 4, PR - PL, PB - PT + 8, null); doc.clip(); doc.discardPath();
    if (HIST.length) {
      doc.setDrawColor(200, 200, 205); doc.setLineWidth(0.6);
      for (var hq = 1; hq < HIST.length; hq++) doc.line(bx(HIST[hq - 1].u), byy(HIST[hq - 1].o), bx(HIST[hq].u), byy(HIST[hq].o));
      HIST.forEach(function (hp) { doc.setFillColor(175, 175, 180); doc.circle(bx(hp.u), byy(hp.o), 1.9, "F"); if (HIST_LABELS[hp.y]) { font(false, 7.5, [130, 130, 135]); doc.text(String(hp.y), bx(hp.u) + 4, byy(hp.o) - 3); } });
    }
    for (var q = 1; q < BV.length; q++) {
      var ei = eraOf(BV[q].m), cc = PE[ei];
      if (bevOff["e" + ei]) continue;
      if (doc.GState) doc.setGState(new doc.GState({ "stroke-opacity": PO[ei], opacity: PO[ei] }));
      doc.setDrawColor(cc[0], cc[1], cc[2]); doc.setLineWidth(PW[ei]);
      doc.line(bx(BV[q - 1].u), byy(BV[q - 1].o), bx(BV[q].u), byy(BV[q].o));
    }
    if (doc.GState) doc.setGState(new doc.GState({ "stroke-opacity": 1, opacity: 1 }));
    bevArrows(BV, bx, byy).forEach(function (a2) {
      var cc2 = PE[a2.e], sz2 = a2.e === 3 ? 5 : 4, qx = -a2.uy, qy = a2.ux;
      doc.setFillColor(cc2[0], cc2[1], cc2[2]);
      doc.triangle(a2.x + a2.ux * sz2, a2.y + a2.uy * sz2, a2.x - a2.ux * sz2 * 0.6 + qx * sz2 * 0.65, a2.y - a2.uy * sz2 * 0.6 + qy * sz2 * 0.65, a2.x - a2.ux * sz2 * 0.6 - qx * sz2 * 0.65, a2.y - a2.uy * sz2 * 0.6 - qy * sz2 * 0.65, "F");
    });
    BV.forEach(function (p2) { if (eraOf(p2.m) === 3 && !bevOff.e3) { doc.setFillColor(0, 140, 130); doc.circle(bx(p2.u), byy(p2.o), 1.3, "F"); } });
    doc.restoreGraphicsState();
    var sp = bevOff.e2 ? [] : BV.filter(function (p2) { return p2.u > sc.u1 + 0.4; });
    if (sp.length) { var tp = sp.reduce(function (a2, p2) { return p2.u > a2.u ? p2 : a2; }); font(true, 8, PE[2]); doc.text(clean("-> " + tp.u.toFixed(1) + "% (" + fmtD(tp.m + "-15", true) + ")"), PR - 2, byy(tp.o) - 5, { align: "right" }); }
    var lp = BV[BV.length - 1];
    if (!bevOff["e" + eraOf(lp.m)]) {
    doc.setFillColor(28, 28, 30); doc.circle(bx(lp.u), byy(lp.o), 3.2, "F");
    font(true, 9.5, INK); doc.text(clean(fmtD(lp.m + "-15", true)), bx(lp.u) + 7, byy(lp.o) - 5);
    }
    // legend, then a mini reading guide (schematic, not data), at the right
    var lx = PR + 26, rw = W - 30 - lx, ly = PT + 4;
    var legRows = [];
    if (HIST.length) legRows.push({ c: [175, 175, 180], n: "1951-2000, yearly", dot: true });
    ERAS.forEach(function (e, ei) { if (!bevOff["e" + ei]) legRows.push({ c: PE[ei], n: e.name, w: PW[ei], bold: ei === 3 }); });
    legRows.forEach(function (r, ri) { doc.setFillColor(r.c[0], r.c[1], r.c[2]); if (r.dot) doc.circle(lx + 7, ly + ri * 13 - 3, 2.2, "F"); else doc.rect(lx, ly + ri * 13 - 5.5, 14, r.w + 2, "F"); font(!!r.bold, 9, INK); doc.text(clean(r.n), lx + 20, ly + ri * 13); });
    var gy = ly + legRows.length * 13 + 12;
    font(true, 9.5, INK); doc.text("How to read it", lx, gy);
    var NEU = [44, 44, 48], gw = 40, gh = 26, ry = gy + 8, tx = lx + gw + 7, tw = rw - gw - 7;
    PATTERNS.forEach(function (P) {
      doc.setFillColor(247, 247, 249); doc.setDrawColor(228, 228, 232); doc.setLineWidth(0.6); doc.roundedRect(lx, ry, gw, gh, 3, 3, "FD");
      var G = glyphGeom(lx, ry, gw, gh, P.k);
      var line = function (pp, c, wdt, dash) { doc.setDrawColor(c[0], c[1], c[2]); doc.setLineWidth(wdt); if (dash) doc.setLineDashPattern(dash, 0); for (var q = 1; q < pp.length; q++) doc.line(pp[q - 1][0], pp[q - 1][1], pp[q][0], pp[q][1]); doc.setLineDashPattern([], 0); };
      line(G.curve, [160, 160, 165], 1.2);
      if (G.shifted) line(G.shifted, NEU, 1, [2.5, 2]);
      var A = G.arrow, hd = arrowHead(A, 4);
      doc.setDrawColor(NEU[0], NEU[1], NEU[2]); doc.setLineWidth(1.8); doc.line(A[0], A[1], A[2] - (A[2] - A[0]) * 0.05, A[3] - (A[3] - A[1]) * 0.05);
      doc.setFillColor(NEU[0], NEU[1], NEU[2]); doc.triangle(hd[0][0], hd[0][1], hd[1][0], hd[1][1], hd[2][0], hd[2][1], "F");
      font(true, 8.3, INK); doc.text(clean(P.a), tx, ry + 9);
      // a small drawn arrow, then the meaning
      doc.setDrawColor(110, 110, 115); doc.setLineWidth(0.7); doc.line(tx, ry + 17.5, tx + 6, ry + 17.5); doc.setFillColor(110, 110, 115); doc.triangle(tx + 7.5, ry + 17.5, tx + 5, ry + 16, tx + 5, ry + 19, "F");
      font(false, 8, GRY); var ml = doc.splitTextToSize(clean(P.m.split("\u201c").join("'").split("\u201d").join("'")), tw - 11).slice(0, 3);
      doc.text(ml, tx + 11, ry + 20, { lineHeightFactor: 1.15 });
      ry += Math.max(gh + 6, 20 + 9.2 * ml.length + 2);
    });
    font(false, 7, [150, 150, 155]); doc.text(doc.splitTextToSize("Glyphs are schematic, not data. Colors on the chart mark eras only.", rw), lx, ry + 4);
    // how the real chart is drawn, under it
    font(false, 7.3, GRY);
    doc.text(doc.splitTextToSize(clean("Each point is a month since December 2000 (JOLTS openings rate, BLS unemployment rate); arrowheads every six months point forward in time. Shows all dates, not the zoom." + (sp.length ? " Spring 2020 runs off the right edge." : "") + (HIST.length ? " 1951-2000: yearly averages of a help-wanted-ad proxy for openings (Barnichon), scaled to JOLTS." : "")), PR - PL - 100).slice(0, 3), PL - 30, PB + 23, { lineHeightFactor: 1.15 });
    banner(++pg);
  }
  // ---- 2. Recession signals: Sahm rule | recession odds from the yield curve ----
  if (hasBev) doc.addPage([W, H], "landscape");
  top = headline((S.anx || []).length && !rpOff.anx ? "Recession Signals: Sahm Rule, Yield Curve and Anxious Index" : "Recession Signals: the Sahm Rule and the Yield Curve");
  var sa = S.sahm.filter(function (p) { return p.n >= a && p.n <= b; });
  chartTitle(L1, half, "Sahm Rule Recession Indicator", "Monthly, percentage points - dashed red line is the 0.50 recession signal", top);
  if (sa.length) {
    var sv = sa.map(function (p) { return p.v; });
    var FS = frameP(L1 + 34, L1 + half - 46, top + 48, H - 44 - 88, Math.min(0, Math.min.apply(null, sv)), Math.max(D.sahmTrigger + 0.15, Math.max.apply(null, sv) + 0.1), function (v) { return v.toFixed(2); });
    doc.setFillColor(253, 232, 232); doc.rect(FS.L, FS.T, FS.R - FS.L, Math.max(0, FS.Y(D.sahmTrigger) - FS.T), "F");
    dashed(FS, D.sahmTrigger, PRED, 1.1, "Recession signal " + D.sahmTrigger.toFixed(2));
    lineP(FS, S.sahm, PGOLD, 2.2);
    var ls = sa[sa.length - 1];
    endLabels(FS, [{ y: FS.Y(ls.v), v: ls.v.toFixed(2), t: "", c: PGOLD }]);
  }
  if (vs) caption(L1, half, H - 44 - 62, vs.word, vs.on ? PRED : PGRN, "",
    "Sahm rule: the 3-month average unemployment rate minus its lowest 3-month average over the prior 12 months (as first reported). A reading of 0.50 or more has signaled the start of every U.S. recession since 1970.");
  if (hasRp) {
    var bKeep = b; b = b + 366; // this chart runs a year past today
    var rp = S.rprob.filter(function (p) { return p.n >= a && p.n <= b; }), PORA = [214, 120, 0];
    var ax2 = (S.anx || []).filter(function (p) { return p.n >= a && p.n <= b; }), anxP = ax2.length > 0 && !rpOff.anx, ycP = !rpOff.yc || !anxP, PPUR = [142, 59, 184];
    chartTitle(L2, half, anxP ? "Recession Odds: Yield Curve and Anxious Index" : "Recession Odds from the Yield Curve", "%, plotted at the month or quarter each reading forecasts", top);
    var rv = (ycP ? rp : []).concat(anxP ? ax2 : []).map(function (p) { return p.v; });
    if (anxP) (S.anxFc || []).forEach(function (r) { r.pts.forEach(function (p) { if (p.n >= a && p.n <= b) rv.push(p.v); }); });
    var FR = frameP(L2 + 34, L2 + half - 46, top + 48, H - 44 - 88, 0, Math.min(100, Math.max(20, Math.max.apply(null, rv) * 1.12)), function (v) { return Math.round(v) + "%"; });
    var txR = FR.X(LAST);
    doc.setFillColor(253, 240, 222); doc.rect(txR, FR.T, FR.R - txR, FR.B - FR.T, "F");
    doc.setDrawColor(120, 120, 125); doc.setLineWidth(0.7); if (doc.setLineDashPattern) doc.setLineDashPattern([3, 2], 0); doc.line(txR, FR.T, txR, FR.B); if (doc.setLineDashPattern) doc.setLineDashPattern([], 0);
    font(true, 8, PORA); doc.text("Forecast", txR + 3, FR.T + 9);
    font(false, 8, GRY); doc.text("Past forecasts", txR - 3, FR.T + 9, { align: "right" });
    if (anxP) {
      lineP(FR, S.anx, PPUR, 1.6, 100);
      var RA = S.anxFc || [], atg = [];
      RA.forEach(function (r, k) {
        var lt = k === RA.length - 1, c8 = lt ? PPUR : [205, 180, 225];
        doc.setDrawColor(c8[0], c8[1], c8[2]); doc.setLineWidth(lt ? 1.3 : 0.9); if (doc.setLineDashPattern) doc.setLineDashPattern([2.5, 2], 0);
        for (var q8 = 1; q8 < r.pts.length; q8++) doc.line(FR.X(r.pts[q8 - 1].n), FR.Y(r.pts[q8 - 1].v), FR.X(r.pts[q8].n), FR.Y(r.pts[q8].v));
        if (doc.setLineDashPattern) doc.setLineDashPattern([], 0);
        r.pts.forEach(function (p) { doc.setFillColor(c8[0], c8[1], c8[2]); doc.circle(FR.X(p.n), FR.Y(p.v), lt ? 1.7 : 1.2, "F"); });
      });
      RA.slice().reverse().forEach(function (r, k) {
        var e = r.pts[r.pts.length - 1], t8 = r.s.split(" ")[0] + " '" + r.s.slice(-2); font(k === 0, 6.5, k ? [175, 150, 200] : PPUR);
        var tw8 = doc.getTextWidth(t8), lx8 = Math.min(FR.R - tw8, FR.X(e.n) - tw8 / 2), ly8 = FR.Y(e.v) - 4;
        if (atg.some(function (q) { return lx8 < q[0] + q[2] + 1.5 && q[0] < lx8 + tw8 + 1.5 && Math.abs(ly8 - q[1]) < 7; })) { ly8 = FR.Y(e.v) + 9; if (atg.some(function (q) { return lx8 < q[0] + q[2] + 1.5 && q[0] < lx8 + tw8 + 1.5 && Math.abs(ly8 - q[1]) < 7; })) return; }
        atg.push([lx8, ly8, tw8]); doc.text(t8, lx8, ly8);
      });
    }
    if (ycP) lineP(FR, S.rprob, PORA, 2.2);
    var lr = rp[rp.length - 1], la2 = ax2[ax2.length - 1];
    endLabels(FR, (ycP ? [{ y: FR.Y(lr.v), v: Math.round(lr.v) + "%", t: "", c: PORA }] : []).concat(anxP ? [{ y: FR.Y(la2.v), v: Math.round(la2.v) + "%", t: "", c: PPUR }] : []));
    if (anxP) { var lg7 = FR.L; (ycP ? [[PORA, "Yield curve: recession, 12 mo. ahead"]] : []).concat([[PPUR, "Anxious Index: GDP falls next quarter"]]).forEach(function (g2) { doc.setFillColor(g2[0][0], g2[0][1], g2[0][2]); doc.rect(lg7, FR.B + 20, 12, 2.4, "F"); font(false, 8, INK); doc.text(g2[1], lg7 + 16, FR.B + 23); lg7 += 24 + doc.getTextWidth(g2[1]); }); }
    caption(L2, half, H - 44 - (anxP ? 52 : 62), "", PORA, "",
      (ycP ? "Orange: odds of a recession each month, forecast a year earlier from the 10-year minus 3-month spread (NY Fed model), " + Math.round(lr.v) + "% for " + rpFor(lr) + ". " : "") + (anxP ? "Purple: the Anxious Index (Philadelphia Fed), forecasters' chance of real GDP falling the quarter after each survey, " + Math.round(la2.v) + "% for " + la2.q + "; dotted: each survey's next four quarters. " : "") + "Shaded: the forecast. Gray columns are recessions.");
    b = bKeep;
  }
  banner(++pg);

  // ---- the four driver charts, drawn into either half of a slide ----
  var GROW = D.jobGrowth != null ? " Payroll jobs are " + Math.abs(D.jobGrowth).toFixed(1) + "% " + (D.jobGrowth >= 0 ? "above" : "below") + " 2019, so the verdict uses claims per 1,000 jobs." : "";
  var WHAT = {
    lay: "Initial unemployment claims, 4-week average: a weekly read on people leaving jobs. The dotted line is the 2019 average; above it (red) pushes unemployment up." + GROW + ((S.layWk || []).length && !jlOff ? " Orange: JOLTS layoffs and discharges as a weekly pace (monthly total / weeks in the month); the gap above claims is layoffs that never became a claim." : "") + (S.newsM.length && S.newsF && !nwOff ? " Gray dots: share of US news articles saying layoff(s) (GDELT, 13-week average, right scale), fitted to the dates shown." : ""),
    cont: "People still collecting unemployment benefits, 4-week average: how long job searches take. Dotted line: the 2019 average; above it (red) pushes unemployment up." + GROW +
      " Only people on benefits count, so this can fall when benefits run out (usually after 26 weeks), not just when people find work.",
  };
  function claimChart(c, x, title, top) {
    var vd = verdict(c.key, b), col = PC[c.key], base = D.baseK[c.key];
    var arr = S[c.k].filter(function (p) { return p.n >= a && p.n <= b; }), rp = at(S[c.raw], b, 10);
    var jw = c.key === "lay" && !jlOff ? (S.layWk || []).filter(function (p) { return p.n >= a && p.n <= b; }) : [];
    var nwP = c.key === "lay" && !nwOff && S.newsF ? S.newsM.filter(function (p) { return p.n >= a && p.n <= b; }) : [];
    chartTitle(x, half, title, "Weekly, 4-week average" + (rp ? " - " + c.per(rp.v) + " per 1,000 jobs at the latest reading" : ""), top);
    if (arr.length) {
      var v = arr.concat(jw).map(function (p) { return p.v; }).concat([base]);
      var lo = Math.min.apply(null, v), hi = Math.min(base * (1 + D.capHi / 100), Math.max.apply(null, v)), pd = (hi - lo) * 0.08;
      var FC = frameP(x + 40, x + half - 50, top + 48, H - 44 - (jw.length || nwP.length ? 100 : 88), Math.max(0, lo - pd), hi + pd, fmtK); // room for the key above the caption
      if (c.key !== "lay") { doc.setFillColor(253, 238, 238); doc.rect(FC.L, FC.T, FC.R - FC.L, Math.max(0, FC.Y(base) - FC.T), "F"); }
      dotted(FC, base, [90, 90, 95], "2019 avg " + fmtK(base));
      var nfP = nwP.length ? newsFit(nwP, a, b, FC.lo, FC.hi) : null;
      var PJ = [214, 120, 0], PN = [130, 130, 136];
      if (nwP.length) {
        doc.setLineCap && doc.setLineCap("round"); if (doc.setLineDashPattern) doc.setLineDashPattern([0.1, 3.2], 0);
        lineP(FC, nfP.pts, PN, 1.8, 10);
        if (doc.setLineDashPattern) doc.setLineDashPattern([], 0); doc.setLineCap && doc.setLineCap("butt");
      }
      if (jw.length) lineP(FC, S.layWk, PJ, 1.5, 40);
      lineP(FC, S[c.k], col, 2);
      var lc = arr[arr.length - 1], lj = jw.length ? jw[jw.length - 1] : null, ln = nfP ? nfP.pts.filter(function (p) { return p.n <= b; }).pop() : null;
      var items = [{ y: FC.Y(lc.v), v: fmtK(lc.v), t: "", c: col }].concat(lj ? [{ y: FC.Y(lj.v), v: fmtK(lj.v), t: "JOLTS", c: PJ }] : []).concat(ln ? [{ y: FC.Y(ln.v), v: ln.r.toFixed(1) + "x", t: "news", c: PN }] : []);
      endLabels(FC, items);
      if (ln) {
        // the news line's own scale (% of articles) at the right, skipping ticks that would sit on a label
        var nst = niceStep(nfP.hi - nfP.lo, 4), ndec = newsDec(nst);
        for (var nv = Math.ceil(nfP.lo / nst) * nst; nv <= nfP.hi + 1e-12; nv += nst) {
          var ny = FC.Y(nfP.map(nv));
          if (items.every(function (it) { return Math.abs(it.y - ny) > 11; })) { font(false, 7.5, PN); doc.text(nv.toFixed(ndec) + "%", FC.R + 6, ny + 3); }
        }
      }
      if (lj || ln) { var lg1 = FC.L; [[col, ln ? "Claims, 4-wk avg." : "Initial claims, 4-week average"]].concat(lj ? [[PJ, "JOLTS layoffs, weekly pace"]] : []).concat(ln ? [[PN, "News mentions (right scale)"]] : []).forEach(function (g2) { doc.setFillColor(g2[0][0], g2[0][1], g2[0][2]); doc.rect(lg1, FC.B + 20, 12, 2.4, "F"); font(false, 8, INK); doc.text(g2[1], lg1 + 16, FC.B + 23); lg1 += 24 + doc.getTextWidth(g2[1]); }); }
    }
    if (vd) caption(x, half, H - 44 - 62, vd.word, PSTAT[vd.st], "", WHAT[c.key]);
  }
  function hireChart(x, top) {
    var vh = verdict("hire", b), hr = S.rawHire.filter(function (p) { return p.n >= a && p.n <= b; });
    chartTitle(x, half, "Hiring: JOLTS Hires Rate", "Monthly, hires as % of jobs - dotted line is the 2019 average", top);
    if (hr.length) {
      var hv = hr.map(function (p) { return p.v; }).concat([D.base.hire]);
      var FH = frameP(x + 34, x + half - 46, top + 48, H - 44 - 88, Math.min.apply(null, hv) - 0.15, Math.max.apply(null, hv) + 0.15, function (v) { return v.toFixed(1) + "%"; });
      var yb = FH.Y(D.base.hire);
      doc.setFillColor(253, 238, 238); doc.rect(FH.L, yb, FH.R - FH.L, Math.max(0, FH.B - yb), "F");
      dotted(FH, D.base.hire, [90, 90, 95], "2019 avg " + D.base.hire.toFixed(1) + "%");
      lineP(FH, S.rawHire, PC.hire, 2);
      var lh = hr[hr.length - 1];
      endLabels(FH, [{ y: FH.Y(lh.v), v: lh.v.toFixed(1) + "%", t: "", c: PC.hire }]);
    }
    if (vh) caption(x, half, H - 44 - 62, vh.word, PSTAT[vh.st], "",
      "Hires each month as a % of jobs (JOLTS): people starting jobs, about six weeks behind the claims data. Below the dotted 2019 line (red) pushes unemployment up. JOLTS counts everyone hired, including people switching jobs, so part of a hiring slowdown can be fewer job-switchers rather than slower re-employment of the unemployed.");
  }
  function epopChart(x, top) {
    var ve = epVerdict(b), ep = S.epop.filter(function (p) { return p.n >= a && p.n <= b; });
    chartTitle(x, half, "Prime-Age Employment Rate (25-54)", "Monthly, % employed - dashed line is the 2019 average", top);
    if (ep.length) {
      var ev = ep.map(function (p) { return p.v; }).concat([D.epopBase]);
      var FE = frameP(x + 34, x + half - 46, top + 48, H - 44 - 88, Math.min.apply(null, ev) - 0.3, Math.max.apply(null, ev) + 0.3, function (v) { return v.toFixed(1) + "%"; });
      dashed(FE, D.epopBase, [120, 120, 125], 0.8, "2019 avg");
      lineP(FE, S.epop, PTEAL, 2);
      var le = ep[ep.length - 1];
      endLabels(FE, [{ y: FE.Y(le.v), v: le.v.toFixed(1) + "%", t: "", c: PTEAL }]);
    }
    if (ve) caption(x, half, H - 44 - 62, "", PGRY, "",
      "Share of people aged 25-54 with a job: how sticky employment is. Unemployment can fall because people stop looking; this rises only when more people work.");
  }
  var LB = base1("lay", b), CB = base1("cont", b), HB = base1("hire", b), dgP = diagnosis(b), ve0 = epVerdict(b);

  // ---- 2. Flows into and out of jobs: Layoffs | Hiring ----
  doc.addPage([W, H], "landscape");
  var layW = !LB ? "" : LB.st === "up" ? "layoffs above 2019 levels" : LB.st === "down" ? "layoffs below 2019 levels" : "layoffs near 2019 levels";
  var hireW = !HB ? "" : HB.st === "up" ? "hiring below its 2019 pace" : HB.st === "down" ? "hiring above its 2019 pace" : "hiring near its 2019 pace";
  var nwL = !nwOff && S.newsF ? S.newsM.filter(function (p) { return p.n >= a && p.n <= b; }) : [];
  nwL = nwL.length ? nwL[nwL.length - 1] : null;
  top = headline("Flows: Leaving and Starting Jobs" + (nwL ? "; Layoff News " + nwL.r.toFixed(1) + "x Its 2019 Level" : ""));
  claimChart(CLAIMS[0], L1, (S.layWk || []).length && !jlOff ? "Leaving Jobs: Initial Claims and JOLTS Layoffs" : "Leaving Jobs: Initial Claims", top);
  hireChart(L2, top);
  banner(++pg);

  // ---- 3. How sticky each state is: Continuing claims | Prime-age employment ----
  doc.addPage([W, H], "landscape");
  var contW = !CB ? "" : CB.st === "up" ? "the unemployed stay on benefits longer" : CB.st === "down" ? "the unemployed find work faster than in 2019" : "job searches take about as long as in 2019";
  if (CB && CB.st !== "up" && HB && HB.st === "up") contW += ", so slower hiring looks like less job-hopping";
  var epW = !ve0 ? "" : ve0.e.v - D.epopBase >= 0.3 ? "prime-age employment still above 2019" : ve0.e.v - D.epopBase <= -0.3 ? "prime-age employment below 2019" : "prime-age employment near 2019";
  top = headline("Stickiness: Staying Unemployed, Staying Employed");
  claimChart(CLAIMS[1], L1, "Staying Unemployed: Continuing Claims", top);
  epopChart(L2, top);
  banner(++pg);

  // ---- What workers expect: losing a job | finding one (NY Fed survey) ----
  if (hasExp) {
    doc.addPage([W, H], "landscape");
    top = headline("What Workers Expect: Losing a Job and Finding One");
    var PBLU = [10, 98, 208], PORG = [214, 120, 0];
    if (hasJl) {
      var bKeep2 = b; b = b + 366; // the survey runs a year past today
      try {
        var jl = S.jloss.filter(function (p) { return p.n >= a && p.n <= b; }), ja = S.layAct.filter(function (p) { return p.n >= a && p.n <= b; });
        chartTitle(L1, half, "Job Loss: Expected vs Actual", "% - survey plotted at the month it's about; actual is layoffs over the past 12 months", top);
        var jv = jl.concat(ja).map(function (p) { return p.v; });
        if (jv.length) {
          var FJ = frameP(L1 + 34, L1 + half - 58, top + 48, H - 44 - 88, Math.max(0, Math.floor(Math.min.apply(null, jv) - 1)), Math.ceil(Math.max.apply(null, jv) + 1), function (v) { return Math.round(v) + "%"; });
          var txJ = FJ.X(LAST);
          if (txJ < FJ.R) {
            doc.setFillColor(228, 238, 252); doc.rect(txJ, FJ.T, FJ.R - txJ, FJ.B - FJ.T, "F");
            doc.setDrawColor(120, 120, 125); doc.setLineWidth(0.7); if (doc.setLineDashPattern) doc.setLineDashPattern([3, 2], 0); doc.line(txJ, FJ.T, txJ, FJ.B); if (doc.setLineDashPattern) doc.setLineDashPattern([], 0);
            font(true, 8, PBLU); doc.text("Forecast", txJ + 3, FJ.T + 9);
            font(false, 8, GRY); doc.text("Past forecasts", txJ - 3, FJ.T + 9, { align: "right" });
          }
          lineP(FJ, S.layAct, PORG, 2);
          var jpast = S.jloss.filter(function (p) { return p.n <= LAST; }), jfut = S.jloss.filter(function (p) { return p.n > LAST; });
          if (jpast.length && jfut.length) jfut = [jpast[jpast.length - 1]].concat(jfut);
          lineP(FJ, jpast, PBLU, 1.5);
          if (doc.setLineDashPattern) doc.setLineDashPattern([3, 2], 0); lineP(FJ, jfut, PBLU, 1.5); if (doc.setLineDashPattern) doc.setLineDashPattern([], 0);
          var laP = S.layAct[S.layAct.length - 1], l4 = S.jloss.slice(-4);
          if (laP) l4.forEach(function (p, k) {
            var lt = k === l4.length - 1, c3 = lt ? PBLU : [165, 192, 232];
            doc.setDrawColor(c3[0], c3[1], c3[2]); doc.setLineWidth(lt ? 1.2 : 0.8); if (doc.setLineDashPattern) doc.setLineDashPattern([1.5, 2], 0);
            doc.line(FJ.X(laP.n), FJ.Y(laP.v), FJ.X(p.n), FJ.Y(p.v)); if (doc.setLineDashPattern) doc.setLineDashPattern([], 0);
            doc.setFillColor(c3[0], c3[1], c3[2]); doc.circle(FJ.X(p.n), FJ.Y(p.v), lt ? 2.6 : 1.9, "F");
          });
          var lj = S.jloss[S.jloss.length - 1], ptags = [];
          if (laP) { doc.setFillColor(PORG[0], PORG[1], PORG[2]); doc.circle(FJ.X(laP.n), FJ.Y(laP.v), 2.4, "F"); }
          // survey months on the fan dots, newest first, where there's room
          l4.slice().reverse().forEach(function (p, k) {
            var t4 = srvMon(p.s); font(k === 0, 7, k ? [120, 150, 200] : PBLU); var tw4 = doc.getTextWidth(t4), lx4 = Math.min(FJ.R - tw4, FJ.X(p.n) - tw4 / 2), ly4 = FJ.Y(p.v) - 5;
            if (ptags.some(function (q) { return lx4 < q[0] + q[2] + 1.5 && q[0] < lx4 + tw4 + 1.5 && Math.abs(ly4 - q[1]) < 8; })) { ly4 = FJ.Y(p.v) + 10; if (ptags.some(function (q) { return lx4 < q[0] + q[2] + 1.5 && q[0] < lx4 + tw4 + 1.5 && Math.abs(ly4 - q[1]) < 8; })) return; }
            ptags.push([lx4, ly4, tw4]); doc.text(t4, lx4, ly4);
          });
          endLabels(FJ, [{ y: FJ.Y(lj.v), v: lj.v.toFixed(1) + "%", t: "exp.", c: PBLU }].concat(laP ? [{ y: FJ.Y(laP.v), v: laP.v.toFixed(1) + "%", t: "act.", c: PORG }] : []));
          var lgx = FJ.L; [[PBLU, "Expected (survey)"], [PORG, "Actual layoffs"]].forEach(function (g2) { doc.setFillColor(g2[0][0], g2[0][1], g2[0][2]); doc.rect(lgx, FJ.B + 20, 12, 2.4, "F"); font(false, 8.5, INK); doc.text(g2[1], lgx + 16, FJ.B + 23); lgx += 26 + doc.getTextWidth(g2[1]); });
          // the latest surveys, newest first
          var kx4 = FJ.L; font(false, 7.5, GRY); doc.text("Latest surveys:", kx4, FJ.B + 33); kx4 += doc.getTextWidth("Latest surveys:") + 4;
          l4.slice().reverse().forEach(function (p, k) { var t5 = srvMon(p.s) + " " + p.v.toFixed(1) + "%"; font(k === 0, 7.5, k ? [120, 150, 200] : PBLU); doc.text(t5, kx4, FJ.B + 33); kx4 += doc.getTextWidth(t5) + 7; });
          caption(L1, half, H - 44 - 44, "", PBLU, "",
            "Average chance workers give of losing their job in the next 12 months (NY Fed Survey of Consumer Expectations), plotted a year after each survey. Dotted: the forecast, " + lj.v.toFixed(1) + "% for " + rpFor(lj) + "; the last four surveys fan out from the latest actual, older three lighter. Actual: JOLTS layoffs and discharges rate summed over 12 months.");
        }
      } finally { b = bKeep2; }
    }
    if (hasJf) {
      var jf = S.jfind.filter(function (p) { return p.n >= a && p.n <= b; });
      chartTitle(L2, half, (S.findAct || []).length ? "Job Finding: Expected vs Actual" : "Job Finding: Expected", "% - chance of finding a job within 3 months if you lost yours", top);
      if (jf.length) {
        var fa = (S.findAct || []).filter(function (p) { return p.n >= a && p.n <= b; });
        var fv = jf.concat(fa).map(function (p) { return p.v; }); if (D.findMean != null) fv.push(D.findMean);
        var FF = frameP(L2 + 34, L2 + half - 58, top + 48, H - 44 - 88, Math.floor(Math.min.apply(null, fv) - 2), Math.ceil(Math.max.apply(null, fv) + 2), function (v) { return Math.round(v) + "%"; });
        if (D.findMean != null) dashed(FF, D.findMean, [120, 120, 125], 0.8, "Average since 2013 " + D.findMean.toFixed(1) + "%");
        lineP(FF, S.findAct || [], PORG, 1.6);
        lineP(FF, S.jfind, PGRN, 2);
        var lf = jf[jf.length - 1], lfa = fa[fa.length - 1];
        endLabels(FF, [{ y: FF.Y(lf.v), v: lf.v.toFixed(1) + "%", t: "exp.", c: PGRN }].concat(lfa ? [{ y: FF.Y(lfa.v), v: lfa.v.toFixed(1) + "%", t: "act.", c: PORG }] : []));
        if (fa.length) { var lgx2 = FF.L; [[PGRN, "Expected (survey)"], [PORG, "Actual job finding"]].forEach(function (g2) { doc.setFillColor(g2[0][0], g2[0][1], g2[0][2]); doc.rect(lgx2, FF.B + 20, 12, 2.4, "F"); font(false, 8.5, INK); doc.text(g2[1], lgx2 + 16, FF.B + 23); lgx2 += 26 + doc.getTextWidth(g2[1]); }); }
        caption(L2, half, H - 44 - 44, "", PGRN, "",
          "Average chance workers give of finding a job they'd accept within 3 months if they lost theirs today (NY Fed Survey of Consumer Expectations, monthly). Actual: the share of unemployed people who found work (BLS labor force flows, 3-month average) as the odds of finding a job within 3 months; it counts everyone unemployed, so it's a close match, not an exact one.");
      }
    }
    banner(++pg);
  }

  // ---- The Job Security Map: losing a job vs finding one, with a reading key ----
  if (hasW) {
    doc.addPage([W, H], "landscape");
    top = headline("Job Security Map: Losing a Job vs Finding One");
    var WP = D.worker, ws = wScale(), QL = 70, QR = W - 268, QT = top + 22, QB = H - 44 - 58;
    var wx = function (x) { return QL + (x - ws.x0) / (ws.x1 - ws.x0) * (QR - QL); }, wy = function (y) { return QB - (y - ws.y0) / (ws.y1 - ws.y0) * (QB - QT); };
    var qmx = wx(D.lossMean != null ? D.lossMean : (ws.x0 + ws.x1) / 2), qmy = wy(D.findMean != null ? D.findMean : (ws.y0 + ws.y1) / 2);
    var QT4 = [[232, 246, 236], [252, 247, 224], [230, 239, 252], [252, 233, 232]], QC4 = [[30, 140, 70], [176, 132, 0], [10, 98, 208], [200, 40, 40]];
    [[QL, QT, qmx, qmy], [qmx, QT, QR, qmy], [QL, qmy, qmx, QB], [qmx, qmy, QR, QB]].forEach(function (q, i) { doc.setFillColor(QT4[i][0], QT4[i][1], QT4[i][2]); doc.rect(q[0], q[1], q[2] - q[0], q[3] - q[1], "F"); });
    doc.setDrawColor(RULE[0], RULE[1], RULE[2]); doc.setLineWidth(0.5);
    var xst = ws.x1 - ws.x0 > 10 ? 4 : 2;
    for (var gx2 = Math.ceil(ws.x0 / xst) * xst; gx2 <= ws.x1; gx2 += xst) { doc.line(wx(gx2), QT, wx(gx2), QB); font(false, 8.5, GRY); doc.text(gx2 + "%", wx(gx2), QB + 12, { align: "center" }); }
    for (var gy2 = ws.y0; gy2 <= ws.y1; gy2 += 5) { doc.line(QL, wy(gy2), QR, wy(gy2)); font(false, 8.5, GRY); doc.text(gy2 + "%", QL - 6, wy(gy2) + 3, { align: "right" }); }
    doc.setDrawColor(130, 130, 135); doc.setLineWidth(0.7); if (doc.setLineDashPattern) doc.setLineDashPattern([3, 2.5], 0);
    doc.line(qmx, QT, qmx, QB); doc.line(QL, qmy, QR, qmy); if (doc.setLineDashPattern) doc.setLineDashPattern([], 0);
    WQ.forEach(function (q, i) { var qx = i % 2 ? QR - 5 : QL + 5, qy = i < 2 ? QT + 11 : QB - 14, al = i % 2 ? "right" : "left"; font(true, 8.5, QC4[i]); doc.text(q[1], qx, qy, { align: al }); font(false, 7.5, GRY); doc.text(q[2], qx, qy + 9, { align: al }); });
    font(true, 9, INK); doc.text("Chance of losing your job, next 12 months", QR, QB + 26, { align: "right" });
    doc.text("Chance of finding a job within 3 months", QL - 44, QT - 8);
    var PWE = [[150, 150, 155], [205, 45, 45], [0, 150, 200], [214, 128, 0]], PWW = [0.9, 0.9, 1, 1.8];
    for (var wi = 1; wi < WP.length; wi++) {
      var we = wEra(WP[wi].m);
      if (wOff["e" + we] || WP[wi].m !== monthAddP(WP[wi - 1].m, 1)) continue;
      doc.setDrawColor(PWE[we][0], PWE[we][1], PWE[we][2]); doc.setLineWidth(PWW[we]);
      doc.line(wx(WP[wi - 1].x), wy(WP[wi - 1].y), wx(WP[wi].x), wy(WP[wi].y));
    }
    var wl = WP[WP.length - 1], wlabs = [[wx(wl.x) + 7, wy(wl.y) + 11], [wx(wl.x) + 27, wy(wl.y) + 11]];
    for (var wj = 1; wj < WP.length; wj++) {
      if (WP[wj].m.slice(5, 7) !== "01" || wOff["e" + wEra(WP[wj].m)]) continue;
      var wa = WP[Math.max(0, wj - 2)], wz = WP[Math.min(WP.length - 1, wj + 2)], ddx = wx(wz.x) - wx(wa.x), ddy = wy(wz.y) - wy(wa.y), dl = Math.sqrt(ddx * ddx + ddy * ddy);
      if (dl < 3) continue;
      var vx = ddx / dl, vy = ddy / dl, ax2 = wx(WP[wj].x), ay2 = wy(WP[wj].y), cz = PWE[wEra(WP[wj].m)], sz3 = 4.2, qx3 = -vy, qy3 = vx;
      doc.setFillColor(cz[0], cz[1], cz[2]);
      doc.triangle(ax2 + vx * sz3, ay2 + vy * sz3, ax2 - vx * sz3 * 0.6 + qx3 * sz3 * 0.65, ay2 - vy * sz3 * 0.6 + qy3 * sz3 * 0.65, ax2 - vx * sz3 * 0.6 - qx3 * sz3 * 0.65, ay2 - vy * sz3 * 0.6 - qy3 * sz3 * 0.65, "F");
      var lx3 = ax2 + 5, ly3 = ay2 - 4;
      if (wlabs.some(function (q) { return Math.abs(q[0] - lx3) < 22 && Math.abs(q[1] - ly3) < 9; })) continue;
      wlabs.push([lx3, ly3]); font(false, 7.5, [100, 100, 105]); doc.text(WP[wj].m.slice(0, 4), lx3, ly3);
    }
    doc.setFillColor(28, 28, 30); doc.circle(wx(wl.x), wy(wl.y), 3.2, "F");
    font(true, 9.5, INK); doc.text(clean(fmtD(wl.m + "-15", true)), wx(wl.x) + 7, wy(wl.y) + 11);
    var elx = QL; WERAS.forEach(function (e, ei) { if (wOff["e" + ei]) return; doc.setFillColor(PWE[ei][0], PWE[ei][1], PWE[ei][2]); doc.rect(elx, QB + 32, 14, PWW[ei] + 1.5, "F"); font(ei === 3, 8.5, INK); doc.text(clean(e.name), elx + 18, QB + 35); elx += 30 + doc.getTextWidth(clean(e.name)); });
    // the reading key, at the right
    var kx = QR + 24, kw = W - 30 - kx, ky = QT - 2;
    font(true, 9.5, INK); doc.text("How to read it", kx, ky + 6);
    var gsz = 34, kty = ky + 14;
    function bez(p0, p1, p2, p3, t) { var u = 1 - t; return [u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]; }
    WPAT.forEach(function (P2, i) {
      var gx = kx, gy = kty, half2 = gsz / 2;
      [[0, 0], [half2, 0], [0, half2], [half2, half2]].forEach(function (q, qi) { doc.setFillColor(QT4[qi][0], QT4[qi][1], QT4[qi][2]); doc.rect(gx + q[0], gy + q[1], half2, half2, "F"); });
      doc.setDrawColor(200, 200, 205); doc.setLineWidth(0.5); doc.rect(gx, gy, gsz, gsz, "S");
      var pc3 = P2.c === "#30D158" ? [30, 140, 70] : P2.c === "#FF453A" ? [200, 40, 40] : P2.c === "#64A8FF" ? [10, 98, 208] : P2.c === "#64D2FF" ? [0, 140, 190] : P2.c === "#BF5AF2" ? [142, 59, 184] : [176, 132, 0];
      var gp = function (p) { return [gx + p[0] * gsz, gy + (1 - p[1]) * gsz]; }, pts3 = [];
      if (P2.gz) { var z = P2.gz.map(gp); for (var t3 = 0; t3 <= 1.001; t3 += 0.1) pts3.push(bez(z[0], z[1], z[2], z[3], t3)); for (t3 = 0.1; t3 <= 1.001; t3 += 0.1) pts3.push(bez(z[3], z[4], z[5], z[6], t3)); }
      else pts3 = P2.g.map(gp);
      doc.setDrawColor(pc3[0], pc3[1], pc3[2]); doc.setLineWidth(1.5);
      for (var q3 = 1; q3 < pts3.length; q3++) doc.line(pts3[q3 - 1][0], pts3[q3 - 1][1], pts3[q3][0], pts3[q3][1]);
      var e1 = pts3[pts3.length - 2], e2 = pts3[pts3.length - 1], hx = e2[0] - e1[0], hy = e2[1] - e1[1], hl = Math.sqrt(hx * hx + hy * hy) || 1; hx /= hl; hy /= hl;
      doc.setFillColor(pc3[0], pc3[1], pc3[2]); doc.triangle(e2[0] + hx * 2, e2[1] + hy * 2, e2[0] - hx * 3.5 - hy * 2.6, e2[1] - hy * 3.5 + hx * 2.6, e2[0] - hx * 3.5 + hy * 2.6, e2[1] - hy * 3.5 - hx * 2.6, "F");
      font(true, 8.3, pc3); doc.text(clean((i + 1) + ". " + P2.t), gx + gsz + 7, gy + 9);
      font(false, 7.8, GRY); doc.text(doc.splitTextToSize(clean(P2.m), kw - gsz - 7).slice(0, 2), gx + gsz + 7, gy + 19, { lineHeightFactor: 1.15 });
      kty += gsz + 7;
    });
    font(false, 7, [150, 150, 155]); doc.text(doc.splitTextToSize("Glyphs are schematic, not data. Dashed lines on the chart: each question's average since 2013. Colors on the chart mark eras.", kw), kx, kty + 4);
    banner(++pg);
  }

  // ---- 5. The result: the unemployment rate, on its own ----
  doc.addPage([W, H], "landscape");
  top = headline("Unemployment Rate");
  var ur = S.ur.filter(function (p) { return p.n >= a && p.n <= b; }), uext = urExt(), bU = b;
  b = b + uext; // the forecasters' path runs past today
  chartTitle(L1, W - 72, "Monthly Unemployment Rate", "Monthly, % - the line turns red in months the Sahm rule was at or above " + D.sahmTrigger.toFixed(2) + (uext ? "; dotted: forecasters' median by quarter" : ""), top);
  if (ur.length) {
    var uv = ur.map(function (p) { return p.v; });
    (S.urFc || []).forEach(function (r) { r.pts.forEach(function (p) { if (p.n >= a && p.n <= b) uv.push(p.v); }); });
    var FU = frameP(L1 + 34, W - 36 - 60, top + 48, H - 44 - 88, Math.max(0, Math.min.apply(null, uv) - 0.3), Math.max.apply(null, uv) + 0.3, function (v) { return v.toFixed(1) + "%"; });
    doc.setLineWidth(2.2); if (doc.setLineJoin) doc.setLineJoin("round");
    var pu = null;
    S.ur.forEach(function (p) {
      if (p.n < a || p.n > b) return;
      if (pu && p.n - pu.n <= 50) { var c0 = hotAt(p) ? PRED : PUR; doc.setDrawColor(c0[0], c0[1], c0[2]); doc.line(FU.X(pu.n), FU.Y(pu.v), FU.X(p.n), FU.Y(p.v)); }
      pu = p;
    });
    var lu = ur[ur.length - 1], ulabs = [{ y: FU.Y(lu.v), v: lu.v.toFixed(1) + "%", t: "", c: hotAt(lu) ? PRED : PUR }];
    if (uext) {
      var txU = FU.X(LAST);
      doc.setFillColor(228, 238, 252); doc.rect(txU, FU.T, FU.R - txU, FU.B - FU.T, "F");
      doc.setDrawColor(120, 120, 125); doc.setLineWidth(0.7); if (doc.setLineDashPattern) doc.setLineDashPattern([3, 2], 0); doc.line(txU, FU.T, txU, FU.B); if (doc.setLineDashPattern) doc.setLineDashPattern([], 0);
      font(true, 8, PUR); doc.text("Forecast", txU + 3, FU.T + 9);
      var RRp = S.urFc, ptg = [];
      RRp.forEach(function (r, k) {
        var latest = k === RRp.length - 1, pts = r.pts.slice(), c5 = latest ? [28, 28, 30] : [150, 180, 225];
        if (latest) pts = [lu].concat(pts.filter(function (p) { return p.n > lu.n; }));
        doc.setDrawColor(c5[0], c5[1], c5[2]); doc.setLineWidth(latest ? 1.6 : 1); if (doc.setLineDashPattern) doc.setLineDashPattern([3, 2], 0);
        for (var q6 = 1; q6 < pts.length; q6++) doc.line(FU.X(pts[q6 - 1].n), FU.Y(pts[q6 - 1].v), FU.X(pts[q6].n), FU.Y(pts[q6].v));
        if (doc.setLineDashPattern) doc.setLineDashPattern([], 0);
        r.pts.forEach(function (p) { if (p.n > LAST - 100) { doc.setFillColor(c5[0], c5[1], c5[2]); doc.circle(FU.X(p.n), FU.Y(p.v), latest ? 1.8 : 1.3, "F"); } });
      });
      RRp.slice().reverse().forEach(function (r, k) {
        var e = r.pts[r.pts.length - 1], t6 = r.s.split(" ")[0] + " '" + r.s.slice(-2); font(k === 0, 7, k ? [120, 150, 200] : INK);
        var tw6 = doc.getTextWidth(t6), lx6 = Math.min(FU.R - tw6, FU.X(e.n) - tw6 / 2), ly6 = FU.Y(e.v) - 5;
        if (ptg.some(function (q) { return lx6 < q[0] + q[2] + 1.5 && q[0] < lx6 + tw6 + 1.5 && Math.abs(ly6 - q[1]) < 8; })) { ly6 = FU.Y(e.v) + 10; if (ptg.some(function (q) { return lx6 < q[0] + q[2] + 1.5 && q[0] < lx6 + tw6 + 1.5 && Math.abs(ly6 - q[1]) < 8; })) return; }
        ptg.push([lx6, ly6, tw6]); doc.text(t6, lx6, ly6);
      });
      var eL = RRp[RRp.length - 1].pts[RRp[RRp.length - 1].pts.length - 1];
      ulabs.push({ y: FU.Y(eL.v), v: eL.v.toFixed(1) + "%", t: "fcst " + eL.q, c: INK });
      var kx6 = FU.L; font(false, 7.5, GRY); doc.text("Forecasters' median, by survey:", kx6, FU.B + 24); kx6 += doc.getTextWidth("Forecasters' median, by survey:") + 4;
      RRp.slice().reverse().forEach(function (r, k) { var e2 = r.pts[r.pts.length - 1], t7 = r.s + " " + e2.v.toFixed(1) + "% by " + e2.q; font(k === 0, 7.5, k ? [120, 150, 200] : INK); doc.text(t7, kx6, FU.B + 24); kx6 += doc.getTextWidth(t7) + 8; });
    }
    endLabels(FU, ulabs);
  }
  b = bU;
  if (vu) caption(L1, W - 72, H - 44 - 56, "", PUR, "",
    "BLS household survey, monthly (October 2025 has no reading: the survey wasn't run during the government shutdown). Gray columns are recessions." + (uext ? " Dotted: the Philadelphia Fed Survey of Professional Forecasters' median forecast for each quarter, the latest survey dark and the three before it light." : ""));
  banner(++pg);


  return doc;
};
if (D) window.update(D);
</script>
__SHARE__
</body>
</html>`;

// ---------- Pressures: claims per 1,000 jobs, hiring, vs 2019 ----------
// Each indicator is turned into its pressure on unemployment, in % vs its
// 2019 average: layoffs (initial claims) and re-employment (continuing claims,
// people still collecting) count above 2019 as upward pressure; hiring counts
// its shortfall vs 2019 as upward pressure. Claims are per 1,000 payroll jobs
// (so a bigger workforce doesn't read as more layoffs), as 4-week averages.
function jobsModel(d) {
  const pay = new Map((d.payems || []).map((p) => [p.m, p.v])); // thousands of jobs
  const payMonths = [...pay.keys()].sort();
  const payFor = (date) => {
    const m = date.slice(0, 7);
    if (pay.has(m)) return pay.get(m);
    const before = payMonths.filter((k) => k <= m);
    return before.length ? pay.get(before[before.length - 1]) : null;
  };
  // weekly claims per 1,000 jobs, then a 4-week average
  const per1k = (arr) => {
    const raw = (arr || []).map((p) => { const j = payFor(p.date); return j ? { d: p.date, v: p.v / j } : null; }).filter(Boolean);
    return raw.map((p, i) => {
      if (i < 3) return null;
      const w = raw.slice(i - 3, i + 1);
      return { d: p.d, v: w.reduce((s, x) => s + x.v, 0) / 4 };
    }).filter(Boolean);
  };
  const avg19 = (arr, key) => {
    const v = arr.filter((p) => (p.d || p.m).startsWith("2019")).map((p) => p.v);
    return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
  };
  const lay = per1k(d.icsa);
  const cont = per1k(d.ccsa);
  // the raw counts too, in thousands, 4-week average
  const avg4k = (arr) => (arr || []).map((p, i, A) => (i < 3 ? null : { d: p.date, v: A.slice(i - 3, i + 1).reduce((t, x) => t + x.v, 0) / 4 / 1000 })).filter(Boolean);
  const layK = avg4k(d.icsa), contK = avg4k(d.ccsa);
  const pay19 = avg19((d.payems || []), "m"), payNow = payMonths.length ? pay.get(payMonths[payMonths.length - 1]) : null;
  const jobGrowth = pay19 && payNow ? (payNow / pay19 - 1) * 100 : null;
  const hire = (d.hires || []).map((p) => ({ d: p.m + "-15", v: p.v }));
  const base = { lay: avg19(lay), cont: avg19(cont), hire: avg19(hire) };
  const r2 = (x) => Math.round(x * 100) / 100;
  const press = {
    lay: base.lay ? lay.map((p) => ({ d: p.d, v: Math.round((p.v / base.lay - 1) * 1000) / 10 })) : [],
    cont: base.cont ? cont.map((p) => ({ d: p.d, v: Math.round((p.v / base.cont - 1) * 1000) / 10 })) : [],
    hire: base.hire ? hire.map((p) => ({ d: p.d, v: Math.round((1 - p.v / base.hire) * 1000) / 10 })) : [],
  };
  const baseK = { lay: avg19(layK), cont: avg19(contK) };
  return { lay, cont, hire, base, press, r2, layK, contK, baseK, jobGrowth };
}

function jobsSummary(d, M) {
  const last = (a) => (a && a.length ? a[a.length - 1] : null);
  const back = (a, days) => {
    const l = last(a);
    if (!l) return null;
    const t = Date.parse(l.d) - days * 86400000;
    let r = null;
    for (const p of a) if (Date.parse(p.d) <= t) r = p;
    return r;
  };
  const fd = (s, monthly) => {
    const [y, m, dd] = s.split("-");
    return monthly ? `${MON[+m - 1]} ${y}` : `week of ${MON[+m - 1]} ${+dd}`;
  };
  const statusOf = (p) => (p > NEUTRAL_PCT ? "up" : p < -NEUTRAL_PCT ? "down" : "neutral");
  const items = [];
  const dir = (now, then) => (!then ? "" : now > then * 1.02 ? "rising over 3 months" : now < then * 0.98 ? "falling over 3 months" : "steady over 3 months");
  const L = last(M.lay), C = last(M.cont), Hh = last(M.hire);
  const pl = last(M.press.lay), pc = last(M.press.cont), ph = last(M.press.hire);
  if (L && pl) {
    const b = back(M.lay, 91);
    items.push({
      key: "lay", name: "Layoffs", status: statusOf(pl.v), p: pl.v,
      pctText: `${pl.v > 0 ? "+" : pl.v < 0 ? "−" : ""}${Math.abs(Math.round(pl.v))}% vs 2019`,
      reading: `Initial claims ${L.v.toFixed(2)} per 1,000 jobs (4-wk avg, ${fd(L.d)}), ${dir(L.v, b && b.v)}`,
    });
  }
  if (C && pc) {
    const b = back(M.cont, 91);
    items.push({
      key: "cont", name: "Continuing claims", status: statusOf(pc.v), p: pc.v,
      pctText: `${pc.v > 0 ? "+" : pc.v < 0 ? "−" : ""}${Math.abs(Math.round(pc.v))}% vs 2019`,
      reading: `Continuing claims ${C.v.toFixed(1)} per 1,000 jobs (people still collecting, ${fd(C.d)}), ${dir(C.v, b && b.v)}`,
    });
  }
  if (Hh && ph) {
    const b = back(M.hire, 91);
    items.push({
      key: "hire", name: "Hiring", status: statusOf(ph.v), p: ph.v,
      pctText: `${Math.abs(Math.round(ph.v))}% ${ph.v >= 0 ? "below" : "above"} 2019`,
      reading: `JOLTS hires rate ${Hh.v.toFixed(1)}% of jobs (${fd(Hh.d, true)}) vs ${M.base.hire.toFixed(1)}% in 2019, ${dir(Hh.v, b && b.v)}`,
    });
  }
  // Headline: which way the pressures lean, then the biggest one
  const ups = items.filter((i) => i.status === "up").length;
  const downs = items.filter((i) => i.status === "down").length;
  const lead = ups > downs ? "Pressures on Unemployment Tilt Upward" : downs > ups ? "Pressures Point to Falling Unemployment"
    : ups === 0 ? "Pressures on Unemployment Are Balanced" : "Mixed Pressures on Unemployment";
  const phrase = (it) => {
    const a = Math.abs(Math.round(it.p));
    if (it.key === "lay") return it.status === "neutral" ? "Layoffs Near 2019 Levels" : `Layoffs ${a}% ${it.p > 0 ? "Above" : "Below"} 2019`;
    if (it.key === "cont") return it.status === "neutral" ? "Continuing Claims Near 2019 Levels" : `Continuing Claims ${a}% ${it.p > 0 ? "Above" : "Below"} 2019`;
    return it.status === "neutral" ? "Hiring Near 2019 Pace" : `Hiring ${a}% ${it.p > 0 ? "Below" : "Above"} 2019`;
  };
  const byMag = [...items].sort((x, y) => Math.abs(y.p) - Math.abs(x.p));
  const headline = byMag.length ? `${lead}: ${phrase(byMag[0])}${byMag[1] ? `, ${phrase(byMag[1])}` : ""}` : lead;
  const top = byMag[0];
  const chartHeadline = !top ? "Pressures on Unemployment vs 2019"
    : top.status === "neutral" ? "Layoffs, Re-Employment and Hiring All Near 2019 Levels"
    : `${phrase(top)} Is the ${top.status === "up" ? "Largest Upward" : "Largest Downward"} Pressure on Unemployment`;
  // The outcome: unemployment, Sahm rule, prime-age employment
  const u = last(d.pts);
  const ya = u ? d.pts.find((p) => p.m === monthAdd(u.m, -12)) : null;
  const sahm = last(d.sahm);
  const ep = last(d.epop);
  const epBase = d.epop ? (() => { const v = d.epop.filter((p) => p.m.startsWith("2019")).map((p) => p.v); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; })() : null;
  const outcome = [];
  if (u) outcome.push([`Unemployment ${u.v.toFixed(1)}%`, `(${fmtMonth(u.m)}${ya ? `, ${u.v - ya.v >= 0 ? "+" : "−"}${Math.abs(u.v - ya.v).toFixed(1)} pts vs a year ago` : ""})`]);
  if (sahm) outcome.push([`Sahm rule ${sahm.v.toFixed(2)}`, `(recession signal at ${SAHM_TRIGGER.toFixed(2)})`]);
  if (ep && epBase) outcome.push([`Prime-age employment ${ep.v.toFixed(1)}%`, `(${ep.v - epBase >= 0 ? "+" : "−"}${Math.abs(ep.v - epBase).toFixed(1)} pts vs 2019)`]);
  const outcomeHeadline = u
    ? `Unemployment at ${u.v.toFixed(1)}%` + (sahm ? `, Sahm Rule at ${sahm.v.toFixed(2)} of the ${SAHM_TRIGGER.toFixed(2)} Recession Signal` : "") +
      (ep ? `; Prime-Age Employment ${ep.v.toFixed(1)}%` : "")
    : "Unemployment and Employment";
  return { items, headline, chartHeadline, outcome, outcomeHeadline, epBase };
}

// The NY Fed's yield-curve recession model: the probability of a recession 12
// months ahead = N(-0.5333 - 0.6330 x spread), spread = 10-year Treasury minus
// the 3-month bill (bond-equivalent), monthly averages (NY Fed's published
// coefficients, estimated on 1959-2009). Each reading is the odds for the month
// a year later, and is plotted there, as the NY Fed does; once made it never
// changes, so there are no revisions to show.
function normCdf(x) {
  // Abramowitz-Stegun 7.1.26, error under 1e-7
  const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x / 2);
  return x >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}
function recessionOdds(d) {
  const tb = new Map((d.tb3 || []).map((p) => [p.m, p.v])), out = [];
  (d.gs10 || []).forEach((p) => {
    if (!tb.has(p.m)) return;
    const disc = tb.get(p.m) / 100, bey = (100 * 365 * disc) / (360 - 91 * disc), spread = p.v - bey;
    out.push({ m: p.m, v: 100 * normCdf(-0.5333 - 0.633 * spread), s: spread });
  });
  return out;
}

function jobsPayload(d, loading) {
  const M = jobsModel(d);
  const Sm = jobsSummary(d, M);
  const from = "2000-01-01";
  const mid = (arr) => (arr || []).filter((p) => p.m >= "2000-01").map((p) => ({ d: p.m + "-15", v: p.v }));
  const dates = [
    ...M.press.lay.map((p) => p.d), ...M.press.cont.map((p) => p.d),
    ...(d.pts.length ? [d.pts[d.pts.length - 1].m + "-15"] : []),
  ].sort();
  const lastDate = dates.length ? dates[dates.length - 1] : iso(new Date());
  const round = (arr, k) => arr.map((p) => ({ d: p.d, v: Math.round(p.v * k) / k }));
  return {
    first: from,
    last: lastDate,
    defaultDays: Math.round(DEFAULT_MONTHS * 30.44),
    rec: recessionBands(d.rec || []).filter((b) => b.to >= "2000-01"),
    ur: mid(d.pts),
    sahm: mid(d.sahm),
    // plotted at the month each reading forecasts (a year after the reading)
    rprob: recessionOdds(d).map((p) => ({ d: monthAdd(p.m, 12) + "-15", v: Math.round(p.v * 10) / 10 })).filter((p) => p.d >= "2000-01"),
    epop: mid(d.epop),
    epopBase: Sm.epBase || 0,
    // NY Fed survey: the chance of losing your job in the next 12 months, plotted
    // at the month it's about (a year after the survey), and of finding one
    // within 3 months, at the survey month
    ...workersPayload(d),
    // openings vs unemployment, month by month where both exist
    bevHist: (() => {
      const hw = d.hwi || [], op = new Map((d.openings || []).map((p) => [p.m, p.v]));
      const both = hw.filter((p) => p.m >= "2001-01" && p.m <= "2014-12" && op.has(p.m));
      if (both.length < 60) return [];
      const k = both.reduce((t, p) => t + op.get(p.m), 0) / both.reduce((t, p) => t + p.v, 0);
      const ur = new Map(d.pts.map((p) => [p.m, p.v])), out = [];
      for (let y = 1951; y <= 2000; y++) {
        const ms = hw.filter((p) => +p.m.slice(0, 4) === y && ur.has(p.m));
        if (ms.length < 10) continue;
        out.push({ y, u: ms.reduce((t, p) => t + ur.get(p.m), 0) / ms.length, o: (ms.reduce((t, p) => t + p.v, 0) / ms.length) * k });
      }
      return out;
    })(),
    bev: (() => { const op = new Map((d.openings || []).map((p) => [p.m, p.v])); return d.pts.filter((p) => op.has(p.m)).map((p) => ({ m: p.m, u: p.v, o: op.get(p.m) })); })(),
    press: { lay: M.press.lay.filter((p) => p.d >= from), cont: M.press.cont.filter((p) => p.d >= from), hire: M.press.hire.filter((p) => p.d >= from) },
    raw: { lay: round(M.lay, 1000), cont: round(M.cont, 100), hire: M.hire },
    rawK: { lay: round(M.layK.filter((p) => p.d >= from), 10), cont: round(M.contK.filter((p) => p.d >= from), 1) },
    baseK: M.baseK,
    jobGrowth: M.jobGrowth,
    summary: Sm,
    base: M.base,
    neutralPct: NEUTRAL_PCT,
    sahmTrigger: SAHM_TRIGGER,
    capHi: PRESSURE_CAP_HI,
    capLo: PRESSURE_CAP_LO,
    progress: progressFor(d, loading) + (d.extrasMissing ? " Some series didn't load (" + d.extrasMissing + ")." : ""),
    note:
      "How to read this: each driver is compared with its own 2019 average (the last calm pre-pandemic year), shown as a dotted line. " +
      "Layoffs: initial unemployment insurance claims, 4-week average, in thousands. Continuing claims: people still collecting benefits, 4-week average. Above the 2019 line pushes unemployment up. " +
      "There are more jobs than in 2019, so raw claims run higher at the same layoff rate; the upward / neutral / downward call uses claims per 1,000 payroll jobs vs 2019, shown in each readout. " +
      "Hiring: the JOLTS hires rate; below its 2019 average pushes unemployment up; JOLTS runs about six weeks behind. " +
      `Within ±${NEUTRAL_PCT}% of 2019 (per job) counts as neutral. The claims charts stop at 2.5 times the 2019 level, so 2020's spike doesn't flatten everything else. ` +
      "The unemployment rate is from the BLS household survey (October 2025 has no reading: the survey wasn't run during the government shutdown). " +
      "The line turns red in months where the Sahm rule was at or above 0.50. The Sahm rule is the 3-month average unemployment rate minus its lowest 3-month average over the prior 12 months, as first reported; a reading of 0.50 or more has signaled the start of every U.S. recession since 1970. " +
      "The prime-age (25–54) employment rate is a cross-check: unemployment can fall because people stop looking, but this only rises when more people work. " +
      "Expected job loss and job finding: the NY Fed Survey of Consumer Expectations (monthly since June 2013, about 1,300 households), average answers to \u201cwhat is the chance you lose your job in the next 12 months\u201d and \u201cif you lost your job today, what is the chance you find one you'd accept within 3 months\u201d. Actual job loss: the JOLTS layoffs and discharges rate, summed over 12 months (people laid off more than once count each time, so it's a close match, not an exact one). Actual job finding: the share of the previous month's unemployed who had a job (BLS labor force flows, LNS17100000 over UNEMPLOY), 3-month average, turned into the odds of finding work within 3 months; it counts everyone unemployed, not just people who lost a job. " +
      "Forecasts: the Philadelphia Fed Survey of Professional Forecasters (quarterly, about 35 forecasters): the median unemployment-rate forecast for the survey quarter and the next four, latest round bold and the three before it dimmed; and the Anxious Index, the average chance forecasters give of real GDP falling in the quarter after the survey, with each survey's odds for the four quarters after it dotted. " +
      "Gray bands are NBER recessions. Sources: BLS, U.S. Department of Labor, via FRED (UNRATE, SAHMREALTIME, LNS12300060, JTSHIR, JTSJOR, JTSLDR, LNS17100000, UNEMPLOY, ICSA, CCSA, PAYEMS, USREC); Federal Reserve Bank of New York, Survey of Consumer Expectations; Federal Reserve Bank of Philadelphia, Survey of Professional Forecasters.",
  };
}

// The survey readings, actual layoffs over the past 12 months (JOLTS layoffs
// and discharges rate, summed), and the Job Security Map (3-month averages of both
// questions, month by month)
function workersPayload(d) {
  const sce = d.sce || {}, loss = sce.loss || [], find = sce.find || [];
  const r1 = (v) => Math.round(v * 10) / 10;
  const ldr = (d.layoffsRate || []).slice().sort((p, q) => (p.m < q.m ? -1 : 1)), act = [];
  for (let i = 11; i < ldr.length; i++) {
    if (monthAdd(ldr[i - 11].m, 11) !== ldr[i].m) continue; // a gap in the data
    let t = 0;
    for (let k = i - 11; k <= i; k++) t += ldr[k].v;
    act.push({ d: ldr[i].m + "-15", v: r1(t) });
  }
  const fm = new Map(find.map((p) => [p.m, p.v])), both = loss.filter((p) => fm.has(p.m)).map((p) => ({ m: p.m, x: p.v, y: fm.get(p.m) })), worker = [];
  for (let i = 2; i < both.length; i++) {
    if (monthAdd(both[i - 2].m, 2) !== both[i].m) continue;
    worker.push({ m: both[i].m, x: r1((both[i].x + both[i - 1].x + both[i - 2].x) / 3), y: r1((both[i].y + both[i - 1].y + both[i - 2].y) / 3) });
  }
  const avg = (a) => (a.length ? r1(a.reduce((t, p) => t + p.v, 0) / a.length) : null);
  // actual job finding: the share of last month's unemployed who had a job this
  // month (CPS labor force flows), averaged over 3 months, then as the odds of
  // finding work within 3 months: 1 - (1 - monthly rate)^3
  const un = new Map((d.unemployed || []).map((p) => [p.m, p.v])), rate = [];
  (d.ueFlow || []).forEach((p) => { const prev = un.get(monthAdd(p.m, -1)); if (prev) rate.push({ m: p.m, r: p.v / prev }); });
  const findAct = [];
  for (let i = 2; i < rate.length; i++) {
    if (monthAdd(rate[i - 2].m, 2) !== rate[i].m) continue;
    const r = (rate[i].r + rate[i - 1].r + rate[i - 2].r) / 3;
    if (rate[i].m >= "2013-01") findAct.push({ d: rate[i].m + "-15", v: r1(100 * (1 - Math.pow(1 - r, 3))) });
  }
  const probs = [sce.missing, sce.error && "the survey file didn't load: " + sce.error].filter(Boolean);
  return {
    jloss: loss.map((p) => ({ d: monthAdd(p.m, 12) + "-15", v: p.v, s: p.m })),
    jfind: find.map((p) => ({ d: p.m + "-15", v: p.v })),
    ...spfPayload(d),
    sched: d.sched || [],
    findAct,
    layWk: (d.layoffsLevel || []).map((p) => { const dim = new Date(Date.UTC(+p.m.slice(0, 4), +p.m.slice(5, 7), 0)).getUTCDate(); return { d: p.m + "-15", v: Math.round((p.v / (dim / 7)) * 10) / 10 }; }),
    layAct: act,
    worker,
    lossMean: avg(loss), findMean: avg(find),
    sceNote: probs.length ? "NY Fed survey: " + probs.join("; ") + "." : "",
    newsWk: (d.news && d.news.wk) || [], news19: (d.news && d.news.base19) || null,
    newsNote: d.news && d.news.error ? "GDELT layoff news: last check failed (" + d.news.error + ")" + (d.news.last ? ", showing data through " + d.news.last : "") + "." : "",
  };
}

// Forecasters (Philadelphia Fed SPF): the last four rounds of the unemployment
// forecast, each as points at mid-quarter for the survey quarter and the four
// after; the Anxious Index (chance GDP falls the quarter after each survey),
// plotted at the quarter it's about; and the last four surveys' odds for each
// of the four quarters after the survey
function spfPayload(d) {
  const spf = d.spf || {}, qd = (qi) => `${Math.floor(qi / 4)}-${String((qi % 4) * 3 + 2).padStart(2, "0")}-15`;
  const ql = (qi) => `Q${(qi % 4) + 1} ${Math.floor(qi / 4)}`;
  const rounds = (spf.unemp || []).slice(-4).map((r) => ({ s: ql(r.s), pts: r.f.slice(1).map((v, k) => (v == null ? null : { d: qd(r.s + k), v, q: ql(r.s + k) })).filter(Boolean) })).filter((r) => r.pts.length);
  // RECESS1 is the survey quarter, RECESS2 the quarter after (the Anxious Index),
  // RECESS3..5 the three after that
  const anx = (spf.recess || []).filter((r) => r.f[1] != null).map((r) => ({ d: qd(r.s + 1), v: r.f[1], q: ql(r.s + 1), s: ql(r.s) })).filter((p) => p.d >= "2000-01");
  const anxFc = (spf.recess || []).slice(-4).map((r) => ({ s: ql(r.s), pts: [1, 2, 3, 4].map((k) => (r.f[k] == null ? null : { d: qd(r.s + k), v: r.f[k], q: ql(r.s + k) })).filter(Boolean) })).filter((r) => r.pts.length);
  return { urFc: rounds, anx, anxFc, spfNote: spf.errors ? "Forecasters' survey: " + spf.errors.join("; ") + "." : "" };
}

// Opens straight away with whatever is stored, then runs `background`, which
// can call push(payload) any number of times to update the open view.
async function openJobs(payload, background) {
  const wv = updWV(new WebView());
  await wv.loadHTML(...updArgs(JOBS_HTML.replace("__DATA__", () => JSON.stringify(payload)).replace("__SHARE__", () => "<script>" + SHARE_PAGE_JS + "</script>")));
  await presentWithSharing(wv, async (isOpen) => {
    const push = async (p) => {
      if (!isOpen()) return;
      try {
        await wv.evaluateJavaScript(`window.update(${JSON.stringify(p)})`);
      } catch (e) {}
    };
    await background(push, isOpen);
  });
}

const AMBER = "#FF9F0A";
const BLUE = "#64A8FF";

function mixHex(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return hexOf(pa.map((v, i) => Math.round(v + (pb[i] - v) * t)));
}
// Fetch from FRED with the stored copy as a fallback, then draw or open
// clock: the source's usual release time in New York, { hh, mm }, plus
// dateOnly: true for sources without a fixed release time
async function runWidget(cacheFile, fetcher, drawImage, payloadFor, clock) {
  if (config.runsInWidget || PREVIEW_WIDGET_IN_APP) {
    let widget;
    try {
      const d = await withCache(cacheFile, fetcher);
      const next = clock && !d.stale ? nextRelease(d.release, clock.hh, clock.mm) : null;
      widget = finishClockWidget(drawImage(d, next), next, clock && clock.dateOnly);
    } catch (e) {
      widget = errorWidget(e.message || e);
    }
    if (config.runsInWidget) Script.setWidget(widget);
    else await widget.presentSmall();
  } else {
    try {
      // Open straight away with stored data, then refresh from FRED behind it
      const cached = readJson("cache", cacheFile);
      const first = cached ? { ...cached, stale: false } : await withCache(cacheFile, fetcher);
      await openJobs(payloadFor(first, !!cached), async (push) => {
        const fresh = await withCache(cacheFile, fetcher);
        await push(payloadFor(fresh, false));
      });
    } catch (e) {
      await errorWidget(e.message || e).presentSmall();
    }
  }
  Script.complete();
}
function progressFor(d, loading) {
  if (loading) return "Checking FRED for newer data…";
  return d.stale ? "FRED unreachable · showing data through " + throughLabel(d) : "";
}
// ---------- Data ----------
// Barnichon's composite help-wanted index, 1951-2014 (a proxy for job
// openings before JOLTS), hosted by the San Francisco Fed. It never changes,
// so it is downloaded once and kept.
const HWI_URL = "https://www.frbsf.org/economic-research/wp-content/uploads/sites/4/HWI_index.txt";
const HWI_FILE = "help-wanted-index-1951-2014.json";
async function helpWantedIndex() {
  const kept = readJson("docs", HWI_FILE);
  if (kept && kept.length > 100) return kept;
  try {
    const req = new Request(HWI_URL);
    req.timeoutInterval = 15;
    const txt = await req.loadString();
    const out = [];
    txt.split("\n").forEach((line) => {
      const mm = line.trim().match(/^(\d{4})M(\d{2})\s+([\d.]+)/);
      if (mm) out.push({ m: mm[1] + "-" + mm[2], v: parseFloat(mm[3]) });
    });
    if (out.length > 100) { writeJson("docs", HWI_FILE, out); return out; }
  } catch (e) {}
  return [];
}
async function fetchUnemployment() {
  const missing = [];
  const opt = (id, start) => fred(id, start).catch(() => { missing.push(id); return []; });
  const [u, sahm, rec, release, icsa, ccsa, payems, hires, epop, openings, gs10, tb3, ldr, ue, unemp, ldl] = await Promise.all([
    fred("UNRATE", "1948-01-01"),
    fred("SAHMREALTIME", "1959-01-01").catch(() => []),
    fred("USREC", "1948-01-01").catch(() => []),
    fredReleaseDates("UNRATE").catch(() => []),
    opt("ICSA", "1999-12-01"),
    opt("CCSA", "1999-12-01"),
    opt("PAYEMS", "1999-12-01"),
    opt("JTSHIR", "2000-12-01"),
    opt("LNS12300060", "1999-12-01"),
    opt("JTSJOR", "2000-12-01"),
    opt("GS10", "1998-12-01"),
    opt("TB3MS", "1998-12-01"),
    opt("JTSLDR", "2000-12-01"),
    opt("LNS17100000", "2012-01-01"),
    opt("UNEMPLOY", "2012-01-01"),
    opt("JTSLDL", "2000-12-01"),
  ]);
  if (!u.length) throw new Error("No unemployment data from FRED");
  const hwi = await helpWantedIndex();
  const sce = await sceJobs();
  const spf = await spfJobs();
  const news = await newsJobs();
  const m = (o) => ({ m: o.date.slice(0, 7), v: o.value });
  const w = (o) => ({ date: o.date, v: o.value });
  const out = {
    pts: u.map(m), sahm: sahm.map(m), rec: rec.map(m), release, gs10: gs10.map(m), tb3: tb3.map(m),
    icsa: icsa.map(w), ccsa: ccsa.map(w), payems: payems.map(m), hires: hires.map(m), epop: epop.map(m), openings: openings.map(m), hwi,
    layoffsRate: ldr.map(m), layoffsLevel: ldl.map(m), ueFlow: ue.map(m), unemployed: unemp.map(m), sce, spf, news,
    extrasMissing: missing.join(", ") || null,
  };
  try { out.sched = await jobsSchedule(out); } catch (e) {}
  return out;
}

// ---------- Layoffs in the news (GDELT) ----------
// The GDELT Project's DOC 2.0 API: each day's share of US English-language news
// articles (in GDELT's monitored sources) that mention "layoff" or "layoffs"
// ("Volume Intensity", % of all articles that day), from January 2017, the
// earliest it searches. Turned into 13-week averages ending each Saturday (news
// comes in bursts, so a shorter window is mostly noise), plus the 2019 average. One download,
// at most twice a day, in the app only; the widget keeps the last copy.
const NEWS_FILE = "gdelt-layoff-news.json";
const NEWS_CHECK_HOURS = 12;
const NEWS_URL = (end) => `https://api.gdeltproject.org/api/v2/doc/doc?query=(layoff%20OR%20layoffs)%20sourcecountry:US%20sourcelang:english&mode=timelinevol&format=json&startdatetime=20170101000000&enddatetime=${end}000000&timelinesmooth=0`;
function newsWeeks(days) {
  const byDay = new Map(days.map((p) => [p.d, p.v])), out = [];
  const iso = (t) => new Date(t).toISOString().slice(0, 10);
  if (!days.length) return out;
  let t = Date.parse(days[0].d + "T12:00:00Z") + 90 * 864e5;
  while (new Date(t).getUTCDay() !== 6) t += 864e5;
  const end = Date.parse(days[days.length - 1].d + "T12:00:00Z");
  for (; t <= end; t += 7 * 864e5) {
    let sum = 0, n = 0;
    for (let k = 0; k < 91; k++) { const v = byDay.get(iso(t - k * 864e5)); if (v != null) { sum += v; n++; } }
    if (n >= 65) out.push({ d: iso(t), v: Math.round((sum / n) * 10000) / 10000 });
  }
  return out;
}
async function newsJobs() {
  const kept = readJson("docs", NEWS_FILE);
  if (config.runsInWidget) return kept;
  if (kept && kept.v === 2 && kept.checked && !kept.error && (Date.now() - new Date(kept.checked).getTime()) / 3600000 < NEWS_CHECK_HOURS) return kept;
  try {
    // through yesterday: today's articles are still coming in
    const r = new Request(NEWS_URL(new Date().toISOString().slice(0, 10).split("-").join("")));
    r.timeoutInterval = 30; r.headers = { "User-Agent": SCE_UA };
    const txt = await r.loadString(), status = r.response && r.response.statusCode;
    if (status && status >= 400) throw new Error(`GDELT answered HTTP ${status}`);
    // a busy GDELT answers in plain text ("Please limit requests to one every 5 seconds...")
    if (!txt || txt.trim()[0] !== "{") throw new Error(`GDELT said: ${String(txt || "nothing").trim().slice(0, 100)}`);
    const j = JSON.parse(txt), line = j.timeline && j.timeline[0], data = line && line.data;
    if (!data || data.length < 100) throw new Error("GDELT's answer had no timeline");
    const days = data.map((p) => ({ d: `${p.date.slice(0, 4)}-${p.date.slice(4, 6)}-${p.date.slice(6, 8)}`, v: +p.value })).filter((p) => isFinite(p.v));
    const y19 = days.filter((p) => p.d.startsWith("2019"));
    const out = { v: 2, checked: new Date().toISOString(), wk: newsWeeks(days), base19: y19.length ? y19.reduce((t, p) => t + p.v, 0) / y19.length : null, last: days[days.length - 1].d };
    writeJson("docs", NEWS_FILE, out);
    return out;
  } catch (e) {
    return kept ? { ...kept, checked: new Date().toISOString(), error: e.message || String(e) } : { wk: [], error: e.message || String(e), checked: new Date().toISOString() };
  }
}

// ---------- NY Fed Survey of Consumer Expectations: losing and finding a job ----------
// A monthly survey of about 1,300 households (since June 2013). Two questions:
// the chance of losing your job in the next 12 months, and, if you lost it
// today, the chance of finding one you'd accept within 3 months (means, %).
// The spreadsheet is unzipped and read in a hidden web page, which a home-
// screen widget can't do, so the widget keeps the last copy. The columns are
// found by their headings and sensible ranges, so small layout changes in the
// file don't break it.
const SCE_DATA_URL = "https://www.newyorkfed.org/medialibrary/interactives/sce/sce/downloads/data/frbny-sce-data.xlsx";
const SCE_FILE = "nyfed-sce-jobs.json";
const SCE_CHECK_HOURS = 24;
const SCE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
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
  r.headers = { "User-Agent": SCE_UA };
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
// "201306", "2013-06-01", "6/1/2013" or an Excel date number -> "2013-06"
function sceMonth(v) {
  const s = String(v).trim();
  let m = s.match(/^(\d{4})(\d{2})$/);
  if (m && +m[2] >= 1 && +m[2] <= 12) return `${m[1]}-${m[2]}`;
  m = s.match(/^(\d{4})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}`;
  m = s.match(/^(\d{1,2})\/\d{1,2}\/(\d{4})$/);
  if (m) return `${m[2]}-${String(m[1]).padStart(2, "0")}`;
  if (/^\d{5}(\.\d+)?$/.test(s)) { const n = parseFloat(s); if (n > 36000 && n < 60000) return new Date(Date.UTC(1899, 11, 30) + n * 86400000).toISOString().slice(0, 7); }
  return null;
}
// Find one survey question's monthly series anywhere in the workbook: a column
// next to a date column, whose heading (or sheet) names the question, prefers
// the mean, avoids demographic splits, and whose values sit in a sensible range.
function sceFind(sheets, want, range) {
  let best = null;
  Object.keys(sheets).forEach((name) => {
    const rows = sheets[name];
    if (!rows || rows.length < 24) return;
    const cols = {};
    rows.forEach((r) => Object.keys(r).forEach((c) => (cols[c] = 1)));
    // the date column: the one with the most month-like cells
    let dc = null, dn = 0;
    Object.keys(cols).forEach((c) => { const n = rows.filter((r) => r[c] != null && sceMonth(r[c])).length; if (n > dn) { dn = n; dc = c; } });
    if (!dc || dn < 24) return;
    const first = rows.findIndex((r) => r[dc] != null && sceMonth(r[dc]));
    const title = (name + " " + rows.slice(0, first).map((r) => Object.values(r).join(" ")).join(" ")).slice(0, 2000);
    Object.keys(cols).forEach((c) => {
      if (c === dc) return;
      const head = rows.slice(0, first).map((r) => r[c] || "").join(" ").trim();
      const pts = [];
      rows.forEach((r) => { const mo = r[dc] != null ? sceMonth(r[dc]) : null, v = parseFloat(r[c]); if (mo && isFinite(v)) pts.push({ m: mo, v }); });
      if (pts.length < 24) return;
      const scale = Math.max(...pts.map((p) => p.v)) <= 1 ? 100 : 1;
      pts.forEach((p) => (p.v = Math.round(p.v * scale * 100) / 100));
      const vs = pts.map((p) => p.v).sort((a, b) => a - b), med = vs[Math.floor(vs.length / 2)];
      if (med < range[0] || med > range[1]) return;
      let score = want.test(head) ? 6 : want.test(title) ? 3 : 0;
      if (!score) return;
      if (/mean|average/i.test(head)) score += 3; else if (/median/i.test(head)) score += 1;
      if (/under|over|age|income|educ|region|male|female|numeracy|<|>|\$|\d{2}\s*-\s*\d{2}|percentile|25th|75th|iqr|uncertain/i.test(head)) score -= 4;
      if (!best || score > best.score || (score === best.score && pts.length > best.pts.length)) best = { score, pts: pts.sort((a, b) => (a.m < b.m ? -1 : 1)), where: `${name} · ${head || c}` };
    });
  });
  return best;
}
async function sceJobs() {
  const kept = readJson("docs", SCE_FILE);
  if (config.runsInWidget) return kept; // no hidden web pages in a widget
  if (kept && kept.checked && (Date.now() - new Date(kept.checked).getTime()) / 3600000 < SCE_CHECK_HOURS) return kept;
  try {
    const sheets = await readXlsx(SCE_DATA_URL);
    if (!sheets) throw new Error("the survey spreadsheet wasn't at its usual address");
    const loss = sceFind(sheets, /los(e|ing)\s+(your|their|a|the|my)?\s*(main\s+)?job|job\s*(loss|separation)|separation/i, [5, 35]);
    const find = sceFind(sheets, /find(ing)?\s+(a|another|new)?\s*job|job\s*finding/i, [25, 75]);
    const out = { checked: new Date().toISOString(), loss: loss ? loss.pts : (kept && kept.loss) || [], find: find ? find.pts : (kept && kept.find) || [], where: { loss: loss && loss.where, find: find && find.where } };
    if (!loss || !find) out.missing = `couldn't find the ${!loss && !find ? "job-loss and job-finding" : !loss ? "job-loss" : "job-finding"} column (sheets: ${Object.keys(sheets).slice(0, 40).join(", ")})`;
    writeJson("docs", SCE_FILE, out);
    return out;
  } catch (e) {
    return kept ? { ...kept, error: e.message || String(e) } : { loss: [], find: [], error: e.message || String(e) };
  }
}

// ---------- Philadelphia Fed Survey of Professional Forecasters ----------
// Quarterly survey of about 35 private forecasters (out mid-February, May,
// August and November). Used here: the median unemployment-rate forecast for
// the survey quarter and the next four (UNEMP2..UNEMP6), and the mean chance of
// real GDP falling in the quarter after the survey (RECESS2, the Philadelphia
// Fed's "Anxious Index"). Each variable's spreadsheet link is read from its page
// (the address carries a version stamp), falling back to the plain address.
const SPF_FILE = "philly-spf-jobs.json";
function spfPage(v) { return `https://www.philadelphiafed.org/surveys-and-data/${v.toLowerCase()}`; }
function spfPlain(kind, v) { return `https://www.philadelphiafed.org/-/media/FRBP/Assets/Surveys-And-Data/survey-of-professional-forecasters/data-files/files/${kind}_${v}_Level.xlsx`; }
async function spfUrl(kind, v) {
  try {
    const r = new Request(spfPage(v));
    r.timeoutInterval = 20; r.headers = { "User-Agent": SCE_UA };
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
async function spfJobs() {
  const kept = readJson("docs", SPF_FILE);
  if (config.runsInWidget) return kept;
  // quarterly: look daily during a survey month, weekly otherwise
  const mo = new Date().getMonth(), survMonth = mo % 3 === 1, hrs = kept && kept.checked ? (Date.now() - new Date(kept.checked).getTime()) / 3600000 : Infinity;
  if (kept && hrs < (survMonth ? 24 : 24 * 7)) return kept;
  const out = { checked: new Date().toISOString(), unemp: (kept && kept.unemp) || [], recess: (kept && kept.recess) || [], errors: [] };
  for (const [key, kind, v, range] of [["unemp", "Median", "UNEMP", [1, 30]], ["recess", "Mean", "RECESS", [0, 100]]]) {
    try {
      const sheets = await readXlsx(await spfUrl(kind, v)) || await readXlsx(spfPlain(kind, v));
      if (!sheets) throw new Error("the spreadsheet wasn't at its usual address");
      const rounds = parseSpf(sheets, v, range);
      if (rounds.length < 8) throw new Error(`couldn't find the ${v} columns (sheets: ${Object.keys(sheets).join(", ")})`);
      out[key] = rounds.filter((r) => r.s >= 1998 * 4);
    } catch (e) { out.errors.push(`${v}: ${e.message || e}`); }
  }
  if (!out.errors.length) delete out.errors;
  writeJson("docs", SPF_FILE, out);
  return out;
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
function schedSpfNext(lastQi) { const q = lastQi + 1, y = Math.floor(q / 4), m0 = (q % 4) * 3 + 1; return schedDay(y, m0, 13); }
function schedPlus(ds, n) { const d = new Date(ds + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return schedIso(d); }


// This widget's sources, next update first
async function jobsSchedule(x) {
  const lastOf = (arr, k) => (arr && arr.length ? arr[arr.length - 1][k || "m"] : null);
  const mAdd = (m, n) => { const [y, mo] = m.split("-").map(Number), t = y * 12 + mo - 1 + n; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`; };
  const rows = await Promise.all([
    schedFredRow({ name: "Jobs report: unemployment, payrolls", last: schedMonName(lastOf(x.pts)), series: "UNRATE", at: [8, 30], every: "BLS, monthly" }, FRED_KEY),
    schedFredRow({ name: "Jobless claims", last: "wk of " + schedDateName(lastOf(x.icsa, "date")), series: "ICSA", at: [8, 30], every: "Labor Dept., weekly" }, FRED_KEY),
    schedFredRow({ name: "JOLTS: hiring, openings, layoffs", last: schedMonName(lastOf(x.hires)), series: "JTSHIR", at: [10, 0], every: "BLS, monthly" }, FRED_KEY),
  ]);
  const g = lastOf(x.gs10);
  if (g) { const nm = mAdd(g, 2); rows.push(schedEst("Treasury yields (recession odds)", schedMonName(g), schedIso(schedNextBizFrom(nm + "-01")), "Fed H.15, monthly average")); }
  const sl = x.sce && x.sce.loss && x.sce.loss.length ? x.sce.loss[x.sce.loss.length - 1].m : null;
  if (sl) { const t = mAdd(sl, 2), d0 = schedNth(+t.slice(0, 4), +t.slice(5, 7) - 1, 1, 2); rows.push(schedEst("NY Fed survey: job loss, job finding", schedMonName(sl), [d0, schedPlus(d0, 4)], "monthly, usually the 2nd Monday", { checked: x.sce && x.sce.checked, err: x.sce && (x.sce.error || x.sce.missing), cadence: "checks daily" })); }
  const sp = x.spf && x.spf.unemp && x.spf.unemp.length ? x.spf.unemp[x.spf.unemp.length - 1].s : null;
  if (sp != null) { const d0 = schedSpfNext(sp); rows.push(schedEst("Pro forecasters (Philadelphia Fed)", schedQName(sp) + " survey", [d0, schedPlus(d0, 6)], "quarterly, mid Feb/May/Aug/Nov", { checked: x.spf && x.spf.checked, err: x.spf && x.spf.errors && x.spf.errors.join("; "), cadence: "checks daily in survey months" })); }
  const nw = x.news;
  if (nw && nw.last) rows.push(schedEst("Layoffs in the news", schedDateName(nw.last), [schedPlus(nw.last, 2), schedPlus(nw.last, 3)], "GDELT, daily", { checked: nw.checked, err: nw.error }));
  return rows;
}
// the first weekday on or after a date
function schedNextBizFrom(ds) { const d = new Date(ds + "T12:00:00Z"); while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1); return d; }

// ---------- Widget: the rate, its change, four years, the Sahm reading ----------
// The face: a mini Beveridge curve (openings vs unemployment since Dec 2000),
// colored by era like the full screen; falls back to the unemployment line
// if the openings data isn't there.
const FACE_ERAS = [["2000-12", "2007-12", "#8E8E93", 0.55, 1], ["2008-01", "2019-12", "#64A8FF", 0.6, 1], ["2020-01", "2021-12", "#FF9F0A", 0.55, 1], ["2022-01", "2099-12", "#30D5C8", 1, 1.8]];
function unemploymentImage(d, next) {
  const op = new Map((d.openings || []).map((p) => [p.m, p.v]));
  const B = d.pts.filter((p) => op.has(p.m)).map((p) => ({ m: p.m, u: p.v, o: op.get(p.m) }));
  if (B.length > 24) return beveridgeImage(d, next, B);
  return unemploymentLineImage(d, next);
}
function beveridgeImage(d, next, B) {
  const ctx = newCanvas(170, 170);
  const last = B[B.length - 1];
  drawText(ctx, "Jobs", new Rect(14, 10, 86, 18), Font.boldSystemFont(14), "#FFFFFF", "left");
  drawText(ctx, `Beveridge curve · ${fmtMonth(last.m)}`, new Rect(14, 27, 130, 13), Font.mediumSystemFont(9.5), GRAY, "left");
  headerClock(ctx, d.stale, next);
  const UMAX = 10.5, box = { x: 16, y: 46, w: 140, h: 88 };
  const us = B.map((p) => Math.min(p.u, UMAX)), os = B.map((p) => p.o);
  const u0 = Math.min(...us) - 0.3, u1 = UMAX, o0 = Math.min(...os) - 0.3, o1 = Math.max(...os) + 0.3;
  const X = (u) => box.x + ((Math.min(u, u1) - u0) / (u1 - u0)) * box.w, Y = (o) => box.y + box.h - ((o - o0) / (o1 - o0)) * box.h;
  // faint frame
  ctx.setFillColor(new Color("#3A3A3C")); ctx.fillRect(new Rect(box.x, box.y + box.h, box.w, 0.8)); ctx.fillRect(new Rect(box.x, box.y, 0.8, box.h));
  const eraOf = (m) => FACE_ERAS.findIndex((e) => m >= e[0] && m <= e[1]);
  for (let i = 1; i < B.length; i++) {
    const e = FACE_ERAS[Math.max(0, eraOf(B[i].m))];
    const seg = new Path();
    seg.move(new Point(X(B[i - 1].u), Y(B[i - 1].o)));
    seg.addLine(new Point(X(B[i].u), Y(B[i].o)));
    ctx.addPath(seg);
    ctx.setStrokeColor(new Color(e[2], e[3]));
    ctx.setLineWidth(e[4]);
    ctx.strokePath();
  }
  ctx.setFillColor(new Color("#FFFFFF"));
  ctx.fillEllipse(new Rect(X(last.u) - 3, Y(last.o) - 3, 6, 6));
  drawText(ctx, "unemp. →", new Rect(box.x + box.w - 60, box.y + box.h + 1, 60, 11), Font.systemFont(8), GRAY, "right");
  drawText(ctx, `Unemp. ${last.u.toFixed(1)}%`, new Rect(14, 145, 72, 13), Font.semiboldSystemFont(9.5), "#FFFFFF", "left");
  drawText(ctx, `Openings ${last.o.toFixed(1)}%`, new Rect(80, 145, 76, 13), Font.semiboldSystemFont(9.5), "#30D5C8", "right");
  return ctx.getImage();
}
function unemploymentLineImage(d, next) {
  const ctx = newCanvas(170, 170);
  const last = d.pts[d.pts.length - 1];
  const ya = d.pts.find((p) => p.m === monthAdd(last.m, -12));
  const sahm = d.sahm && d.sahm.length ? d.sahm[d.sahm.length - 1] : null;
  drawText(ctx, "Jobs", new Rect(14, 10, 86, 18), Font.boldSystemFont(14), "#FFFFFF", "left");
  drawText(ctx, "Unemployment rate", new Rect(14, 27, 120, 13), Font.mediumSystemFont(9.5), GRAY, "left");
  headerClock(ctx, d.stale, next);

  drawText(ctx, `${last.v.toFixed(1)}%`, new Rect(14, 40, 120, 30), Font.semiboldSystemFont(26), "#FFFFFF", "left");
  let sub = fmtMonth(last.m);
  let subHex = GRAY;
  if (ya) {
    const ch = last.v - ya.v;
    const s = Math.abs(ch).toFixed(1);
    sub += ` · ${parseFloat(s) === 0 ? "" : ch > 0 ? "+" : "−"}${s} vs yr ago`;
    subHex = parseFloat(s) === 0 ? GRAY : ch > 0 ? RED : GREEN; // rising unemployment is red
  }
  drawText(ctx, sub, new Rect(14, 69, 150, 14), Font.semiboldSystemFont(10.5), subHex, "left");

  // Four years of history
  const pts = d.pts.slice(-WIDGET_MONTHS);
  const box = { x: 14, y: 90, w: 142, h: 44 };
  const vals = pts.map((p) => p.v);
  const hi = Math.max(...vals) + 0.15;
  const lo = Math.max(0, Math.min(...vals) - 0.15);
  const X = (i) => box.x + (i / (pts.length - 1)) * box.w;
  const Y = (v) => box.y + box.h - ((v - lo) / (hi - lo)) * box.h;
  // blue, turning red in months the Sahm rule was at or above its trigger
  const sahmAt = new Map((d.sahm || []).map((p) => [p.m, p.v]));
  const hot = (p) => (sahmAt.get(p.m) || 0) >= SAHM_TRIGGER;
  ctx.setLineWidth(1.6);
  for (let i = 1; i < pts.length; i++) {
    const seg = new Path();
    seg.move(new Point(X(i - 1), Y(pts[i - 1].v)));
    seg.addLine(new Point(X(i), Y(pts[i].v)));
    ctx.addPath(seg);
    ctx.setStrokeColor(new Color(hot(pts[i]) ? RED : BLUE));
    ctx.strokePath();
  }
  ctx.setFillColor(new Color("#FFFFFF"));
  ctx.fillEllipse(new Rect(X(pts.length - 1) - 2.5, Y(last.v) - 2.5, 5, 5));
  drawText(ctx, `Low ${Math.min(...vals).toFixed(1)}`, new Rect(14, 138, 70, 13), Font.systemFont(9.5), GRAY, "left");

  // Sahm rule reading against its trigger
  if (sahm) {
    const hex = sahm.v >= SAHM_TRIGGER ? RED : sahm.v >= SAHM_TRIGGER * 0.6 ? AMBER : GRAY;
    drawText(ctx, `Sahm ${sahm.v.toFixed(2)} / ${SAHM_TRIGGER.toFixed(2)}`, new Rect(70, 138, 86, 13), Font.semiboldSystemFont(9.5), hex, "right");
  }
  return ctx.getImage();
}

// ---------- Full screen ----------
function recessionBands(rec) {
  const bands = [];
  let cur = null;
  for (const p of rec) {
    if (p.v >= 1) {
      if (!cur) cur = { from: p.m, to: p.m };
      else cur.to = p.m;
    } else if (cur) {
      bands.push(cur);
      cur = null;
    }
  }
  if (cur) bands.push(cur);
  return bands;
}
// The BLS releases the jobs report at 8:30 am New York time
await runWidget(CACHE_FILE, fetchUnemployment, unemploymentImage, jobsPayload, { hh: 8, mm: 30 });
// Update test, Nov 17, 2026 (no change in behavior)
