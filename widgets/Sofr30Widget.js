
// ---- Shared settings (saved on this phone by the Setup script) ----
// Keys and personal settings live in the phone's keychain, not in this file,
// so the file can be shared as is.
function setting(key, fallback) {
  try { if (Keychain.contains(key)) { const v = Keychain.get(key); if (v) return v; } } catch (e) {}
  return fallback;
}

// SOFR 30-Day Average Widget for Scriptable (small widget, Stocks-style)
// 30-day average SOFR from the New York Fed via FRED (SOFR30DAYAVG, daily,
// percent; FRED posts each business day's value early that morning). It's the
// usual index for adjustable-rate mortgages.
// Colors are inverted from Stocks on purpose: falling = green (cheaper ARMs
// and funding), rising = red. Daily data, so no release countdown.
// Tap the widget for the full-screen chart: range buttons, pinch zoom,
// moving averages, and Share.

// ---- Update check (once a day; one shared request for all the Housing Widgets) ----
// When GitHub has a newer version of this widget: a thin yellow glow around the
// widget face, and an "Update ready" card in the full view with a Run Installer button.
const UPD_REPO = "r6mjz5hk4v-glitch/housing-widgets";
const UPD_CACHE = "housing-widgets-update-v2.json"; // v2: fingerprints from the title line down
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
const MIN_AXIS_SPAN_BPS = 25;

// Shown in the header, Stocks-style. Keep the ticker short.
const TICKER = "SOFR 30D";
const NAME = "30-day avg SOFR";
const CACHE_FILE = "sofr30-v1.json";

// Apple's system green and red for dark backgrounds
const GREEN = "#30D158";
const RED = "#FF453A";
const GRAY = "#98989F";
const REFRESH_HOURS = 6;
// FRED posts the 30-day average SOFR about 7:02 am Central each business day, dated that day.
const POST = { clock: [7, 2], refresh: [7, 15], retryUntil: 12, lagDays: 0 };
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
    const s = await fred("SOFR30DAYAVG", daysAgo(DETAIL_DAYS_BACK));
    const pts = s.map((o) => ({ date: o.date, v: o.value })); // percent
    if (!pts.length) throw new Error("No SOFR data from FRED");
    return { pts };
  });
}

function widgetSpec(d) {
  const pts = recent(d.pts);
  const first = pts[0];
  const last = pts[pts.length - 1];
  const bps = (last.v - first.v) * 100; // change over the window, in bps
  const up = Math.round(bps) > 0;
  return {
    pts,
    hex: up ? RED : GREEN, // rising = red, falling/flat = green
    triangleUp: up,
    topRight: signedWhole(bps),
    name: NAME,
    staleTag: d.stale ? (CLOCK_BY_VALUE ? "cached" : `cached · ${throughLabel(d, true)}`) : null,
    staleDate: d.stale ? throughLabel(d, true) : null,
    rightSub: "bps",
    value: `${last.v.toFixed(2)}%`,
    clock: postClock(d),
  };
}

function detailPayload(d) {
  return {
    ticker: TICKER,
    name: "30-Day Average SOFR",
    unit: "%",
    dec: 2,
    chg: { scale: 100, dec: 0, unit: "bps" },
    upIsGood: false,
    zoom: true, // pinch to zoom, two-finger drag to pan, double-tap to reset
    minSpan: MIN_AXIS_SPAN_BPS / 100,
    legs: [],
    pts: d.pts,
    note:
      "The 30-day average SOFR: the compounded average of the Secured Overnight Financing Rate " +
      "over a rolling 30 days, published by the New York Fed. It's the usual index for " +
      "adjustable-rate mortgages. Changes are shown in basis points. Tap an average in the legend " +
      "to hide or show it. Pinch the chart to zoom in time, drag with two fingers to pan, and " +
      "double-tap to go back to the last range button. Source: FRED." +
      (d.stale ? " Showing cached data; the last fetch failed." : ""),
  };
}

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
  <div id="staleNote" style="display:none;color:#FF9F0A;font-size:13px;font-weight:600;margin-top:6px"></div>
  <div class="valrow">
    <span class="value" id="value"></span><span class="unit" id="unit"></span>
    <span class="change" id="change"></span>
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

  <div class="seg" id="viewSeg" style="display:none; margin-top:-4px">
    <button data-v="change" class="on">Change</button>
    <button data-v="levels">Levels</button>
  </div>

  <div class="legend" id="legend"></div>

  <div id="chartWrap">
    <svg id="chart" xmlns="http://www.w3.org/2000/svg"></svg>
    <div id="touch"></div>
  </div>

  <div class="stats" id="stats"></div>

  <div id="mix" style="display:none">
    <div class="h2">Market mix</div>
    <div class="bar" id="mixBar"></div>
    <div id="mixRows"></div>
    <div class="note" id="mixNote"></div>
  </div>

  <div class="note" id="note"></div>

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
// Band mode has two views of the rates on the left axis:
//   "change": both rates as bps change since the start of the range, so the
//             gap that opens between them is the change in the spread
//   "levels": the actual rate levels, in percent
var bandView = BAND && BAND.view ? BAND.view : "change"; // the payload picks the opening view
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
  el("change").textContent = fmtC(delta);
  el("change").style.color = colorFor(delta);
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
  el("sChg").textContent = fmtC(delta);
  el("sChg").style.color = color;

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

// Band mode: a taller chart, and the Change / Levels switch
if (BAND) {
  svg.style.height = "380px";
  el("viewSeg").style.display = "flex";
  var vbtns = document.querySelectorAll("#viewSeg button");
  for (var vb = 0; vb < vbtns.length; vb++) {
    vbtns[vb].className = vbtns[vb].getAttribute("data-v") === bandView ? "on" : "";
    vbtns[vb].addEventListener("click", function () {
      bandView = this.getAttribute("data-v");
      for (var z = 0; z < vbtns.length; z++) {
        vbtns[z].className = vbtns[z] === this ? "on" : "";
      }
      render();
      header(null);
    });
  }
}

// Stats grid: four range stats, then one row per rate behind the number
(function () {
  var rows = [["High", "sHigh"], ["Low", "sLow"], ["Average", "sAvg"], ["Change", "sChg"]];
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

el("ticker").textContent = D.ticker;
el("name").textContent = D.name;
if (D.staleNote) { el("staleNote").textContent = D.staleNote; el("staleNote").style.display = ""; }
el("unit").textContent = D.unit;
el("note").textContent = D.note;
select("3M");
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

async function presentDetail(payload) {
  // A script can supply its own PDF layout (PRINT_PAGE_JS); others use the general one
  const print = typeof PRINT_PAGE_JS !== "undefined" ? PRINT_PAGE_JS : "";
  const html = DETAIL_HTML.replace("__DATA__", () => JSON.stringify(payload))
    .replace("__PRINT__", () => print)
    .replace("__SHARE__", () => SHARE_PAGE_JS);
  const wv = updWV(new WebView());
  await wv.loadHTML(...updArgs(html));
  await presentWithSharing(wv, async () => {});
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
    const data = await getData();
    const payload = detailPayload(data);
    if (data.stale) payload.staleNote = "FRED unreachable · showing data through " + throughLabel(data);
    await presentDetail(payload);
  } catch (e) {
    await errorWidget(e.message || e).presentSmall();
  }
}
Script.complete();
