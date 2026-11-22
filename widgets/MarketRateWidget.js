
// ---- Shared settings (saved on this phone by the Setup script) ----
// Keys and personal settings live in the phone's keychain, not in this file,
// so the file can be shared as is.
function setting(key, fallback) {
  try { if (Keychain.contains(key)) { const v = Keychain.get(key); if (v) return v; } } catch (e) {}
  return fallback;
}

// WAC Widget for Scriptable (small widget, Stocks-style): market weighted average rate
// Weighted average of Optimal Blue 30Y note rates by product
// (FRED: OBMMIC30YF, OBMMIFHA30YF, OBMMIVA30YF, OBMMIUSDA30YF, daily),
// weighted by the product mix in the MBA Weekly Applications Survey press release.
// The mix is scraped from mba.org. That is fragile by nature: if MBA changes its
// site or wording, the script falls back to the last mix that worked, then to
// DEFAULT_MIX below. The detail view always says which one it is using.
// Tap the widget for the full-screen chart with a rate line per product (tap any
// legend entry, the weighted average included, to hide or show it), two spread
// charts under it (GNMA vs UMBS, Jumbo vs Conv, in bps) and the mix breakdown.
// Below them, "Where rates are headed": Freddie Mac's 30-year rate (FRED
// MORTGAGE30US, weekly), MBA's latest quarterly forecast of it (read from MBA's
// monthly Mortgage Finance Forecast PDF), and what consumers expect (NY Fed
// Survey of Consumer Expectations, Housing Survey medians).
// Share as PDF: 16:9 slides: the rates chart, both spreads side by side, then
// the forecast chart.

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

// ---------- FRED: ask only when needed (shared by every FRED widget) ----------
// All widgets share one FRED key and FRED allows 120 requests a minute, so:
// - every answer is saved in one cache all widgets share (Documents/fred-cache);
// - a series is asked again only after its next scheduled release (FRED's own release
//   calendar, re-read weekly); if the new number isn't in yet, at most every 3 hours;
//   daily and month-to-date series at most hourly; anything at least weekly;
// - a shared log keeps everyone under 90 requests a minute; on "429 Too Many Requests"
//   the app waits and tries again, the home-screen widget keeps the saved answer;
// - FRED_FORCE (the Fix panel's Retry now) skips the cache.
// tools/fred_gate.js is the master copy; tools/sync_fred_gate.py puts it in each widget.
let FRED_FORCE = false;
const FRED_DIR = "fred-cache";
function fredFm() { const fm = FileManager.local(), d = fm.joinPath(fm.documentsDirectory(), FRED_DIR); try { if (!fm.fileExists(d)) fm.createDirectory(d, true); } catch (e) {} return { fm, d }; }
function fredRead(name) { try { const { fm, d } = fredFm(), p = fm.joinPath(d, name); return fm.fileExists(p) ? JSON.parse(fm.readString(p)) : null; } catch (e) { return null; } }
function fredWrite(name, o) { try { const { fm, d } = fredFm(); fm.writeString(fm.joinPath(d, name), JSON.stringify(o)); } catch (e) {} }
function fredKeyOf(url) {
  const q = url.replace(/[?&]api_key=[^&]*/, "").replace("https://api.stlouisfed.org/fred/", "");
  let h = 2166136261;
  for (let i = 0; i < q.length; i++) { h ^= q.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return (q.match(/series_id=([A-Za-z0-9_]+)/) || q.match(/release_id=(\d+)/) || ["", "x"])[1] + "-" + h.toString(16) + ".json";
}
// Central time, as "YYYY-MM-DD" and the hour
function fredCT(ms) {
  const t = new Date(ms), p = {};
  try { new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false }).formatToParts(t).forEach((x) => { p[x.type] = x.value; }); }
  catch (e) { const u = new Date(ms - 6 * 3600e3); return { day: u.toISOString().slice(0, 10), hour: u.getUTCHours() }; }
  return { day: `${p.year}-${p.month}-${p.day}`, hour: +p.hour % 24 };
}
// keep under FRED's limit: a request log all widgets share
async function fredSlot() {
  const maxWait = config.runsInWidget ? 3000 : 90000, t0 = Date.now();
  for (;;) {
    const now = Date.now(), log = (fredRead("log.json") || []).filter((t) => now - t < 60000);
    if (log.length < 90 || now - t0 > maxWait) { log.push(now); fredWrite("log.json", log); return; }
    await new Promise((r) => Timer.schedule(Math.min(60000 - (now - log[0]) + 100, 3000), false, r));
  }
}
async function fredFetch(url, secs) {
  for (let attempt = 0; ; attempt++) {
    await fredSlot();
    const r = new Request(url);
    r.timeoutInterval = secs || 20;
    let j = null, failed = null;
    try { j = await r.loadJSON(); } catch (e) { failed = e; }
    const code = (r.response && r.response.statusCode) || 0;
    if (code === 429) {
      if (!config.runsInWidget && attempt < 2) { await new Promise((res) => Timer.schedule(attempt ? 30000 : 15000, false, res)); continue; }
      const e = new Error("api.stlouisfed.org answered HTTP 429: too many requests this minute (all your widgets share one FRED key); try again in a minute");
      e.code = 429; throw e;
    }
    if (failed) throw new Error(`couldn't reach api.stlouisfed.org (${String((failed && failed.message) || failed).slice(0, 60)})`);
    if (code >= 400 && !(j && j.error_message)) throw new Error(`api.stlouisfed.org answered HTTP ${code}`);
    return { j, ok: code < 400 && j && !j.error_message };
  }
}
// a series' release dates (past and scheduled), from FRED's calendar: which release a
// series belongs to is asked once; each release's dates are re-read weekly (series share them)
async function fredReleaseDays(sid, key) {
  const base = `https://api.stlouisfed.org/fred`;
  try {
    let idr = fredRead(`relid-${sid}.json`);
    if (!idr || (idr.id == null && Date.now() - idr.at > 30 * 864e5)) {
      const rel = (await fredFetch(`${base}/series/release?series_id=${sid}&api_key=${key}&file_type=json`)).j;
      idr = { at: Date.now(), id: (rel && rel.releases && rel.releases[0] && rel.releases[0].id) || null };
      fredWrite(`relid-${sid}.json`, idr);
    }
    if (idr.id == null) return null;
    const rk = `reldates-${idr.id}.json`, kept = fredRead(rk);
    if (kept && Date.now() - kept.at < 7 * 864e5) return kept.days;
    try {
      const r = (await fredFetch(`${base}/release/dates?release_id=${idr.id}&api_key=${key}&file_type=json&include_release_dates_with_no_data=true&sort_order=desc&limit=40`)).j;
      const days = ((r && r.release_dates) || []).map((x) => x.date).sort();
      fredWrite(rk, { at: Date.now(), days });
      return days;
    } catch (e) { return kept ? kept.days : null; }
  } catch (e) { return null; }
}
// does this cached answer need asking again?
async function fredDue(url, c) {
  const now = Date.now(), age = now - c.at;
  if (age > 7 * 864e5) return true; // weekly: revisions, missed releases
  if (!/\/series\/observations\?/.test(url)) return age > (/\/release\/dates\?/.test(url) ? 7 * 864e5 : 864e5); // calendars and the like
  const obs = (c.j && c.j.observations) || [], n = obs.length;
  const gap = n > 1 ? (Date.parse(obs[n - 1].date) - Date.parse(obs[n - 2].date)) / 864e5 : 30;
  if (gap < 6 || /[?&]frequency=/.test(url)) return age > 3600e3; // daily, or month-to-date averages
  const sid = (url.match(/series_id=([A-Za-z0-9_]+)/) || [])[1];
  const days = sid ? await fredReleaseDays(sid, (url.match(/api_key=([^&]+)/) || [])[1]) : null;
  if (!days || !days.length) return age > 6 * 3600e3; // no calendar: every 6 hours
  const ct = fredCT(now), fetched = fredCT(c.at);
  // the latest release day that has started (from 7am Central)
  const past = days.filter((d) => d < ct.day || (d === ct.day && ct.hour >= 7));
  const last = past[past.length - 1];
  if (!last) return false;
  if (fetched.day < last || (fetched.day === last && fetched.hour < 7)) return true; // first look after a release
  // released but the new number wasn't there: look again every 3 hours for 5 days
  const daysSince = (Date.parse(ct.day) - Date.parse(last)) / 864e5;
  return (c.changed || 0) < Date.parse(last + "T12:00:00Z") && daysSince <= 5 && age > 3 * 3600e3;
}
// the one way widgets ask FRED: returns FRED's JSON (with error_message when FRED says no)
async function fredJSON(url, secs) {
  const k = fredKeyOf(url), c = fredRead(k);
  if (c && !FRED_FORCE && !(await fredDue(url, c))) return c.j;
  let got;
  try { got = await fredFetch(url, secs); }
  catch (e) { if (c && e.code === 429 && config.runsInWidget) return c.j; throw e; }
  if (got.ok) {
    const lastOf = (j) => { const o = (j && j.observations) || []; return o.length ? o[o.length - 1].date + "=" + o[o.length - 1].value + "#" + o.length : JSON.stringify(j).length; };
    const changed = !c || lastOf(c.j) !== lastOf(got.j) ? Date.now() : c.changed || c.at;
    fredWrite(k, { at: Date.now(), changed, j: got.j });
  }
  return got.j;
}
// ---------- end FRED ----------


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

// Spread charts (GNMA vs UMBS, Jumbo vs Conv): one point a week, each the
// average of this many trading days ending that week. Higher = smoother.
const SPREAD_AVG_DAYS = 10;

