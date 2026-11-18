// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-blue; icon-glyph: book-open;

// ---- Shared settings (saved on this phone by the Setup script) ----
// Keys and personal settings live in the phone's keychain, not in this file,
// so the file can be shared as is.
function setting(key, fallback) {
  try { if (Keychain.contains(key)) { const v = Keychain.get(key); if (v) return v; } } catch (e) {}
  return fallback;
}


// Reports Widget (small): a release calendar for the industry reports you
// read, every one a PDF you can open, save or share.
//   Ginnie Mae Global Markets Analysis Report (monthly)
//   Urban Institute Housing Finance at a Glance chartbook (monthly)
//   ICE Mortgage Monitor (monthly)
//   Fannie Mae Housing Forecast and Economic Forecast (monthly)
//   MBA Forecast Commentary (monthly: commentary and charts, no data tables)
//   HUD FHA Single Family Loan Performance Trends (monthly)
//   Fed Beige Book (8 a year)
//   NY Fed Household Debt and Credit Report (quarterly)
//   Big 5 builder earnings releases (quarterly: D.R. Horton, Lennar,
//     PulteGroup, NVR, Toll Brothers; the SEC filing, saved as a PDF on this phone)
// Cover: the next book due, and the last 2 released (blue dot = not opened yet).
// Tap: the schedule. Each book's next release, and its last 2 editions. Tap an
// edition to read its PDF (downloaded the first time, then kept; the viewer's
// share button saves it to Files). Only the newest 2 editions of each book
// are kept.
//
// Next-release dates: the Beige Book's come from the Fed's published calendar.
// The rest are estimates from each book's past timing (the day of the month
// its last edition came out, or its usual window); a book past its window
// turns orange, with how late it is, when it was due, and why it isn't in.

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
const CHECK_HOURS = 6; // how often the widget looks for new editions
const WIDGET_BUDGET_S = 20; // a widget gets only seconds; past this it shows what it has
const LOOKBACK_MONTHS = 6; // how far back to look for editions
const KEEP = 2; // editions kept per book
const STORE_FILE = "reports-v2.json";
const OLD_STORE = "reports-v1.json"; // the earlier version's file: its voice and opened marks carry over
const CREDIT_STORE = "mortgage-credit-v1.json"; // the Borrower Credit widget's file: HUD report addresses it already found
const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
const JSPDF = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
const H2C = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
const PREVIEW_WIDGET_IN_APP = false;

// SEC asks every request to say who's asking: a name and an email address.
// The app asks for it once and keeps it in this phone's keychain (not in this
// file); "SEC contact" at the bottom of the schedule changes it.
const SEC_KEY = "sec_contact";
let SEC_CONTACT = Keychain.contains(SEC_KEY) ? Keychain.get(SEC_KEY) : "";
// Each builder's release is found by a phrase its releases always use
const BUILDERS = [
  { t: "DHI", name: "D.R. Horton", short: "Horton", cik: "0000882184", q: "homes closed" },
  { t: "LEN", name: "Lennar", short: "Lennar", cik: "0000920760", q: "new orders" },
  { t: "PHM", name: "PulteGroup", short: "Pulte", cik: "0000822416", q: "net new orders" },
  { t: "NVR", name: "NVR", short: "NVR", cik: "0000906163", q: "settlements" },
  { t: "TOL", name: "Toll Brothers", short: "Toll", cik: "0000794170", q: "net signed contracts" },
];


const GREEN = "#30D158";
const RED = "#FF453A";
const BLUE = "#64D2FF";
const ORANGE = "#FF9F0A";
const GRAY = "#98989F";
const DIM = "#636366";
const RULE = "#3A3A3C";

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_NAMES = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const BROWSER_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const DAY = 24 * 3600 * 1000;

// ---------- Small helpers ----------
function fm() {
  return FileManager.local();
}
function docPath(name) {
  return fm().joinPath(fm().documentsDirectory(), name);
}
const keyOf = (y, m) => `${y}-${String(m + 1).padStart(2, "0")}`;
const isoDay = (d) => new Date(d).toISOString().slice(0, 10);
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const plusDays = (iso, n) => isoDay(Date.parse(iso + "T12:00:00Z") + n * DAY);
const daysBetween = (a, b) => Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / DAY);
function label(key, short) {
  const [y, m] = key.split("-").map(Number);
  return short ? `${MON[m - 1]} ’${String(y).slice(2)}` : `${MON[m - 1]} ${y}`;
}
function shortDate(iso) {
  if (!iso) return "—";
  const [, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  return `${MON[m - 1]} ${d}`;
}
function dayName(iso) {
  return WD[new Date(iso + "T12:00:00Z").getUTCDay()] + " " + shortDate(iso);
}
function rangeText(a, b) {
  if (a === b) return shortDate(a);
  return a.slice(0, 7) === b.slice(0, 7) ? `${shortDate(a)}–${+b.slice(8)}` : `${shortDate(a)}–${shortDate(b)}`;
}
function ago(ms) {
  if (!ms) return "never";
  const min = Math.round((Date.now() - ms) / 60000);
  if (min < 2) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 36) return `${h} hr${h === 1 ? "" : "s"} ago`;
  return `${Math.round(h / 24)} days ago`;
}
// A date in text like "June 8, 2026" -> "2026-06-08"
function parseLongDate(text) {
  const m = /(January|February|March|April|May|June|July|August|September|October|November|December) (\d{1,2}), (\d{4})/.exec(text || "");
  return m ? `${m[3]}-${String(MONTH_NAMES.indexOf(m[1].toLowerCase()) + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}` : null;
}
const sleep = (ms) => new Promise((r) => Timer.schedule(ms, false, r));
const safeKey = (k) => String(k).replace(/[^\w-]/g, "");
function shortErr(e) {
  const m = String((e && e.message) || e || "unknown error");
  return /offline|internet connection|network connection|timed out|could not connect|hostname/i.test(m) ? "no connection" : m.slice(0, 120);
}

