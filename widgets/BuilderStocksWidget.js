// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: orange; icon-glyph: home;

// ---- Shared settings (saved on this phone by the Setup script) ----
// Keys and personal settings live in the phone's keychain, not in this file,
// so the file can be shared as is.
function setting(key, fallback) {
  try { if (Keychain.contains(key)) { const v = Keychain.get(key); if (v) return v; } } catch (e) {}
  return fallback;
}

// Builder Stocks Widget (small): a heatmap of the 10 largest US public
// homebuilders' stock moves over the last 30 trading days.
// Each row is a builder (ticker on the left), each column a trading day, and
// each cell the % change from the window's first day: blues deepening with
// the gain, oranges deepening with the drop. Biggest gainer on top. The last column is today,
// live during market hours (as often as iOS refreshes the widget).
// The 10: about 16 US homebuilders ranked by market cap (latest price ×
// shares outstanding from each company's latest SEC filing).
// Tap: market caps, a bigger heatmap with a 30 / 45 / 60-day switch, and a
// release schedule; Share makes a 2-slide PDF.
// Prices: Yahoo Finance's free chart feed (unofficial; about 15 minutes
// delayed), with Stooq daily closes as the fallback.

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
// ---------- Black-screen guard (shared by every widget with a full view) ----------
// iOS runs each web page in its own process and sometimes kills it (low memory, a cold
// launch from a widget tap): the view keeps its Close button but goes black, and nothing
// tells the script. So while the full view is open, check that the page is alive; if it
// isn't, draw it again (twice at most) and say so in a small gray note (kept out of PDFs).
// tools/page_guard.js is the master copy; tools/sync_page_guard.py puts it in each widget.
let UPD_LAST = null; // the main full view's latest loadHTML arguments
function updArgs(html, base) {
  const a = base === undefined ? [updPage(html)] : [updPage(html), base];
  if (typeof html === "string" && (html.indexOf("__takeShare") >= 0 || html.indexOf("<title>Reports</title>") >= 0)) UPD_LAST = a;
  return a;
}
async function updWatch(wv, isOpen) {
  const nap = (ms) => new Promise((r) => Timer.schedule(ms, false, r));
  let redraws = 0, slow = 0, wait = 3000;
  while (isOpen()) {
    await nap(wait);
    wait = 10000;
    if (!isOpen() || !UPD_LAST) continue;
    // alive: answers, and has drawn something. A page busy for a while (building a PDF)
    // doesn't answer at once: only two slow checks in a row count as dead
    let st = "dead";
    try {
      const r = await Promise.race([wv.evaluateJavaScript("(document.body && document.body.innerText.length > 20) ? 1 : 0"), nap(15000).then(() => "slow")]);
      st = r === "slow" ? "slow" : r === 1 ? "ok" : "dead";
    } catch (e) {}
    if (st === "ok") { slow = 0; continue; }
    if (st === "slow" && ++slow < 2) continue;
    if (!isOpen()) break;
    slow = 0;
    if (redraws >= 2) {
      try { await wv.loadHTML('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:28px 20px;background:#000;color:#FF9F0A;font:16px -apple-system,sans-serif;line-height:1.45"><b>The page keeps going black.</b><br><br>iOS dropped it three times, which usually means the phone is short on memory. Close this, close a few other apps, and open the widget again.</body></html>'); } catch (e) {}
      break;
    }
    redraws++;
    try { await wv.loadHTML(...UPD_LAST); } catch (e) {}
    const note = "iOS dropped this page; redrawn" + (redraws > 1 ? " (" + redraws + "×)" : "");
    try {
      await wv.evaluateJavaScript(`(function () { var b = document.body; if (!b) return 0; var d = document.createElement("div"); d.className = "hint"; d.id = "hwRedrawn"; d.textContent = ${JSON.stringify(note)}; d.style.cssText = "color:#8E8E93;font-size:11.5px;margin:4px 0 6px"; var t = document.querySelector("h1,.ticker,.title"); if (t && t.parentNode) t.parentNode.insertBefore(d, t.nextSibling); else b.insertBefore(d, b.firstChild); return 1; })()`);
    } catch (e) {}
  }
}
// ---------- end black-screen guard ----------
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
const WINDOW = 30; // trading days on the home-screen widget
const WINDOWS = [30, 60, 90]; // the app's buttons (pinch the heatmap for any range up to a year)
const MAX_DAYS = 252; // about a year of trading days, the furthest the app zooms out
const KEEP_DAYS = 280; // daily closes kept per builder
const TOP_N = 10;
const HIGHLIGHT = setting("highlight_builder", "DHI"); // this builder's row stays bright and outlined (and always shows); the rest fade back
const CANDIDATES = [
  { t: "DHI", name: "D.R. Horton" },
  { t: "LEN", name: "Lennar" },
  { t: "PHM", name: "PulteGroup" },
  { t: "NVR", name: "NVR" },
  { t: "TOL", name: "Toll Brothers" },
  { t: "TMHC", name: "Taylor Morrison" },
  { t: "MTH", name: "Meritage Homes" },
  { t: "KBH", name: "KB Home" },
  { t: "DFH", name: "Dream Finders" },
  { t: "CCS", name: "Century Communities" },
  { t: "MHO", name: "M/I Homes" },
  { t: "TPH", name: "Tri Pointe" },
  { t: "GRBK", name: "Green Brick" },
  { t: "LGIH", name: "LGI Homes" },
  { t: "BZH", name: "Beazer Homes" },
  { t: "HOV", name: "Hovnanian" },
];
const FILE = "builder-stocks-v1.json";
const WIDGET_BUDGET_S = 20;
const LIVE_MIN = 10; // during market hours, prices older than this are fetched again
const SHARES_DAYS = 7; // shares outstanding are looked up again after this many days
const SEC_KEY = "sec_contact"; // name and email for SEC requests, in the keychain (shared with Reports and New Construction)
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const PREVIEW_WIDGET_IN_APP = false;

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const GRAY = "#98989F", DIM = "#636366";
// cell colors: change from the window's first day; blues for up, oranges for down
const UP = [[20, "#1F4E79"], [10, "#3E73A0"], [5, "#6A9CC2"], [2, "#9DC1D9"], [-Infinity, "#C9DFEA"]];
const DOWN = [[-10, "#7E4317"], [-5, "#CD7A2D"], [-2, "#DFA580"], [-Infinity, "#EAC9A7"]];
function cellColor(p) {
  if (p == null) return "#2C2C2E";
  if (p > -0.05) { for (const [lo, c] of UP) if (p >= lo) return c; } // day 1 (0%) is the palest blue
  const a = -p;
  for (const [lo, c] of DOWN) if (-a <= lo) return c;
  return DOWN[3][1];
}
const sleep = (ms) => new Promise((r) => Timer.schedule(ms, false, r));

// ---------- Files ----------
function fm() { return FileManager.local(); }
function readStore() {
  try { const p = fm().joinPath(fm().documentsDirectory(), FILE); if (fm().fileExists(p)) return JSON.parse(fm().readString(p)); } catch (e) {}
  return { px: {}, shares: {} };
}
function saveStore(s) { try { fm().writeString(fm().joinPath(fm().documentsDirectory(), FILE), JSON.stringify(s)); } catch (e) {} }

// ---------- Prices ----------
// Yahoo's chart feed: 6 months of daily closes, plus the live price
async function yahooGet(host, t, range) {
  const r = new Request(`https://${host}/v8/finance/chart/${encodeURIComponent(t)}?range=${range}&interval=1d`);
  r.headers = { "User-Agent": UA };
  r.timeoutInterval = 15;
  const txt = await r.loadString(), code = (r.response && r.response.statusCode) || 0;
  let j = null;
  try { j = JSON.parse(txt); } catch (e) { throw new Error(`HTTP ${code}: ${txt.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 60) || "empty answer"}`); }
  const res = j && j.chart && j.chart.result && j.chart.result[0];
  if (!res || !res.timestamp) throw new Error(`HTTP ${code}: ` + ((j && j.chart && j.chart.error && j.chart.error.description) || "no prices in the answer"));
  return res;
}
// Yahoo's chart feed on either of its hosts: 6 months of daily closes, plus the live price
// range: "2y" once a day (a year-plus of closes for the zoom), "5d" for the top-ups in between
async function yahoo(t, range) {
  let res;
  try { res = await yahooGet("query1.finance.yahoo.com", t, range); } catch (e) { await sleep(400); res = await yahooGet("query2.finance.yahoo.com", t, range); }
  const meta = res.meta || {}, off = meta.gmtoffset || 0, cl = ((res.indicators || {}).quote || [{}])[0].close || [];
  const by = {};
  res.timestamp.forEach((s, i) => { if (cl[i] != null) by[new Date((s + off) * 1000).toISOString().slice(0, 10)] = +cl[i]; });
  let live = null;
  if (meta.regularMarketPrice && meta.regularMarketTime) {
    const d = new Date((meta.regularMarketTime + off) * 1000).toISOString().slice(0, 10);
    by[d] = +meta.regularMarketPrice; // today's bar, or the close, as of the latest trade
    const per = meta.currentTradingPeriod && meta.currentTradingPeriod.regular, now = Date.now() / 1000;
    live = { at: meta.regularMarketTime * 1000, open: !!(per && now >= per.start && now <= per.end), src: "Yahoo" };
  }
  return { days: Object.keys(by).sort().map((d) => ({ d, c: by[d] })), live };
}
// Stooq's daily closes, when Yahoo doesn't answer
async function stooq(t) {
  const r = new Request(`https://stooq.com/q/d/l/?s=${t.toLowerCase()}.us&i=d`);
  r.headers = { "User-Agent": UA };
  r.timeoutInterval = 15;
  const rows = (await r.loadString()).trim().split(/\r?\n/).slice(1).map((l) => l.split(",")).filter((c) => /^\d{4}-\d\d-\d\d$/.test(c[0]) && +c[4] > 0);
  if (!rows.length) throw new Error("no prices in the answer");
  return { days: rows.slice(-KEEP_DAYS).map((c) => ({ d: c[0], c: +c[4] })), live: { at: Date.parse(rows[rows.length - 1][0] + "T21:00:00Z"), open: false, src: "Stooq" } };
}
async function prices(s, t) {
  const old = s.px[t], full = !old || !old.fullAt || Date.now() - old.fullAt > 20 * 3600e3 || !old.days || old.days.length < 200;
  try {
    const p = await yahoo(t, full ? "2y" : "5d");
    // a top-up's few days merge into the stored year
    const by = {};
    if (!full) old.days.forEach((o) => (by[o.d] = o.c));
    p.days.forEach((o) => (by[o.d] = o.c));
    const days = Object.keys(by).sort().slice(-KEEP_DAYS).map((d) => ({ d, c: by[d] }));
    s.px[t] = { days, live: p.live, err: null, checked: Date.now(), fullAt: full ? Date.now() : old.fullAt };
    return;
  } catch (e) {
    try { const p = await stooq(t); s.px[t] = { ...p, err: "Yahoo failed (" + (e.message || e) + "); using Stooq closes", checked: Date.now(), fullAt: Date.now() }; return; } catch (e2) {
      s.px[t] = { ...(s.px[t] || { days: [] }), err: "Yahoo: " + (e.message || e) + " · Stooq: " + (e2.message || e2), checked: Date.now() };
    }
  }
}

// ---------- Shares outstanding (SEC) ----------
function secContact() { return Keychain.contains(SEC_KEY) ? Keychain.get(SEC_KEY) : ""; }
async function secJSON(url) {
  const r = new Request(url);
  r.headers = { "User-Agent": secContact() };
  r.timeoutInterval = 20;
  return r.loadJSON();
}
// The latest filing's cover-page share count; classes (Lennar's A and B) added together
async function shares(s, t) {
  if (!s.cik || !s.cikAt || Date.now() - s.cikAt > 30 * 864e5) {
    const j = await secJSON("https://www.sec.gov/files/company_tickers.json");
    s.cik = {};
    Object.values(j).forEach((o) => { s.cik[String(o.ticker).toUpperCase()] = o.cik_str; });
    s.cikAt = Date.now();
  }
  const cik = s.cik[t];
  if (!cik) throw new Error("not in SEC's ticker list");
  const base = `https://data.sec.gov/api/xbrl/companyconcept/CIK${String(cik).padStart(10, "0")}`;
  // 1) the cover page's count. SEC's API leaves out counts given by share class
  //    (Lennar's A and B), so for those it's missing or years old
  let got = null;
  try {
    const list = (((await secJSON(`${base}/dei/EntityCommonStockSharesOutstanding.json`)).units || {}).shares || []).filter((o) => o.val > 0);
    if (list.length) {
      const lastFiled = list.reduce((a, o) => (o.filed > a ? o.filed : a), "");
      const latest = list.filter((o) => o.filed === lastFiled);
      const accn = latest[0].accn, end = latest.reduce((a, o) => (o.end > a ? o.end : a), "");
      got = { n: latest.filter((o) => o.accn === accn && o.end === end).reduce((a, o) => a + o.val, 0), filed: lastFiled, end, form: latest[0].form, src: "cover" };
    }
  } catch (e) {}
  // 2) missing or over a year old: the latest quarter's diluted weighted-average shares from the financials (all classes)
  if (!got || Date.now() - Date.parse(got.filed) > 400 * 864e5) {
    for (const tag of ["WeightedAverageNumberOfDilutedSharesOutstanding", "WeightedAverageNumberOfSharesOutstandingBasic"]) {
      try {
        const list = (((await secJSON(`${base}/us-gaap/${tag}.json`)).units || {}).shares || []).filter((o) => o.val > 0 && o.start);
        if (!list.length) continue;
        const lastFiled = list.reduce((a, o) => (o.filed > a ? o.filed : a), "");
        // the shortest (quarter) period ending latest in that filing
        const pick = list.filter((o) => o.filed === lastFiled).sort((a, b) => (b.end > a.end ? 1 : b.end < a.end ? -1 : b.start > a.start ? 1 : -1))[0];
        if (!got || lastFiled > got.filed) got = { n: pick.val, filed: lastFiled, end: pick.end, form: pick.form, src: tag.includes("Diluted") ? "diluted avg" : "basic avg" };
        break;
      } catch (e) {}
    }
  }
  if (!got) throw new Error("no share count filed");
  s.shares[t] = { ...got, at: Date.now() };
}