// Fallback mix, in percent of applications. Used only when the MBA scrape has
// never succeeded on this phone. From the release for the week ending July 10, 2026.
const DEFAULT_MIX = {
  fha: 17.7,
  va: 13.6,
  usda: 0.5,
  arm: 7.1,
  refi: 43.2,
  weekEnding: "July 10, 2026",
};

// How long to wait before asking mba.org again (the survey is weekly).
const MIX_RETRY_HOURS = 6;

const TICKER = "WAC";
const NAME = "Optimal Blue";
const CACHE_FILE = "mkt-wavg-v1.json";
const MIX_CACHE_FILE = "mkt-mix-v1.json";

// Rates up = red, rates down = green.

// Apple's system green and red for dark backgrounds
const GREEN = "#30D158";
const RED = "#FF453A";
const GRAY = "#98989F";
const REFRESH_HOURS = 6;
// FRED posts Optimal Blue rates about 7:02 am Central, dated the business day before.
const POST = { clock: [7, 2], refresh: [7, 15], retryUntil: 12, lagDays: 1 };
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
  const json = await fredJSON(url);
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

// ---------- MBA mix scrape ----------
const MBA_LIST_URL = "https://www.mba.org/news-and-research/newsroom/all-news";
const MBA_NEWS_BASE = "https://www.mba.org/news-and-research/newsroom/news/";
const MBA_SLUGS = ["decrease", "increase", "decreased", "increased"].map(
  (s) => `mortgage-applications-${s}-in-latest-mba-weekly-survey`
);

async function getText(url) {
  const req = new Request(url);
  req.timeoutInterval = 12;
  req.headers = {
    "User-Agent":
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 " +
      "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  };
  return await req.loadString();
}

// Pull the shares out of a release. The sentences look like:
//   "The FHA share of total applications increased to 17.7 percent from ..."
//   "The USDA share of total applications remained unchanged at 0.5 percent ..."
// Returns null unless the numbers are present and plausible.
function parseRelease(html) {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/\s+/g, " ");
  const grab = (label) => {
    const m = new RegExp(
      label + "[^.]{0,60}?\\b(?:to|at) ([0-9]+(?:\\.[0-9]+)?) ?(?:percent|%)",
      "i"
    ).exec(text);
    return m ? parseFloat(m[1]) : null;
  };
  const fha = grab("FHA share of total applications");
  const va = grab("VA share of total applications");
  const usda = grab("USDA share of total applications");
  if (fha === null || va === null) return null;
  if (fha < 5 || fha > 40 || va < 2 || va > 35) return null;
  const week = /week ending ([A-Z][a-z]+\.? [0-9]{1,2}, [0-9]{4})/.exec(text);
  return {
    fha,
    va,
    usda: usda !== null && usda <= 5 ? usda : 0,
    arm: grab("\\(ARM\\) share of activity"),
    refi: grab("refinance share of mortgage activity"),
    weekEnding: week ? week[1] : null,
  };
}

// Newest weekly-survey links on MBA's press release listing, if it can be read.
async function listedUrls() {
  try {
    const html = await getText(MBA_LIST_URL);
    const re =
      /\/news-and-research\/newsroom\/news\/(\d{4})\/(\d{2})\/(\d{2})\/mortgage-applications[a-z0-9-]*weekly-survey[a-z0-9-]*/gi;
    const found = new Map();
    let m;
    while ((m = re.exec(html))) found.set(m[0].toLowerCase(), m[1] + m[2] + m[3]);
    return [...found.entries()]
      .sort((a, b) => b[1].localeCompare(a[1]))
      .slice(0, 2)
      .map(([path]) => "https://www.mba.org" + path);
  } catch (e) {
    return [];
  }
}

// Releases come out on Wednesdays at a dated URL, so the address can be guessed.
function guessedUrls(weeksBack) {
  const d = new Date();
  const sinceWed = (d.getDay() - 3 + 7) % 7;
  d.setDate(d.getDate() - sinceWed - 7 * weeksBack);
  const two = (n) => String(n).padStart(2, "0");
  const datePath = `${d.getFullYear()}/${two(d.getMonth() + 1)}/${two(d.getDate())}/`;
  return MBA_SLUGS.map((s) => MBA_NEWS_BASE + datePath + s);
}

async function tryRelease(url) {
  try {
    const mix = parseRelease(await getText(url));
    return mix ? { ...mix, url } : null;
  } catch (e) {
    return null;
  }
}

async function scrapeMix() {
  for (const url of await listedUrls()) {
    const hit = await tryRelease(url);
    if (hit) return hit;
  }
  for (let w = 0; w < 3; w++) {
    const hits = await Promise.all(guessedUrls(w).map(tryRelease));
    const hit = hits.find(Boolean);
    if (hit) return hit;
  }
  return null;
}

// status: "live" (scraped), "cached" (scrape failed, older scrape reused),
// or "default" (never scraped successfully; DEFAULT_MIX)
async function loadMix() {
  const fm = FileManager.local();
  const path = fm.joinPath(fm.documentsDirectory(), MIX_CACHE_FILE);
  let cache = null;
  if (fm.fileExists(path)) {
    try {
      cache = JSON.parse(fm.readString(path));
    } catch (e) {}
  }
  const now = Date.now();
  const fromCache = () =>
    cache && cache.mix
      ? { ...cache.mix, status: cache.status }
      : { ...DEFAULT_MIX, status: "default" };

  if (cache && now - cache.attemptedAt < MIX_RETRY_HOURS * 3600 * 1000) {
    return fromCache();
  }
  const scraped = await scrapeMix();
  if (scraped) {
    cache = { mix: scraped, status: "live", attemptedAt: now };
  } else {
    const keep = cache && cache.mix ? cache.mix : null;
    cache = { mix: keep, status: keep ? "cached" : "default", attemptedAt: now };
  }
  fm.writeString(path, JSON.stringify(cache));
  return fromCache();
}

// ---------- Data (with offline fallback) ----------
async function getData() {
  return withCache(CACHE_FILE, async () => {
    const start = daysAgo(DETAIL_DAYS_BACK);
    const [conv, fha, va, usda, jumbo, mix] = await Promise.all([
      fred("OBMMIC30YF", start),
      fred("OBMMIFHA30YF", start),
      fred("OBMMIVA30YF", start),
      fred("OBMMIUSDA30YF", start).catch(() => []), // optional
      fred("OBMMIJUMBO30YF", start).catch(() => []), // optional, chart context only
      loadMix(),
    ]);
    const wConv = 100 - mix.fha - mix.va - mix.usda;
    const fhaBy = byDate(fha);
    const vaBy = byDate(va);
    const usdaBy = byDate(usda);
    const jumboBy = byDate(jumbo);

    // Today's mix applied to every day, so the line shows rate moves only.
    // A day missing its conforming, FHA or VA print is skipped. A day missing
    // only USDA is averaged over the other three.
    const pts = [];
    for (const c of conv) {
      const f = fhaBy.get(c.date);
      const v = vaBy.get(c.date);
      if (f === undefined || v === undefined) continue;
      const u = usdaBy.get(c.date);
      let sum = wConv * c.value + mix.fha * f + mix.va * v;
      let weight = wConv + mix.fha + mix.va;
      if (u !== undefined) {
        sum += mix.usda * u;
        weight += mix.usda;
      }
      const p = { date: c.date, v: sum / weight, conv: c.value, fha: f, va: v };
      if (u !== undefined) p.usda = u;
      // Jumbo rides along for the chart only; it is not in the average,
      // because the MBA release has no jumbo share to weight it by.
      const j = jumboBy.get(c.date);
      if (j !== undefined) p.jumbo = j;
      pts.push(p);
    }
    if (!pts.length) throw new Error("No overlapping data");
    return { pts, mix };
  });
}

function widgetSpec(d) {
  const pts = recent(d.pts);
  const first = pts[0];
  const last = pts[pts.length - 1];
  const delta = last.v - first.v; // percentage points
  const up = delta > 0;
  const govt = d.mix.fha + d.mix.va + d.mix.usda;
  return {
    pts,
    hex: up ? RED : GREEN, // rates up = red, down/flat = green
    triangleUp: up,
    topRight: signedWhole(delta * 100), // change over the window, bps
    name: NAME,
    staleTag: d.stale ? (CLOCK_BY_VALUE ? "cached" : `cached · ${throughLabel(d, true)}`) : null,
    staleDate: d.stale ? throughLabel(d, true) : null,
    rightSub: `${Math.round(govt)}% govt`, // government share of the mix
    value: last.v.toFixed(2),
    clock: postClock(d),
  };
}