async function choose(title, message, actions) {
  const a = new Alert();
  a.title = title;
  a.message = message;
  actions.forEach((x) => a.addAction(x));
  a.addCancelAction("Cancel");
  return a.presentSheet();
}
function decodeHtml(x) {
  return x
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&(?:rsquo|lsquo|#8217|#8216|#39);/g, "'")
    .replace(/&(?:rdquo|ldquo|quot|#8220|#8221);/g, '"')
    .replace(/&(?:ndash|#8211|mdash|#8212);/g, ", ")
    .replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n))
    .replace(/\s+/g, " ")
    .trim();
}

// ---------- Store ----------
// { books: { id: { eds: [newest, previous], checked, err, nextExact, nextEst } }, voice, openedKeys }
// An edition: { key, label, url, pageUrl, posted (ISO day or null), est (posted unknown), sort, opened }
function readStore() {
  let s = null;
  try {
    const p = docPath(STORE_FILE);
    if (fm().fileExists(p)) s = JSON.parse(fm().readString(p));
  } catch (e) {}
  if (!s) {
    s = { books: {}, openedKeys: {} };
    // first run of this version: keep the voice and which editions were opened
    try {
      const p = docPath(OLD_STORE);
      if (fm().fileExists(p)) {
        const o = JSON.parse(fm().readString(p));
        if (o.voice) s.voice = o.voice;
        for (const id of ["ginnie", "urban", "ice"]) if (o[id] && o[id].opened) s.openedKeys[`${id}:${o[id].key}`] = true;
        for (const t in o.builders || {}) if (o.builders[t] && o.builders[t].opened) s.openedKeys[`b-${t}:${o.builders[t].key}`] = true;
      }
      // the earlier version's single copies (the Urban one is shared with the Urban widget, so it stays)
      for (const f of ["ginnie-gmar.pdf", "ice-mortgage-monitor.pdf"]) if (fm().fileExists(docPath(f))) fm().remove(docPath(f));
    } catch (e) {}
  }
  s.books = s.books || {};
  s.openedKeys = s.openedKeys || {};
  // books merged since (Fannie's and MBA's two forecasts became one book each), and
  // MBA's forecast tables, replaced by its Forecast Commentary
  // and the builders' earnings releases, replaced by their investor decks
  for (const id of ["fnmah", "fnmae", "mbaf", "mbae", "mba", "b-DHI", "b-LEN", "b-PHM", "b-NVR", "b-TOL"]) {
    if (!s.books[id]) continue;
    delete s.books[id];
    try { for (const f of fm().listContents(fm().documentsDirectory())) if (f.startsWith(`book-${id}-`)) fm().remove(docPath(f)); } catch (e) {}
  }
  return s;
}
function saveStore(s) {
  try {
    fm().writeString(docPath(STORE_FILE), JSON.stringify(s));
  } catch (e) {}
}

// A site that sends a missing address somewhere else (its newest file, a
// search page) answers 200 at a different address: that isn't the edition asked for
function redirected(res, url) {
  const got = String((res && res.url) || "");
  if (!got) return false;
  const want = decodeURIComponent(url.split("?")[0].split("/").pop()).toLowerCase();
  return !decodeURIComponent(got.split("?")[0]).toLowerCase().includes(want);
}

// ---------- Is a PDF there? ----------
// HEAD first; a server that refuses HEAD gets a normal request, and the answer
// has to start like a PDF. reached = the site answered at all.
async function pdfThere(url, ua) {
  const hdr = (res) => (res && res.headers) || {};
  const lmOf = (h) => {
    const lm = h["Last-Modified"] || h["last-modified"];
    return lm && !isNaN(Date.parse(lm)) ? isoDay(Date.parse(lm)) : null;
  };
  try {
    const r = new Request(url);
    r.method = "HEAD";
    r.timeoutInterval = 12;
    r.headers = { "User-Agent": ua || BROWSER_UA };
    await r.load();
    const res = r.response || {}, h = hdr(res), code = res.statusCode || 0;
    const type = String(h["Content-Type"] || h["content-type"] || "");
    if (code === 200 && !/html/i.test(type)) return { ok: true, reached: true, posted: lmOf(h) };
    // a missing file sometimes comes back as a normal web page
    if (code === 404 || code === 410 || (code === 200 && /html/i.test(type))) return { ok: false, reached: true };
  } catch (e) {}
  try {
    const g = new Request(url);
    g.timeoutInterval = 30;
    g.headers = { "User-Agent": ua || BROWSER_UA };
    const data = await g.load();
    const res = g.response || {};
    const ok = (res.statusCode || 200) < 400 && !!data && data.toBase64String().startsWith("JVBERi");
    return { ok, reached: true, posted: ok ? lmOf(hdr(res)) : null };
  } catch (e) {
    return { ok: false, reached: false };
  }
}
// The first of these addresses that holds a PDF
function pdfAt(urlsFor, ua) {
  return async (p) => {
    let reached = false;
    for (const url of urlsFor(p)) {
      const h = await pdfThere(url, ua);
      if (h.reached) reached = true;
      if (h.ok) return { reached, ed: { url, posted: h.posted } };
    }
    return { reached };
  };
}

// ---------- Periods to look through ----------
// Months (or quarters), newest first; each { key, label, y, m (0-based) / q }
function monthsBack(startBack) {
  const out = [], now = new Date();
  for (let back = startBack || 0; back <= LOOKBACK_MONTHS; back++) {
    const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const key = keyOf(d.getFullYear(), d.getMonth());
    out.push({ key, label: label(key), y: d.getFullYear(), m: d.getMonth() });
  }
  return out;
}
function quartersBack() {
  const out = [], now = new Date();
  let y = now.getFullYear(), q = Math.floor(now.getMonth() / 3) + 1;
  for (let i = 0; i < 6; i++) {
    out.push({ key: `${y}Q${q}`, label: `Q${q} ${y}`, y, q });
    q--;
    if (q === 0) { q = 4; y--; }
  }
  return out;
}
// Look through the periods, newest first, for editions not already stored;
// stop at the newest stored one once there are enough. Throws if no site answered.
async function scan(have, periods, probe) {
  const found = [], known = new Set(have.map((h) => h.key));
  const newest = have.length ? have[0].key : "";
  let tried = 0, reached = 0;
  for (const p of periods) {
    if (p.key <= newest && found.length + have.length >= KEEP) break;
    if (known.has(p.key)) continue;
    if (found.length >= KEEP) break;
    const r = await probe(p);
    tried++;
    if (r.reached) reached++;
    if (r.ed) {
      // a new edition that wasn't there at the last check came out about now
      const posted = r.ed.posted || (have.length ? todayIso() : null);
      found.push({ key: p.key, label: p.label, ...r.ed, posted, est: !posted });
    }
  }
  if (tried && !reached) throw new Error("no connection");
  return found;
}

// ---------- Where each book lives ----------
// Ginnie's report for month M is posted early in month M+1 (sometimes M+2),
// under one of two address styles it has used
function ginnieUrls(y, m) {
  const tag = `${MON[m].toLowerCase()}${String(y).slice(2)}`;
  const urls = [];
  for (const add of [1, 2, 0]) {
    const d = new Date(y, m + add, 1);
    urls.push(`https://www.ginniemae.gov/s3/sites/default/files/${keyOf(d.getFullYear(), d.getMonth())}/global_market_analysis_${tag}.pdf`);
  }
  urls.push(`https://www.ginniemae.gov/data_and_reports/reporting/Documents/global_market_analysis_${tag}.pdf`);
  return urls;
}

async function getPage(url) {
  const r = new Request(url);
  r.timeoutInterval = 15;
  r.headers = { "User-Agent": BROWSER_UA };
  const body = await r.loadString();
  const res = r.response || {};
  // sent elsewhere (a listing or the newest edition) counts as not found
  return { code: redirected(res, url) ? 404 : res.statusCode || 200, body };
}
// The page is about this month's edition: "October 2026", "Oct. 2026" or a date like "October 5, 2026" on it
function namesMonth(body, p) {
  return new RegExp("\\b(" + MONF[p.m] + "|" + MON[p.m] + "\\.?)\\s+(\\d{1,2},?\\s+)?" + p.y + "\\b", "i").test(decodeHtml(body));
}
function pagePublished(html) {
  const m = /"datePublished"\s*:\s*"(\d{4}-\d{2}-\d{2})/.exec(html) ||
    /article:published_time"\s+content="(\d{4}-\d{2}-\d{2})/.exec(html);
  return m ? m[1] : null;
}
// Urban's chartbook has a page per edition; the page links the PDF
async function probeUrban(p) {
  const pageUrl = `https://www.urban.org/research/publication/housing-finance-glance-monthly-chartbook-${MONTH_NAMES[p.m]}-${p.y}`;
  try {
    const page = await getPage(pageUrl);
    if (page.code !== 200 || !/Housing Finance at a Glance/i.test(page.body) || !namesMonth(page.body, p)) return { reached: true };
    const m = /href="([^"]+\.pdf)"/i.exec(page.body);
    let url = m ? m[1].replace(/&amp;/g, "&") : null;
    if (url && url.startsWith("/")) url = "https://www.urban.org" + url;
    if (!url) return { reached: true };
    return { reached: true, ed: { url, pageUrl, posted: pagePublished(page.body) } };
  } catch (e) {
    return { reached: false };
  }
}
// ICE posts each Mortgage Monitor at a page named for its month; the page has
// the press-release summary (what gets read aloud), the date, and the PDF
async function probeIce(p) {
  const pageUrl = `https://mortgagetech.ice.com/resources/data-reports/${MONTH_NAMES[p.m]}-${p.y}-mortgage-monitor`;
  try {
    const page = await getPage(pageUrl);
    if (page.code !== 200 || !/Mortgage Monitor/i.test(page.body) || !namesMonth(page.body, p)) return { reached: true };
    const m = /href="([^"]*publicdocs[^"]*\.pdf)"/i.exec(page.body) || /href="([^"]+Mortgage_Monitor[^"]*\.pdf)"/i.exec(page.body);
    let url = m ? m[1].replace(/&amp;/g, "&") : null;
    if (url && url.startsWith("/")) url = "https://mortgagetech.ice.com" + url;
    if (!url) return { reached: true };
    const text = decodeHtml(page.body);
    const at = text.search(/Mortgage Monitor/i);
    const posted = pagePublished(page.body) || parseLongDate(text.slice(Math.max(0, at - 400), at + 2000));
    return { reached: true, ed: { url, pageUrl, posted } };
  } catch (e) {
    return { reached: false };
  }
}
// Fannie Mae ESR: housing-forecast-MMYYYY and economic-forecast-MMYYYY
const fannieUrls = (name) => (p) => [`https://www.fanniemae.com/media/document/pdf/${name}-${String(p.m + 1).padStart(2, "0")}${p.y}`];
const MON3 = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
// MBA Forecast Commentary (commentary and charts, no data tables), under names MBA
// hasn't kept consistent: forecast-commentary-mar26, -sep25-final, -mar-2024
function mbaCommentaryUrls(p) {
  const mo = MON3[p.m], full = MONF[p.m].toLowerCase(), yy = String(p.y).slice(2), y = p.y;
  const names = [`${mo}${yy}`, `${mo}${yy}-final`, `${mo}-${y}`, `${mo}-${y}-final`, `${full}-${y}`, `${full}-${y}-final`];
  const dirs = [`https://www.mba.org/docs/default-source/research-and-forecasts/forecasts/${y}/`, "https://www.mba.org/docs/default-source/research-and-forecasts/forecasts/"];
  const out = [];
  for (const d of dirs) for (const n of names) out.push(`${d}forecast-commentary-${n}.pdf`);
  return out;
}
const MBA_COMMENTARY_PAGE = "https://www.mba.org/forecasts-and-commentary/economic-commentary-archives";
// MBA's archive page lists every commentary wherever MBA keeps it; file-name guesses are the fallback
async function findMbaCommentary(have) {
  let links = [];
  try {
    const page = await getPage(MBA_COMMENTARY_PAGE);
    if (page.code < 400) {
      const body = String(page.body).replace(/&amp;/g, "&"); // the raw page: its links are in the tags
      for (const m of body.matchAll(/href="([^"]*forecast-commentary[^"]*\.pdf[^"]*)"/gi)) {
        const u = m[1].startsWith("http") ? m[1] : "https://www.mba.org" + (m[1].startsWith("/") ? "" : "/") + m[1];
        if (!links.includes(u)) links.push(u);
      }
    }
  } catch (e) {}
  // each link's month, from its name: mar26, sep25-final, mar-2024, august-2024
  const dated = [];
  for (const u of links) {
    const f = decodeURIComponent(u.split("/").pop().split("?")[0]).toLowerCase();
    const m = /forecast-commentary-([a-z]+)-?(\d{2}|\d{4})(?=[-.])/.exec(f);
    if (!m) continue;
    const mi = MON3.indexOf(m[1].slice(0, 3));
    if (mi < 0) continue;
    const y = m[2].length === 2 ? 2000 + +m[2] : +m[2];
    dated.push({ key: keyOf(y, mi), label: label(keyOf(y, mi)), url: u });
  }
  dated.sort((a, b) => (a.key < b.key ? 1 : -1));
  if (dated.length) {
    const known = new Set(have.map((h) => h.key)), out = [];
    for (const d of dated) {
      if (out.length + have.length >= KEEP * 2 || out.length >= KEEP) break;
      if (known.has(d.key)) continue;
      const h = await pdfThere(d.url);
      if (h.ok) out.push({ key: d.key, label: d.label, url: d.url, posted: h.posted || (have.length ? todayIso() : null), est: !h.posted });
    }
    if (out.length || have.length) return out;
  }
  return scan(have, monthsBack(0), pdfAt(mbaCommentaryUrls));
}