// ---------- Market caps (Yahoo) ----------
// Yahoo's quote feed gives each builder's market cap, all 16 in one request.
// It wants a session first: a cookie from fc.yahoo.com, then a token ("crumb").
async function yahooSession(s) {
  if (s.yc && Date.now() - s.yc.at < 12 * 3600e3) return s.yc;
  const a = new Request("https://fc.yahoo.com");
  a.headers = { "User-Agent": UA };
  a.timeoutInterval = 15;
  try { await a.load(); } catch (e) {} // the page itself doesn't matter; its cookie does
  const cookie = ((a.response && a.response.cookies) || []).map((c) => `${c.name}=${c.value}`).join("; ");
  const b = new Request("https://query1.finance.yahoo.com/v1/test/getcrumb");
  b.headers = cookie ? { "User-Agent": UA, Cookie: cookie } : { "User-Agent": UA };
  b.timeoutInterval = 15;
  const crumb = (await b.loadString()).trim(), code = (b.response && b.response.statusCode) || 0;
  if (!crumb || crumb.length > 40 || /[<{\s]/.test(crumb)) throw new Error(`no session token (HTTP ${code})`);
  s.yc = { cookie, crumb, at: Date.now() };
  return s.yc;
}
async function yahooCaps(s) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const yc = await yahooSession(s);
    const q = new Request(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${CANDIDATES.map((c) => c.t).join(",")}&fields=marketCap,regularMarketPrice,earningsTimestamp,earningsTimestampStart,earningsTimestampEnd,earningsCallTimestampStart,isEarningsDateEstimate&crumb=${encodeURIComponent(yc.crumb)}`);
    q.headers = yc.cookie ? { "User-Agent": UA, Cookie: yc.cookie } : { "User-Agent": UA };
    q.timeoutInterval = 15;
    const txt = await q.loadString(), code = (q.response && q.response.statusCode) || 0;
    let j = null;
    try { j = JSON.parse(txt); } catch (e) {}
    const list = j && j.quoteResponse && j.quoteResponse.result;
    if (code === 401 || !list) { s.yc = null; if (attempt === 0) continue; throw new Error(`HTTP ${code}: ${((j && j.finance && j.finance.error && j.finance.error.description) || txt.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()).slice(0, 60)}`); }
    const caps = {};
    list.forEach((o) => { if (o.symbol && o.marketCap > 0) caps[String(o.symbol).toUpperCase()] = o.marketCap; });
    takeEarnings(s, list);
    if (!Object.keys(caps).length) throw new Error("no market caps in the answer");
    s.ycap = { caps, at: Date.now(), err: null };
    return;
  }
}

// ---------- Refresh ----------
// Prices: during market hours when older than LIVE_MIN minutes; otherwise once
// after the close (and each time the app opens). Shares: weekly.
function marketOpenNow(s) { return Object.values(s.px || {}).some((p) => p.live && p.live.open && Date.now() - p.checked < 6 * 3600e3); }
// step(name): called after each stage so the page can redraw as data arrives
async function refresh(s, force, say, step) {
  const now = Date.now(), times = [];
  const timed = async (label, fn) => { const t0 = Date.now(); try { await fn(); } finally { times.push(`${label} ${((Date.now() - t0) / 1000).toFixed(1)}s`); } if (step) await step(); };
  // 1) market caps and earnings dates: one quick request
  if (!s.ycap || !s.ycap.at || force || now - s.ycap.at >= (marketOpenNow(s) ? LIVE_MIN : 60) * 60000) {
    if (say) await say("Getting market caps and earnings dates…");
    await timed("caps", async () => { try { await yahooCaps(s); } catch (e) { s.ycap = { ...(s.ycap || {}), err: e.message || String(e), errAt: now }; } });
  }
  const stale = (t) => {
    const p = s.px[t];
    if (!p || !p.checked || force) return true;
    const mins = (now - p.checked) / 60000;
    if (marketOpenNow(s)) return mins >= LIVE_MIN;
    return mins >= 60; // the close posts once; an hour is plenty outside market hours
  };
  // 2) prices, 6 at a time (all 16 at once can get some turned away by Yahoo)
  const due = CANDIDATES.filter((c) => stale(c.t));
  if (due.length) {
    if (say) await say(`Getting prices for ${due.length} builders${due.some((c) => !s.px[c.t] || !s.px[c.t].fullAt || Date.now() - s.px[c.t].fullAt > 20 * 3600e3) ? " (the day's full year of history)" : ""}…`);
    await timed("prices", async () => {
      let left = due.slice();
      const worker = async () => { while (left.length) { const c = left.shift(); await prices(s, c.t); } };
      await Promise.all([1, 2, 3, 4, 5, 6].map(worker));
    });
  }
  // 3) SEC share counts, only for builders Yahoo gave no market cap
  const capped = (s.ycap && s.ycap.caps) || {};
  if (secContact()) {
    const need = CANDIDATES.filter((c) => !capped[c.t] && (FIX_FORCE || !s.shares[c.t] || !s.shares[c.t].src || (s.shares[c.t].err ? now - s.shares[c.t].at > 864e5 : now - s.shares[c.t].at > SHARES_DAYS * 864e5)));
    if (need.length) {
      if (say) await say(`Getting share counts from SEC for ${need.map((c) => c.t).join(", ")}…`);
      await timed("SEC", async () => {
        for (const c of need) {
          try { await shares(s, c.t); } catch (e) { s.shares[c.t] = { ...(s.shares[c.t] || {}), err: e.message || String(e), at: now }; }
          await sleep(120); // SEC asks for no more than 10 requests a second
        }
      });
    }
  }
  s.checked = now;
  s.timing = times.length ? `Updated in ${((Date.now() - now) / 1000).toFixed(1)}s (${times.join(", ")})` : "";
  saveStore(s);
  if (say) await say(s.timing);
  return s;
}

// ---------- The numbers ----------
// The last W trading days (from all builders' dates), each builder's close on
// each (carried forward over a missing day), and the % change from the first
function model(s, W) {
  const all = new Set();
  const live = CANDIDATES.filter((c) => s.px[c.t] && s.px[c.t].days.length);
  // a builder whose last trade is more than 10 days old has stopped trading
  const newest = live.reduce((a, c) => { const d = s.px[c.t].days; return d[d.length - 1].d > a ? d[d.length - 1].d : a; }, "");
  const active = live.filter((c) => { const d = s.px[c.t].days; return newest && (Date.parse(newest) - Date.parse(d[d.length - 1].d)) / 864e5 <= 10; });
  active.forEach((c) => s.px[c.t].days.forEach((o) => all.add(o.d)));
  const dates = [...all].sort().slice(-W);
  const rows = active.map((c) => {
    const px = s.px[c.t], by = {};
    px.days.forEach((o) => (by[o.d] = o.c));
    let prev = null;
    const before = px.days.filter((o) => o.d < dates[0]);
    if (before.length) prev = before[before.length - 1].c;
    const closes = dates.map((d) => (by[d] != null ? (prev = by[d]) : prev));
    const have = dates.filter((d) => by[d] != null).length;
    const base = closes.find((v) => v != null);
    const cells = closes.map((v) => (v == null || !base ? null : (v / base - 1) * 100));
    const last = px.days[px.days.length - 1], prior = px.days[px.days.length - 2];
    const sh = s.shares[c.t];
    // market cap: Yahoo's (if from the last 2 days), else the SEC estimate
    const yCap = s.ycap && s.ycap.caps && s.ycap.at && Date.now() - s.ycap.at < 2 * 864e5 ? s.ycap.caps[c.t] : null;
    const secCap = sh && sh.n ? px.days[px.days.length - 1].c * sh.n : null;
    return {
      t: c.t, name: c.name, sharesSrc: sh && sh.src, sharesErr: sh && !sh.n ? sh.err : null, price: last.c, priceDay: last.d, day: prior ? (last.c / prior.c - 1) * 100 : null,
      chg: cells[cells.length - 1], cells, cap: yCap || secCap, capSrc: yCap ? "Yahoo" : secCap ? "SEC est." : null,
      capGap: yCap && secCap && Math.abs(yCap / secCap - 1) > 0.1 ? secCap : null, sharesFiled: sh && sh.filed, err: px.err,
      thin: have < dates.length / 2, // too few prices in the window to show (e.g. only a fallback's last few days)
    };
  });
  // top 10 by market cap (any without a share count go last, in list order)
  const ranked = rows.slice().sort((a, b) => (b.cap || 0) - (a.cap || 0) || CANDIDATES.findIndex((c) => c.t === a.t) - CANDIDATES.findIndex((c) => c.t === b.t));
  ranked.forEach((r, i) => (r.rank = i + 1));
  let topList = ranked.filter((r) => !r.thin).slice(0, TOP_N);
  const hiRow = ranked.find((r) => r.t === HIGHLIGHT && !r.thin);
  if (hiRow && !topList.includes(hiRow)) topList = topList.slice(0, TOP_N - 1).concat([hiRow]);
  ranked.forEach((r) => (r.hi = r.t === HIGHLIGHT));
  const top = topList.sort((a, b) => (b.chg == null ? -999 : b.chg) - (a.chg == null ? -999 : a.chg));
  // the freshest live price from Yahoo (Stooq only when Yahoo gave nothing)
  const lives = Object.values(s.px).map((p) => p.live).filter(Boolean), yl = lives.filter((l) => l.src === "Yahoo");
  const lv = (yl.length ? yl : lives).sort((a, b) => b.at - a.at)[0] || null;
  // builders with no usable prices, and why
  const failed = CANDIDATES.filter((c) => !active.includes(c)).map((c) => ({
    t: c.t, name: c.name,
    why: s.px[c.t] && s.px[c.t].err ? s.px[c.t].err : s.px[c.t] && s.px[c.t].days && s.px[c.t].days.length ? "last trade " + s.px[c.t].days[s.px[c.t].days.length - 1].d + " (stopped trading?)" : "no prices yet",
    sharesErr: s.shares[c.t] && s.shares[c.t].err,
  }));
  return { dates, top, ranked, failed, live: lv, haveCaps: rows.some((r) => r.cap) };
}
function fmtPct(p, d) { return p == null ? "–" : (p > 0 ? "+" : p < 0 ? "−" : "") + Math.abs(p).toFixed(d == null ? 1 : d) + "%"; }
// times shown in Central
function ctTime(ms) { return new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" }).replace(" ", "").toLowerCase().replace(":00", "").replace(/m$/, ""); }
function shortD(iso) { const [, m, d] = iso.split("-").map(Number); return `${MON[m - 1]} ${d}`; }

// ---------- Widget ----------
function drawText(ctx, text, rect, font, color, align) {
  ctx.setFont(font);
  ctx.setTextColor(new Color(color));
  if (align === "right") ctx.setTextAlignedRight();
  else if (align === "center") ctx.setTextAlignedCenter();
  else ctx.setTextAlignedLeft();
  ctx.drawTextInRect(text, rect);
}
function drawWidget(s) {
  const ctx = new DrawContext();
  ctx.size = new Size(170, 170);
  ctx.opaque = true;
  ctx.respectScreenScale = true;
  ctx.setFillColor(new Color("#1C1C1E"));
  ctx.fillRect(new Rect(0, 0, 170, 170));
  const M = model(s, WINDOW);
  const open = M.live && M.live.open;
  // header: the window and the time (Central) on the left; the highlighted builder's price on the right, colored by today's move
  const asOf = !M.live ? "" : open ? `${ctTime(M.live.at)} CT` : shortD(M.dates[M.dates.length - 1] || "2000-01-01") + " close";
  drawText(ctx, `${WINDOW}D · ${asOf}`, new Rect(8, 6, 90, 12), Font.semiboldSystemFont(9), open ? "#64D2FF" : GRAY);
  const hr = M.ranked.find((x) => x.hi);
  if (hr) {
    const pxText = "$" + (hr.price >= 1000 ? Math.round(hr.price).toLocaleString("en-US") : hr.price.toFixed(2));
    drawText(ctx, `${hr.t} ${pxText}`, new Rect(84, 5.5, 78, 13), Font.boldSystemFont(10), hr.day > 0.05 ? "#7FB2DA" : hr.day < -0.05 ? "#E89B5A" : "#FFFFFF", "right");
  }
  if (!M.top.length) {
    drawText(ctx, "Open once to load prices", new Rect(8, 70, 154, 30), Font.systemFont(11), GRAY, "center");
    return ctx.getImage();
  }
  const T = 21, B = 151, n = M.top.length, rh = (B - T) / Math.max(n, TOP_N), L = 38, R = 162, cw = (R - L) / Math.max(1, M.dates.length);
  // every builder in place, then the highlighted one lifted in front as a card
  M.top.forEach((r, i) => {
    if (r.hi) return;
    const y = T + i * rh;
    drawText(ctx, r.t, new Rect(4, y + rh / 2 - 6.5, L - 7, 13), Font.semiboldSystemFont(9), "#C7C7CC", "right");
    r.cells.forEach((p, k) => {
      ctx.setFillColor(new Color(cellColor(p)));
      ctx.fillRect(new Rect(L + k * cw, y + 0.5, Math.max(0.6, cw - 0.4), rh - 1));
    });
  });
  // today's column, marked while the market is open
  if (open) {
    ctx.setStrokeColor(new Color("#FFFFFF", 0.9));
    ctx.setLineWidth(0.8);
    ctx.strokeRect(new Rect(R - cw, T, cw, rh * n));
  }
  const hi = M.top.findIndex((r) => r.hi);
  if (hi >= 0) {
    // the rest a shade back
    ctx.setFillColor(new Color("#000000", 0.06));
    ctx.fillRect(new Rect(L, T, R - L, rh * n));
    liftedCard(ctx, M.top[hi], T + hi * rh, rh, L, R, cw);
  }
  // the next earnings call among these builders
  const nc = nextCall(s, M.top.map((r) => r.t));
  if (nc) {
    const w = callWhen(nc.e.next, nc.e.nextCall, nc.e.nextEst);
    drawText(ctx, `Next call: ${nc.t} ${w.short}${w.when ? " · " + w.when : ""}${nc.e.nextEst ? " (est.)" : ""}`, new Rect(8, 154, 154, 12), Font.semiboldSystemFont(9), nc.t === HIGHLIGHT ? "#FFFFFF" : GRAY);
  }
  return ctx.getImage();
}
// A row lifted off the page: a little taller and wider than its slot, from the
// ticker to the last day, on a soft shadow. (Scriptable draws no real shadows,
// so the shadow is stacked see-through layers.)
function roundRectPath(r, rad) {
  const p = new Path();
  p.addRoundedRect(r, rad, rad);
  return p;
}
function liftedCard(ctx, r, y0, rh, L, R, cw) {
  const h = rh * 1.16, y = y0 - (h - rh) / 2, x0 = 4, x1 = R + 2.5;
  for (let k = 12; k >= 1; k--) {
    ctx.setFillColor(new Color("#000000", 0.032));
    ctx.addPath(roundRectPath(new Rect(x0 - k * 0.4, y + 1.6 - k * 0.32, x1 - x0 + k * 0.8, h + k * 0.85), 3.5 + k * 0.4));
    ctx.fillPath();
  }
  ctx.setFillColor(new Color("#3A3A3C"));
  ctx.addPath(roundRectPath(new Rect(x0, y, x1 - x0, h), 3.5));
  ctx.fillPath();
  const w = (x1 - L) / Math.max(1, r.cells.length);
  r.cells.forEach((p, k) => {
    ctx.setFillColor(new Color(cellColor(p)));
    ctx.fillRect(new Rect(L + k * w, y + 0.5, Math.max(0.6, w - 0.4), h - 1));
  });
  // light along the top edge, a little shade along the bottom
  ctx.setFillColor(new Color("#FFFFFF", 0.13));
  ctx.fillRect(new Rect(x0 + 1, y + 0.5, x1 - x0 - 2, h * 0.2));
  ctx.setFillColor(new Color("#000000", 0.16));
  ctx.fillRect(new Rect(x0 + 1, y + h * 0.82, x1 - x0 - 2, h * 0.18 - 0.5));
  drawText(ctx, r.t, new Rect(x0, y + h / 2 - 6.5, L - x0 - 3, 13), Font.semiboldSystemFont(9), "#C7C7CC", "right");
}
function renderWidget(s) {
  const w = new ListWidget();
  w.backgroundImage = updRing(drawWidget(s));
  w.addSpacer();
  w.url = URLScheme.forRunningScript();
  w.refreshAfterDate = new Date(Date.now() + (marketOpenNow(s) ? 15 : 60) * 60000);
  return w;
}

// ---------- Release schedule ----------
// Prices: live during market hours (8:30 to 3:00 CT, weekdays; exchange
// holidays aren't known here, so the next open is an estimate on those days)
function nextOpen() {
  const ny = (d) => new Date(d.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const now = new Date(), n = ny(now), off = now.getTime() - n.getTime();
  const t = new Date(n);
  t.setHours(9, 30, 0, 0);
  if (n >= t) t.setDate(t.getDate() + 1);
  while (t.getDay() === 0 || t.getDay() === 6) t.setDate(t.getDate() + 1);
  return new Date(t.getTime() + off);
}
function schedRows(s, M) {
  const rows = [], now = Date.now();
  const errs = CANDIDATES.filter((c) => s.px[c.t] && s.px[c.t].err).map((c) => `${c.t}: ${s.px[c.t].err}`);
  const lv = M.live, open = lv && lv.open, age = lv ? Math.round((now - lv.at) / 60000) : null;
  const when = (ms) => new Date(ms).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" }) + " CT";
  let late = null;
  if (open && age > 30) late = `${age} min old · should update every ~15 min while the market is open · ${errs.length ? `${errs.length} of ${CANDIDATES.length} failed the last check, e.g. ${errs[0]}` : "Yahoo's feed hasn't moved"}`;
  rows.push({
    name: "Stock prices (" + (lv ? lv.src : "Yahoo") + ", ~15 min delayed)",
    last: lv ? (open ? "live, " + ctTime(lv.at) + " CT" : (M.dates.length ? shortD(M.dates[M.dates.length - 1]) + " close" : "")) : "not loaded",
    next: open ? "every refresh until 3:00 PM CT" : when(nextOpen().getTime()) + " open (est.: holidays not known)",
    late,
    checked: s.checked || null,
    err: errs[0] || null,
  });
  const yc = s.ycap || {};
  rows.push({
    name: "Market caps (Yahoo)",
    last: yc.at ? new Date(yc.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" }) + " CT" : "not loaded",
    next: "with prices: every ~15 min while the market is open, hourly otherwise",
    late: yc.err ? "Yahoo didn't give market caps: " + yc.err + (secContact() ? " · using SEC estimates" : "") : null,
    checked: yc.errAt || yc.at || null,
    err: yc.err || null,
  });
  const filed = Object.values(s.shares || {}).map((x) => x.filed).filter(Boolean).sort();
  rows.push({
    name: "Shares outstanding (SEC filings, backup for market caps)",
    last: filed.length ? "newest filed " + shortD(filed[filed.length - 1]) : secContact() ? "not loaded" : "needs your SEC contact",
    next: "each builder's next 10-Q or 10-K, quarterly; checked weekly",
    late: secContact() ? null : "The SEC backup needs your name and email: tap SEC contact below",
    checked: Math.max(0, ...Object.values(s.shares || {}).map((x) => x.at || 0)) || null,
    err: (() => { const e = Object.entries(s.shares || {}).find(([, x]) => x.err); return e ? e[0] + ": " + e[1].err : null; })(),
  });
  return rows;
}

// ---------- The page ----------
// The page works out any window itself from the closes: the base facts per
// builder (from the 30-day model) plus every builder's daily closes on one
// shared calendar, carried forward over a missing day
function series(s, M) {
  const all = new Set();
  M.ranked.forEach((r) => s.px[r.t].days.forEach((o) => all.add(o.d)));
  const dates = [...all].sort().slice(-(MAX_DAYS + 1));
  const px = {};
  M.ranked.forEach((r) => {
    const by = {};
    s.px[r.t].days.forEach((o) => (by[o.d] = o.c));
    let prev = null;
    const before = s.px[r.t].days.filter((o) => o.d < dates[0]);
    if (before.length) prev = before[before.length - 1].c;
    px[r.t] = dates.map((d) => { if (by[d] != null) prev = by[d]; return prev == null ? null : Math.round(prev * 10000) / 10000; });
    px[r.t + "_n"] = dates.map((d) => (by[d] != null ? 1 : 0)).join(""); // which days actually traded
  });
  return { dates, px };
}
function payload(s) {
  const M = model(s, WINDOW);
  const base = { ...M, top: M.top.map((r) => r.t), ranked: M.ranked.map((r) => { const o = { ...r }; delete o.cells; return o; }) };
  return {
    windows: WINDOWS, start: WINDOW, maxDays: MAX_DAYS, base, series: series(s, M), sched: fixPages(schedRows(s, M)), earn: earnRows(s, M),
    colors: { down: DOWN.map(([lo, c]) => [lo === -Infinity ? null : lo, c]), up: UP.map(([lo, c]) => [lo === -Infinity ? null : lo, c]) },
    checked: s.checked || null, sec: !!secContact(), voice: voiceLabel(s),
    sources: "Sources: stock prices from Yahoo Finance's chart feed (about 15 minutes delayed; Stooq daily closes when Yahoo doesn't answer). Market caps from Yahoo Finance's quote feed; where Yahoo gives none, an SEC estimate (marked “SEC est.”): latest price × shares outstanding from the company's latest SEC filing (the cover-page count, or the latest quarter's diluted weighted-average shares where SEC's data has none, as for Lennar's two share classes). Top 10 of " + CANDIDATES.length + " US public homebuilders by market cap. Past 150 trading days, each cell is a week (its last trading day).",
  };
}

const PAGE_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<title>Builder Stocks</title>
<script>
window.onerror = function (m, src, line) { window.__drawn = true; var e = document.getElementById("errs"); if (e) e.textContent = "Page error: " + m + " (line " + line + ")"; };
</script>
<style>
  * { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  html, body { margin:0; background:#1C1C1E; color:#FFFFFF; font-family:-apple-system, system-ui, sans-serif; }
  .wrapP { padding:18px 16px 40px; max-width:720px; margin:0 auto; }
  h1 { font-size:28px; font-weight:700; margin:4px 0 2px; }
  .lede { color:#98989F; font-size:13.5px; }
  #status { color:#64D2FF; font-size:13px; font-weight:600; min-height:17px; margin-top:4px; }
  #busy { display:none; position:relative; height:3px; border-radius:2px; background:#3A3A3C; overflow:hidden; margin-top:6px; }
  #busy:after { content:""; position:absolute; top:0; bottom:0; left:-40%; width:40%; border-radius:2px; background:#64D2FF; animation:busy 1.2s ease-in-out infinite; }
  @keyframes busy { 0% { left:-40%; } 100% { left:100%; } }
  #errs { color:#FF9F0A; font-size:12px; }
  .sched { background:#2C2C2E; border-radius:12px; padding:8px 12px; margin:10px 0 14px; }
  .sr { padding:6px 0; border-top:1px solid #3A3A3C; font-size:12.5px; }
  .sr:first-child { border-top:none; }
  .sr b { display:block; font-size:13px; font-weight:600; }
  .sr span { color:#98989F; }
  .sr .late { color:#FF9F0A; display:block; margin-top:2px; }
  .seg { display:flex; background:#2C2C2E; border-radius:9px; padding:2px; margin:6px 0 10px; }
  .seg button { flex:1; border:none; background:none; color:#FFFFFF; font:inherit; font-size:14px; font-weight:600; padding:7px 0; border-radius:7px; }
  .seg button.on { background:#636366; }
  .ro { font-size:12.5px; color:#98989F; min-height:34px; line-height:1.4; }
  .ro b { color:#FFFFFF; }
  svg { display:block; width:100%; }
  .legend { display:flex; flex-wrap:wrap; gap:4px 10px; font-size:11px; color:#98989F; margin:8px 0 18px; }
  .legend i { display:inline-block; width:12px; height:10px; border-radius:2px; vertical-align:-1px; margin-right:4px; }
  h2 { font-size:13px; font-weight:600; color:#98989F; text-transform:uppercase; letter-spacing:0.6px; margin:16px 0 6px; }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  th { color:#98989F; font-weight:600; font-size:11.5px; text-align:right; padding:4px 4px; }
  th:nth-child(2), td:nth-child(2) { text-align:left; }
  td { padding:7px 4px; border-top:1px solid #3A3A3C; text-align:right; font-variant-numeric:tabular-nums; }
  td small { color:#98989F; display:block; font-size:11px; }
  tr.out td { color:#8E8E93; }
  tr.hi td { background:#2C2C2E; box-shadow:0 5px 10px -4px rgba(0,0,0,0.8); position:relative; }
  tr.fail td { color:#8E8E93; }
  td .why { color:#FF9F0A; }
  .up { color:#7FB2DA; } .dn { color:#E89B5A; }
  .note { color:#98989F; font-size:11.5px; line-height:1.45; margin-top:16px; }
  .btn { background:#2C2C2E; color:#64D2FF; border:none; border-radius:10px; padding:9px 12px; font:inherit; font-size:13.5px; font-weight:600; margin-top:12px; }
</style>
</head>
<body>
<div class="wrapP">
  <h1>Builder Stocks</h1>
  <div class="lede" id="lede"></div>
  <div id="status"></div>
  <div id="busy"></div>
  <div id="errs"></div>
  <div class="sched" id="earn"></div>
  <div class="sched" id="sched"></div>
  <div class="seg" id="seg"></div>
  <div class="ro" id="ro"></div>
  <svg id="hm"></svg>
  <div class="legend" id="legend"></div>
  <h2>Market caps</h2>
  <table id="caps"></table>
  <div class="note" id="note"></div>
  <button class="btn" id="secBtn">SEC contact</button>
  <button class="btn" id="voiceBtn">Voice</button>
</div>
__SHARE__
<script>
var D = __DATA__;
var W = D ? D.start : 30, pick = null, req = "", memo = {};
var WEEKLY_AFTER = 150; // past this many trading days, a cell is a week
function weekKey(iso) { return Math.floor((Date.parse(iso + "T12:00:00Z") / 864e5 + 3) / 7); }
// Any window, from the closes: the last N trading days ending today
function modelFor(N) {
  if (memo[N]) return memo[N];
  var B = D.base, S = D.series, last = S.dates.length - 1, n = Math.max(2, Math.min(N, last)), start = last - n + 1, idx = [], i;
  var weekly = n > WEEKLY_AFTER;
  if (!weekly) for (i = start; i <= last; i++) idx.push(i);
  else { idx.push(start); for (i = start + 1; i <= last; i++) if (i === last || weekKey(S.dates[i]) !== weekKey(S.dates[i + 1])) idx.push(i); }
  var ranked = B.ranked.map(function (r) {
    var cl = S.px[r.t] || [], tr = S.px[r.t + "_n"] || "", base = null, k, have = 0;
    for (k = start; k <= last; k++) { if (base == null && cl[k] != null) base = cl[k]; if (tr.charAt(k) === "1") have++; }
    var cells = idx.map(function (j) { return cl[j] == null || !base ? null : (cl[j] / base - 1) * 100; });
    var o = {}; for (var key in r) o[key] = r[key];
    o.cells = cells; o.chg = cells[cells.length - 1]; o.thin = have < n / 2;
    return o;
  });
  var by = {}; ranked.forEach(function (r) { by[r.t] = r; });
  var top = B.top.map(function (t) { return by[t]; }).filter(function (r) { return r && !r.thin; });
  top.sort(function (a, b) { return (b.chg == null ? -999 : b.chg) - (a.chg == null ? -999 : a.chg); });
  memo[N] = { dates: idx.map(function (j) { return S.dates[j]; }), n: n, weekly: weekly, top: top, ranked: ranked, failed: B.failed, live: B.live, haveCaps: B.haveCaps };
  return memo[N];
}
function cur() { return modelFor(W); }
window.__takeReq = function () { var r = req; req = ""; return r; };
function el(id) { return document.getElementById(id); }
function esc(t) { return String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function sd(iso) { return MON[+iso.slice(5, 7) - 1] + " " + (+iso.slice(8, 10)); }
function pct(p, d) { if (p == null) return "–"; return (p > 0 ? "+" : p < 0 ? "−" : "") + Math.abs(p).toFixed(d == null ? 1 : d) + "%"; }
function cls(p) { return p == null ? "" : p > 0.05 ? "up" : p < -0.05 ? "dn" : ""; }
function color(p) {
  if (p == null) return "#2C2C2E";
  var i;
  if (p > -0.05) { for (i = 0; i < D.colors.up.length; i++) if (D.colors.up[i][0] == null || p >= D.colors.up[i][0]) return D.colors.up[i][1]; }
  for (i = 0; i < D.colors.down.length; i++) if (D.colors.down[i][0] == null || p <= D.colors.down[i][0]) return D.colors.down[i][1];
  return D.colors.down[D.colors.down.length - 1][1];
}
function money(v) { if (v == null) return "–"; return v >= 1e9 ? "$" + (v / 1e9).toFixed(v >= 1e10 ? 1 : 2) + "B" : "$" + (v / 1e6).toFixed(0) + "M"; }
function price(v) { return "$" + (v >= 1000 ? Math.round(v).toLocaleString("en-US") : v.toFixed(2)); }
window.setStatus = function (t) { el("status").textContent = t || ""; el("busy").style.display = t && t.indexOf("…") >= 0 ? "block" : "none"; };

// Earnings calls: the next ones first, then each builder's last (tap for replay or listen)
function renderEarn() {
  var E = D.earn || { next: [], last: [] }, h = '<div class="sr" style="border:none"><b>Earnings calls</b><span>Tap a call for its webcast, replay or a read-aloud of the prepared remarks</span></div>';
  var row = function (x, which) {
    return '<div class="sr ecall" data-t="' + esc(x.t) + '" data-w="' + which + '" style="display:flex;justify-content:space-between;gap:8px;cursor:pointer' + (x.hi ? ';background:#3A3A3C;margin:0 -12px;padding:6px 12px;border-radius:8px;box-shadow:0 5px 10px -4px rgba(0,0,0,0.8)' : "") + '"><span style="color:#FFFFFF"><b style="display:inline">' + esc(x.t) + "</b> " + esc(x.name) + '</span><span style="text-align:right;white-space:nowrap">' + esc(x.day) + (x.when ? " · " + esc(x.when) : "") + (x.est ? ' <span style="color:#98989F">est.</span>' : "") + (which === "last" && x.rec ? ' <span style="color:#30D158;font-size:12px;font-weight:600">🎧 ' + (x.rec === "full" ? "Recorded" : "Partly recorded") + "</span>" : "") + (which === "last" ? ' <span style="color:#64D2FF">▶︎</span>' : "") + "</span></div>";
  };
  if (E.next.length) { h += '<div class="sr"><span>Next</span></div>'; E.next.forEach(function (x) { h += row(x, "next"); }); }
  if (E.last.length) { h += '<div class="sr"><span>Last call' + (E.last.some(function (x) { return x.rec; }) ? " · 🎧 Recorded plays free; new recordings use ElevenLabs credits" : "") + '</span></div>'; E.last.forEach(function (x) { h += row(x, "last"); }); }
  if (!E.next.length && !E.last.length) h += '<div class="sr"><span>No dates yet: they come with the market caps from Yahoo.</span></div>';
  el("earn").innerHTML = h;
}
el("earn").addEventListener("click", function (e) { var r = e.target.closest(".ecall"); if (!r) return; req = "call:" + r.getAttribute("data-t") + ":" + r.getAttribute("data-w"); r.style.opacity = "0.5"; setTimeout(function () { r.style.opacity = ""; }, 4000); });
// ---------- Fix panel: Builder Stocks schedule adapter ----------
function schedEsc(t) { return esc(t).replace(/"/g, "&quot;"); }
function schedState(r) { return { late: !!r.late, main: r.late ? "Not coming through" : "On schedule", sub: "" }; }
function schedWhy(r) { return r.late || ""; }
function renderSched() {
  window.__sched = D.sched || [];
  el("sched").innerHTML = (FIXNOTE ? '<div class="fixMsg ok">' + schedEsc(FIXNOTE) + "</div>" : "") + window.__sched.map(function (r) {
    var st = schedState(r);
    return '<div class="sr"><b>' + esc(r.name) + '</b><span>Latest: ' + esc(r.last) + " · Next: " + esc(r.next) + "</span>" + (r.late ? '<span class="late">' + esc(r.late) + "</span>" + fixBtn(r) : "") + "</div>" + (r.late && FIXOPEN[r.name] ? fixPanel(r, st) : "");
  }).join("");
}
// ---------- Fix panel: page side (shared by the widgets with the standard release schedule) ----------
// Late rows get "Fix ›": details, Retry now, Open the source, Copy report for Claude.
// Page code: no backticks, no dollar-brace, no backslashes. Master copy: tools/fix_kit_page.js.
var FIXOPEN = {}, FIXMSG = {}, FIXBUSY = {}, FIXNOTE = "";
(function () {
  var css = document.createElement("style");
  css.textContent = ".fixBtn{display:inline-block;margin-top:5px;font:inherit;font-size:11.5px;font-weight:600;color:#FF9F0A;background:rgba(255,159,10,0.14);border:none;border-radius:8px;padding:4px 10px}" +
    ".fixPanel{margin:2px 0 8px;padding:9px 10px;border-radius:10px;background:#1C1C1E;border:1px solid #3A3A3C;font-size:11.5px;color:#C7C7CC;line-height:1.4}" +
    ".fixPanel b{color:#E5E5EA;font-weight:600}.fixPanel .err{color:#FF9F0A;word-break:break-word}" +
    ".fixActs{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.fixActs button{flex:1 1 auto;font:inherit;font-size:12px;font-weight:600;color:#E5E5EA;background:#2C2C2E;border:none;border-radius:9px;padding:8px;min-height:34px}" +
    ".fixActs button.primary{color:#1C1C1E;background:#FF9F0A}.fixActs button:disabled{opacity:0.5}" +
    ".fixMsg{margin-top:7px;color:#98989F;font-size:11.5px}.fixMsg.ok{color:#30D158}.fixMsg.bad{color:#FF9F0A}";
  document.head.appendChild(css);
})();
function fixCT(t) {
  if (!t) return "never";
  try { return new Date(t).toLocaleString("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + " CT"; }
  catch (e) { return String(t); }
}
function fixHost(u) { var m = String(u || "").match(/^https?:..([^/]+)/); return m ? m[1] : ""; }
function fixText(h) { var d = document.createElement("div"); d.innerHTML = h || ""; return d.textContent; }
function fixRow(k) { return (window.__sched || []).filter(function (r) { return r.name === k; })[0]; }
function fixBtn(r) { return '<button class="fixBtn" data-fix="' + schedEsc(r.name) + '">' + (FIXOPEN[r.name] ? "Close ‹" : "Fix ›") + "</button>"; }
function fixPanel(r, st) {
  var m = FIXMSG[r.name], busy = FIXBUSY[r.name];
  return '<div class="fixPanel">' +
    "<div><b>Status:</b> " + schedEsc(fixText(st.main)) + (st.sub ? ", " + schedEsc(fixText(st.sub)) : "") + "</div>" +
    "<div><b>Last checked:</b> " + schedEsc(fixCT(r.checked)) + "</div>" +
    (r.err ? '<div><b>Error:</b> <span class="err">' + schedEsc(r.err) + "</span></div>" : "<div><b>Error:</b> none; the source answered, but the new release isn't in it yet.</div>") +
    (r.page ? "<div><b>Source:</b> " + schedEsc(fixHost(r.page)) + "</div>" : "") +
    '<div class="fixActs"><button class="primary" data-fixkey="' + schedEsc(r.name) + '" data-fixact="retry"' + (busy ? " disabled" : "") + ">" + (busy ? "Refreshing…" : "Retry now") + "</button>" +
    (r.page ? '<button data-fixkey="' + schedEsc(r.name) + '" data-fixact="open">Open the source</button>' : "") +
    '<button data-fixkey="' + schedEsc(r.name) + '" data-fixact="copy">Copy report for Claude</button></div>' +
    (m ? '<div class="fixMsg ' + (m.ok ? "ok" : "bad") + '">' + schedEsc(m.msg) + "</div>" : "") + "</div>";
}
function fixReport(r, st) {
  var NL = String.fromCharCode(10);
  var when = function (t) { if (!t || isNaN(Date.parse(t))) return t || "?"; return r.approx ? new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : fixCT(t); };
  return ["Housing Widgets · " + (document.title || "__FIX_NAME__") + ": source not coming through",
    "Source: " + r.name + (r.every ? " (" + r.every + ")" : ""),
    "Status: " + fixText(st.main) + (st.sub ? ", " + fixText(st.sub) : ""),
    "Latest data shown: " + r.last,
    "Due: " + when(r.next) + (r.to && r.to !== r.next ? " to " + when(r.to) : ""),
    "Last checked: " + fixCT(r.checked),
    "Error: " + (r.err || "none (source answered; release not in it yet)"),
    "Why shown: " + schedWhy(r),
    "Source page: " + (r.page || "none listed"),
    "Report made: " + fixCT(Date.now())].join(NL);
}
document.addEventListener("click", function (e) {
  var t = e.target && e.target.closest ? e.target.closest("[data-fix],[data-fixact]") : null;
  if (!t) return;
  var k = t.getAttribute("data-fix");
  if (k != null) { FIXOPEN[k] = !FIXOPEN[k]; renderSched(window.__sched); return; }
  var key = t.getAttribute("data-fixkey"), act = t.getAttribute("data-fixact"), r = fixRow(key);
  if (!r) return;
  if (act === "open") { if (r.page) window.__openUrl = r.page; return; }
  if (act === "retry") { FIXBUSY[key] = true; FIXMSG[key] = null; FIXNOTE = ""; window.__fixReq = { key: key, action: "retry" }; }
  if (act === "copy") window.__fixReq = { key: key, action: "copy", text: fixReport(r, schedState(r)) };
  renderSched(window.__sched);
});
window.__takeFix = function () { var q = window.__fixReq; window.__fixReq = null; return q ? JSON.stringify(q) : null; };
window.__takeOpen = function () { var u = window.__openUrl; window.__openUrl = null; return u || null; };
window.fixDone = function (res) {
  if (!res || res.key == null) return;
  FIXBUSY[res.key] = false;
  var r = fixRow(res.key), st = r ? schedState(r) : null;
  if (res.after) res = { key: res.key, ok: !(st && st.late), msg: !r ? "Refreshed." : st.late ? "Still late after refreshing. " + schedWhy(r) : "Up to date now: latest " + r.last + "." };
  FIXMSG[res.key] = res;
  if (r && st && st.late) FIXOPEN[res.key] = true;
  else { FIXOPEN[res.key] = false; FIXNOTE = (r ? r.name + ": " : "") + res.msg; }
  renderSched(window.__sched);
};
// ---------- end Fix panel (page) ----------
function renderSeg() {
  el("seg").innerHTML = D.windows.map(function (w) { return '<button data-w="' + w + '" class="' + (w === W ? "on" : "") + '">' + w + " days</button>"; }).join("") +
    (D.windows.indexOf(W) < 0 ? '<button data-w="' + W + '" class="on">' + W + " days</button>" : "");
}
function geom() {
  var M = cur(), svg = el("hm"), wd = svg.getBoundingClientRect().width || 360, rh = 26;
  return { M: M, svg: svg, wd: wd, rh: rh, L: 96, R: wd - 112, T: 4, H: 4 + rh * M.top.length + 22 };
}
function renderHeat() {
  var g = geom(), M = g.M, cw = (g.R - g.L) / Math.max(1, M.dates.length), s = "";
  g.svg.style.height = g.H + "px";
  // the window % and, to its right, the current price
  var pctPx = function (r, y) {
    return '<text x="' + (g.wd - 62) + '" y="' + y.toFixed(2) + '" font-size="12.5" font-weight="700" text-anchor="end" fill="' + (r.chg > 0.05 ? "#7FB2DA" : r.chg < -0.05 ? "#E89B5A" : "#FFFFFF") + '">' + pct(r.chg) + "</text>" +
      '<text x="' + (g.wd - 4) + '" y="' + y.toFixed(2) + '" font-size="12" font-weight="600" text-anchor="end" fill="#E5E5EA">' + price(r.price) + "</text>";
  };
  var hiI = -1, row = function (r, y, h, x0, xL, xR) {
    var w = (xR - xL) / Math.max(1, r.cells.length), o = "";
    o += '<text x="' + (x0 + 6) + '" y="' + (y + h / 2 - 1.5) + '" font-size="12.5" font-weight="700" fill="#E5E5EA">' + esc(r.t) + '</text><text x="' + (x0 + 6) + '" y="' + (y + h / 2 + 9.5) + '" font-size="9.5" fill="#98989F">' + esc(r.name) + "</text>";
    r.cells.forEach(function (p, k) { o += '<rect x="' + (xL + k * w).toFixed(2) + '" y="' + (y + 0.5).toFixed(2) + '" width="' + Math.max(0.6, w - 0.6).toFixed(2) + '" height="' + (h - 1).toFixed(2) + '" fill="' + color(p) + '"/>'; });
    o += pctPx(r, y + h / 2 + 4.5);
    return o;
  };
  s += '<defs><filter id="lift" x="-10%" y="-60%" width="120%" height="240%"><feDropShadow dx="0" dy="4" stdDeviation="4.5" flood-color="#000" flood-opacity="0.85"/></filter>' +
    '<linearGradient id="gloss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.16"/><stop offset="0.22" stop-color="#fff" stop-opacity="0"/><stop offset="0.8" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.2"/></linearGradient></defs>';
  M.top.forEach(function (r, i) { if (r.hi) { hiI = i; return; } s += row(r, g.T + i * g.rh, g.rh, 0, g.L, g.R); });
  var yB = g.T + g.rh * M.top.length;
  if (pick != null) s += '<rect x="' + (g.L + pick * cw - 0.5).toFixed(2) + '" y="' + g.T + '" width="' + (cw + 1).toFixed(2) + '" height="' + (yB - g.T) + '" fill="none" stroke="#FFFFFF" stroke-width="1.2"/>';
  // the highlighted builder lifted in front: one card from its name to the last day
  if (hiI >= 0) {
    var hr = M.top[hiI], hh = g.rh * 1.16, hy = g.T + hiI * g.rh - (hh - g.rh) / 2, hx0 = 1, hx1 = g.R + 3;
    s += '<rect x="' + g.L + '" y="' + g.T + '" width="' + (g.R - g.L) + '" height="' + (yB - g.T) + '" fill="#000" opacity="0.06"/>';
    s += '<clipPath id="card"><rect x="' + hx0 + '" y="' + hy.toFixed(2) + '" width="' + (hx1 - hx0) + '" height="' + hh.toFixed(2) + '" rx="5"/></clipPath>';
    s += '<g filter="url(#lift)"><rect x="' + hx0 + '" y="' + hy.toFixed(2) + '" width="' + (hx1 - hx0) + '" height="' + hh.toFixed(2) + '" rx="5" fill="#3A3A3C"/></g>';
    s += '<g clip-path="url(#card)">' + row(hr, hy, hh, hx0, g.L - 3, hx1) + '<rect x="' + hx0 + '" y="' + hy.toFixed(2) + '" width="' + (hx1 - hx0) + '" height="' + hh.toFixed(2) + '" fill="url(#gloss)"/></g>';
    // its % stays in the column on the right
    s += pctPx(hr, hy + hh / 2 + 4.5);
  }
  [0, Math.floor((M.dates.length - 1) / 2), M.dates.length - 1].forEach(function (k, j) {
    if (!M.dates[k]) return;
    s += '<text x="' + (g.L + (k + 0.5) * cw) + '" y="' + (yB + 14) + '" font-size="10" fill="#8E8E93" text-anchor="' + (j === 0 ? "start" : j === 2 ? "end" : "middle") + '">' + sd(M.dates[k]) + "</text>";
  });
  g.svg.innerHTML = s;
  // readout: the tapped day, or the window's start and end
  if (pick != null && M.dates[pick]) {
    el("ro").innerHTML = "<b>" + sd(M.dates[pick]) + "</b>, change since " + sd(M.dates[0]) + ": " + M.top.map(function (r) { return '<span class="' + cls(r.cells[pick]) + '">' + esc(r.t) + " " + pct(r.cells[pick]) + "</span>"; }).join(" · ");
  } else {
    el("ro").innerHTML = "Change from <b>" + (M.dates[0] ? sd(M.dates[0]) : "") + "</b> to <b>" + (M.dates.length ? sd(M.dates[M.dates.length - 1]) : "") + "</b> (" + M.n + " trading days" + (M.weekly ? ", a cell per week" : "") + "), biggest gainer on top. Tap a " + (M.weekly ? "week" : "day") + " to read it · pinch to zoom out to a year or in to 10 days · double-tap for 30.";
  }
}
function renderLegend() {
  var b = [["≤ −10%", D.colors.down[0][1]], ["−5 to −10", D.colors.down[1][1]], ["−2 to −5", D.colors.down[2][1]], ["0 to −2", D.colors.down[3][1]], ["0 to +2", D.colors.up[4][1]], ["+2 to +5", D.colors.up[3][1]], ["+5 to +10", D.colors.up[2][1]], ["+10 to +20", D.colors.up[1][1]], ["≥ +20%", D.colors.up[0][1]]];
  el("legend").innerHTML = b.map(function (x) { return '<span><i style="background:' + x[1] + '"></i>' + x[0] + "</span>"; }).join("");
}
function renderCaps() {
  var M = cur(), inTop = {};
  M.top.forEach(function (r) { inTop[r.t] = 1; });
  var h = "<tr><th>#</th><th>Builder</th><th>Market cap</th><th>Price</th><th>Today</th><th>" + cur().n + "d</th></tr>";
  M.ranked.forEach(function (r) {
    h += '<tr class="' + (r.hi ? "hi" : inTop[r.t] ? "" : "out") + '"><td>' + r.rank + "</td><td><b>" + esc(r.t) + "</b><small>" + esc(r.name) + (r.sharesSrc && r.sharesSrc !== "cover" ? " · shares: 10-Q " + esc(r.sharesSrc) : "") + (r.thin ? " · too few prices to chart" : "") + (r.cap == null && r.sharesErr ? '<span class="why"> · no market cap: SEC ' + esc(r.sharesErr) + "</span>" : r.cap == null ? '<span class="why"> · no market cap: no share count yet</span>' : "") + (r.err ? '<span class="why"> · ' + esc(r.err) + "</span>" : "") + "</small></td><td>" + money(r.cap) + (r.capSrc ? "<small>" + esc(r.capSrc) + (r.capGap ? " · SEC est. " + money(r.capGap) : "") + "</small>" : "") + "</td><td>" + price(r.price) + '</td><td class="' + cls(r.day) + '">' + pct(r.day) + '</td><td class="' + cls(r.chg) + '">' + pct(r.chg) + "</td></tr>";
  });
  (M.failed || []).forEach(function (r) {
    h += '<tr class="fail"><td>–</td><td><b>' + esc(r.t) + "</b><small>" + esc(r.name) + '<span class="why"> · price failed: ' + esc(r.why) + "</span>" + (r.sharesErr ? '<span class="why"> · SEC: ' + esc(r.sharesErr) + "</span>" : "") + "</small></td><td>–</td><td>–</td><td>–</td><td>–</td></tr>";
  });
  el("caps").innerHTML = h;
}
function render() {
  if (!D) { el("lede").textContent = "Loading prices…"; return; }
  el("note").textContent = D.sources;
  el("secBtn").textContent = D.sec ? "SEC contact" : "Set SEC contact (for market caps)";
  el("voiceBtn").textContent = "Voice: " + (D.voice || "iPhone voice");
  // the release schedule (and its Fix panel) shows even before any prices come in
  renderSched();
  // first open on a phone: nothing saved yet, so wait for the first prices
  if (!D.series || !D.series.dates || D.series.dates.length < 2) {
    // done looking (checked is set) and still no prices: say so, with why, instead of waiting forever
    var fl = (D.base && D.base.failed) || [];
    if (D.checked && fl.length) {
      el("lede").textContent = "Couldn't get prices for any builder. Check the connection and open it again.";
      var why = {}; fl.forEach(function (f) { if (f.why) why[f.why] = (why[f.why] || 0) + 1; });
      el("errs").textContent = Object.keys(why).slice(0, 3).map(function (w) { return w + (why[w] > 1 ? " (" + why[w] + " builders)" : ""); }).join("; ");
    } else el("lede").textContent = "Loading prices… (the first time takes a minute)";
    return;
  }
  var M = cur();
  el("lede").textContent = "Top " + M.top.length + " of " + M.ranked.length + " US public homebuilders by market cap" + (D.haveCaps === false ? "" : "");
  if (!M.haveCaps) el("errs").textContent = "No market caps yet (share counts come from SEC filings): showing builders in list order.";
  renderEarn(); renderSeg(); renderHeat(); renderLegend(); renderCaps();
  el("note").textContent = D.sources;
  el("secBtn").textContent = D.sec ? "SEC contact" : "Set SEC contact (for market caps)";
  el("voiceBtn").textContent = "Voice: " + (D.voice || "iPhone voice");
  window.__rendered = true;
}
window.update = function (d) { D = d; memo = {}; W = Math.min(W, maxW()); render(); };
function maxW() { return Math.min(D.maxDays || 252, D.series.dates.length - 1); }
// pinch the heatmap: spread to zoom in (fewer days), pinch to zoom out (more, up to a year); double-tap for 30
(function () {
  var d0 = 0, W0 = 30, raf = 0, lastTap = 0;
  function dist(t) { var dx = t[0].clientX - t[1].clientX, dy = t[0].clientY - t[1].clientY; return Math.sqrt(dx * dx + dy * dy); }
  var hm = el("hm");
  var pinched = false;
  hm.addEventListener("touchstart", function (e) { if (e.touches.length === 2) { d0 = dist(e.touches); W0 = W; pinched = true; lastTap = 0; e.preventDefault(); } }, { passive: false });
  hm.addEventListener("touchmove", function (e) {
    if (e.touches.length !== 2 || !d0) return;
    e.preventDefault();
    var nW = Math.max(10, Math.min(maxW(), Math.round(W0 * d0 / dist(e.touches))));
    if (nW === W) return;
    W = nW; pick = null;
    if (!raf) raf = requestAnimationFrame(function () { raf = 0; render(); });
  }, { passive: false });
  hm.addEventListener("touchend", function (e) {
    if (e.touches.length < 2) d0 = 0;
    if (e.touches.length === 0 && pinched) { pinched = false; lastTap = 0; return; } // lifting the last finger of a pinch isn't a tap
    if (e.changedTouches.length === 1 && e.touches.length === 0) {
      var now = Date.now();
      if (now - lastTap < 300) { W = D.start; pick = null; render(); lastTap = 0; e.preventDefault(); return; }
      lastTap = now;
    }
  });
})();
el("seg").addEventListener("click", function (e) { var b = e.target.closest("button"); if (!b) return; W = +b.getAttribute("data-w"); pick = null; render(); });
el("hm").addEventListener("click", function (e) {
  var g = geom(), r = g.svg.getBoundingClientRect(), x = e.clientX - r.left, n = g.M.dates.length;
  if (x < g.L || x > g.R) { pick = null; renderHeat(); return; }
  var k = Math.min(n - 1, Math.max(0, Math.floor((x - g.L) / ((g.R - g.L) / n))));
  pick = pick === k ? null : k;
  renderHeat();
});
el("secBtn").addEventListener("click", function () { req = "sec"; });
el("voiceBtn").addEventListener("click", function () { req = "voice"; });
window.addEventListener("resize", function () { if (D) renderHeat(); });

// ---- Share as PDF: two 16:9 slides ----
window.shareInfo = function () { var M = cur(); return { title: "Builder Stocks", name: cur().n + " trading days", asOf: M.dates.length ? sd(M.dates[M.dates.length - 1]) + ", " + M.dates[M.dates.length - 1].slice(0, 4) : "" }; };
window.printPdf = function (jsPDF, fonts) {
  var PW = 792, PH = 445.5, M = cur();
  var doc = new jsPDF({ unit: "pt", format: [PW, PH], orientation: "landscape" });
  var FACE = "helvetica";
  if (fonts && fonts.regular && fonts.bold) {
    doc.addFileToVFS("Narrow-Regular.ttf", fonts.regular); doc.addFont("Narrow-Regular.ttf", "Narrow", "normal");
    doc.addFileToVFS("Narrow-Bold.ttf", fonts.bold); doc.addFont("Narrow-Bold.ttf", "Narrow", "bold");
    FACE = "Narrow";
  }
  var INK = [28, 28, 30], GRY = [110, 110, 115], RULE = [222, 222, 226], UPI = [40, 100, 160], DNI = [190, 100, 30];
  function rgb(hex) { return [1, 3, 5].map(function (i) { return parseInt(hex.slice(i, i + 2), 16); }); }
  function font(bold, size, c) { doc.setFont(FACE, bold ? "bold" : "normal"); doc.setFontSize(size); doc.setTextColor(c[0], c[1], c[2]); }
  function clean(t) { return String(t).split("−").join("-").split("’").join("'").split("–").join("-").split("…").join("...").split("≤").join("<=").split("≥").join(">=").split("×").join("x"); }
  function headline(text) {
    var size = 21, lines;
    do { font(true, size, INK); lines = doc.splitTextToSize(clean(text), PW - 72); size -= 1; } while (lines.length > 1 && size > 15);
    doc.text(lines.slice(0, 2), 36, 42);
    return 42 + (Math.min(2, lines.length) - 1) * (size + 4);
  }
  function titles(top, title, sub, cx) { font(true, 11.5, INK); doc.text(clean(title), cx, top + 28, { align: "center" }); font(false, 9, GRY); doc.text(clean(sub), cx, top + 41, { align: "center" }); }
  var asOf = M.dates.length ? sd(M.dates[M.dates.length - 1]) + ", " + M.dates[M.dates.length - 1].slice(0, 4) : "";
  function banner(page) {
    var bh = 44, by = PH - bh;
    doc.setFillColor(28, 28, 30); doc.rect(0, by, PW, bh, "F");
    doc.setFillColor(201, 162, 39); doc.rect(PW - 176, by + 6, 2, bh - 12, "F");
    font(false, 7.2, [235, 235, 240]); doc.text(doc.splitTextToSize(clean(D.sources), PW - 176 - 40 - 110).slice(0, 4), 28, by + 11);
    font(false, 7.5, [200, 200, 205]); doc.text("Data through " + asOf, PW - 188, by + 20, { align: "right" }); doc.text(page + " of 2 · " + M.n + " trading days", PW - 188, by + 31, { align: "right" });
    font(true, 12.5, [255, 255, 255]); doc.text("Builder", PW - 162, by + 20); doc.text("Stocks", PW - 162, by + 34);
  }
  function tc(p) { return p == null ? INK : p > 0.05 ? UPI : p < -0.05 ? DNI : INK; }
  // slide 1: the heatmap; headline: who leads and who trails over the window
  var best = M.top[0], worst = M.top[M.top.length - 1];
  var hl = best && worst ? best.name + " Leads the Top " + M.top.length + " Builders Over " + M.n + " Trading Days, " + (best.chg >= 0 ? "Up " : "Down ") + Math.abs(best.chg).toFixed(1) + "%; " + worst.name + " Trails, " + (worst.chg >= 0 ? "Up " : "Down ") + Math.abs(worst.chg).toFixed(1) + "%" : "Builder Stocks";
  var top = headline(hl);
  var L0 = 150, R0 = PW - 170, T0 = top + 56, B0 = PH - 86, n = M.top.length, rh = (B0 - T0) / Math.max(1, n), cw = (R0 - L0) / Math.max(1, M.dates.length);
  titles(top, "Change From the First Day of the Window, Each " + (M.weekly ? "Week" : "Trading Day"), sd(M.dates[0]) + " to " + asOf + " · top " + n + " builders by market cap, biggest gainer on top", (L0 + R0) / 2);
  var pdfRow = function (r, y, h, xL, xR) {
    var w = (xR - xL) / Math.max(1, r.cells.length);
    font(true, 10, INK); doc.text(r.t, L0 - 8, y + h / 2 - 1, { align: "right" });
    font(false, 7.5, GRY); doc.text(clean(r.name), L0 - 8, y + h / 2 + 8, { align: "right" });
    r.cells.forEach(function (p, k) { var c = rgb(color(p)); doc.setFillColor(c[0], c[1], c[2]); doc.rect(xL + k * w, y + 0.5, Math.max(0.5, w - 0.6), h - 1, "F"); });
    font(true, 10.5, tc(r.chg)); doc.text(clean(pct(r.chg)), R0 + 58, y + h / 2 + 3.5, { align: "right" });
    font(false, 10, INK); doc.text(clean(price(r.price)), R0 + 128, y + h / 2 + 3.5, { align: "right" });
  };
  var hiP = -1;
  M.top.forEach(function (r, i) { if (r.hi) { hiP = i; return; } pdfRow(r, T0 + i * rh, rh, L0, R0); });
  if (hiP >= 0) {
    // lifted in front: a soft shadow of stacked see-through layers, then one card from the name to the last day
    var hh = rh * 1.16, hy = T0 + hiP * rh - (hh - rh) / 2, hx0 = L0 - 100, hx1 = R0 + 3;
    if (doc.GState) {
      for (var k = 7; k >= 1; k--) { doc.setGState(new doc.GState({ opacity: 0.035 })); doc.setFillColor(0, 0, 0); doc.roundedRect(hx0 - k * 0.7, hy + 1.2 - k * 0.2, hx1 - hx0 + k * 1.4, hh + k * 1.1, 4 + k * 0.6, 4 + k * 0.6, "F"); }
      doc.setGState(new doc.GState({ opacity: 1 }));
    }
    doc.setFillColor(242, 242, 245); doc.roundedRect(hx0, hy, hx1 - hx0, hh, 4, 4, "F");
    pdfRow(M.top[hiP], hy, hh, L0 - 3, hx1);
  }
  font(false, 8, GRY);
  doc.text(sd(M.dates[0]), L0, B0 + 11); doc.text(sd(M.dates[M.dates.length - 1]), R0, B0 + 11, { align: "right" });
  // color key
  var keys = [["<= -10%", D.colors.down[0][1]], ["-5 to -10", D.colors.down[1][1]], ["-2 to -5", D.colors.down[2][1]], ["0 to -2", D.colors.down[3][1]], ["0 to +2", D.colors.up[4][1]], ["+2 to +5", D.colors.up[3][1]], ["+5 to +10", D.colors.up[2][1]], ["+10 to +20", D.colors.up[1][1]], [">= +20%", D.colors.up[0][1]]];
  var kx = L0;
  keys.forEach(function (k) { var c = rgb(k[1]); doc.setFillColor(c[0], c[1], c[2]); doc.rect(kx, B0 + 18, 10, 7, "F"); font(false, 7.5, GRY); doc.text(k[0], kx + 13, B0 + 24.5); kx += 13 + doc.getTextWidth(k[0]) + 12; });
  banner(1);
  // slide 2: market caps, largest first
  doc.addPage([PW, PH], "landscape");
  var big = M.ranked[0];
  top = headline(big && big.cap ? big.name + " Is the Largest US Public Homebuilder at " + clean(money(big.cap)) + " in Market Cap" : "Builder Market Caps");
  var rows2 = M.ranked.filter(function (r) { return r.cap; }).slice(0, 12), L2 = 170, R2 = PW - 300, T2 = top + 56, B2 = PH - 70, rh2 = (B2 - T2) / Math.max(1, rows2.length), mx = rows2.length ? rows2[0].cap : 1;
  titles(top, "Market Cap by Builder", "Latest price x shares outstanding on the latest SEC filing · as of " + asOf, (L2 + PW - 60) / 2);
  font(false, 7.8, GRY); doc.text("Price", PW - 200, T2 - 4, { align: "right" }); doc.text("Today", PW - 130, T2 - 4, { align: "right" }); doc.text(M.n + "d", PW - 60, T2 - 4, { align: "right" });
  rows2.forEach(function (r, i) {
    var y = T2 + i * rh2, bwid = (R2 - L2) * r.cap / mx, inTop = M.top.some(function (x) { return x.t === r.t; });
    font(true, r.hi ? 10.5 : 9.5, r.hi || inTop ? INK : GRY); doc.text(r.t, L2 - 8, y + rh2 / 2 - 0.5, { align: "right" });
    font(false, 7, GRY); doc.text(clean(r.name), L2 - 8, y + rh2 / 2 + 7.5, { align: "right" });
    // neutral grays (size, not direction); the highlighted builder dark, the rest light
    var c = r.hi ? [28, 28, 30] : inTop ? [150, 150, 156] : [212, 212, 216];
    doc.setFillColor(c[0], c[1], c[2]); doc.rect(L2, y + 2, Math.max(1, bwid), rh2 - 4, "F");
    font(true, 9, INK); doc.text(clean(money(r.cap)), L2 + bwid + 5, y + rh2 / 2 + 3);
    font(false, 9, INK); doc.text(clean(price(r.price)), PW - 200, y + rh2 / 2 + 3, { align: "right" });
    font(true, 9, tc(r.day)); doc.text(clean(pct(r.day)), PW - 130, y + rh2 / 2 + 3, { align: "right" });
    font(true, 9, tc(r.chg)); doc.text(clean(pct(r.chg)), PW - 60, y + rh2 / 2 + 3, { align: "right" });
  });
  banner(2);
  return doc;
};
if (D) render(); else el("lede").textContent = "Loading prices…";
window.__drawn = true;
</script>
</body>
</html>
`;

// SEC contact (shared with Reports and New Construction)
async function askSecContact() {
  const a = new Alert();
  a.title = "SEC contact";
  a.message = "Market caps use share counts from SEC filings, and the SEC asks every request to say who's asking: your name and email, like \"Jane Doe jane@example.com\". It's kept in this phone's keychain and sent only to sec.gov.";
  a.addTextField("Name and email", secContact());
  a.addAction("Save");
  a.addCancelAction("Cancel");
  if ((await a.present()) === -1) return "";
  const v = a.textFieldValue(0).trim();
  if (v) Keychain.set(SEC_KEY, v);
  return v;
}

// ---------- Earnings calls ----------
// Dates from Yahoo's quote feed (same request as the market caps). Tapping a
// call in the app offers, in this order, what can be found: the webcast replay
// (a webcast link on the builder's investor-relations page), the transcript's
// prepared remarks read aloud by your ElevenLabs voice "Bert", and the IR page.
// Each builder's investor relations site. The events page is found by following
// the site's own Events/Webcasts link, so a redesign doesn't break it.
const IR = {
  DHI: "https://investor.drhorton.com/",
  LEN: "https://investors.lennar.com/",
  PHM: "https://pultegroupinc.com/investor-relations/",
  NVR: "https://nvri.gcs-web.com/",
  TOL: "https://investors.tollbrothers.com/",
  TMHC: "https://investors.taylormorrison.com/",
  MTH: "https://investors.meritagehomes.com/",
  KBH: "https://investor.kbhome.com/",
  DFH: "https://investors.dreamfindershomes.com/",
  CCS: "https://investors.centurycommunities.com/",
  MHO: "https://investors.mihomes.com/",
  TPH: "https://investors.tripointehomes.com/",
  GRBK: "https://investors.greenbrickpartners.com/",
  LGIH: "https://investor.lgihomes.com/",
  BZH: "https://ir.beazer.com/",
  HOV: "https://khov.gcs-web.com/",
};
// events pages already confirmed (tried first)
const IR_EVENTS = { LEN: "https://investors.lennar.com/events-and-presentations" };
// Motley Fool's transcript pages are named for the company: /2026/07/22/dr-horton-dhi-q3-2026-earnings-call-transcript/
const FOOL = { DHI: "dr-horton", LEN: "lennar", PHM: "pultegroup", NVR: "nvr", TOL: "toll-brothers", TMHC: "taylor-morrison-home", MTH: "meritage-homes", KBH: "kb-home", DFH: "dream-finders-homes", CCS: "century-communities", MHO: "mi-homes", TPH: "tri-pointe-homes", GRBK: "green-brick-partners", LGIH: "lgi-homes", BZH: "beazer-homes-usa", HOV: "hovnanian-enterprises" };
const VOICE_NAME = setting("voice_name", "Bert"); // the ElevenLabs voice that reads the calls
// Recording quality, chosen under the Voice button. Credits are per character.
const TTS_MODELS = {
  standard: { id: "eleven_multilingual_v2", rate: 1, name: "Standard", tag: "" },
  saver: { id: "eleven_flash_v2_5", rate: 0.5, name: "Saver", tag: "~s" },
};
function ttsModel(s) { return TTS_MODELS[s.ttsQuality] || TTS_MODELS.standard; }
const MAX_LISTEN_CHARS = 45000; // a safety cap only: the full prepared remarks run about 30 minutes
const TTS_PIECE_CHARS = 1000; // short pieces, at sentence ends: long ones drift (whispering, tone changes)
// steadier delivery: fewer swings in loudness and tone, a slightly flatter read
const TTS_SETTINGS = { stability: 0.6, similarity_boost: 0.75, style: 0, use_speaker_boost: true };
const KEY_NAME = "elevenlabs_api_key"; // shared with the Reports widget
const ELEVENLABS_KEY = "";
const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

// Yahoo's earnings fields → { next, nextEst, last } (milliseconds); a next date that has passed becomes the last
function takeEarnings(s, list) {
  s.earn = s.earn || {};
  const now = Date.now();
  list.forEach((o) => {
    const t = String(o.symbol || "").toUpperCase();
    if (!t) return;
    const e = s.earn[t] || {};
    if (e.next && e.next < now - 6 * 3600e3) { e.last = Math.max(e.last || 0, e.next); e.lastEst = e.nextEst; e.next = null; e.nextCall = null; }
    const stamps = [o.earningsCallTimestampStart, o.earningsTimestamp, o.earningsTimestampStart].filter((x) => x > 0).map((x) => x * 1000);
    const fut = stamps.filter((x) => x > now - 6 * 3600e3).sort((a, b) => a - b), past = stamps.filter((x) => x <= now - 6 * 3600e3).sort((a, b) => b - a);
    if (fut.length) {
      e.next = fut[0];
      e.nextEst = !!o.isEarningsDateEstimate;
      // Yahoo can keep last quarter's call time after the next release date is set: use a call time only near this release
      const call = o.earningsCallTimestampStart ? o.earningsCallTimestampStart * 1000 : null;
      e.nextCall = call && call >= e.next - 864e5 && call <= e.next + 4 * 864e5 ? call : null;
    }
    if (past.length && past[0] > (e.last || 0)) { e.last = past[0]; e.lastEst = false; }
    s.earn[t] = e;
  });
}
// "before open" / "after close" / a call time, in Central
function callWhen(ms, call, est) {
  const ct = (x) => new Date(x).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" }).replace(":00", "").replace(" ", "").toLowerCase();
  // the call's own date when Yahoo has it (a release after the close is often called the next morning),
  // but never a call time from a different quarter
  if (call && Math.abs(call - ms) > 4 * 864e5) call = null;
  if (call) ms = call;
  const day = new Date(ms).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/Chicago" });
  const etH = +new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", hour12: false, timeZone: "America/New_York" });
  const when = call ? `call ${ct(call)} CT` : est ? "" : etH < 9 ? "before open" : etH >= 16 ? "after close" : "";
  return { day, when, short: new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" }) };
}
// The next call among these builders
function nextCall(s, tickers) {
  const now = Date.now();
  return tickers.map((t) => ({ t, e: (s.earn || {})[t] })).filter((x) => x.e && x.e.next && x.e.next > now - 6 * 3600e3).sort((a, b) => a.e.next - b.e.next)[0] || null;
}
// Listen recordings already on this phone for a call (any voice or quality):
// "full" when a whole reading is saved, "part" when only some pieces are (credits ran out)
function recordedState(files, t, at) {
  const pre = `call-${t}-${new Date(at).toISOString().slice(0, 10)}-`;
  let st = null;
  for (const f of files) {
    if (!f.startsWith(pre)) continue;
    const rest = f.slice(pre.length); // voice[~s]-text fingerprint[-pN | -partial].mp3
    if (/^[A-Za-z0-9]{1,8}(~s)?-[0-9a-f]{6}\.mp3$/.test(rest)) return "full";
    if (/^[A-Za-z0-9]{1,8}(~s)?-[0-9a-f]{6}-(p\d+|partial)\.mp3$/.test(rest)) st = "part";
  }
  return st;
}
function earnRows(s, M) {
  const top = M.top.map((r) => r.t), out = { next: [], last: [] };
  let files = [];
  try { files = fm().listContents(fm().documentsDirectory()).filter((f) => f.startsWith("call-")); } catch (e) {}
  top.forEach((t) => {
    const e = (s.earn || {})[t];
    const name = (CANDIDATES.find((c) => c.t === t) || {}).name || t;
    if (e && e.next) { const w = callWhen(e.next, e.nextCall, e.nextEst); out.next.push({ t, name, at: e.next, day: w.day, when: w.when, est: !!e.nextEst, hi: t === HIGHLIGHT }); }
    if (e && e.last) { const w = callWhen(e.last, null, e.lastEst); out.last.push({ t, name, at: e.last, day: w.day, hi: t === HIGHLIGHT, rec: recordedState(files, t, e.last) }); }
  });
  out.next.sort((a, b) => a.at - b.at);
  out.last.sort((a, b) => b.at - a.at);
  return out;
}

// ---- finding a call's replay or transcript ----
async function getText(url, ua) {
  const r = new Request(url);
  r.headers = { "User-Agent": ua || UA };
  r.timeoutInterval = 20;
  const txt = await r.loadString();
  return { code: (r.response && r.response.statusCode) || 0, txt, url: (r.response && r.response.url) || url };
}
// a webcast link on the builder's IR page (the newest listed)
const WEBCAST = /href="(https?:\/\/(?:app\.webinar\.net|events\.q4inc\.com|edge\.media-server\.com|event\.choruscall\.com|services\.choruscall\.com|[\w.-]*onlinexperiences\.com|[\w.-]*\.webcasts\.com|viavid\.webcasts\.com|register\.vevent\.com|www\.webcaster4\.com|[\w.-]*\.zoom\.us\/webinar|events\.globalmeet\.com|[\w.-]*notified\.com)[^"]*)"/i;
function absUrl(href, base) {
  href = href.replace(/&amp;/g, "&");
  if (/^https?:/i.test(href)) return href;
  const origin = base.replace(/^(https?:\/\/[^/]+).*/, "$1");
  if (href.startsWith("//")) return "https:" + href;
  if (href.startsWith("/")) return origin + href;
  return base.replace(/[^/]*$/, "") + href;
}
// links on an IR page that lead to its events / webcasts / presentations page, best first
function eventLinks(html, base) {
  const out = [], seen = new Set(), re = /<a\b[^>]*href="([^"#]+)"[^>]*>([\s\S]{0,200}?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const href = m[1], text = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (/^(mailto|tel|javascript):/i.test(href) || /\.(pdf|xlsx?|docx?)(\?|$)/i.test(href)) continue;
    const hay = href + " " + text;
    const score = /event/i.test(hay) ? 3 : /webcast/i.test(hay) ? 2 : /presentation/i.test(hay) ? 1 : 0;
    if (!score) continue;
    const u = absUrl(href, base);
    if (seen.has(u) || !/^https?:/i.test(u)) continue;
    seen.add(u);
    out.push({ u, score });
  }
  return out.sort((a, b) => b.score - a.score).map((x) => x.u);
}
async function findReplay(t) {
  const out = { replay: null, irUrl: null };
  const look = (txt) => { const m = WEBCAST.exec(txt || ""); return m ? m[1].replace(/&amp;/g, "&") : null; };
  const tryPage = async (u) => {
    try {
      const p = await getText(u);
      if (p.code >= 400 || !p.txt) return null;
      return p;
    } catch (e) { return null; }
  };
  if (IR_EVENTS[t]) {
    const p = await tryPage(IR_EVENTS[t]);
    if (p) { out.irUrl = p.url || IR_EVENTS[t]; out.replay = look(p.txt); if (out.replay) return out; }
  }
  if (!IR[t]) return out;
  const home = await tryPage(IR[t]);
  if (!home) return out;
  if (!out.irUrl) out.irUrl = home.url || IR[t];
  out.replay = look(home.txt);
  if (out.replay) return out;
  for (const u of eventLinks(home.txt, home.url || IR[t]).slice(0, 3)) {
    const p = await tryPage(u);
    if (!p) continue;
    out.irUrl = p.url || u; // the events page that actually loaded
    out.replay = look(p.txt);
    if (out.replay) return out;
  }
  return out;
}
// A PDF's pages joined without what repeats on every page: headers, footers and
// page numbers (otherwise the voice reads "Page 4 of 18" at every page turn)
function withoutPageFurniture(pages) {
  const norm = (l) => l.replace(/\s+/g, " ").trim().replace(/\d+/g, "#").toLowerCase();
  const split = pages.map((p) => String(p).split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean));
  // lines near the top or bottom of a page that show up on many pages
  const seen = {};
  split.forEach((ls) => {
    new Set(ls.slice(0, 4).concat(ls.slice(-4)).map(norm)).forEach((n) => { seen[n] = (seen[n] || 0) + 1; });
  });
  const many = Math.max(3, Math.ceil(split.length * 0.4));
  const pageNo = /^(page\s*)?#+(\s*(of|\/)\s*#+)?$/i;
  return split.map((ls) => ls.filter((l, k) => {
    const n = norm(l), edge = k < 4 || k >= ls.length - 4;
    return !(pageNo.test(n) || (edge && split.length >= 3 && seen[n] >= many && n.length < 160));
  }).join(" ")).join(" ");
}
// The call's prepared remarks: the text up to where questions start
function preparedRemarks(text) {
  const t = text.replace(/\s+/g, " ").trim();
  const from = Math.max(0, t.search(/(prepared remarks|good (morning|afternoon)[,.]? (and|everyone|ladies)|welcome to)/i));
  let body = t.slice(from);
  // Q&A starts where the operator takes the first question. Earlier mentions in the
  // remarks ("we'll open it up for questions", "our question and answer period") don't count.
  const q = body.slice(800).search(/(first question (today )?(comes|is|will come|is coming) from|(take|have) (our|the|your) first question|we('ll| will) now (begin|open|start|conduct) (the |our )?question(-| )and(-| )answer)/i);
  if (q > 0) {
    const at = 800 + q, end = Math.max(body.lastIndexOf(". ", at), body.lastIndexOf("? ", at), body.lastIndexOf("! ", at));
    body = body.slice(0, end > 0 ? end + 1 : at).replace(/\s*Operator\s*:?\s*(thank you|thanks)[.!]?\s*$/i, "");
  }
  return capText(body);
}
// Lennar posts its transcripts as PDFs; for the rest, Motley Fool's free transcript page
async function findTranscript(t, at, step) {
  step = step || (() => {});
  const d = new Date(at), y = d.getFullYear(), yy = String(y).slice(2);
  // all the candidate addresses at once; the first in this (newest-first) order that answers wins
  const firstHit = async (cands, test) => {
    const res = await Promise.all(cands.map((c) => test(c).catch(() => null)));
    return res.find((x) => x) || null;
  };
  if (t === "LEN") {
    step("Checking Lennar's transcripts…");
    const tags = [];
    for (const fy of [y, y + 1]) for (let q = 4; q >= 1; q--) tags.push(`q${q}-${fy}`, `q${q}-${String(fy).slice(2)}`);
    const hit = await firstHit(tags, async (tag) => {
      const r = new Request(`https://investors.lennar.com/~/media/Files/L/Lennar-IR-V3/reports-and-presentations/${tag}-len-earnings-call-transcript.pdf`);
      r.headers = { "User-Agent": UA };
      r.timeoutInterval = 20;
      const data = await r.load();
      return data && data.toBase64String().startsWith("JVBERi") ? { tag, data } : null;
    });
    if (hit) {
      step("Reading Lennar's transcript…");
      const path = fm().joinPath(fm().temporaryDirectory(), `len-${hit.tag}.pdf`);
      fm().write(path, hit.data);
      const o = await runPdfReader(path, "extractAll");
      const text = withoutPageFurniture(o.pages || []);
      if (text.length > 2000) return { text, src: `Lennar's transcript (${hit.tag.toUpperCase()})` };
    }
  }
  if (t === "GRBK") {
    step("Checking Green Brick's transcripts…");
    // Green Brick posts its transcripts as PDFs; the quarter the call covers ended about 1 to 2 months before it
    const q0 = new Date(at - 40 * 864e5), eq = Math.floor(q0.getMonth() / 3) + 1, ey = q0.getFullYear();
    const qs = [[ey, eq], eq === 1 ? [ey - 1, 4] : [ey, eq - 1], eq === 4 ? [ey + 1, 1] : [ey, eq + 1]];
    const urls = [];
    qs.forEach(([fy, q]) => {
      const dir = `https://s202.q4cdn.com/944500558/files/doc_financials/${fy}/q${q}/`;
      urls.push({ u: dir + `GRBK-Earnings-Call-Transcript-Q${q}-${fy}.pdf`, tag: `Q${q} ${fy}` }, { u: dir + `Green-Brick-Partners-Q${q}-${fy}-Earnings-Call-Transcript.pdf`, tag: `Q${q} ${fy}` });
    });
    const hit = await firstHit(urls, async (c) => {
      const r = new Request(c.u);
      r.headers = { "User-Agent": UA };
      r.timeoutInterval = 20;
      const data = await r.load();
      return data && data.toBase64String().startsWith("JVBERi") ? { tag: c.tag, data } : null;
    });
    if (hit) {
      step("Reading Green Brick's transcript…");
      const path = fm().joinPath(fm().temporaryDirectory(), `grbk-${hit.tag.replace(" ", "-")}.pdf`);
      fm().write(path, hit.data);
      const o = await runPdfReader(path, "extractAll");
      const text = withoutPageFurniture(o.pages || []);
      if (text.length > 2000) return { text, src: `Green Brick's transcript (${hit.tag})` };
    }
  }
  step("Checking Motley Fool…");
  const fool = await foolTranscript(t, at, firstHit);
  if (fool) return fool;
  step("Checking Yahoo Finance…");
  return yahooTranscript(t, at, step);
}
// Motley Fool's free transcript page, when it has one for this call
async function foolTranscript(t, at, firstHit) {
  const y = new Date(at).getFullYear();
  const slug = FOOL[t];
  if (!slug) return null;
  // the page is dated the day of the call (sometimes the day after), for the fiscal quarter
  const cands = [], p = (n) => String(n).padStart(2, "0");
  for (const off of [0, 1, -1, 2]) {
    const c = new Date(at + off * 864e5);
    const dir = `https://www.fool.com/earnings/call-transcripts/${c.getFullYear()}/${p(c.getMonth() + 1)}/${p(c.getDate())}/`;
    for (const fy of [y, y + 1]) for (let q = 4; q >= 1; q--) cands.push({ url: `${dir}${slug}-${t.toLowerCase()}-q${q}-${fy}-earnings-call-transcript/`, q, fy });
  }
  // 8 at a time, in order, stopping at the first that answers
  for (let i = 0; i < cands.length; i += 8) {
    const hit = await firstHit(cands.slice(i, i + 8), async (c) => {
      const g = await getText(c.url);
      if (g.code !== 200 || !/earnings call transcript/i.test(g.txt)) return null;
      const text = g.txt.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<\/(p|h\d|div|li)>/gi, ". ").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&rsquo;/g, "'").replace(/&quot;|&ldquo;|&rdquo;/g, '"').replace(/&nbsp;/g, " ");
      return text.length > 3000 ? { text, src: `Motley Fool transcript (Q${c.q} ${c.fy})` } : null;
    });
    if (hit) return hit;
  }
  return null;
}
// Yahoo Finance's transcript (from Quartr). The page fills in its text in the
// browser, so it's opened in a hidden page and read once it has loaded.
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
// the ways a page might write the call's date (a day or two either side)
function dateForms(ms) {
  const out = [];
  for (const off of [-2, -1, 0, 1, 2]) {
    const d = new Date(ms + off * 864e5), M = MONTHS[d.getMonth()], D = d.getDate(), Y = d.getFullYear(), p = (n) => String(n).padStart(2, "0");
    out.push(`${M} ${D}, ${Y}`, `${M.slice(0, 3)} ${D}, ${Y}`, `${D} ${M} ${Y}`, `${Y}-${p(d.getMonth() + 1)}-${p(D)}`, `${d.getMonth() + 1}/${D}/${Y}`);
  }
  return out;
}
async function hiddenPageText(url) {
  const wv = new WebView();
  try { await wv.loadURL(url); } catch (e) { return ""; }
  // wait for the text to fill in; open a "show full transcript" button if the page has one (buttons only, never links)
  const poke = "(function () { var b = document.querySelectorAll('button'); for (var i = 0; i < b.length; i++) { var x = (b[i].innerText || '').trim(); if (/^(show|view|read)( the)? (full|more|entire|all)( transcript)?$|^(show|read) more$/i.test(x) && !b[i].__hw) { b[i].__hw = 1; try { b[i].click(); } catch (e) {} } } return document.body ? document.body.innerText.length : 0; })()";
  for (let i = 0; i < 16; i++) {
    await sleep(800);
    let n = 0;
    try { n = await wv.evaluateJavaScript(poke); } catch (e) {}
    if (n > 15000) break;
  }
  try { return String((await wv.evaluateJavaScript("document.body ? document.body.innerText : ''")) || ""); } catch (e) { return ""; }
}
async function yahooTranscript(t, at, step) {
  step = step || (() => {});
  let list;
  try { list = await getText(`https://finance.yahoo.com/quote/${t}/earnings-calls/`); } catch (e) { return null; }
  if (!list || list.code >= 400 || !list.txt) return null;
  const re = new RegExp(`/quote/${t}/earnings/${t}-Q(\\d)-(\\d{4})-earnings_call-\\d+\\.html`, "g"), links = [];
  let m;
  while ((m = re.exec(list.txt))) {
    const u = "https://finance.yahoo.com" + m[0];
    if (!links.some((x) => x.u === u)) links.push({ u, q: m[1], fy: m[2] });
  }
  const forms = dateForms(at), anyDate = new RegExp(`(${MONTHS.join("|")}) \\d{1,2}, 20\\d\\d`);
  // newest first; use one only if it's dated on this call (or, the newest, if the page shows no date at all)
  for (let k = 0; k < Math.min(2, links.length); k++) {
    step(`Reading Yahoo's Q${links[k].q} transcript…`);
    const L = links[k], text = await hiddenPageText(L.u);
    if (text.length < 5000) continue;
    // judge the date from the transcript's own heading, not the news around it
    const hi = text.search(/earnings call/i), head = hi >= 0 ? text.slice(Math.max(0, hi - 1500), hi + 1500) : text.slice(0, 4000);
    const dated = forms.some((f) => head.includes(f));
    if (!dated && (k > 0 || anyDate.test(head))) continue;
    const from = text.search(/(operator|good (morning|afternoon|day)|ladies and gentlemen|hello,? and welcome|thank you for standing by)/i);
    return { text: from > 0 ? text.slice(from) : text, src: `Yahoo Finance transcript (Q${L.q} FY${L.fy})${dated ? "" : ", date not shown"}` };
  }
  return null;
}
async function bertVoice(s, key) {
  if (s.voice && s.voice.id && (s.voicePicked || String(s.voice.name).toLowerCase().startsWith(VOICE_NAME.toLowerCase()))) return s.voice; // a voice picked by hand always wins
  try {
    const v = (await accountVoices(key) || []).find((x) => String(x.name).toLowerCase().startsWith(VOICE_NAME.toLowerCase()));
    if (v) { s.voice = { id: v.id, name: v.name }; saveStore(s); return s.voice; }
  } catch (e) {}
  return chooseVoice(s, key);
}
async function listenRemarks(s, t, at, tr, say) {
  const text = preparedRemarks(tr.text);
  if (!text || text.length < 500) throw new Error("Couldn't find the prepared remarks in the transcript.");
  const key = s.iphoneVoice ? null : await getKey();
  if (!key) { await Speech.speak(text); return; }
  const voice = await bertVoice(s, key);
  if (!voice) return;
  // one recording per call, voice and text (a fixed transcript gets a fresh recording)
  const model = ttsModel(s);
  const stem = `call-${t}-${new Date(at).toISOString().slice(0, 10)}-${voice.id.slice(0, 8)}${model.tag}`;
  const path = fm().joinPath(fm().documentsDirectory(), `${stem}-${updHash(text).slice(0, 6)}.mp3`);
  if (!fm().fileExists(path)) {
    // an earlier full recording of this call (same voice and quality, before a fix changed the text): free to play
    let older = null;
    try {
      older = fm().listContents(fm().documentsDirectory()).filter((f) => f.startsWith(stem + "-") && /^-[0-9a-f]{6}\.mp3$/.test(f.slice(stem.length)))[0] || null;
    } catch (e) {}
    if (older) {
      const a = new Alert();
      a.title = "Already recorded";
      a.message = `You have a recording of this call from before the latest Listen fixes. Play it free, or record it again with the new settings (about ${Math.ceil(text.length * model.rate).toLocaleString("en-US")} ElevenLabs credits).`;
      a.addAction("Play the saved recording");
      a.addAction("Record it again");
      a.addCancelAction("Cancel");
      const pick = await a.present();
      if (pick === 0) return playAudio(fm().joinPath(fm().documentsDirectory(), older));
      if (pick !== 1) return;
    }
    const pieces = splitForSpeech(text, TTS_PIECE_CHARS);
    const piecePath = (k) => path.replace(/\.mp3$/, `-p${k}.mp3`);
    const todo = pieces.map((x, k) => k).filter((k) => !fm().fileExists(piecePath(k)));
    const need = Math.ceil(todo.reduce((n, k) => n + pieces[k].length, 0) * model.rate);
    // warn before spending when the key can see the balance and it's short
    const left = await creditsLeft(key);
    if (left != null && left < need) {
      const a = new Alert();
      a.title = "Not enough ElevenLabs credits";
      a.message = `This reading needs about ${need.toLocaleString("en-US")} credits; you have ${left.toLocaleString("en-US")} left. Credits reset when your plan renews.`;
      a.addAction("Read it with the iPhone voice");
      a.addCancelAction("Cancel");
      if ((await a.present()) === 0) await Speech.speak(text);
      return;
    }
    const pr = say ? progress(say) : null;
    const ids = [];
    for (const k of todo) {
      if (pr) pr.set((pieces.length > 1 ? `Recording part ${k + 1} of ${pieces.length} with ${voice.name}` : `Recording the prepared remarks with ${voice.name}`) + (model.tag ? " (Saver)…" : "…"));
      const ctx = { prev: k > 0 ? pieces[k - 1].slice(-400) : "", next: k < pieces.length - 1 ? pieces[k + 1].slice(0, 300) : "", prevIds: todo.indexOf(k - 1) >= 0 ? ids.slice() : [] };
      try { fm().write(piecePath(k), await elevenLabs(pieces[k], key, voice.id, model.id, ctx)); if (ctx.lastId) ids.push(ctx.lastId); } catch (e) {
        if (pr) await pr.stop();
        if (keyProblem(e)) { await askKey(true, e); return; }
        if (!outOfCredits(e)) {
          // refused for another reason (often the voice itself): say what ElevenLabs said, offer a way out
          if (e.code >= 400 && e.code < 500) return voiceRefused(s, t, at, tr, say, voice, e, text);
          throw e;
        }
        // out partway: play what was made (pieces stay saved; the next Listen records only the rest)
        const made = pieces.map((x, n) => n).filter((n) => fm().fileExists(piecePath(n)));
        if (!made.length || made[0] !== 0) return creditsAlert(e, text, need);
        let run = 0; while (run < made.length && made[run] === run) run++;
        const part = path.replace(/\.mp3$/, "-partial.mp3");
        fm().write(part, joinMp3(made.slice(0, run).map((n) => fm().read(piecePath(n)))));
        const said = pieces.slice(0, run).join(" ").length;
        const a = new Alert();
        a.title = "Out of ElevenLabs credits";
        a.message = `Recorded ${run} of ${pieces.length} parts (about ${Math.round(said / text.length * 100)}% of the remarks) before the credits ran out. Those parts stay saved; tap Listen after your credits renew to record the rest.`;
        a.addAction("Play what was recorded");
        a.addAction("Read it all with the iPhone voice");
        a.addCancelAction("Cancel");
        const pick = await a.present();
        if (pick === 0) await playAudio(part);
        if (pick === 1) await Speech.speak(text);
        return;
      }
    }
    if (pr) await pr.stop();
    fm().write(path, joinMp3(pieces.map((x, k) => fm().read(piecePath(k)))));
    // tidy up: the pieces, a partial copy, and older recordings of this call in this voice
    try {
      fm().listContents(fm().documentsDirectory()).forEach((f) => {
        // this call, voice and quality only (the other quality's recording stays, for comparing)
        const mine = f.startsWith(stem + "-") && /^-[0-9a-f]{1,8}(-p\d+|-partial)?\.mp3$/.test(f.slice(stem.length));
        if (mine && fm().joinPath(fm().documentsDirectory(), f) !== path) fm().remove(fm().joinPath(fm().documentsDirectory(), f));
      });
    } catch (e) {}
  }
  await playAudio(path);
}
// Text in pieces of at most n characters, broken at sentence ends
function splitForSpeech(text, n) {
  const out = [];
  let rest = text.trim();
  while (rest.length > n) {
    const cut = rest.slice(0, n);
    let end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
    if (end < n / 3) end = cut.lastIndexOf(" ");
    if (end <= 0) end = n - 1;
    out.push(rest.slice(0, end + 1).trim());
    rest = rest.slice(end + 1).trim();
  }
  if (rest) out.push(rest);
  return out;
}
// MP3 pieces played back to back as one file. MP3 is a run of frames, so pieces can be
// joined end to end; each piece is padded with 0 to 2 zero bytes (players skip them)
// so its base64 joins cleanly with the next.
function joinMp3(datas) {
  if (datas.length === 1) return datas[0];
  const b64 = datas.map((d, k) => { const x = d.toBase64String(); return k < datas.length - 1 ? x.replace(/=+$/, (m) => "A".repeat(m.length)) : x; }).join("");
  return Data.fromBase64String(b64);
}
// ElevenLabs credits left this month, or null when the key isn't allowed to see it
async function creditsLeft(key) {
  try {
    const r = new Request("https://api.elevenlabs.io/v1/user/subscription");
    r.headers = { "xi-api-key": key };
    r.timeoutInterval = 10;
    const j = await r.loadJSON();
    if (!r.response || r.response.statusCode !== 200 || !j || j.character_limit == null) return null;
    return Math.max(0, j.character_limit - (j.character_count || 0));
  } catch (e) { return null; }
}
// A status line that counts the seconds on the current step, so a slow step looks busy, not stuck
function progress(say) {
  let label = "", t0 = Date.now(), on = true;
  const loop = (async () => {
    while (on) {
      if (label) await say(`${label} ${Math.round((Date.now() - t0) / 1000)}s`);
      await sleep(1000);
    }
  })();
  return { set(l) { label = l; t0 = Date.now(); }, async stop() { on = false; await loop; await say(""); } };
}
// A tapped call: what can be found, offered in order
async function openCall(s, t, which, say) {
  const e = (s.earn || {})[t] || {}, at = which === "next" ? e.next : e.last;
  const name = (CANDIDATES.find((c) => c.t === t) || {}).name || t;
  const pr = progress(say);
  pr.set(`Looking for ${t}'s ${which === "next" ? "webcast" : "replay and transcript"}…`);
  let rp, tr;
  try { [rp, tr] = await Promise.all([findReplay(t), which === "last" && at ? findTranscript(t, at, (l) => pr.set(l)) : Promise.resolve(null)]); }
  finally { await pr.stop(); }
  const opts = [];
  if (rp.replay) opts.push(["▶︎ " + (which === "next" ? "Webcast" : "Replay (webcast)"), () => Safari.openInApp(rp.replay, false)]);
  if (tr) opts.push(["\u{1F3A7} Listen: prepared remarks (" + (voiceLabel(s) === "iPhone voice" ? "iPhone voice" : voiceName(s)) + ")", () => listenRemarks(s, t, at, tr, say)]);
  const what = which === "next" ? "webcast" : "replay";
  opts.push([rp.irUrl ? "Investor relations page" : `Search the web for the ${what}`, () => Safari.openInApp(rp.irUrl ? rp.irUrl : `https://www.google.com/search?q=${encodeURIComponent(name + " earnings call " + what + " " + (at ? new Date(at).getFullYear() : ""))}`, false)]);
  const w = at ? callWhen(at, which === "next" ? e.nextCall : null, which === "next" ? e.nextEst : e.lastEst) : null;
  const msg = (w ? `${w.day}${w.when ? " · " + w.when : ""}` : "") + (!rp.replay ? "\nNo webcast link found on the IR page." : "") + (which === "last" ? (tr ? `\nTranscript: ${tr.src}` : "\nNo transcript found.") : "");
  const i = await choose(`${name} earnings call`, msg, opts.map((o) => o[0]));
  if (i >= 0) await opts[i][1]();
}
// ok getKey
async function getKey() {
  if (ELEVENLABS_KEY.trim()) {
    // keep a copy in the keychain, so future versions of the script (with this
    // line blank) still have it
    Keychain.set(KEY_NAME, ELEVENLABS_KEY.trim());
    return ELEVENLABS_KEY.trim();
  }
  return Keychain.contains(KEY_NAME) && Keychain.get(KEY_NAME) ? Keychain.get(KEY_NAME) : null; // no key: the iPhone voice reads (add one with the Voice button)
}
function hasVoiceKey() { return !!ELEVENLABS_KEY.trim() || (Keychain.contains(KEY_NAME) && !!Keychain.get(KEY_NAME)); }
function voiceName(s) { return (s.voicePicked && s.voice && s.voice.name) || VOICE_NAME; }
// what Listen will read with, for the button and the menu
function voiceLabel(s) { return !s.iphoneVoice && hasVoiceKey() ? voiceName(s) + (ttsModel(s).tag ? " (ElevenLabs, Saver)" : " (ElevenLabs)") : "iPhone voice"; }
// The Voice button: switch between ElevenLabs and the iPhone voice, pick a voice, add or replace the key
async function voiceMenu(s) {
  const has = hasVoiceKey(), opts = [];
  const useEleven = async () => { s.iphoneVoice = false; saveStore(s); };
  if (has) {
    if (s.iphoneVoice) opts.push(["Use ElevenLabs (" + voiceName(s) + ")", useEleven]);
    else opts.push(["Use the iPhone voice", async () => { s.iphoneVoice = true; saveStore(s); }]);
    opts.push(["Pick a different ElevenLabs voice", async () => { const k = await getKey(); if (k && (await chooseVoice(s, k))) await useEleven(); }]);
    if (ttsModel(s).tag) opts.push(["Use Standard quality (about 1 credit per character)", async () => { s.ttsQuality = "standard"; await useEleven(); }]);
    else opts.push(["Use Saver quality (about ½ credit per character)", async () => { s.ttsQuality = "saver"; await useEleven(); }]);
    opts.push(["Replace the ElevenLabs key", async () => { if (await askKey(false)) await useEleven(); }]);
  } else {
    opts.push(["Add an ElevenLabs key", async () => { if (await askKey(false)) await useEleven(); }]);
    opts.push(["Get a key at elevenlabs.io", async () => Safari.openInApp("https://elevenlabs.io/app/settings/api-keys", false)]);
  }
  const msg = "Listen reads with: " + voiceLabel(s) + (has ? "\n\nStandard quality uses about 1 ElevenLabs credit per character; Saver uses about half, in the same voice. Switching makes a new recording the next time you tap Listen." : "\n\nWithout an ElevenLabs key, the iPhone's built-in voice reads. With one, a natural ElevenLabs voice does.");
  const i = await choose("Voice for Listen", msg, opts.map((o) => o[0]));
  if (i >= 0) await opts[i][1]();
}
// ok askKey
async function askKey(again, why) {
  if (ELEVENLABS_KEY.trim()) {
    if (again) throw new Error("ElevenLabs rejected the key pasted at the top of the script. Check it was copied in full, between the quotes.");
    return ELEVENLABS_KEY.trim();
  }
  const a = new Alert();
  a.title = again ? "That key didn't work" : "ElevenLabs API key";
  const saved = Keychain.contains(KEY_NAME) ? Keychain.get(KEY_NAME) || "" : "";
  a.message = (again && why ? `ElevenLabs said ${why.code}${why.detail ? ": " + why.detail : ""}${saved ? " (saved key ends in " + saved.slice(-4) + ")" : ""}.\n\n` : "") +
    "Paste your ElevenLabs API key (for Listen); it starts with sk_. It's saved in this phone's keychain, stays there when you update the script, and is only sent to ElevenLabs. Cancel to skip for now.";
  a.addSecureTextField("API key", "");
  a.addAction("Save");
  a.addCancelAction("Cancel");
  if ((await a.present()) === -1) return null;
  const k = a.textFieldValue(0).trim();
  if (!k) return null;
  Keychain.set(KEY_NAME, k);
  return k;
}
// ok elevenLabs
async function elevenLabs(text, key, voiceId, modelId, ctx) {
  const send = async (stitch) => {
    const r = new Request(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_64`);
    r.method = "POST";
    r.timeoutInterval = 180;
    r.headers = { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" };
    const body = { text, model_id: modelId || TTS_MODELS.standard.id, voice_settings: TTS_SETTINGS };
    // stitching: the text around this piece and the pieces just made, so tone and loudness carry across the joins
    if (stitch && ctx) {
      if (ctx.prev) body.previous_text = ctx.prev;
      if (ctx.next) body.next_text = ctx.next;
      if (ctx.prevIds && ctx.prevIds.length) body.previous_request_ids = ctx.prevIds.slice(-3);
    }
    r.body = JSON.stringify(body);
    const data = await r.load();
    const h = (r.response && r.response.headers) || {};
    return { r, data, code: (r.response && r.response.statusCode) || 0, id: h["request-id"] || h["Request-Id"] || h["request_id"] || null };
  };
  let res = await send(true);
  // a refused stitch (an old piece's id expired, or a model without stitching): try once plain
  if ((res.code === 400 || res.code === 422) && ctx) res = await send(false);
  const { data, code } = res;
  if (code !== 200) {
    let msg = "";
    let status = "";
    try {
      const d = JSON.parse(data.toRawString()).detail;
      msg = typeof d === "string" ? d : (d && (d.message || d.status)) || "";
      status = (d && d.status) || "";
    } catch (e) {}
    const err = new Error(`ElevenLabs said ${code}${msg ? ": " + msg : ""}`);
    err.code = code;
    err.status = status;
    err.detail = msg;
    throw err;
  }
  if (ctx) ctx.lastId = res.id;
  return data;
}
// ok accountVoices
async function accountVoices(key) {
  const r = new Request("https://api.elevenlabs.io/v1/voices");
  r.headers = { "xi-api-key": key };
  r.timeoutInterval = 20;
  try {
    const j = await r.loadJSON();
    const code = (r.response && r.response.statusCode) || 0;
    if (code !== 200 || !j || !Array.isArray(j.voices)) return null;
    return j.voices.map((v) => ({ id: v.voice_id, name: v.name, category: v.category || "" }));
  } catch (e) {
    return null;
  }
}
// ok pasteVoiceId
async function pasteVoiceId(note) {
  const a = new Alert();
  a.title = "Voice ID";
  a.message = (note ? note + "\n\n" : "") + "At elevenlabs.io, open the voice and copy its ID, then paste it here.";
  a.addTextField("Voice ID", "");
  a.addTextField("Name (optional)", "");
  a.addAction("Save");
  a.addCancelAction("Cancel");
  if ((await a.present()) === -1) return null;
  const id = a.textFieldValue(0).trim();
  return id ? { id, name: a.textFieldValue(1).trim() || "Custom voice" } : null;
}
// ok chooseVoice
async function chooseVoice(s, key) {
  const voices = await accountVoices(key);
  let picked = null;
  if (voices && voices.length) {
    // your own voices first, then the rest, each alphabetical
    const rank = (c) => (c === "premade" ? 1 : 0);
    voices.sort((a, b) => rank(a.category) - rank(b.category) || a.name.localeCompare(b.name));
    const a = new Alert();
    a.title = "Choose a voice";
    a.message = s.voice ? `Now: ${s.voice.name}` : "";
    voices.forEach((v) => a.addAction(`${v.name}${v.category && v.category !== "premade" ? "  \u00B7 " + v.category : ""}${s.voice && s.voice.id === v.id ? "  \u2713" : ""}`));
    a.addAction("Paste a voice ID\u2026");
    a.addCancelAction("Cancel");
    const i = await a.presentSheet();
    if (i === -1) return s.voice || null;
    picked = i < voices.length ? { id: voices[i].id, name: voices[i].name } : await pasteVoiceId();
  } else {
    picked = await pasteVoiceId("Couldn't list your voices (the key may not have Voices read access).");
  }
  if (picked) {
    if (s.voice && s.voice.id !== picked.id) s.prevVoice = s.voice; // to go back to if ElevenLabs won't use the new one
    s.voice = picked;
    s.voicePicked = true;
    saveStore(s);
  }
  return s.voice || null;
}
// ok choose
async function choose(title, message, actions) {
  const a = new Alert();
  a.title = title;
  a.message = message;
  actions.forEach((x) => a.addAction(x));
  a.addCancelAction("Cancel");
  return a.presentSheet();
}
// ok playAudio
async function playAudio(path) {
  const pick = await choose("Ready", "Play here, or send it to Files or another app to keep listening with the screen off.", ["Play", "Share / Save to Files"]);
  if (pick === 0) await QuickLook.present(path, true);
  if (pick === 1) await ShareSheet.present([path]);
}
// ok outOfCredits
function outOfCredits(e) {
  return /quota|credits? (remaining|required)|exceeds your|out of credits|insufficient/i.test(`${e.status || ""} ${e.detail || e.message || ""}`);
}
// ok creditsAlert
async function creditsAlert(e, text, need) {
  const m = /have\s+([\d,]+)\s+credits?\s+remaining[^\d]+([\d,]+)\s+credits?\s+(?:are\s+)?required/i.exec(e.detail || e.message || "");
  const a = new Alert();
  a.title = "Out of ElevenLabs credits";
  a.message = (m
    ? `This reading needs about ${m[2]} credits; you have ${m[1]} left this month.`
    : `ElevenLabs says you're out of credits for this reading (it needs about ${(need || text.length).toLocaleString("en-US")}).`) +
    "\n\nCredits reset when your plan renews. Recordings you've already made still play free.";
  a.addAction("Read it with the iPhone voice");
  a.addCancelAction("OK");
  if ((await a.present()) === 0) await Speech.speak(text);
}
// ok keyProblem
function keyProblem(e) {
  const said = `${e.status || ""} ${e.detail || e.message || ""}`;
  return (e.code === 401 || e.code === 400) && !outOfCredits(e) && /invalid_api_key|invalid api key|api key id|only valid api keys|api key (is )?(invalid|not valid)|needs_authorization/i.test(said) && !/permission/i.test(said);
}
// ElevenLabs turned down a recording for a reason other than the key or credits
// (a voice the plan or the voice's owner doesn't allow through the API, say)
async function voiceRefused(s, t, at, tr, say, voice, e, text) {
  const prev = s.prevVoice && s.prevVoice.id !== voice.id ? s.prevVoice : null;
  const back = prev ? prev.name : VOICE_NAME;
  const a = new Alert();
  a.title = `ElevenLabs wouldn't record with ${voice.name}`;
  const perm = /permission/i.test(`${e.status || ""} ${e.detail || e.message || ""}`);
  a.message = `ElevenLabs said ${e.code}${e.detail ? ": " + e.detail : ""}\n\n` + (perm
    ? "Your key works but isn't allowed to do this: at elevenlabs.io, API Keys, turn on Text to Speech for it."
    : "Your key works; this is about the voice or your plan.") + " Nothing was charged.";
  a.addAction(`Go back to ${back}`);
  a.addAction("Pick another voice");
  a.addAction("Read it with the iPhone voice");
  a.addCancelAction("Cancel");
  const pick = await a.present();
  if (pick === 0) {
    if (prev) { s.voice = prev; s.voicePicked = true; } else { s.voice = null; s.voicePicked = false; }
    s.prevVoice = null; saveStore(s);
    return listenRemarks(s, t, at, tr, say);
  }
  if (pick === 1) { const k = await getKey(); if (k && (await chooseVoice(s, k))) return listenRemarks(s, t, at, tr, say); return; }
  if (pick === 2) await Speech.speak(text);
}
// ok capText
function capText(text) {
  if (text.length <= MAX_LISTEN_CHARS) return text;
  const cut = text.slice(0, MAX_LISTEN_CHARS);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
  return cut.slice(0, end > 0 ? end + 1 : MAX_LISTEN_CHARS) + " That's the end of this reading.";
}
// ok sentencesOf
function sentencesOf(text) {
  // drop heading-like lines first (short, no closing punctuation), so a page
  // header doesn't glue itself onto the first sentence
  const lines = text.replace(/(\w)-\n(\w)/g, "$1$2").split("\n")
    .filter((l) => !/global markets? analysis report/i.test(l))
    .filter((l) => l.trim().split(/\s+/).length >= 8 || /[.!?]["')\]]*\s*$/.test(l.trim()));
  // a sentence ends at . ! or ? followed by a space and a capital (so "1.0 percent"
  // and "$50.1 trillion" stay whole); bullets are dropped
  return lines.join(" ").replace(/[\u2022\u25AA\u25CF\u2013\u2014]\s*/g, (c) => (/[\u2013\u2014]/.test(c) ? ", " : ""))
    .replace(/\s+/g, " ")
    .replace(/([.!?]["')\]\u201D\u2019]*)\s+(?=["'(\[\u201C\u2018]?[A-Z0-9$])/g, "$1\u0001")
    .split("\u0001")
    .map((x) => x.trim())
    .filter((x) => /[.!?]["')\]\u201D\u2019]*$/.test(x));
}
// ok isProse
function isProse(sen) {
  const words = sen.split(/\s+/);
  if (words.length < 10) return false;
  if (/^(source|sources|note|notes)\b/i.test(sen)) return false;
  if (/global markets? analysis report|office of capital markets|ginniemae\.gov/i.test(sen)) return false;
  const chars = sen.replace(/\s/g, "");
  const letters = (chars.match(/[A-Za-z]/g) || []).length;
  return letters / chars.length >= 0.7;
}
// ok runPdfReader
async function runPdfReader(path, fn) {
  const wv = updWV(new WebView());
  await wv.loadHTML(...updArgs(EXTRACT_HTML));
  let ready = false;
  for (let i = 0; i < 20 && !ready; i++) {
    ready = await wv.evaluateJavaScript("typeof pdfjsLib !== 'undefined'");
    if (!ready) await sleep(500);
  }
  if (!ready) throw new Error("Couldn't load the PDF reader");
  const b64 = fm().read(path).toBase64String();
  await wv.evaluateJavaScript(`${fn}(${JSON.stringify(b64)})`);
  for (let i = 0; i < 120; i++) {
    await sleep(500);
    const out = await wv.evaluateJavaScript("window.__out");
    if (out) {
      const o = JSON.parse(out);
      if (o.error) throw new Error(o.error);
      return o;
    }
  }
  throw new Error("Timed out reading the PDF");
}
const EXTRACT_HTML = `<!DOCTYPE html><html><head><meta charset="utf-8">
<script src="${PDFJS}"></script></head><body><script>
window.__out = null;
window.extract = function (b64) {
  window.__out = null;
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "${PDFJS_WORKER}";
    var raw = atob(b64), bytes = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    pdfjsLib.getDocument({ data: bytes }).promise.then(function (doc) {
      var n = doc.numPages, i = n, found = "";
      // the state table sits near the back; read from the end until the National row turns up
      function next() {
        if (i < 1) { window.__out = JSON.stringify({ text: found }); return; }
        doc.getPage(i).then(function (p) { return p.getTextContent(); }).then(function (tc) {
          var s = tc.items.map(function (it) { return it.str; }).join(" ");
          if (/National/.test(s) && /Serious Delinquency/i.test(s)) { window.__out = JSON.stringify({ text: s }); return; }
          i--; next();
        }, function (e) { window.__out = JSON.stringify({ error: String(e) }); });
      }
      next();
    }, function (e) { window.__out = JSON.stringify({ error: String(e) }); });
  } catch (e) { window.__out = JSON.stringify({ error: String(e) }); }
  return "started";
};
window.extractAll = function (b64) {
  window.__out = null;
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "${PDFJS_WORKER}";
    var raw = atob(b64), bytes = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    pdfjsLib.getDocument({ data: bytes }).promise.then(function (doc) {
      var pages = [], i = 1;
      function next() {
        if (i > doc.numPages) { window.__out = JSON.stringify({ pages: pages }); return; }
        doc.getPage(i).then(function (p) { return p.getTextContent(); }).then(function (tc) {
          pages.push(tc.items.map(function (it) { return it.str + (it.hasEOL ? "\\n" : " "); }).join(""));
          i++; next();
        }, function (e) { window.__out = JSON.stringify({ error: String(e) }); });
      }
      next();
    }, function (e) { window.__out = JSON.stringify({ error: String(e) }); });
  } catch (e) { window.__out = JSON.stringify({ error: String(e) }); }
  return "started";
};
</script></body></html>`;

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
// ---------- Fix panel: script side (shared) ----------
// The release schedule's Fix panel asks through window.__takeFix (Retry now, Copy
// report) and window.__takeOpen (Open the source). Each widget's full view sets
// FIX_RETRY to a function that refreshes everything and updates the page; while it
// runs, FIX_FORCE (and FRED_FORCE, where a widget asks FRED) skip "checked recently".
// tools/fix_kit_script.js is the master copy; tools/sync_fix_kit.py puts it in each widget.
let FIX_FORCE = false;
let FIX_RETRY = null;
// the publisher's page for a schedule row, by its name (FRED rows carry their own)
const FIX_PAGES = [
  [/^NY Fed household debt/, "https://www.newyorkfed.org/microeconomics/hhdc"],
  [/^Freddie Mac delinquency/, "https://www.freddiemac.com/investors/financials/monthly-volume-summaries"],
  [/^MBA forecast/, "https://www.mba.org/news-and-research/forecasts-and-commentary"],
  [/^MBA weekly/, "https://www.mba.org/news-and-research/newsroom"],
  [/^NY Fed housing survey/, "https://www.newyorkfed.org/microeconomics/sce/housing"],
  [/^NY Fed survey: job/, "https://www.newyorkfed.org/microeconomics/sce/labor"],
  [/^Pro forecasters/, "https://www.philadelphiafed.org/surveys-and-data/real-time-data-research/survey-of-professional-forecasters"],
  [/^Closings \(Zillow\)/, "https://www.zillow.com/research/data/"],
  [/^Treasury yields/, "https://www.federalreserve.gov/releases/h15/"],
  [/^Layoffs in the news/, "https://www.gdeltproject.org/"],
  [/^Optimal Blue/, "https://fred.stlouisfed.org/series/OBMMIC30YF"],
  [/^Freddie Mac 30-yr/, "https://fred.stlouisfed.org/series/MORTGAGE30US"],
  [/^MOVE index/, "https://finance.yahoo.com/quote/%5EMOVE/"],
  [/^For-sale starts/, "https://www.census.gov/construction/nrc/index.html"],
  [/^Stock prices|^Market caps/, "https://finance.yahoo.com/"],
  [/^Shares outstanding/, "https://www.sec.gov/edgar/search/"],
];
function fixPages(rows) {
  (rows || []).forEach((r) => {
    if (r.page) return;
    if (r.series) { r.page = "https://fred.stlouisfed.org/series/" + r.series; return; }
    const hit = FIX_PAGES.find((p) => p[0].test(r.name || ""));
    if (hit) r.page = hit[1];
  });
  return rows;
}
// one look at the page: answer a Fix request or an Open-the-source tap
async function fixPoll(wv) {
  let fx = null;
  try { fx = await wv.evaluateJavaScript("window.__takeFix ? window.__takeFix() : null"); } catch (e) {}
  if (fx) {
    let req = {};
    try { req = JSON.parse(fx); } catch (e) {}
    let res = { key: req.key, ok: true };
    if (req.action === "copy") { Pasteboard.copyString(String(req.text || "").replace("__FIX_NAME__", () => Script.name())); res.msg = "Copied. Paste it to Claude."; }
    else if (req.action === "retry") {
      if (!FIX_RETRY) res = { key: req.key, ok: false, msg: "Retry works once the page has finished its first load; try again in a moment." };
      else {
        FIX_FORCE = true;
        try { FRED_FORCE = true; } catch (e) {}
        try { await FIX_RETRY(); res.after = true; }
        catch (e) { res = { key: req.key, ok: false, msg: "Retry failed: " + String((e && e.message) || e).slice(0, 160) }; }
        finally { FIX_FORCE = false; try { FRED_FORCE = false; } catch (e) {} }
      }
    }
    try { await wv.evaluateJavaScript(`window.fixDone && window.fixDone(${JSON.stringify(res)});0`); } catch (e) {}
  }
  let u = null;
  try { u = await wv.evaluateJavaScript("window.__takeOpen ? window.__takeOpen() : null"); } catch (e) {}
  if (u) { try { await Safari.openInApp(u, false); } catch (e) { try { Safari.open(u); } catch (e2) {} } }
}
// ---------- end Fix panel (script) ----------
async function sharePoller(wv, isOpen) {
  const later = [];
  while (isOpen()) {
    await sleep(600);
    if (!isOpen()) break;
    await fixPoll(wv);
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
  let open = true, closed = null;
  // A view that closes the instant it opens never really showed (the app was
  // still launching, or another view was still up): open it again, twice at most
  for (let tries = 0; ; tries++) {
    const p = wv.present(true).then(() => true, () => true);
    const quick = await Promise.race([p, sleep(700).then(() => false)]);
    if (!quick) { closed = p.then(() => { open = false; }); break; }
    if (tries >= 2) { open = false; closed = Promise.resolve(); break; }
    await sleep(600);
  }
  if (!open) return;
  const sharing = sharePoller(wv, () => open);
  updWatch(wv, () => open); // redraw the page if iOS drops it
  await new Promise((r) => Timer.schedule(2500, false, r)); // let the page draw before the background work starts
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


// One full view at a time: a newer run (another tap on the widget) takes over,
// and an older copy still open in the background stops refreshing
const RUN_FILE = "builder-stocks-run.txt";
function runPath() { return fm().joinPath(fm().documentsDirectory(), RUN_FILE); }
function claimRun(me) { try { fm().writeString(runPath(), me); } catch (e) {} }
function stillMine(me) { try { return !fm().fileExists(runPath()) || fm().readString(runPath()) === me; } catch (e) { return true; } }

async function openApp() {
  const s = readStore();
  const me = Date.now() + "-" + Math.random().toString(36).slice(2);
  const html = () => PAGE_HTML.replace("__DATA__", () => JSON.stringify(payload(s))).replace("__SHARE__", () => "<script>" + SHARE_PAGE_JS + "</script>");
  const wv = updWV(new WebView());
  await wv.loadHTML(...updArgs(html()));
  await presentWithSharing(wv, async (isOpen) => {
    claimRun(me);
    // Black-screen guard: the page says when it has drawn. If it hasn't (or the
    // page stopped answering), load it again, twice at most.
    (async () => {
      for (let k = 0; k < 2 && isOpen(); k++) {
        await sleep(1500);
        let ok = -1;
        try { ok = await Promise.race([wv.evaluateJavaScript("window.__drawn ? 1 : 0"), sleep(2500).then(() => -1)]); } catch (e) {}
        if (ok === 1 || !isOpen()) break;
        try { await wv.loadHTML(...updArgs(html())); } catch (e) {}
      }
    })();
    const say = async (t) => { try { if (isOpen()) await wv.evaluateJavaScript(`window.setStatus(${JSON.stringify(t)});0`); } catch (e) {} };
    const push = async () => { try { if (isOpen()) await wv.evaluateJavaScript(`window.update(${JSON.stringify(payload(s))});0`); } catch (e) {} };
    // the page is up with the last saved numbers; fresh ones fill in step by step,
    // while taps (calls, SEC contact) are answered at the same time
    let busy = true, last = Date.now();
    // Fix › Retry now: everything again (after any refresh already running), then redraw
    FIX_RETRY = async () => {
      while (busy && isOpen()) await sleep(300);
      busy = true;
      try { await refresh(s, true, say, push); } finally { busy = false; last = Date.now(); }
      await push();
    };
    refresh(s, true, say, push).then(async () => {
      busy = false;
      await push();
      // no market caps from Yahoo and no SEC contact yet: ask for it once
      if (isOpen() && !secContact() && !s.secAsked && CANDIDATES.some((c) => !((s.ycap && s.ycap.caps) || {})[c.t])) { s.secAsked = true; saveStore(s); if (await askSecContact()) { await refresh(s, false, say, push); await push(); } }
    }).catch(() => { busy = false; });
    while (isOpen()) {
      await sleep(500);
      if (!stillMine(me)) { await say("Opened again from the widget: close this copy"); break; }
      let req = "";
      try { req = await wv.evaluateJavaScript("window.__takeReq ? window.__takeReq() : ''"); } catch (e) {}
      if (req === "voice") { try { await voiceMenu(s); } catch (e) {} await push(); }
      if (req === "sec") { await askSecContact(); await refresh(s, false, say); await push(); }
      if (req && req.startsWith("call:")) { const [, t, which] = req.split(":"); try { await openCall(s, t, which, say); await push(); /* show a new "Recorded" tag right away */ } catch (e) { await say(""); await choose("Earnings call", String(e.message || e), ["OK"]); } }
      if (!busy && marketOpenNow(s) && Date.now() - last > 3 * 60000) { last = Date.now(); busy = true; try { await refresh(s, true, null, push); } catch (e) {} busy = false; await push(); }
    }
  });
}

// ---------- Run ----------
if (config.runsInWidget || PREVIEW_WIDGET_IN_APP) {
  const s = readStore();
  try {
    const timeout = new Promise((r) => Timer.schedule(WIDGET_BUDGET_S * 1000, false, () => r(null)));
    await Promise.race([refresh(s, false, null), timeout]);
  } catch (e) {}
  const w = renderWidget(s);
  if (config.runsInWidget) Script.setWidget(w);
  else await w.presentSmall();
} else {
  try {
    await openApp();
  } catch (e) {
    const a = new Alert();
    a.title = "Builder Stocks";
    a.message = String(e.message || e);
    a.addAction("OK");
    await a.present();
  }
}
Script.complete();
// Update test, Nov 17, 2026 (no change in behavior)