function detailPayload(d) {
  const last = d.pts[d.pts.length - 1];
  const mix = d.mix;

  // Spreads per day, in bps. GNMA side: FHA, VA and USDA (when it printed)
  // blended at MBA's mix; UMBS side: the conforming rate. Jumbo vs Conv:
  // jumbo minus conforming, only on days FRED has a jumbo print.
  const pts = d.pts.map((p) => {
    let sum = mix.fha * p.fha + mix.va * p.va, w = mix.fha + mix.va;
    if (p.usda !== undefined && mix.usda > 0) { sum += mix.usda * p.usda; w += mix.usda; }
    const q = { ...p, gs: Math.round((sum / w - p.conv) * 1000) / 10 };
    if (p.jumbo !== undefined) q.js = Math.round((p.jumbo - p.conv) * 1000) / 10;
    return q;
  });
  // The daily spreads are noisy, so the charts plot one point per week: on the
  // week's last trading day, the average of the 10 trading days ending there
  // (days without a print are left out; at least 5 are needed).
  const weekOf = (ymd) => {
    const t = new Date(ymd + "T12:00:00Z");
    t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7)); // back to Monday
    return t.toISOString().slice(0, 10);
  };
  for (let i = 0; i < pts.length; i++) {
    if (i < pts.length - 1 && weekOf(pts[i + 1].date) === weekOf(pts[i].date)) continue;
    for (const k of ["gs", "js"]) {
      const vals = [];
      for (let j = Math.max(0, i - SPREAD_AVG_DAYS + 1); j <= i; j++) if (pts[j][k] !== undefined) vals.push(pts[j][k]);
      if (vals.length >= Math.ceil(SPREAD_AVG_DAYS / 2)) pts[i][k + "W"] = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
    }
  }

  // Mix table, priced at the latest rates. If USDA has no rate today,
  // drop it and rescale the others to 100%.
  const rows = [
    { label: "Conventional", share: 100 - mix.fha - mix.va - mix.usda, rate: last.conv, color: "#64A8FF" },
    { label: "FHA", share: mix.fha, rate: last.fha, color: "#FF9F0A" },
    { label: "VA", share: mix.va, rate: last.va, color: "#30D5C8" },
  ];
  if (last.usda !== undefined && mix.usda > 0) {
    rows.push({ label: "USDA", share: mix.usda, rate: last.usda, color: "#AC8E68" });
  }
  const totalShare = rows.reduce((s, r) => s + r.share, 0);
  rows.forEach((r) => (r.share = (r.share / totalShare) * 100));

  const statusText = {
    live: "Pulled automatically from the MBA press release.",
    cached: "The latest MBA scrape failed, so this is the last mix that worked.",
    default: "The MBA scrape has not worked on this phone yet, so this is the built-in default mix.",
  }[mix.status];
  const extras =
    mix.arm !== null && mix.arm !== undefined && mix.refi !== null && mix.refi !== undefined
      ? ` ARM share ${mix.arm}% and refinance share ${mix.refi}% of applications.`
      : "";

  return {
    ticker: TICKER,
    name: "Optimal Blue",
    unit: "%",
    dec: 2,
    chg: { scale: 100, dec: 0, unit: "bps" },
    upIsGood: false,
    zoom: true, // pinch to zoom, two-finger drag to pan, double-tap to reset
    minSpan: MIN_AXIS_SPAN_BPS / 100,
    legs: [],
    // One line per product, in the same colors as the mix table.
    // USDA is left off the chart (tiny share) but stays in the mix table.
    // Jumbo is shown for context when FRED has it; it is not part of the average.
    lines: [
      { key: "conv", label: "Conv", color: "#64A8FF" },
      ...(d.pts.some((p) => p.jumbo !== undefined)
        ? [{ key: "jumbo", label: "Jumbo", color: "#BF5AF2" }]
        : []),
      { key: "fha", label: "FHA", color: "#FF9F0A" },
      { key: "va", label: "VA", color: "#30D5C8" },
    ],
    pts: pts,
    mainToggle: { label: "Wtd avg" }, // the weighted average gets a legend entry too
    spreads: [
      { key: "gsW", label: "GNMA \u2212 UMBS", color: "#FF9F0A", weekly: true },
      { key: "jsW", label: "Jumbo \u2212 Conv", color: "#BF5AF2", weekly: true },
    ],
    mixWeek: mix.weekEnding || null,
    mix: {
      rows: rows,
      total: last.v,
      note:
        `MBA Weekly Applications Survey, week ending ${mix.weekEnding || "unknown"}. ` +
        statusText + extras +
        " Shares are by application count, not dollars. Adds is each product's" +
        " contribution to the average, in percentage points.",
    },
    note:
      "Weighted average of Optimal Blue 30Y note rates using the current MBA mix, " +
      "held constant across the chart, so the line shows rate moves, not mix shifts. " +
      "On long ranges that means today's mix at past rates, not the market average of the time. " +
      "Conventional includes jumbo applications, priced here at the conforming rate. " +
      "The white line is the weighted average; the colored lines are each product's rate. " +
      "Tap a product in the legend, the weighted average included, to hide or show its line. Pinch the chart to zoom in " +
      "time, drag with two fingers to pan, and double-tap to reset. The jumbo line is context " +
      "only and is not part of the average, since MBA publishes no jumbo share. " +
      "GNMA \u2212 UMBS is the FHA, VA and USDA rates blended at the same MBA mix, minus the conforming rate; " +
      "Jumbo \u2212 Conv is the jumbo rate minus the conforming rate. To show direction rather than daily noise, each " +
      "is plotted weekly: one point on each week's last trading day, the average of the 10 trading days ending there. " +
      "Both are note rates in bps (FHA mortgage " +
      "insurance and the VA funding fee aren't included) and follow the main chart's range, pinch and scrub. " +
      "Sources: FRED, MBA." +
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

const PRINT_PAGE_JS = `
// Share as PDF: 16:9 slides for the dates on screen. 1) the weighted average
// and each product's rate (lines switched off on screen stay off); 2) GNMA vs
// UMBS and Jumbo vs Conv side by side, in bps. Each has a headline that states
// the point, the chart large, value labels at the line ends, and a dark banner
// crediting the sources. Vector, so it stays sharp.
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
  var PCOL = { conv: [59, 111, 216], jumbo: [140, 64, 196], fha: [222, 120, 0], va: [0, 150, 140], usda: [150, 120, 80] };
  var GSC = [222, 120, 0], JSC = [140, 64, 196];
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
  var SP = (D.spreads || []).map(function (sp) {
    var idx = []; P.forEach(function (p, i) { if (p[sp.key] !== undefined && p[sp.key] !== null) idx.push(i); });
    return { key: sp.key, label: sp.label.split("\\u2212").join("-"), idx: idx };
  });
  var spPage = SP.some(function (s) { return s.idx.length >= 2; });
  var FCM = typeof fcModel === "function" ? fcModel() : null;
  var pages = 1 + (spPage ? 1 : 0) + (FCM ? 1 : 0);

  function headline(text) {
    var size = 21, lines;
    do { font(true, size, INK); lines = doc.splitTextToSize(text, W - 72); size -= 1; } while (lines.length > 1 && size > 15);
    doc.text(lines, 36, 42);
    return 42 + (lines.length - 1) * (size + 4);
  }
  function titles(top, title, sub, cx) {
    font(true, 11.5, INK); doc.text(title, cx, top + 30, { align: "center" });
    font(false, 9.5, GRY); doc.text(sub, cx, top + 43, { align: "center" });
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
  // the chart box, its grid with left-axis labels, and dates
  function frame(top, L, R, sc, fmt, minGap) {
    var F = { L: L, R: R, T: top + 58, B: H - 92 };
    F.X = function (i) { return F.L + (n === 1 ? 0 : i / (n - 1) * (F.R - F.L)); };
    F.Y = function (v) { return F.B - (v - sc.lo) / (sc.hi - sc.lo) * (F.B - F.T); };
    doc.setLineWidth(0.5);
    for (var v = sc.lo; v <= sc.hi + sc.st / 2; v += sc.st) {
      var zero = Math.abs(v) < sc.st / 1000;
      if (zero) doc.setDrawColor(150, 150, 155); else doc.setDrawColor(RULE[0], RULE[1], RULE[2]);
      doc.line(F.L, F.Y(v), F.R, F.Y(v));
      font(false, 8.5, GRY); doc.text(fmt(v), F.L - 6, F.Y(v) + 3, { align: "right" });
    }
    doc.setDrawColor(150, 150, 155); doc.line(F.L, F.B, F.R, F.B);
    var monthsSpan = days / 30.4, lastX = -99, prevKey = null;
    for (var i = 0; i < n; i++) {
      var d = P[i].date, key = monthsSpan > 30 ? d.slice(0, 4) : d.slice(0, 7);
      if (key === prevKey) continue;
      prevKey = key;
      if (i === 0) continue;
      var lab = monthsSpan > 30 ? d.slice(0, 4) : MON[+d.slice(5, 7) - 1] + (d.slice(5, 7) === "01" || monthsSpan > 10 ? " '" + d.slice(2, 4) : "");
      var x = F.X(i);
      if (x - lastX < (minGap || 44) || x > F.R - 10) continue;
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
  function endLabels(F, items, dx) {
    items.sort(function (p, q) { return p.y - q.y; });
    for (var k = 1; k < items.length; k++) if (items[k].y - items[k - 1].y < 13) items[k].y = items[k - 1].y + 13;
    items.forEach(function (it) { font(true, 10, it.c); doc.text(it.t, F.R + (dx || 8), it.y + 3.5); });
  }
  function legend(F, items, cx) {
    var y = F.B + 30, total = 0;
    font(false, 9, INK);
    items.forEach(function (it) { it.w = doc.getTextWidth(it.t); total += 22 + it.w + 26; });
    var x = cx - (total - 26) / 2;
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
    var src = "Sources: Optimal Blue 30-year fixed note rate indices (conforming OBMMIC30YF, jumbo OBMMIJUMBO30YF, FHA OBMMIFHA30YF, VA OBMMIVA30YF, USDA OBMMIUSDA30YF), via FRED; " +
      "product mix from the MBA Weekly Applications Survey" + (D.mixWeek ? " (week ending " + D.mixWeek + ")" : "") + ", held constant across the chart." +
      (page === 2 ? " GNMA - UMBS = FHA, VA and USDA rates blended at the MBA mix, minus the conforming rate. Jumbo - Conv = jumbo minus conforming. Note rates only. Weekly points, each the average of the 10 trading days ending that week." :
        " Jumbo is shown for context and is not in the average.");
    if (srcOver) src = srcOver;
    doc.text(doc.splitTextToSize(src, W - 176 - 40 - 110), 28, by + 13);
    font(false, 7.5, [200, 200, 205]);
    doc.text("Data through " + longDate(through || last.date), W - 188, by + 20, { align: "right" });
    doc.text(page + " of " + pages, W - 188, by + 31, { align: "right" });
    font(true, 12.5, [255, 255, 255]);
    doc.text("Market", W - 162, by + 20);
    doc.text("WAC", W - 162, by + 34);
  }
  function bpsAbs(v) { return Math.abs(Math.round(v)) + " bps"; }
  function bps(v) { var r = Math.round(v); return (r < 0 ? "-" : "") + Math.abs(r) + " bps"; }

  // ---- 1. Weighted average and product rates ----
  var chg = (last.v - first.v) * 100, rc = Math.round(chg);
  var top = headline(Math.abs(rc) < 1
    ? "Market WAC at " + last.v.toFixed(2) + "%, Unchanged " + period
    : "Market WAC at " + last.v.toFixed(2) + "%, " + (rc > 0 ? "Up " : "Down ") + Math.abs(rc) + " bps " + period);
  var mixTxt = (D.mix && D.mix.rows ? D.mix.rows.map(function (r) { return (r.label === "Conventional" ? "Conv" : r.label) + " " + Math.round(r.share) + "%"; }).join(", ") : "");
  titles(top, "Optimal Blue 30-Year Fixed Note Rates, Weighted by the MBA Application Mix",
    "Daily, % · " + (mixTxt ? "Mix: " + mixTxt + " · " : "") + span, W / 2);
  var shown = [];
  if (!HIDE_MAIN) shown.push({ key: "v", label: "Weighted average", c: INK, w: 3 });
  OVERLAYS.forEach(function (o, k) {
    if (HIDDEN[k]) return;
    var key = D.lines[k].key;
    shown.push({ key: key, label: o.label === "Conv" ? "Conforming" : o.label, c: PCOL[key] || GRY, w: 1.6 });
  });
  if (!shown.length) shown.push({ key: "v", label: "Weighted average", c: INK, w: 3 });
  var vals = [];
  shown.forEach(function (s) { P.forEach(function (p) { if (p[s.key] !== undefined && p[s.key] !== null) vals.push(p[s.key]); }); });
  var F = frame(top, 70, W - 118, scale(vals, 0.5), function (v) { return v.toFixed(2) + "%"; });
  var ends = [];
  shown.slice().reverse().forEach(function (s) {
    line(F, function (i) { var v = P[i][s.key]; return v === undefined || v === null ? null : F.Y(v); }, s.c, s.w);
    for (var i = n - 1; i >= 0; i--) {
      var v = P[i][s.key];
      if (v !== undefined && v !== null) { ends.push({ y: F.Y(v), t: v.toFixed(2) + "%", c: s.c }); break; }
    }
  });
  endLabels(F, ends, 8);
  legend(F, shown.map(function (s) { return { t: s.label, c: s.c, lw: s.w }; }), W / 2);
  banner(1);

  // ---- 2. GNMA vs UMBS and Jumbo vs Conv, side by side ----
  if (spPage) {
    doc.addPage([W, H], "landscape");
    var parts = [];
    SP.forEach(function (sp) {
      if (sp.idx.length < 1) return;
      var lv = P[sp.idx[sp.idx.length - 1]][sp.key];
      if (sp.key.indexOf("gs") === 0) parts.push(Math.round(lv) === 0 ? "GNMA Rates Even With UMBS" : "GNMA Rates " + bpsAbs(lv) + (lv < 0 ? " Below" : " Above") + " UMBS");
      else parts.push(Math.round(lv) === 0 ? "Jumbo Even With Conforming" : "Jumbo " + bpsAbs(lv) + (lv < 0 ? " Below" : " Above") + " Conforming");
    });
    top = headline(parts.join(", ") + (endsNow ? "" : " on " + longDate(last.date)));
    var halves = [{ L: 66, R: W / 2 - 52 }, { L: W / 2 + 58, R: W - 60 }];
    SP.slice(0, 2).forEach(function (sp, h) {
      var hv = halves[h], cx = (hv.L + hv.R) / 2, isG = sp.key.indexOf("gs") === 0, col = isG ? GSC : JSC;
      var title = isG ? "GNMA - UMBS: Govt Blend Minus Conforming" : "Jumbo - Conv: Jumbo Minus Conforming";
      if (sp.idx.length < 2) {
        titles(top, title, "Not enough data in this range", cx);
        return;
      }
      var a = P[sp.idx[0]][sp.key], b = P[sp.idx[sp.idx.length - 1]][sp.key], c = Math.round(b - a);
      titles(top, title, "Weekly, 2-week average, bps · " + (c === 0 ? "unchanged" : (c > 0 ? "+" : "-") + Math.abs(c) + " bps") + " since " + longDate(P[sp.idx[0]].date), cx);
      var sv = sp.idx.map(function (i) { return P[i][sp.key]; });
      var sc = scale(sv.concat([0]).filter(function (v, i, arr) { return i < sv.length || (Math.min.apply(null, sv) <= 15 && Math.max.apply(null, sv) >= -15); }), 20);
      var Fh = frame(top, hv.L, hv.R, sc, function (v) { return String(Math.round(v)); }, 40);
      line(Fh, function (i) { var v = P[i][sp.key]; return v === undefined || v === null ? null : Fh.Y(v); }, col, 2.4);
      endLabels(Fh, [{ y: Fh.Y(b), t: bps(b), c: col }], 6);
      sp.idx.forEach(function (i) { if (sp.idx.length <= 30) { doc.setFillColor(col[0], col[1], col[2]); doc.circle(Fh.X(i), Fh.Y(P[i][sp.key]), 1.8, "F"); } });
      legend(Fh, [{ t: (isG ? "FHA/VA/USDA at MBA mix minus conforming" : "Jumbo minus conforming") + ", 2-week avg", c: col, lw: 2.4 }], cx);
    });
    banner(2);
  }

  // ---- 3. Where rates are headed: Freddie Mac, MBA's forecast, consumers ----
  if (FCM) {
    doc.addPage([W, H], "landscape");
    var GOLD = [196, 140, 0], TEAL = [0, 130, 190], pg3 = pages;
    var lmq = FCM.mba.length ? FCM.mba[FCM.mba.length - 1] : null, ls3 = FCM.sce.length ? FCM.sce[FCM.sce.length - 1] : null;
    top = headline(lmq ? "MBA Forecasts " + lmq.v.toFixed(1) + "% by " + lmq.q.slice(4) + " " + lmq.q.slice(0, 4) + (ls3 ? "; Consumers Expect " + ls3.pts[2][1].toFixed(1) + "% by " + shortMY(ls3.pts[2][0]) : "")
      : "Freddie Mac 30-Year Rate and What Consumers Expect");
    titles(top, "30-Year Fixed Mortgage Rate: Actual, MBA Forecast and Consumer Expectations",
      "Freddie Mac weekly rate, % · MBA quarterly forecast" + (FCM.F.mba ? " (" + FCM.F.mba.vintage + ")" : "") + " · NY Fed consumer survey medians", W / 2);
    var lo3 = Math.floor(FCM.lo * 2 - 0.6) / 2, hi3 = Math.ceil(FCM.hi * 2 + 0.6) / 2, st3 = hi3 - lo3 > 4 ? 1 : 0.5;
    var L3 = 70, R3 = W - 150, T3 = top + 58, B3 = H - 92;
    var X3 = function (sd) { return L3 + (ymdT(sd) - FCM.t0) / (FCM.t1 - FCM.t0) * (R3 - L3); };
    var Y3 = function (v) { return B3 - (v - lo3) / (hi3 - lo3) * (B3 - T3); };
    doc.setLineWidth(0.5);
    for (var g3 = Math.ceil(lo3 / st3 - 1e-9) * st3; g3 <= hi3 + 1e-9; g3 += st3) {
      doc.setDrawColor(RULE[0], RULE[1], RULE[2]); doc.line(L3, Y3(g3), R3, Y3(g3));
      font(false, 8.5, GRY); doc.text(g3.toFixed(st3 < 1 ? 1 : 0) + "%", L3 - 6, Y3(g3) + 3, { align: "right" });
    }
    doc.setDrawColor(150, 150, 155); doc.line(L3, B3, R3, B3);
    var lx3 = -99;
    fcTicks(FCM.t0, FCM.t1).forEach(function (tk) {
      var xx3 = L3 + (tk.t - FCM.t0) / (FCM.t1 - FCM.t0) * (R3 - L3);
      if (xx3 - lx3 < 40 || xx3 < L3 + 10 || xx3 > R3 - 10) return;
      lx3 = xx3; doc.setDrawColor(150, 150, 155); doc.line(xx3, B3, xx3, B3 + 3); font(false, 8.5, GRY); doc.text(tk.lab, xx3, B3 + 13, { align: "center" });
    });
    // lines stay inside the chart box when zoomed
    doc.saveGraphicsState(); doc.rect(L3, T3 - 14, R3 - L3, B3 - T3 + 14, null); doc.clip(); doc.discardPath();
    var tx3 = X3(FCM.last[0]);
    doc.setDrawColor(150, 150, 155); doc.setLineDashPattern([2, 2], 0); doc.line(tx3, T3, tx3, B3); doc.setLineDashPattern([], 0);
    font(false, 8, GRY); doc.text("Today", tx3 - 4, T3 + 8, { align: "right" });
    var ends3 = [];
    // consumers
    FCM.sce.forEach(function (r) {
      var c = r.latest ? TEAL : [150, 190, 215];
      doc.setDrawColor(c[0], c[1], c[2]); doc.setLineWidth(1.6); doc.setLineDashPattern([1.5, 3], 0);
      for (var k = 1; k < r.pts.length; k++) doc.line(X3(r.pts[k - 1][0]), Y3(r.pts[k - 1][1]), X3(r.pts[k][0]), Y3(r.pts[k][1]));
      doc.setLineDashPattern([], 0);
      r.pts.forEach(function (p, k) {
        doc.setDrawColor(c[0], c[1], c[2]); doc.setLineWidth(1.2);
        if (k) { doc.setFillColor(c[0], c[1], c[2]); doc.circle(X3(p[0]), Y3(p[1]), 2.6, "FD"); }
        else { doc.setFillColor(255, 255, 255); doc.circle(X3(p[0]), Y3(p[1]), 2.6, "FD"); }
      });
      var e = r.pts[2];
      if (FCM.inW(e[0])) { font(true, 8.5, c); doc.text(r.label + " survey: " + e[1].toFixed(1) + "%", X3(e[0]) - 5, Y3(e[1]) + 12, { align: "right" }); }
    });
    // Freddie Mac
    doc.setDrawColor(INK[0], INK[1], INK[2]); doc.setLineWidth(1.8);
    for (var i3 = 1; i3 < FCM.F.pmms.length; i3++) doc.line(X3(FCM.F.pmms[i3 - 1][0]), Y3(FCM.F.pmms[i3 - 1][1]), X3(FCM.F.pmms[i3][0]), Y3(FCM.F.pmms[i3][1]));
    doc.setFillColor(INK[0], INK[1], INK[2]); doc.circle(tx3, Y3(FCM.last[1]), 2.8, "F");
    font(true, 9, INK); doc.text(FCM.last[1].toFixed(2) + "%", tx3 - 5, Y3(FCM.last[1]) - 6, { align: "right" });
    // earlier MBA forecasts, lighter
    FCM.old.forEach(function (o, k) {
      var c = k ? [232, 214, 165] : [218, 190, 120];
      doc.setDrawColor(c[0], c[1], c[2]); doc.setLineWidth(1.4); doc.setLineDashPattern([3, 3], 0);
      for (var j = 1; j < o.q.length; j++) doc.line(X3(qMid(o.q[j - 1].q)), Y3(o.q[j - 1].v), X3(qMid(o.q[j].q)), Y3(o.q[j].v));
      doc.setLineDashPattern([], 0);
      o.q.forEach(function (x) { doc.setFillColor(c[0], c[1], c[2]); doc.circle(X3(qMid(x.q)), Y3(x.v), 1.6, "F"); });
      var e = o.q[o.q.length - 1];
      if (FCM.inW(qMid(e.q))) ends3.push({ y: Y3(e.v), t: o.vintage.slice(0, 3) + " " + e.v.toFixed(1) + "%", c: [190, 160, 90] });
    });
    // MBA
    if (FCM.mba.length) {
      doc.setDrawColor(GOLD[0], GOLD[1], GOLD[2]); doc.setLineWidth(2); doc.setLineDashPattern([5, 3], 0);
      var px3 = tx3, py3 = Y3(FCM.last[1]);
      FCM.mba.forEach(function (x) { var qx = X3(qMid(x.q)), qy = Y3(x.v); doc.line(px3, py3, qx, qy); px3 = qx; py3 = qy; });
      doc.setLineDashPattern([], 0);
      FCM.mba.forEach(function (x) { doc.setFillColor(GOLD[0], GOLD[1], GOLD[2]); doc.circle(X3(qMid(x.q)), Y3(x.v), 2.2, "F"); });
      if (FCM.inW(qMid(lmq.q))) ends3.push({ y: Y3(lmq.v), t: "MBA " + lmq.v.toFixed(1) + "%", c: GOLD });
    }
    doc.restoreGraphicsState();
    endLabels({ R: X3(lmq ? qMid(lmq.q) : FCM.last[0]) }, ends3, 8);
    legend({ B: B3 }, [{ t: "Freddie Mac 30-yr (weekly)", c: INK, lw: 1.8 }].concat(FCM.F.mba ? [{ t: "MBA forecast, " + FCM.F.mba.vintage + (FCM.old.length ? " (earlier: " + FCM.old.map(function (o) { return o.vintage.slice(0, 3); }).join(", ") + ", lighter)" : ""), c: GOLD, lw: 2 }] : [])
      .concat([{ t: "Consumers expect, 1 and 3 years out (median)", c: TEAL, lw: 1.6 }]), W / 2);
    banner(pg3, "Sources: Freddie Mac Primary Mortgage Market Survey 30-year fixed rate (MORTGAGE30US) via FRED; MBA Mortgage Finance Forecast" +
      (FCM.F.mba ? " (" + FCM.F.mba.vintage + (FCM.F.mba.asOf ? ", " + FCM.F.mba.asOf : "") + (FCM.old.length ? "; earlier: " + FCM.old.map(function (o) { return o.vintage; }).join(", ") : "") + ")" : "") + ", quarterly averages of the Freddie Mac rate; " +
      "Federal Reserve Bank of New York Survey of Consumer Expectations, Housing Survey (February), median expected average national 30-year rate. Hollow dot: the rate people thought it was at the survey.", FCM.last[0]);
  }
  return doc;
};
`;

// ---------- Where rates are headed: MBA forecast and consumer expectations ----------
// MBA forecasts Freddie Mac's 30-year fixed rate (its PDF footnote says so), so
// the chart pairs it with Freddie's weekly rate, not the Optimal Blue lines.
const FC_FILE = "mkt-forecast-v1.json";
const FC_CHECK_DAYS = 5; // how often to look for a newer MBA forecast (monthly release)
const FC_YEARS_BACK = 3; // history shown left of today (pinch to zoom out further)
const FC_HISTORY_FROM = "2015-01-01"; // how far back zooming out can go
// NY Fed Survey of Consumer Expectations, Housing Survey (fielded each February):
// median answers for the average national 30-year fixed rate today and expected
// 1 and 3 years ahead. Typed in from the survey's public slide deck; the question
// began in 2025. Add a row each spring when the new survey comes out.
const SCE_RATES = [
  { survey: "2025-02-15", label: "Feb 2025", now: 7.0, y1: 7.0, y3: 7.0 },
  { survey: "2026-02-15", label: "Feb 2026", now: 6.5, y1: 6.0, y3: 6.0 },
];
const MBA_PDF = (y, mon) => `https://www.mba.org/docs/default-source/research-and-forecasts/forecasts/${y}/mortgage-finance-forecast-${mon}-${y}.pdf`;
const MBA_ARCHIVE = "https://www.mba.org/forecasts-and-commentary/mortgage-finance-forecast-archives";
const PDFJS = [
  ["https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js", "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js"],
  ["https://cdn.jsdelivr.net/npm/pdfjs-dist@2.16.105/build/pdf.min.js", "https://cdn.jsdelivr.net/npm/pdfjs-dist@2.16.105/build/pdf.worker.min.js"],
];
const MON3 = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const daysSince = (iso) => (iso ? (Date.now() - Date.parse(iso)) / 86400000 : Infinity);

// A PDF's text, as lines per page, read with pdf.js in a hidden page
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

// MBA's table: a line of years ("2026 2027 2028"), a line of quarters
// ("Q1 Q2 Q3 Q4 ... 2025 2026 2027 2028 2029") and the row
// "30-Year Fixed Rate Mortgage (%) 6.1 6.4 ...". The first 4 x (number of
// years) values are quarterly averages; the rest are annual (Q4) values.
function parseMba(lines) {
  const i = lines.findIndex((l) => /30-?\s?Year Fixed Rate/i.test(l));
  if (i < 0) return null;
  const vals = lines[i].split(" ").filter((t) => /^\d+(\.\d+)?$/.test(t)).map(Number);
  let years = null;
  for (let j = i - 1; j >= 0 && !years; j--) if (/^(20\d\d\s*){2,}$/.test(lines[j].trim())) years = lines[j].trim().split(/\s+/).map(Number);
  if (!years || vals.length < years.length * 4) return null;
  const q = [];
  years.forEach((y, k) => [1, 2, 3, 4].forEach((n) => q.push({ q: y + "Q" + n, v: vals[k * 4 + n - 1] })));
  if (q.some((x) => !(x.v > 2 && x.v < 15))) return null;
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
    const html = await getText(MBA_ARCHIVE), re = /href="([^"]*mortgage-finance-forecast-([a-z]+)-(20\d\d)\.pdf[^"]*)"/gi;
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

// Freddie Mac's weekly rate every time; MBA's PDF only every few days
async function refreshForecast() {
  const saved = readSaved(FC_FILE) || {};
  const out = { ...saved };
  try {
    out.pmms = (await fred("MORTGAGE30US", FC_HISTORY_FROM)).map((o) => [o.date, o.value]);
  } catch (e) {}
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
  if (out.pmms) writeSaved(FC_FILE, out);
  return out;
}
// Show MBA's PDF itself (iOS's PDF viewer, with its own share button), over
// the open view. Downloads it again if the saved copy is missing.
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
function forecastPayload(fc) {
  if (!fc || !fc.pmms || !fc.pmms.length) return null;
  const mbas = fc.mbas || (fc.mba ? [fc.mba] : []);
  return { pmms: fc.pmms, mba: mbas[0] || null, mbaOld: mbas.slice(1), sce: SCE_RATES };
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
  .sp { margin-top:24px; }
  .sp .st { display:flex; align-items:baseline; font-variant-numeric:tabular-nums; }
  .sp .st b { font-size:16px; }
  .sp .st b i { display:inline-block; width:14px; height:4px; border-radius:2px; vertical-align:middle; margin-right:7px; }
  .sp .st .val { margin-left:auto; font-size:20px; font-weight:600; }
  .sp .ss { color:var(--gray); font-size:12px; margin-top:2px; min-height:16px; font-variant-numeric:tabular-nums; }
  .sp .wrap { position:relative; margin-top:6px; }
  .sp svg { display:block; width:100%; height:150px; touch-action:none; }
  .sp .tl { position:absolute; left:0; top:0; right:0; bottom:0; touch-action:none; }
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
  #fcChart { display:block; width:100%; height:250px; }
  .fcsub { color:var(--gray); font-size:13px; margin:-4px 0 8px; line-height:1.4; font-variant-numeric:tabular-nums; }
  .fclink { color:var(--gray); font-size:13px; font-weight:600; padding:10px 0 0; }
  .fclink span { color:#64A8FF; cursor:pointer; padding:4px 0; }
  .fcleg i.dash { background:none; border-top:3px dashed #FFD60A; height:0; }
  .fcleg i.dot3 { background:none; border-top:3px dotted #64D2FF; height:0; }
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

  <div id="spreads"></div>

  <div id="fcSec" style="display:none">
    <div class="h2">Where rates are headed</div>
    <div class="fcsub" id="fcSub"></div>
    <div class="legend fcleg" id="fcLeg"></div>
    <div style="position:relative"><svg id="fcChart" xmlns="http://www.w3.org/2000/svg"></svg><div id="fcTouch" style="position:absolute;left:0;top:0;right:0;bottom:0;touch-action:pan-y"></div></div>
    <div class="fclink" id="fcLink" style="display:none"></div>
    <div class="note" id="fcNote"></div>
  </div>

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
// The main line (the weighted average) can be switched off too, when the payload asks
var MAIN_TOGGLE = LINE_MODE && D.mainToggle ? D.mainToggle : null;
var HIDE_MAIN = false;
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
  if (MAIN_TOGGLE) {
    html += '<span data-k="m"' + (HIDE_MAIN ? ' class="off"' : '') +
            '><i style="background:' + MAIN_WHITE + '"></i>' + MAIN_TOGGLE.label +
            '<span>' + fmtV(pts[i].v) + '</span></span>';
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
  spreadHeader(i);
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
  var vals = HIDE_MAIN ? [] : pts.map(function (p) { return p.v; });
  // Scale to the main line and every overlay line in view
  for (var a = 0; a < mas.length; a++) {
    if (HIDDEN[a]) continue; // hidden lines don't stretch the axis
    for (var j = 0; j < mas[a].length; j++) {
      if (mas[a][j] !== null) vals.push(mas[a][j]);
    }
  }
  if (!vals.length) vals = pts.map(function (p) { return p.v; }); // everything switched off
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
    s += (HIDE_MAIN ? "" : baseline) + over;
    if (!HIDE_MAIN) {
      s += '<path d="' + d + '" fill="none" stroke="' + mainColor +
           '" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>';
    }
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
       '<circle id="curDot" r="5" fill="' + mainColor + '" stroke="#1C1C1E" stroke-width="2"' +
       (HIDE_MAIN ? ' visibility="hidden"' : '') + '/></g>';

  svg.innerHTML = s;
  renderSpreads();
}

// ---- Spread charts under the main chart (bps), on the same dates and x positions
var SPREADS = D.spreads || [];
var spGeo = [];
function fmtBps(v) { var r = Math.round(v); return (r < 0 ? "-" : "") + Math.abs(r) + " bps"; }
function renderSpreads() {
  if (!geo) return;
  for (var k = 0; k < SPREADS.length; k++) {
    var sv = el("spc" + k);
    if (!sv) continue;
    var key = SPREADS[k].key, w = geo.w, h = sv.clientHeight || 150;
    var m = { l: geo.m.l, r: geo.m.r, t: 10, b: 22 };
    sv.setAttribute("viewBox", "0 0 " + w + " " + h);
    sv.setAttribute("preserveAspectRatio", "xMinYMin meet");
    var vals = [];
    for (var i = 0; i < pts.length; i++) if (pts[i][key] !== undefined && pts[i][key] !== null) vals.push(pts[i][key]);
    var s = "";
    if (!vals.length) {
      spGeo[k] = null;
      sv.innerHTML = '<text x="' + (w / 2) + '" y="' + (h / 2) + '" fill="#98989F" font-size="12" text-anchor="middle">No data in this range</text>';
      continue;
    }
    var hi = Math.max.apply(null, vals), lo = Math.min.apply(null, vals);
    var pad = (hi - lo) * 0.12; hi += pad; lo -= pad;
    if (hi - lo < 20) { var mid = (hi + lo) / 2; hi = mid + 10; lo = mid - 10; }
    var span = hi - lo, step = span <= 30 ? 5 : span <= 60 ? 10 : span <= 150 ? 25 : span <= 300 ? 50 : 100;
    var y = (function (hi, lo) { return function (v) { return m.t + (hi - v) / (hi - lo) * (h - m.t - m.b); }; })(hi, lo);
    spGeo[k] = { y: y, base: h - m.b };
    for (var g = Math.ceil(lo / step - 1e-9); g * step <= hi + 1e-9; g++) {
      var gv = g * step, gy = y(gv);
      s += '<line x1="' + m.l + '" x2="' + (w - m.r) + '" y1="' + gy + '" y2="' + gy +
           '" stroke="' + (g === 0 ? "#8E8E93" : "#3A3A3C") + '" stroke-width="1"/>';
      s += '<text x="' + (w - m.r + 6) + '" y="' + (gy + 4) + '" fill="#98989F" font-size="11">' + Math.round(gv) + '</text>';
    }
    var d = "", pen = false, dots = "";
    for (var q = 0; q < pts.length; q++) {
      var v = pts[q][key];
      if (v === undefined || v === null) { if (!SPREADS[k].weekly) pen = false; continue; }
      d += (pen ? "L" : "M") + geo.x(q).toFixed(1) + " " + y(v).toFixed(1) + " ";
      pen = true;
      if (SPREADS[k].weekly && vals.length <= 30) {
        dots += '<circle cx="' + geo.x(q).toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="2.6" fill="' + SPREADS[k].color + '"/>';
      }
    }
    s += '<path d="' + d + '" fill="none" stroke="' + SPREADS[k].color +
         '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>' + dots;
    s += '<text x="' + m.l + '" y="' + (h - 5) + '" fill="#98989F" font-size="11">' + fmtDate(pts[0].date) + '</text>';
    s += '<text x="' + (w - m.r) + '" y="' + (h - 5) + '" fill="#98989F" font-size="11" text-anchor="end">' +
         fmtDate(pts[pts.length - 1].date) + '</text>';
    s += '<g id="spcur' + k + '" visibility="hidden">' +
         '<line id="spcl' + k + '" y1="' + m.t + '" y2="' + (h - m.b) + '" stroke="#FFFFFF" stroke-opacity="0.5" stroke-width="1"/>' +
         '<circle id="spcd' + k + '" r="4.5" fill="' + SPREADS[k].color + '" stroke="#1C1C1E" stroke-width="2"/></g>';
    sv.innerHTML = s;
  }
}
// The point a spread shows for position i: itself, or for a weekly series the
// latest weekly point at or before it (null if none in view)
function spreadAt(k, i) {
  var key = SPREADS[k].key;
  if (!SPREADS[k].weekly) return pts[i][key] === undefined || pts[i][key] === null ? null : i;
  for (var j = i; j >= 0; j--) if (pts[j][key] !== undefined && pts[j][key] !== null) return j;
  return null;
}
// Value and change for each spread at point i (the latest, or under the finger)
function spreadHeader(i) {
  for (var k = 0; k < SPREADS.length; k++) {
    var key = SPREADS[k].key;
    if (!el("spv" + k)) continue;
    var at = spreadAt(k, i), v = at === null ? null : pts[at][key];
    el("spv" + k).textContent = v === null ? "n/a" : fmtBps(v);
    var f0 = null;
    for (var j = 0; j < pts.length; j++) if (pts[j][key] !== undefined && pts[j][key] !== null) { f0 = j; break; }
    var sub = SPREADS[k].weekly ? (at === null ? "No weekly point yet in this range" : (pts[at].date === D.pts[N - 1].date ? "Latest, " : "Wk ending ") + fmtDate(pts[at].date)) : fmtDate(pts[i].date);
    if (SPREADS[k].weekly) i = at === null ? i : at;
    if (f0 !== null && f0 < i && v !== null) {
      var c = Math.round(v - pts[f0][key]);
      sub += "  \u00b7  " + (c > 0 ? "+" : c < 0 ? "-" : "") + Math.abs(c) + " bps since " + fmtDate(pts[f0].date);
    }
    el("sps" + k).textContent = sub;
  }
}
function spreadCursor(i) {
  for (var k = 0; k < SPREADS.length; k++) {
    var c = el("spcur" + k);
    if (!c || !spGeo[k]) continue;
    if (i === null) { c.setAttribute("visibility", "hidden"); continue; }
    var at = spreadAt(k, i), v = at === null ? null : pts[at][SPREADS[k].key];
    var cx = geo.x(at === null ? i : at);
    c.setAttribute("visibility", "visible");
    el("spcl" + k).setAttribute("x1", cx); el("spcl" + k).setAttribute("x2", cx);
    var dot = el("spcd" + k);
    if (v === undefined || v === null) dot.setAttribute("visibility", "hidden");
    else { dot.setAttribute("visibility", "visible"); dot.setAttribute("cx", cx); dot.setAttribute("cy", spGeo[k].y(v)); }
  }
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
  spreadCursor(i);
  header(i);
}
function endScrub() {
  var c = el("cur");
  if (c) c.setAttribute("visibility", "hidden");
  spreadCursor(null);
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

var tapDown = null; // the second tap of a possible double-tap, until its finger lifts
function onDown(e) {
  fingers[e.pointerId] = { x: e.clientX, y: e.clientY };
  var n = fingerIds().length;
  if (n === 2 && D.zoom) {
    var st = pinchNow(), span = win.b - win.a;
    // Remember which data point sits between the fingers; it stays there.
    pinch = { dist: st.dist, span: span, anchor: win.a + fracAt(st.mid) * span };
    pinchLock = true; tapDown = null;
    var c = el("cur");
    if (c) c.setAttribute("visibility", "hidden");
    spreadCursor(null);
    header(null);
  } else if (n === 1 && !pinchLock) {
    var now = Date.now();
    if (D.zoom && lastTap && now - lastTap.t < 320 && Math.abs(e.clientX - lastTap.x) < 30) {
      // the second tap of a double-tap: acted on when the finger lifts, so a pinch that starts right after a tap doesn't reset the view
      tapDown = { t: now, x: e.clientX };
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
  if (n === 0) { if (tapDown && !pinchLock && e.type !== "pointercancel" && Date.now() - tapDown.t < 450 && Math.abs(e.clientX - tapDown.x) < 30) { lastTap = null; select(curRange); } tapDown = null;
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
  var kk = t.getAttribute("data-k");
  if (kk === "m") HIDE_MAIN = !HIDE_MAIN;
  else HIDDEN[+kk] = !HIDDEN[+kk];
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

// Spread charts: a title row, a value that follows the scrub, and a chart
// whose touch layer does the same as the main chart's (scrub, pinch, pan)
(function () {
  var html = "";
  for (var k = 0; k < SPREADS.length; k++) {
    html += '<div class="sp"><div class="st"><b><i style="background:' + SPREADS[k].color + '"></i>' + SPREADS[k].label +
            '</b><span class="val" id="spv' + k + '"></span></div><div class="ss" id="sps' + k + '"></div>' +
            '<div class="wrap"><svg id="spc' + k + '" xmlns="http://www.w3.org/2000/svg"></svg><div class="tl" id="spt' + k + '"></div></div></div>';
  }
  el("spreads").innerHTML = html;
  for (var k2 = 0; k2 < SPREADS.length; k2++) {
    var tl = el("spt" + k2);
    tl.addEventListener("pointerdown", onDown);
    tl.addEventListener("pointermove", onMove);
    tl.addEventListener("pointerup", onUp);
    tl.addEventListener("pointercancel", onUp);
    tl.addEventListener("pointerleave", onUp);
  }
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

// ---- Where rates are headed: Freddie Mac's weekly 30-year rate, MBA's
// quarterly forecast of it, and what consumers expect (NY Fed survey medians)
var FC_GOLD = "#FFD60A", FC_TEAL = "#64D2FF", FCV = null;
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
    if (n === 2) { var st = two(); pz = { d: st.d, span: M.t1 - M.t0, at: M.t0 + frac(st.mid) * (M.t1 - M.t0) }; tap = null; tapDown = null; pinched = true; }
    else if (n === 1) {
      var now = Date.now();
      // the second tap of a double-tap: acted on when the finger lifts, so a pinch that starts right after a tap doesn't reset the zoom
      if (tap && now - tap.t < 320 && Math.abs(e.clientX - tap.x) < 30) tapDown = { t: now, x: e.clientX };
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
  var tapDown = null, pinched = false;
  function up(e) {
    if (!f[e.pointerId]) return;
    delete f[e.pointerId];
    var n = Object.keys(f).length;
    if (n < 2) pz = null;
    if (n === 0) {
      if (tapDown && !pinched && e.type !== "pointercancel" && Date.now() - tapDown.t < 450 && Math.abs(e.clientX - tapDown.x) < 30) { tap = null; setV(null); redraw(); }
      tapDown = null; pinched = false;
    }
  }
  ["pointerup", "pointercancel", "pointerleave"].forEach(function (ev) { ov.addEventListener(ev, up); });
}

function ymdT(s) { return Date.parse(s + "T12:00:00Z"); }
function addYears(s, n) { return (+s.slice(0, 4) + n) + s.slice(4); }
function qMid(q) { var y = +q.slice(0, 4), n = +q.slice(5); return y + "-" + ["02", "05", "08", "11"][n - 1] + "-15"; }
function qEnd(q) { var y = +q.slice(0, 4), n = +q.slice(5); return y + "-" + ["03-31", "06-30", "09-30", "12-31"][n - 1]; }
function shortMY(s) { return MONTHS[+s.slice(5, 7) - 1] + " " + s.slice(0, 4); }
// MBA quarters still ahead: those ending after Freddie's latest week
function fcModel() {
  var F = D.fc; if (!F || !F.pmms || !F.pmms.length) return null;
  var last = F.pmms[F.pmms.length - 1];
  var mba = F.mba ? F.mba.q.filter(function (x) { return qEnd(x.q) > last[0]; }) : [];
  var sce = (F.sce || []).map(function (r, k, arr) {
    return { label: r.label, latest: k === arr.length - 1, pts: [[r.survey, r.now], [addYears(r.survey, 1), r.y1], [addYears(r.survey, 3), r.y3]] };
  });
  // earlier MBA forecasts, each from the quarter it came out in
  var old = (F.mbaOld || []).map(function (o) {
    var from = Math.floor(o.st / 100) + "-" + String(o.st % 100).padStart(2, "0") + "-01";
    return { vintage: o.vintage, st: o.st, q: o.q.filter(function (x) { return qEnd(x.q) >= from; }) };
  }).filter(function (o) { return o.q.length; });
  var end = last[0];
  mba.forEach(function (x) { if (qEnd(x.q) > end) end = qEnd(x.q); });
  old.forEach(function (o) { o.q.forEach(function (x) { if (qEnd(x.q) > end) end = qEnd(x.q); }); });
  sce.forEach(function (r) { if (r.pts[2][0] > end) end = r.pts[2][0]; });
  // the window: the zoom, or by default the last 3 years plus the forecast
  var full0 = ymdT(F.pmms[0][0]), full1 = ymdT(end) + 40 * DAY_MS, def0 = Math.max(full0, ymdT(last[0]) - 3 * 365.25 * DAY_MS);
  var a = FCV ? FCV.a : def0, b = FCV ? FCV.b : full1;
  var inW = function (sd) { var t = ymdT(sd); return t >= a && t <= b; };
  var vals = [];
  F.pmms.forEach(function (p) { if (inW(p[0])) vals.push(p[1]); });
  mba.forEach(function (x) { if (inW(qMid(x.q))) vals.push(x.v); });
  old.forEach(function (o) { o.q.forEach(function (x) { if (inW(qMid(x.q))) vals.push(x.v); }); });
  sce.forEach(function (r) { r.pts.forEach(function (p) { if (inW(p[0])) vals.push(p[1]); }); });
  if (!vals.length) vals = [last[1]];
  return { F: F, last: last, mba: mba, old: old, sce: sce, t0: a, t1: b, full0: full0, full1: full1, inW: inW, lo: Math.min.apply(null, vals), hi: Math.max.apply(null, vals) };
}
function renderForecast() {
  var M = fcModel(), sec = el("fcSec");
  if (!M) { sec.style.display = "none"; return; }
  sec.style.display = "";
  var sv = el("fcChart"), w = sv.clientWidth || 360, h = sv.clientHeight || 250;
  var m = { l: 8, r: 40, t: 12, b: 24 };
  sv.setAttribute("viewBox", "0 0 " + w + " " + h);
  var lo = Math.floor(M.lo * 2 - 0.6) / 2, hi = Math.ceil(M.hi * 2 + 0.6) / 2, step = hi - lo > 4 ? 1 : 0.5;
  var X = function (s) { return m.l + (ymdT(s) - M.t0) / (M.t1 - M.t0) * (w - m.l - m.r); };
  var Y = function (v) { return m.t + (hi - v) / (hi - lo) * (h - m.t - m.b); };
  var s = "";
  for (var g = Math.ceil(lo / step - 1e-9) * step; g <= hi + 1e-9; g += step) {
    s += '<line x1="' + m.l + '" x2="' + (w - m.r) + '" y1="' + Y(g) + '" y2="' + Y(g) + '" stroke="#3A3A3C"/>';
    s += '<text x="' + (w - m.r + 6) + '" y="' + (Y(g) + 4) + '" fill="#98989F" font-size="11">' + g.toFixed(step < 1 ? 1 : 0) + "%</text>";
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
  s += '<defs><clipPath id="fcClip"><rect x="' + m.l + '" y="0" width="' + (w - m.l - m.r) + '" height="' + (h - m.b) + '"/></clipPath></defs><g clip-path="url(#fcClip)">';
  // today
  var tx = X(M.last[0]);
  s += '<line x1="' + tx + '" x2="' + tx + '" y1="' + m.t + '" y2="' + (h - m.b) + '" stroke="#8E8E93" stroke-dasharray="2 3"/>';
  s += '<text x="' + (tx - 4) + '" y="' + (m.t + 10) + '" fill="#8E8E93" font-size="10" text-anchor="end">Today</text>';
  // consumers: from each February survey, what people thought rates were then (hollow) and expected 1 and 3 years out
  M.sce.forEach(function (r) {
    var op = r.latest ? 1 : 0.45, d = "";
    r.pts.forEach(function (p, k) { d += (k ? "L" : "M") + X(p[0]).toFixed(1) + " " + Y(p[1]).toFixed(1); });
    s += '<path d="' + d + '" fill="none" stroke="' + FC_TEAL + '" stroke-opacity="' + op + '" stroke-width="2.2" stroke-dasharray="1.5 4" stroke-linecap="round"/>';
    r.pts.forEach(function (p, k) {
      s += '<circle cx="' + X(p[0]).toFixed(1) + '" cy="' + Y(p[1]).toFixed(1) + '" r="3.6" fill="' + (k ? FC_TEAL : "#1C1C1E") + '" fill-opacity="' + (k ? op : 1) + '" stroke="' + FC_TEAL + '" stroke-opacity="' + op + '" stroke-width="1.6"/>';
    });
    var e = r.pts[2];
    s += '<text x="' + (X(e[0]) - 6).toFixed(1) + '" y="' + (Y(e[1]) + 15).toFixed(1) + '" fill="' + FC_TEAL + '" fill-opacity="' + op + '" font-size="10.5" font-weight="600" text-anchor="end">' + r.label + " survey: " + e[1].toFixed(1) + "%</text>";
  });
  // Freddie Mac's weekly rate
  var dl = "";
  M.F.pmms.forEach(function (p, k) { dl += (k ? "L" : "M") + X(p[0]).toFixed(1) + " " + Y(p[1]).toFixed(1); });
  s += '<path d="' + dl + '" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linejoin="round"/>';
  s += '<circle cx="' + tx + '" cy="' + Y(M.last[1]) + '" r="4" fill="#FFFFFF" stroke="#1C1C1E" stroke-width="1.5"/>';
  // earlier MBA forecasts, fainter, labeled with their month below the line end
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
  // MBA's forecast, joined to today's rate
  if (M.mba.length) {
    var dm = "M" + tx.toFixed(1) + " " + Y(M.last[1]).toFixed(1);
    M.mba.forEach(function (x) { dm += "L" + X(qMid(x.q)).toFixed(1) + " " + Y(x.v).toFixed(1); });
    s += '<path d="' + dm + '" fill="none" stroke="' + FC_GOLD + '" stroke-width="2.4" stroke-dasharray="6 4" stroke-linejoin="round"/>';
    M.mba.forEach(function (x) { s += '<circle cx="' + X(qMid(x.q)).toFixed(1) + '" cy="' + Y(x.v).toFixed(1) + '" r="3" fill="' + FC_GOLD + '"/>'; });
    var lm = M.mba[M.mba.length - 1], mtop = Math.max.apply(null, M.mba.map(function (x) { return x.v; }));
    s += '<text x="' + X(qMid(lm.q)).toFixed(1) + '" y="' + (Y(mtop) - 10).toFixed(1) + '" fill="' + FC_GOLD + '" font-size="10.5" font-weight="700" text-anchor="end">MBA ' + lm.v.toFixed(1) + "%</text>";
  }
  sv.innerHTML = s + "</g>";
  // title row, legend, note
  var lastS = M.sce.length ? M.sce[M.sce.length - 1] : null, lm2 = M.mba.length ? M.mba[M.mba.length - 1] : null;
  el("fcSub").innerHTML = "Freddie Mac 30-yr " + '<b style="color:#fff">' + M.last[1].toFixed(2) + "%</b> (" + fmtDate(M.last[0]) + ")" +
    (lm2 ? " · MBA: " + lm2.v.toFixed(1) + "% by " + lm2.q.slice(4) + " " + lm2.q.slice(0, 4) : "") +
    (lastS ? " · consumers: " + lastS.pts[2][1].toFixed(1) + "% by " + shortMY(lastS.pts[2][0]) : "");
  var lk = el("fcLink");
  var all = M.F.mba ? [M.F.mba].concat(M.F.mbaOld || []) : [];
  if (all.length) {
    lk.style.display = "";
    lk.innerHTML = "MBA forecast PDFs: " + all.map(function (o) { return '<span data-st="' + o.st + '">' + o.vintage + "</span>"; }).join(" · ");
  } else lk.style.display = "none";
  el("fcLeg").innerHTML = '<span><i style="background:#FFFFFF"></i>Freddie Mac 30-yr</span>' +
    (M.F.mba ? '<span><i class="dash"></i>MBA forecast (' + M.F.mba.vintage + ")</span>" : "") +
    (M.old.length ? '<span><i class="dash" style="opacity:0.45"></i>Earlier: ' + M.old.map(function (o) { return o.vintage.slice(0, 3); }).join(", ") + "</span>" : "") +
    '<span><i class="dot3"></i>Consumers expect (median)</span>';
  el("fcNote").textContent = "White: Freddie Mac's weekly 30-year fixed rate (FRED MORTGAGE30US), the rate MBA forecasts; it runs at a different level than the Optimal Blue rates above. " +
    (M.F.mba ? "Gold: MBA's Mortgage Finance Forecast (" + M.F.mba.vintage + (M.F.mba.asOf ? ", dated " + M.F.mba.asOf : "") + "), quarterly averages, plotted mid-quarter and joined to today's rate. Fainter gold: the two forecasts before it, each from the quarter it came out in, so you can see how MBA's call has moved. The newest 3 are kept; tap a month under the chart to open that PDF. " : "MBA's forecast hasn't loaded yet; it's read from MBA's monthly PDF. ") +
    "Pinch to zoom in time (back to 2015), drag with two fingers to pan, double-tap to reset. Blue: NY Fed Survey of Consumer Expectations, Housing Survey (each February). Median answers for the average national 30-year rate: hollow dot = what people thought it was at the survey, then where they expected it 1 and 3 years later. The older survey is faded. Medians are whole or half numbers; the averages run much higher because of a few extreme answers.";
}
window.setForecast = function (fc) { D.fc = fc; renderForecast(); };
fcZoomable("fcTouch", "fcChart", fcModel, function (v) { FCV = v; }, renderForecast);
// The MBA link: the script, polling, opens the PDF itself over this view
var mbaWanted = false;
window.__takeMba = function () { var w = mbaWanted; mbaWanted = false; return w; };
el("fcLink").addEventListener("click", function (e) {
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
renderForecast();
window.addEventListener("resize", renderForecast);
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
  // the forecast chart fills in (or updates) after the page opens
  await presentWithSharing(wv, async (isOpen) => {
    let fc = payload.fc;
    try {
      fc = forecastPayload(await refreshForecast()) || fc;
      if (fc && isOpen()) await wv.evaluateJavaScript(`window.setForecast(${JSON.stringify(fc)});0`);
    } catch (e) {}
    // taps on the MBA link under the forecast chart
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
    const rel = await fredJSON(`${base}/series/release?series_id=${seriesId}&api_key=${apiKey}&file_type=json`);
    const id = rel && rel.releases && rel.releases[0] && rel.releases[0].id;
    if (!id) throw new Error("no release");
    const r = await fredJSON(`${base}/release/dates?release_id=${id}&api_key=${apiKey}&file_type=json&include_release_dates_with_no_data=true&sort_order=desc&limit=60`);
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
function schedSpfNext(lastQi) { const q = lastQi + 1, y = Math.floor(q / 4), m0 = (q % 4) * 3 + 1; return schedDay(y, m0, 15); }

// This widget's sources, next update first
function wacSchedule(data, fc) {
  const lastD = (arr, k) => (arr && arr.length ? arr[arr.length - 1][k || "date"] : null);
  const pts = data.pts || data.series || [];
  const rows = [
    schedDaily("Optimal Blue rates", schedDateName(lastD(pts)), [8, 2], "FRED, business days"),
    schedWeekly("MBA weekly applications (product mix)", data.mix && data.mix.weekEnding ? "wk of " + data.mix.weekEnding.replace(/, \d{4}$/, "") : "", 3, [7, 0], "weekly, Wednesday"),
    schedWeekly("Freddie Mac 30-yr (PMMS)", fc && fc.pmms && fc.pmms.length ? schedDateName(fc.pmms[fc.pmms.length - 1][0]) : "", 4, [12, 0], "weekly, Thursday noon"),
  ];
  // MBA posts each month's forecast around mid-month
  const mbas = (fc && (fc.mbas || (fc.mba ? [fc.mba] : []))) || [];
  if (mbas.length) { const st = Math.max(...mbas.map((m) => m.st)), y = Math.floor(st / 100), m0 = st % 100; rows.push(schedEst("MBA forecast", mbas.find((m) => m.st === st).vintage, [schedDay(y, m0, 11), schedDay(y, m0, 20)], "monthly, mid-month", { checked: fc.mbasChecked, cadence: "checks daily while due, else every few days" })); }
  // the NY Fed's housing survey runs each February; results come out in the spring
  const sce = SCE_RATES[SCE_RATES.length - 1], sy = +sce.survey.slice(0, 4) + 1;
  rows.push(schedEst("NY Fed housing survey (rate expectations)", sce.label + " survey", [schedDay(sy, 3, 1), schedDay(sy, 4, 31)], "yearly, out in the spring", { cadence: "not fetched: its numbers are typed into the script (SCE_RATES) each spring" }));
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
    const data = await getData();
    const payload = detailPayload(data);
    if (data.stale) payload.staleNote = "FRED unreachable · showing data through " + throughLabel(data);
    payload.fc = forecastPayload(readSaved(FC_FILE));
    try { payload.sched = wacSchedule(data, readSaved(FC_FILE)); } catch (e) { payload.sched = []; }
    await presentDetail(payload);
  } catch (e) {
    await errorWidget(e.message || e).presentSmall();
  }
}
Script.complete();
// Update test, Nov 17, 2026 (no change in behavior)