// HUD's FHA report for data month M posts 6 to 9 weeks after M ends, under
// names that have changed over the years (FHALPT_Aug2026, FHALPT-AUGUST2026, ...)
const MONF = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function hudUrls(p) {
  const y = p.y, m = p.m, out = [];
  const D1 = "https://www.hud.gov/sites/default/files/Housing/documents/", D2 = "https://www.hud.gov/sites/dfiles/Housing/documents/", D3 = "https://www.hud.gov/sites/dfiles/Housing/images/";
  const dirs = y >= 2026 ? [D1, D2, D3] : y === 2025 ? [D2, D1, D3] : [D3, D2, D1];
  const up = [MON[m].toUpperCase(), MONF[m].toUpperCase()], low = [MON[m], MONF[m]];
  const names = (y >= 2026 ? up.concat(low) : low.concat(up)).concat(m === 8 ? ["Sept", "SEPT"] : []);
  for (const dir of dirs) for (const n of names) for (const sep of ["_", "-", ""]) out.push(`${dir}FHALPT${sep}${n}${y}.pdf`);
  return out;
}
// HUD's addresses, a few at a time
async function probeHud(p) {
  const urls = hudUrls(p);
  let reached = false;
  for (let i = 0; i < urls.length; i += 9) {
    const res = await Promise.all(urls.slice(i, i + 9).map((u) => pdfThere(u, BROWSER_UA).then((h) => ({ u, h }))));
    if (res.some((x) => x.h.reached)) reached = true;
    const hit = res.find((x) => x.h.ok);
    if (hit) return { reached, ed: { url: hit.u, posted: hit.h.posted } };
  }
  return { reached };
}
// The Borrower Credit widget already found HUD's reports: start from those
function hudSeed() {
  try {
    const p = docPath(CREDIT_STORE);
    if (!fm().fileExists(p)) return [];
    const files = (JSON.parse(fm().readString(p)).fha || {}).files || {};
    return Object.keys(files).map(Number).sort((a, b) => b - a).slice(0, KEEP).map((t) => {
      const key = keyOf(Math.floor(t / 12), t % 12);
      return { key, label: label(key), url: files[t], posted: null, est: true };
    });
  } catch (e) {
    return [];
  }
}
async function findHud(have) {
  const seed = have.length ? have : hudSeed();
  const found = await scan(seed, monthsBack(1), probeHud);
  return have.length ? found : found.concat(seed);
}

// The Fed's Beige Book page lists the year's release dates; released ones link their PDF
const BEIGE_PAGE = "https://www.federalreserve.gov/monetarypolicy/beige-book-default.htm";
async function findBeige(have, st) {
  let page;
  try {
    page = await getPage(BEIGE_PAGE);
  } catch (e) {
    throw new Error("no connection");
  }
  const d8s = [...new Set([...page.body.matchAll(/BeigeBook_(\d{8})\.pdf/g)].map((m) => m[1]))].sort().reverse();
  const iso8 = (d8) => `${d8.slice(0, 4)}-${d8.slice(4, 6)}-${d8.slice(6)}`;
  const found = d8s.slice(0, KEEP).map((d8) => {
    const iso = iso8(d8);
    return { key: iso, label: `${shortDate(iso)}, ${iso.slice(0, 4)}`, url: `https://www.federalreserve.gov/monetarypolicy/files/BeigeBook_${d8}.pdf`, posted: iso, sort: iso };
  });
  if (!found.length) throw new Error("the Fed's page had no Beige Book links");
  // the next release: the first date listed after the newest report that has no report yet
  st.nextExact = null;
  const newest = found[0].key, released = new Set(d8s.map(iso8)), y0 = +newest.slice(0, 4), cands = [];
  for (const m of decodeHtml(page.body).matchAll(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})\b/g)) {
    for (const y of [y0, y0 + 1]) {
      const iso = `${y}-${String(MONTH_NAMES.indexOf(m[1].toLowerCase()) + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
      const gap = daysBetween(newest, iso);
      if (gap > 20 && gap < 100 && !released.has(iso)) cands.push(iso);
    }
  }
  cands.sort();
  if (cands.length) st.nextExact = cands[0];
  return found;
}

// NY Fed Household Debt and Credit Report, quarterly
const hhdcUrls = (p) => {
  const b = "https://www.newyorkfed.org/medialibrary/interactives/householdcredit/data/pdf/";
  return [`${b}hhdc_${p.y}q${p.q}.pdf`, `${b}HHDC_${p.y}Q${p.q}.pdf`, `${b}HHDC_${p.y}Q${p.q}`];
};

// A builder's earnings releases from SEC full-text search (Exhibit 99 to its
// 8-Ks), newest first
async function builderReleases(b) {
  const end = isoDay(Date.now());
  const start = isoDay(Date.now() - 2 * 365 * DAY);
  const url = "https://efts.sec.gov/LATEST/search-index?q=" + encodeURIComponent(`"${b.q}"`) +
    `&forms=8-K&ciks=${b.cik}&startdt=${start}&enddt=${end}`;
  const r = new Request(url);
  r.headers = { "User-Agent": SEC_CONTACT };
  r.timeoutInterval = 15;
  const j = await r.loadJSON();
  return ((j && j.hits && j.hits.hits) || [])
    .map((h) => {
      const [adsh, file] = String(h._id || "").split(":");
      const src = h._source || {};
      return { adsh, file, filed: src.file_date || "", type: src.file_type || "" };
    })
    .filter((x) => x.adsh && x.file && x.filed && /EX-99/i.test(x.type))
    .sort((a, c) => (a.filed < c.filed ? 1 : -1));
}
async function findBuilder(b, have, st) {
  if (!SEC_CONTACT) throw new Error("needs your SEC contact (tap SEC contact at the bottom)");
  let list;
  try {
    list = await builderReleases(b);
  } catch (e) {
    throw new Error("SEC search didn't answer");
  }
  if (!list.length) return [];
  const last = list[0];
  // the release before: at least 45 days earlier (a quarter's release can have several exhibits)
  const prev = list.find((x) => Date.parse(last.filed) - Date.parse(x.filed) > 45 * DAY);
  // next release: near the date the quarter after this one was released a year ago
  const target = new Date(last.filed).getTime() + 91 * DAY - 365 * DAY;
  const yrAgo = list.find((x) => Math.abs(new Date(x.filed).getTime() - target) <= 21 * DAY);
  st.nextEst = isoDay(yrAgo ? new Date(yrAgo.filed).getTime() + 365 * DAY : new Date(last.filed).getTime() + 91 * DAY);
  const cik = parseInt(b.cik, 10);
  return [last, prev].filter(Boolean).map((x) => ({
    key: x.adsh, label: `${shortDate(x.filed)}, ${x.filed.slice(0, 4)}`, sort: x.filed, posted: x.filed,
    url: `https://www.sec.gov/Archives/edgar/data/${cik}/${x.adsh.replace(/-/g, "")}/${x.file}`,
  }));
}
// Ask for the SEC contact (name and email) and keep it in the keychain
async function askSecContact() {
  const a = new Alert();
  a.title = "SEC contact";
  a.message = "The SEC asks every request for builder filings to say who's asking: your name and email, like \"Jane Doe jane@example.com\". It's kept in this phone's keychain and sent only to sec.gov. Cancel to skip the builder releases.";
  a.addTextField("Name and email", SEC_CONTACT);
  a.addAction("Save");
  a.addCancelAction("Cancel");
  if ((await a.present()) === -1) return SEC_CONTACT;
  const v = a.textFieldValue(0).trim();
  if (v) {
    Keychain.set(SEC_KEY, v);
    SEC_CONTACT = v;
  }
  return SEC_CONTACT;
}

// ---------- When each book is next due ----------
// A window of days in a month (month index may run past 11); days past the month's end are clamped
function winInMonth(y, m0, a, b) {
  const d = new Date(Date.UTC(y, m0, 1)), Y = d.getUTCFullYear(), M = d.getUTCMonth();
  const last = new Date(Date.UTC(Y, M + 1, 0)).getUTCDate();
  const iso = (day) => `${Y}-${String(M + 1).padStart(2, "0")}-${String(Math.min(Math.max(day, 1), last)).padStart(2, "0")}`;
  return { from: iso(a), to: iso(b) };
}
// Monthly book: the next edition comes the month after the newest. If the
// newest's publish date is known, the window centers on the same day of the
// month (and the same lag behind the edition's month); otherwise the book's
// usual window [lag in months, first day, last day].
function monthlyNext(def) {
  return (st) => {
    const e = st.eds[0];
    if (!e) return null;
    const [y, m] = e.key.split("-").map(Number);
    let [lag, a, b] = def;
    if (e.posted && !e.est) {
      const [py, pm, pd] = e.posted.split("-").map(Number);
      const off = py * 12 + pm - (y * 12 + m);
      if (off >= 0 && off <= 3) { lag = off; a = pd - 5; b = pd + 6; }
    }
    return winInMonth(y, m + lag, a, b); // m (1-based) as a 0-based index = the month after
  };
}
// HUD: data month M's report about 40 to 65 days after the next month ends
function hudNext(st) {
  const e = st.eds[0];
  if (!e) return null;
  const [y, m] = e.key.split("-").map(Number);
  const end = isoDay(Date.UTC(y, m + 1, 0)); // the last day of the month after the newest
  return { from: plusDays(end, 40), to: plusDays(end, 65) };
}
// NY Fed: the quarter after the newest, out early in the 2nd month after it ends (Feb, May, Aug, Nov)
function hhdcNext(st) {
  const e = st.eds[0];
  if (!e) return null;
  let [y, q] = e.key.split("Q").map(Number);
  q++;
  if (q > 4) { q = 1; y++; }
  return winInMonth(y, q * 3 + 1, 3, 14);
}
function beigeNext(st) {
  if (st.nextExact) return { from: st.nextExact, to: st.nextExact, exact: true };
  const e = st.eds[0];
  return e ? { from: plusDays(e.key, 40), to: plusDays(e.key, 56) } : null;
}
function builderNext(st) {
  return st.nextEst ? { from: plusDays(st.nextEst, -7), to: plusDays(st.nextEst, 7) } : null;
}

// ---------- Builder investor decks ----------
// Slide decks only (not filings or transcripts), from the builders that post them.
// One card; the newest 2 decks of each builder are kept.
const DECK_SOURCES = [
  { t: "DHI", short: "Horton", find: () => deckByPattern(dhiDeckUrls) },
  { t: "LEN", short: "Lennar", find: () => deckByPattern(lenDeckUrls) },
  { t: "TMHC", short: "Taylor Morrison", find: () => deckByPattern(tmhcDeckUrls) },
  { t: "KBH", short: "KB Home", find: async () => { const a = await deckByPattern(kbhDeckUrls); return a.length ? a : deckFromPages(["https://investor.kbhome.com/"]); } },
  { t: "GRBK", short: "Green Brick", find: () => deckByPattern(grbkDeckUrls) },
  { t: "DFH", short: "Dream Finders", find: () => deckFromPages(["https://investors.dreamfindershomes.com/", "https://investors.dreamfindershomes.com/news-events/events"]) },
  { t: "PHM", short: "Pulte", find: () => deckFromPages(["https://pultegroupinc.com/investor-relations/", "https://pultegroupinc.com/investor-relations/events-and-presentations/default.aspx"]) },
  { t: "TOL", short: "Toll", find: () => deckFromPages(["https://investors.tollbrothers.com/", "https://investors.tollbrothers.com/news-and-events/events-and-presentations"]) },
];
// calendar quarters that ended in the last 15 months, newest first
function endedQuarters(n) {
  const out = [], now = new Date();
  let y = now.getFullYear(), q = Math.floor(now.getMonth() / 3); // the last full quarter
  if (q === 0) { q = 4; y--; }
  for (let i = 0; i < (n || 5); i++) {
    out.push({ y, q, yy: String(y).slice(2), end: `${y}-${String(q * 3).padStart(2, "0")}-28` });
    if (--q === 0) { q = 4; y--; }
  }
  return out;
}
// Each pattern list: [{ per, label, end, urls }] newest first; the first 2 that exist are used
function dhiDeckUrls() {
  // D.R. Horton's fiscal year ends in September: calendar Q4 is its fiscal Q1 of the next year
  return endedQuarters(5).map((c) => {
    const fy = c.q === 4 ? c.y + 1 : c.y, fq = c.q === 4 ? 1 : c.q + 1;
    return { per: `${c.y}Q${c.q}`, label: `Q${fq} FY${fy}`, end: c.end, urls: [`https://investor.drhorton.com/~/media/Files/D/D-R-Horton-IR/reports-and-presentations/presentations/q${fq}-${fy}-investor-presentation.pdf`] };
  });
}
function tmhcDeckUrls() {
  return endedQuarters(5).map((c) => ({ per: `${c.y}Q${c.q}`, label: `Q${c.q} ${c.y}`, end: c.end, urls: [`https://s27.q4cdn.com/448041563/files/doc_earnings/${c.y}/q${c.q}/presentation/TMHC-${c.q}Q${c.yy}-Investor-Presentation-Final.pdf`] }));
}
function grbkDeckUrls() {
  return endedQuarters(5).map((c) => ({ per: `${c.y}Q${c.q}`, label: `Q${c.q} ${c.y}`, end: c.end, urls: [`https://s202.q4cdn.com/944500558/files/doc_financials/${c.y}/q${c.q}/${c.q}Q${c.yy}-Investor-Presentation-Final.pdf`] }));
}
function kbhDeckUrls() {
  // KB Home's fiscal quarters end in February, May, August and November
  const out = [], now = new Date();
  for (let back = 0; out.length < 5 && back < 18; back++) {
    const d = new Date(now.getFullYear(), now.getMonth() - back - 1, 1), m = d.getMonth();
    if ([1, 4, 7, 10].indexOf(m) < 0) continue;
    const fq = [1, 4, 7, 10].indexOf(m) + 1, fy = d.getFullYear();
    out.push({ per: `${fy}-${String(m + 1).padStart(2, "0")}`, label: `Q${fq} ${fy}`, end: `${fy}-${String(m + 1).padStart(2, "0")}-28`,
      urls: [`https://s201.q4cdn.com/124745054/files/doc_financials/${fy}/q${fq}/Q${fq}-${fy}-KBH-IR-Presentation.pdf`, `https://s21.q4cdn.com/462588783/files/doc_financials/${fy}/q${fq}/Q${fq}-${fy}-KBH-IR-Presentation.pdf`] });
  }
  return out;
}
function lenDeckUrls() {
  // Lennar posts one now and then, named by month: "June 2026 Investor Presentation"
  const out = [], now = new Date();
  for (let back = 0; back < 9; back++) {
    const d = new Date(now.getFullYear(), now.getMonth() - back, 1), name = `${MONF[d.getMonth()]} ${d.getFullYear()} Investor Presentation`;
    out.push({ per: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: `${MONF[d.getMonth()]} ${d.getFullYear()}`, end: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`,
      urls: [`https://investors.lennar.com/~/media/Files/L/Lennar-IR-V3/reports-and-presentations/${encodeURIComponent(name)}.pdf`] });
  }
  return out;
}
async function deckByPattern(listFn) {
  const out = [];
  for (const c of listFn()) {
    if (out.length >= KEEP) break;
    for (const url of c.urls) {
      const h = await pdfThere(url);
      if (h.ok) { out.push({ per: c.per, label: c.label, url, posted: h.posted || null, sort: h.posted || c.end }); break; }
    }
  }
  return out;
}
// Builders whose deck names can't be predicted: read their IR pages for PDF links that are decks
async function deckFromPages(pages) {
  const seen = new Set(), cands = [];
  for (const pg of pages) {
    let html = "";
    try { const p = await getPage(pg); if (p.code >= 400) continue; html = p.body; } catch (e) { continue; }
    const origin = pg.replace(/^(https?:\/\/[^/]+).*/, "$1");
    for (const m of html.matchAll(/href="([^"]+?\.pdf[^"]*)"[^>]*>([\s\S]{0,200}?)<\/a>/gi)) {
      let u = decodeHtml(m[1]);
      u = /^https?:/i.test(u) ? u : u.startsWith("//") ? "https:" + u : u.startsWith("/") ? origin + u : pg.replace(/[^/]*$/, "") + u;
      const hay = decodeURIComponent(u) + " " + m[2].replace(/<[^>]+>/g, " ");
      if (!/presentation|slides|overview/i.test(hay) || /transcript|release|10-?q|10-?k|proxy|annual report|sustainab|esg/i.test(hay)) continue;
      if (seen.has(u)) continue;
      seen.add(u);
      cands.push(u);
    }
  }
  const out = [];
  for (const u of cands.slice(0, 6)) {
    const h = await pdfThere(u);
    if (!h.ok) continue;
    const name = decodeURIComponent(u.split("/").pop().replace(/\.pdf.*$/i, "")).replace(/[-_+]+/g, " ").trim();
    out.push({ per: h.posted || name, label: deckLabel(name, h.posted), url: u, posted: h.posted || null, sort: h.posted || "0000" });
  }
  return out.sort((a, b) => (a.sort < b.sort ? 1 : -1)).slice(0, KEEP);
}
// A short name from a deck's file name: its quarter when it has one ("Q3 2026"),
// else what's left after the boilerplate, with the month it was posted
function deckLabel(name, posted) {
  const q = /\bQ([1-4])\s*(20\d\d)\b/i.exec(name) || /\b([1-4])Q\s*(\d\d)\b/i.exec(name) || /\bQ([1-4])\b.*?\b(20\d\d)\b/i.exec(name);
  if (q) return `Q${q[1]} ${q[2].length === 2 ? "20" + q[2] : q[2]}`;
  const rest = name.replace(/\b(final|revised|v\d|investor|presentation|slides|ir)\b/gi, " ").replace(/\b[A-Z]{2,5}\b/g, " ").replace(/\b\d{1,2} \d{1,2} \d{2,4}\b/g, " ").replace(/\s+/g, " ").trim();
  const when = posted ? `${MON[+posted.slice(5, 7) - 1]} ${posted.slice(0, 4)}` : "";
  return [rest.slice(0, 40), when].filter(Boolean).join(" · ") || "Investor presentation";
}
async function findDecks(have, st) {
  const found = [], errs = [];
  st.deckLast = st.deckLast || {};
  await Promise.all(DECK_SOURCES.map(async (src) => {
    // skip a builder whose newest deck is recent: decks come about quarterly
    const mine = have.filter((e) => e.t === src.t);
    if (mine.length >= KEEP && mine[0].sort && Date.now() - Date.parse(mine[0].sort) < 70 * DAY) return;
    try {
      for (const d of await src.find()) found.push({ key: `${src.t}-${safeKey(d.per)}`, t: src.t, label: `${src.short} · ${d.label}`, url: d.url, posted: d.posted, est: !d.posted, sort: d.sort });
    } catch (e) { errs.push(src.short); }
  }));
  if (errs.length === DECK_SOURCES.length) throw new Error("no connection");
  return found;
}
// keep the newest 2 decks of each builder
function keepDecks(eds) {
  const n = {};
  return eds.filter((e) => { const t = e.t || String(e.key).split("-")[0]; n[t] = (n[t] || 0) + 1; return n[t] <= KEEP; });
}
// the next deck: about a quarter after each builder's newest one
function decksNext(st) {
  const newest = {};
  (st.eds || []).forEach((e) => { const t = e.t || String(e.key).split("-")[0]; if (e.sort && (!newest[t] || e.sort > newest[t])) newest[t] = e.sort; });
  const nexts = Object.values(newest).map((d) => plusDays(String(d).slice(0, 10), 91)).filter((d) => d >= todayIso()).sort();
  return nexts.length ? { from: plusDays(nexts[0], -10), to: plusDays(nexts[0], 10) } : null;
}

// ---------- The books ----------
// monthlyNext([months after the edition's month, first day, last day]): the usual window
const BOOKS = [
  { id: "ginnie", name: "Ginnie Mae Global Markets Analysis", short: "Ginnie GMAR", src: "Ginnie Mae", cadence: "monthly",
    find: (have) => scan(have, monthsBack(0), pdfAt((p) => ginnieUrls(p.y, p.m))), next: monthlyNext([1, 1, 25]) },
  { id: "urban", name: "Urban Housing Finance at a Glance", short: "Urban chartbook", src: "Urban Institute", cadence: "monthly",
    find: (have) => scan(have, monthsBack(0), probeUrban), next: monthlyNext([0, 10, 28]) },
  { id: "ice", name: "ICE Mortgage Monitor", short: "ICE Monitor", src: "ICE", cadence: "monthly",
    find: (have) => scan(have, monthsBack(0), probeIce), next: monthlyNext([0, 1, 14]) },
  // Fannie puts out two forecasts on the same day: one book,
  // found by the first, and tapping an edition asks which PDF
  { id: "fannie", name: "Fannie Mae Forecasts", short: "Fannie forecasts", src: "Fannie Mae ESR", cadence: "monthly · 2 PDFs",
    parts: [{ k: "h", name: "Housing Forecast", urls: fannieUrls("housing-forecast") }, { k: "e", name: "Economic Forecast", urls: fannieUrls("economic-forecast") }],
    find: (have) => scan(have, monthsBack(0), pdfAt(fannieUrls("housing-forecast"))), next: monthlyNext([0, 8, 22]) },
  { id: "mbac", name: "MBA Forecast Commentary", short: "MBA commentary", src: "MBA", cadence: "monthly",
    find: findMbaCommentary, next: monthlyNext([0, 10, 22]) },
  { id: "decks", name: "Builder investor decks", short: "Builder decks", src: "Builders' investor sites", cadence: "about quarterly",
    find: findDecks, next: decksNext, keepEds: keepDecks },
  { id: "hud", name: "HUD FHA Loan Performance Trends", short: "HUD FHA", src: "HUD", cadence: "monthly",
    find: findHud, next: hudNext },
  { id: "beige", name: "Fed Beige Book", short: "Beige Book", src: "Federal Reserve Board", cadence: "8 a year",
    find: findBeige, next: beigeNext },
  { id: "hhdc", name: "NY Fed Household Debt and Credit", short: "NY Fed debt", src: "New York Fed", cadence: "quarterly",
    find: (have) => scan(have, quartersBack(), pdfAt(hhdcUrls)), next: hhdcNext },
];
const bookById = (id) => BOOKS.find((b) => b.id === id);

// ---------- Checking for new editions ----------
function pdfName(id, key, part) {
  return `book-${id}-${safeKey(key)}${part ? "-" + part.k : ""}.pdf`;
}
// A two-PDF book's file for an edition month ("2026-10")
function partUrl(part, ed) {
  return part.urls({ y: +ed.key.slice(0, 4), m: +ed.key.slice(5, 7) - 1 })[0];
}
const anySaved = (book, ed) => (book.parts || [null]).some((p) => fm().fileExists(docPath(pdfName(book.id, ed.key, p))));
// newest first; opened marks carried over
function mergeEds(s, id, have, found) {
  const by = {};
  for (const e of have.concat(found)) {
    const was = by[e.key];
    by[e.key] = was ? { ...e, ...was, posted: was.est && e.posted && !e.est ? e.posted : was.posted, est: was.est && e.est } : { ...e };
  }
  let eds = Object.values(by).map((e) => ({ ...e, sort: e.sort || e.key, opened: !!(e.opened || s.openedKeys[`${id}:${e.key}`]) }));
  eds.sort((a, b) => (a.sort < b.sort ? 1 : a.sort > b.sort ? -1 : 0));
  // the same file under two editions: a site handing out its newest file for a
  // month that isn't out yet; the older edition is the real one
  eds = eds.filter((e, i) => !e.url || !eds.slice(i + 1).some((o) => o.url === e.url));
  const book = bookById(id);
  return book && book.keepEds ? book.keepEds(eds) : eds.slice(0, KEEP);
}
// Remove saved PDFs of editions that dropped off
function prune(id, eds) {
  try {
    const keep = new Set(eds.map((e) => safeKey(e.key)));
    for (const f of fm().listContents(fm().documentsDirectory())) {
      const rest = f.startsWith(`book-${id}-`) && f.endsWith(".pdf") ? f.slice(`book-${id}-`.length, -4) : null;
      if (rest !== null && !keep.has(rest) && !keep.has(rest.replace(/-[a-z]$/, ""))) fm().remove(docPath(f));
      if (f.startsWith("listen-") && f.endsWith(".mp3")) fm().remove(docPath(f)); // read-aloud recordings from older versions
    }
  } catch (e) {}
}
async function refreshBook(s, book) {
  const st = s.books[book.id] || (s.books[book.id] = { eds: [] });
  try {
    const found = await book.find(st.eds, st);
    st.eds = mergeEds(s, book.id, st.eds, found || []);
    st.err = null;
    prune(book.id, st.eds);
  } catch (e) {
    st.err = shortErr(e);
  }
  st.checked = Date.now();
  saveStore(s);
}
// force: check every book now. onBook: called as each finishes.
async function refreshAll(s, force, onBook) {
  const due = BOOKS.filter((b) => force || !s.books[b.id] || Date.now() - (s.books[b.id].checked || 0) >= CHECK_HOURS * 3600 * 1000);
  await Promise.all(due.map((b) => refreshBook(s, b).then(() => (onBook ? onBook(b) : null)).catch(() => {})));
  saveStore(s);
  return s;
}

// ---------- Where each book stands ----------
// { book, st, w (window), kind: up | due | late | none, ... }
function standing(s, book) {
  const st = s.books[book.id] || { eds: [] };
  const w = book.next(st);
  const t = todayIso();
  if (!w) return { book, st, kind: "none" };
  if (t < w.from) return { book, st, w, kind: "up", inDays: daysBetween(t, w.from) };
  if (t <= w.to) return { book, st, w, kind: "due", since: daysBetween(w.from, t) };
  return { book, st, w, kind: "late", late: daysBetween(w.to, t) };
}
// Why a due or late book isn't in yet
function whyText(st) {
  if (!st.checked) return "Not checked yet";
  if (st.err) return `Last check failed ${ago(st.checked)}: ${st.err}`;
  return `Checked ${ago(st.checked)}: not posted yet`;
}
// What the schedule shows for a book's next release
function nextLines(x) {
  const w = x.w;
  if (x.kind === "none") return { main: "—", sub: x.st.err ? "couldn't check" : "no editions found yet", tone: "dim", why: x.st.err ? whyText(x.st) : "" };
  const tag = w.exact ? "" : " · est.";
  if (x.kind === "up") {
    const when = x.inDays === 1 ? "tomorrow" : `in ${x.inDays} days`;
    return w.exact ? { main: dayName(w.from), sub: when, tone: "up" } : { main: `~${rangeText(w.from, w.to)}`, sub: when + tag, tone: "up" };
  }
  if (x.kind === "due") {
    if (w.exact) return { main: "Today", sub: dayName(w.from), tone: "due", why: whyText(x.st) };
    return { main: "Due now", sub: `since ${shortDate(w.from)} (${x.since} day${x.since === 1 ? "" : "s"}) · late after ${shortDate(w.to)}${tag}`, tone: "due", why: whyText(x.st) };
  }
  return { main: `${x.late} day${x.late === 1 ? "" : "s"} late`, sub: `was due ${w.exact ? "" : "by "}${shortDate(w.to)}${tag}`, tone: "late", why: whyText(x.st) };
}
// Due or late books first (oldest due first), then the soonest coming up
function ordered(s) {
  const all = BOOKS.map((b) => standing(s, b));
  const rank = (x) => (x.kind === "late" || x.kind === "due" ? 0 : x.kind === "up" ? 1 : 2);
  return all.sort((a, b) => rank(a) - rank(b) || ((a.w && a.w.from) || "").localeCompare((b.w && b.w.from) || "") || a.book.name.localeCompare(b.book.name));
}
// The cover's "next up": something due or a few weeks late, else the soonest coming
function nextUp(s) {
  const list = ordered(s);
  return list.find((x) => x.kind === "due" || (x.kind === "late" && x.late <= 21)) || list.find((x) => x.kind === "up") || null;
}
// The newest editions across all books (newest publish date first)
function lastReleased(s, n) {
  const out = [];
  for (const b of BOOKS) for (const e of (s.books[b.id] || { eds: [] }).eds) if (e.posted) out.push({ book: b, ed: e });
  return out.sort((a, c) => (a.ed.posted < c.ed.posted ? 1 : a.ed.posted > c.ed.posted ? -1 : 0)).slice(0, n);
}

// ---------- Widget ----------
function hexOf(rgb) {
  return "#" + rgb.map((c) => c.toString(16).padStart(2, "0")).join("");
}
function paintBackground(ctx, W, H) {
  const top = [0x2c, 0x2c, 0x2e];
  const bottom = [0x1c, 0x1c, 0x1e];
  for (let i = 0; i < 34; i++) {
    const f = i / 33;
    ctx.setFillColor(new Color(hexOf(top.map((c, j) => Math.round(c + (bottom[j] - c) * f)))));
    ctx.fillRect(new Rect(0, (H * i) / 34, W, H / 34 + 1));
  }
}
function drawText(ctx, text, rect, font, hex, align) {
  ctx.setFont(font);
  ctx.setTextColor(new Color(hex));
  if (align === "right") ctx.setTextAlignedRight();
  else if (align === "center") ctx.setTextAlignedCenter();
  else ctx.setTextAlignedLeft();
  ctx.drawTextInRect(text, rect);
}
function dot(ctx, x, y, hex) {
  ctx.setFillColor(new Color(hex));
  ctx.fillEllipse(new Rect(x, y, 7, 7));
}
function clock(ctx, x, y, hex) {
  ctx.setStrokeColor(new Color(hex));
  ctx.setLineWidth(1.2);
  const c = new Path();
  c.addEllipse(new Rect(x + 0.5, y, 9, 9));
  ctx.addPath(c);
  ctx.strokePath();
  const h = new Path();
  h.move(new Point(x + 5, y + 4.5));
  h.addLine(new Point(x + 5, y + 1.8));
  h.move(new Point(x + 5, y + 4.5));
  h.addLine(new Point(x + 7, y + 5.6));
  ctx.addPath(h);
  ctx.strokePath();
}
function drawWidget(s) {
  const ctx = new DrawContext();
  ctx.size = new Size(170, 170);
  ctx.opaque = true;
  ctx.respectScreenScale = true;
  paintBackground(ctx, 170, 170);

  // Next up
  const n = nextUp(s);
  const hot = n && (n.kind === "due" || n.kind === "late");
  clock(ctx, 14, 14, hot ? ORANGE : GRAY);
  drawText(ctx, "NEXT UP", new Rect(28, 11, 120, 15), Font.semiboldSystemFont(10.5), hot ? ORANGE : GRAY);
  if (n) {
    const name = n.book.short;
    drawText(ctx, name, new Rect(14, 27, 146, 22), Font.semiboldSystemFont(name.length > 14 ? 16 : 18), "#FFFFFF");
    const L = nextLines(n);
    const line = n.kind === "late" ? `${L.main} · due ${shortDate(n.w.to)}`
      : n.kind === "due" ? (n.w.exact ? `Today · ${dayName(n.w.from)}` : `Due now · by ${shortDate(n.w.to)}`)
      : n.w.exact ? `${dayName(n.w.from)} · ${L.sub}` : `~${rangeText(n.w.from, n.w.to)} · ${L.sub.replace(" · est.", "")}`;
    drawText(ctx, line, new Rect(14, 50, 146, 15), Font.semiboldSystemFont(11), hot ? ORANGE : GRAY);
  } else {
    drawText(ctx, "Open once to look for reports", new Rect(14, 30, 146, 32), Font.systemFont(11), GRAY);
  }

  ctx.setFillColor(new Color(RULE));
  ctx.fillRect(new Rect(14, 74, 142, 0.8));

  // Ready to read: the last 2 released
  drawText(ctx, "READY TO READ", new Rect(14, 81, 142, 14), Font.semiboldSystemFont(10.5), GRAY);
  const list = lastReleased(s, 2);
  list.forEach((r, i) => {
    const y = 98 + i * 21;
    const isNew = !r.ed.opened;
    dot(ctx, 14, y + 5, isNew ? BLUE : RULE);
    drawText(ctx, r.book.short, new Rect(26, y, 92, 16), Font.semiboldSystemFont(12), isNew ? "#FFFFFF" : GRAY);
    drawText(ctx, shortDate(r.ed.posted), new Rect(110, y, 46, 16), Font.semiboldSystemFont(12), isNew ? BLUE : GRAY, "right");
  });
  if (!list.length) drawText(ctx, "Looking for reports…", new Rect(14, 98, 142, 16), Font.systemFont(11), GRAY);

  // how many recent editions haven't been opened
  let unread = 0;
  for (const b of BOOKS) for (const e of (s.books[b.id] || { eds: [] }).eds) if (!e.opened && e.posted && daysBetween(e.posted, todayIso()) <= 45) unread++;
  drawText(ctx, unread ? `${unread} new to read` : "All caught up", new Rect(14, 145, 142, 14), Font.semiboldSystemFont(10), unread ? BLUE : DIM);
  return ctx.getImage();
}
function renderWidget(s) {
  const w = new ListWidget();
  w.backgroundImage = updRing(drawWidget(s));
  w.addSpacer(); // a widget with nothing in it can come up blank
  w.url = URLScheme.forRunningScript();
  w.refreshAfterDate = new Date(Date.now() + CHECK_HOURS * 3600 * 1000);
  return w;
}

// ---------- Reading PDFs ----------
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

// A builder's release is an SEC web page; this lays it out on letter pages
// and saves it as a PDF (logos and pictures left out)
const SEC_RENDER = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=780">
<style>
html,body{background:#fff;margin:0;padding:0}
#doc{width:740px;padding:20px;color:#111;font-family:-apple-system,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.35}
#doc *{max-width:700px;box-sizing:border-box}
#doc table{border-collapse:collapse}
#doc td,#doc th{font-size:11px;padding:1px 3px;vertical-align:bottom}
</style>
<script src="${H2C}"></script><script src="${JSPDF}"></script>
</head><body><div id="doc">__BODY__</div></body></html>`;
function secBody(html) {
  const bm = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html);
  return (bm ? bm[1] : html).replace(/<(script|style)[\s\S]*?<\/\1>/gi, "").replace(/<img[^>]*>/gi, "");
}
const SEC_MAKE_JS = `(function () {
  try {
    var doc = new window.jspdf.jsPDF({ unit: "pt", format: "letter" });
    doc.html(document.getElementById("doc"), {
      margin: [30, 30, 30, 30], autoPaging: "text", width: 552, windowWidth: 780,
      html2canvas: { useCORS: true, logging: false },
      callback: function (d) { window.__pdf = d.output("datauristring").split(",")[1]; }
    });
  } catch (e) { window.__pdf = "ERR:" + e; }
})(); 0`;
async function secPdf(url) {
  const r = new Request(url);
  r.headers = { "User-Agent": SEC_CONTACT || BROWSER_UA };
  r.timeoutInterval = 30;
  const html = await r.loadString();
  const wv = updWV(new WebView());
  await wv.loadHTML(...updArgs(SEC_RENDER.replace("__BODY__", () => secBody(html))));
  let ready = false;
  for (let i = 0; i < 30 && !ready; i++) {
    ready = await wv.evaluateJavaScript("!!(window.jspdf && window.html2canvas)");
    if (!ready) await sleep(500);
  }
  if (!ready) throw new Error("Couldn't load the PDF maker");
  await wv.evaluateJavaScript(SEC_MAKE_JS);
  for (let i = 0; i < 240; i++) {
    await sleep(500);
    const out = await wv.evaluateJavaScript("window.__pdf || ''");
    if (out) {
      if (out.startsWith("ERR:")) throw new Error(out.slice(4));
      return Data.fromBase64String(out);
    }
  }
  throw new Error("Timed out making the PDF");
}
// The edition's PDF on this phone, downloading (or making) it the first time
async function ensurePdf(book, ed, part) {
  const path = docPath(pdfName(book.id, ed.key, part));
  if (fm().fileExists(path)) return path;
  const url = part ? partUrl(part, ed) : ed.url;
  if (!url) throw new Error("Couldn't find this edition's file.");
  let data;
  if (book.kind === "html") {
    data = await secPdf(url);
  } else {
    const r = new Request(url);
    r.timeoutInterval = 90;
    r.headers = { "User-Agent": BROWSER_UA };
    data = await r.load();
    if (!data || !data.toBase64String().startsWith("JVBERi")) throw new Error(`${book.src}'s site didn't return the ${part ? part.name + " " : ""}PDF`);
  }
  fm().write(path, data);
  return path;
}

// ---------- The schedule page ----------
function payload(s) {
  const rows = ordered(s).map((x) => {
    const L = nextLines(x);
    return {
      id: x.book.id, name: x.book.name, src: x.book.src, cadence: x.book.cadence,
      main: L.main, sub: L.sub, tone: L.tone, why: L.why || "", group: x.kind === "due" || x.kind === "late" ? "due" : x.kind,
      eds: x.st.eds.map((e) => ({
        // a release labeled by its own date doesn't repeat it
        key: e.key, label: e.label, posted: e.posted && !e.est && !e.label.startsWith(shortDate(e.posted)) ? shortDate(e.posted) : "", opened: !!e.opened,
        saved: anySaved(x.book, e),
      })),
    };
  });
  const checked = Math.max(0, ...BOOKS.map((b) => (s.books[b.id] && s.books[b.id].checked) || 0));
  return {
    rows, checked: checked ? ago(checked) : "",
    sec: !!SEC_CONTACT,
    note: "Each book is checked every " + CHECK_HOURS + " hours and each time you open this. Next-release dates: the Beige Book's are from the Fed's calendar. The rest (est.) are estimated from each book's last release (the same day of the month), or its usual window when that date isn't known; builders from the date of the same quarter's release a year earlier. " +
      "Only each book's newest 2 editions are kept on this phone. A builder release is its SEC filing, laid out as a PDF on the phone (pictures left out).",
  };
}

const PAGE_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<title>Reports</title>
<style>
  :root { --bg:#1C1C1E; --card:#2C2C2E; --rule:#3A3A3C; --ink:#FFFFFF; --gray:#98989F; --dim:#636366; --blue:#64D2FF; --orange:#FF9F0A; }
  * { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  html, body { margin:0; background:var(--bg); color:var(--ink); font-family:-apple-system, system-ui, sans-serif; }
  .wrap { padding:18px 16px 40px; max-width:700px; margin:0 auto; }
  h1 { font-size:30px; font-weight:700; margin:4px 0 2px; letter-spacing:-0.3px; }
  .lede { color:var(--gray); font-size:14px; }
  #status { color:var(--blue); font-size:13px; font-weight:600; min-height:18px; margin-top:6px; }
  #errs { color:var(--orange); font-size:12px; }
  h2 { font-size:13px; font-weight:600; color:var(--gray); text-transform:uppercase; letter-spacing:0.6px; margin:22px 2px 8px; }
  h2.due { color:var(--orange); }
  .card { background:var(--card); border-radius:14px; padding:12px 14px; margin-bottom:10px; }
  .top { display:flex; align-items:flex-start; gap:10px; }
  .name { flex:1; min-width:0; }
  .name b { display:block; font-size:16px; font-weight:600; line-height:1.25; }
  .name span { display:block; color:var(--gray); font-size:12.5px; margin-top:2px; }
  .when { text-align:right; flex:none; max-width:52%; }
  .when b { display:block; font-size:15px; font-weight:600; font-variant-numeric:tabular-nums; }
  .when span { display:block; color:var(--gray); font-size:12px; margin-top:2px; }
  .due .when b, .late .when b, .due .when span, .late .when span { color:var(--orange); }
  .why { color:var(--orange); font-size:12px; margin-top:7px; line-height:1.35; }
  .dim .when b { color:var(--dim); }
  .eds { display:flex; gap:8px; margin-top:10px; flex-wrap:wrap; }
  .ed { flex:1 1 140px; background:#3A3A3C; border:none; border-radius:10px; padding:8px 10px; text-align:left; color:var(--ink); font:inherit; cursor:pointer; position:relative; }
  .ed:active { background:#48484A; }
  .ed b { display:block; font-size:14px; font-weight:600; padding-left:14px; }
  .ed span { display:block; font-size:11.5px; color:var(--gray); margin-top:2px; padding-left:14px; }
  .ed i { position:absolute; left:10px; top:13px; width:7px; height:7px; border-radius:50%; background:var(--rule); }
  .ed.new i { background:var(--blue); }
  .ed.new span.p { color:var(--blue); }
  .ed.busy { opacity:0.55; }
  .none { color:var(--dim); font-size:12.5px; margin-top:8px; }
  .foot { color:var(--gray); font-size:12px; line-height:1.45; margin-top:24px; }
  .btns { display:flex; gap:8px; flex-wrap:wrap; margin-top:14px; }
  .btns button { background:var(--card); color:var(--blue); border:none; border-radius:10px; padding:9px 12px; font:inherit; font-size:13.5px; font-weight:600; }
</style>
<script>
window.onerror = function (m, src, line) { var e = document.getElementById("errs"); if (e) e.textContent = "Page error: " + m + " (line " + line + ")"; };
</script>
</head>
<body>
<div class="wrap">
  <h1>Reports</h1>
  <div class="lede" id="lede"></div>
  <div id="status"></div>
  <div id="errs"></div>
  <div id="list"></div>
  <div class="btns" id="btns"></div>
  <div class="foot" id="note"></div>
</div>
<script>
var D = __DATA__;
window.__q = [];
window.__take = function () { var x = window.__q.shift(); return x ? JSON.stringify(x) : ""; };
function el(id) { return document.getElementById(id); }
function esc(t) { return String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
window.setStatus = function (t) { el("status").textContent = t || ""; };

function edHtml(r, e) {
  var sub = (e.posted ? "posted " + e.posted : "") + (e.saved ? (e.posted ? " · " : "") + "on phone" : "");
  if (!sub) sub = "PDF";
  return '<button class="ed' + (e.opened ? "" : " new") + '" data-id="' + esc(r.id) + '" data-key="' + esc(e.key) + '">' +
    '<i></i><b>' + esc(e.label) + '</b><span class="p">' + esc(sub) + '</span></button>';
}
function cardHtml(r) {
  var h = '<div class="card ' + r.tone + '"><div class="top"><div class="name"><b>' + esc(r.name) + '</b><span>' +
    esc(r.src) + " · " + esc(r.cadence) + '</span></div><div class="when"><b>' + esc(r.main) + '</b><span>' + esc(r.sub) + '</span></div></div>';
  if (r.why) h += '<div class="why">' + esc(r.why) + '</div>';
  if (r.eds.length) {
    h += '<div class="eds">';
    for (var i = 0; i < r.eds.length; i++) h += edHtml(r, r.eds[i]);
    h += '</div>';
  } else {
    h += '<div class="none">No editions found yet.</div>';
  }
  return h + '</div>';
}
function render() {
  var groups = [["due", "Due now or late"], ["up", "Coming up"], ["none", "Not found yet"]];
  var h = "", nDue = 0, nNew = 0;
  for (var g = 0; g < groups.length; g++) {
    var rows = D.rows.filter(function (r) { return r.group === groups[g][0]; });
    if (!rows.length) continue;
    if (groups[g][0] === "due") nDue = rows.length;
    h += '<h2 class="' + groups[g][0] + '">' + groups[g][1] + '</h2>';
    for (var i = 0; i < rows.length; i++) h += cardHtml(rows[i]);
  }
  D.rows.forEach(function (r) { r.eds.forEach(function (e) { if (!e.opened) nNew++; }); });
  el("list").innerHTML = h;
  el("lede").textContent = "Release schedule · " + D.rows.length + " books" + (nNew ? " · " + nNew + " unopened" : "") + (D.checked ? " · checked " + D.checked : "");
  el("btns").innerHTML = "";
  el("note").textContent = D.note;
}
document.addEventListener("click", function (ev) {
  var t = ev.target.closest ? ev.target.closest("button") : null;
  if (!t) return;
  if (t.getAttribute("data-a")) { window.__q.push({ a: t.getAttribute("data-a") }); return; }
  var id = t.getAttribute("data-id");
  if (!id) return;
  t.className += " busy";
  window.__q.push({ a: "open", id: id, key: t.getAttribute("data-key") });
});
window.update = function (d) { D = d; render(); };
render();
</script>
</body>
</html>
`;

async function showError(title, e) {
  const x = new Alert();
  x.title = title;
  x.message = String((e && e.message) || e);
  x.addAction("OK");
  await x.present();
}

// One request from the page: open an edition, set the SEC contact
async function handle(s, q, say) {
  if (q.a === "open") {
    const book = bookById(q.id), st = s.books[q.id];
    const ed = st && st.eds.find((e) => e.key === q.key);
    if (!book || !ed) return;
    let part = null;
    if (book.parts) {
      const pick = await choose(book.name, `${ed.label}${ed.posted && !ed.est ? " · posted " + shortDate(ed.posted) : ""}`, book.parts.map((p) => "\u{1F4D6} " + p.name));
      if (pick === -1) return;
      part = book.parts[pick];
    }
    try {
      if (!fm().fileExists(docPath(pdfName(book.id, ed.key, part)))) await say(book.kind === "html" ? `Making the ${book.builder.short} release into a PDF…` : `Downloading ${part ? book.src + " " + part.name : book.short}…`);
      const path = await ensurePdf(book, ed, part);
      await say("");
      await QuickLook.present(path, true);
      ed.opened = true;
      s.openedKeys[`${book.id}:${ed.key}`] = true;
      saveStore(s);
    } catch (e) {
      await say("");
      if (book.kind === "html") {
        const pick = await choose("Couldn't make the PDF", `${shortErr(e)}\n\nOpen the SEC page instead?`, ["Open the SEC page"]);
        if (pick === 0) await Safari.openInApp(ed.url, false);
      } else {
        await showError("Read", e);
      }
    }
  } else if (q.a === "sec") {
    const before = SEC_CONTACT;
    await askSecContact();
    if (SEC_CONTACT && SEC_CONTACT !== before) {
      await say("Checking the builder releases…");
      await Promise.all(BOOKS.filter((b) => b.builder).map((b) => refreshBook(s, b)));
      await say("");
    }
  }
}

async function runApp() {
  const s = readStore();
  const wv = updWV(new WebView());
  await wv.loadHTML(...updArgs(PAGE_HTML.replace("__DATA__", () => JSON.stringify(payload(s)))));
  let open = true;
  const closed = wv.present(true).then(() => {
    open = false;
  });
  const say = async (t) => {
    try {
      if (open) await wv.evaluateJavaScript(`window.setStatus(${JSON.stringify(t)});0`);
    } catch (e) {}
  };
  const push = async () => {
    try {
      if (open) await wv.evaluateJavaScript(`window.update(${JSON.stringify(payload(s))});0`);
    } catch (e) {}
  };
  // taps on the page, answered while the checks below carry on
  const poll = (async () => {
    while (open) {
      await sleep(400);
      let raw = "";
      try {
        raw = await wv.evaluateJavaScript("window.__take ? window.__take() : ''");
      } catch (e) {}
      if (!raw) continue;
      try {
        await handle(s, JSON.parse(raw), say);
      } catch (e) {
        await showError("Reports", e);
      }
      await push();
    }
  })();
  await sleep(600); // let the page draw first
  let left = BOOKS.length;
  await say(`Checking ${left} books for new editions…`);
  await refreshAll(s, true, async () => {
    left--;
    await say(left ? `Checking… ${left} to go` : "");
    await push();
  });
  await say("");
  await push();
  await poll;
  await closed;
}

// ---------- Run ----------
if (config.runsInWidget || PREVIEW_WIDGET_IN_APP) {
  const s = readStore();
  try {
    const timeout = new Promise((r) => Timer.schedule(WIDGET_BUDGET_S * 1000, false, () => r(null)));
    await Promise.race([refreshAll(s, false), timeout]);
  } catch (e) {}
  const w = renderWidget(s);
  if (config.runsInWidget) Script.setWidget(w);
  else await w.presentSmall();
} else {
  try {
    await runApp();
  } catch (e) {
    await showError("Reports", e);
  }
}
Script.complete();
// Update test, Nov 17, 2026 (no change in behavior)
