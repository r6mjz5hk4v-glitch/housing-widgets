// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-blue; icon-glyph: lock;

// ---- Shared settings (saved on this phone by the Setup script) ----
// Keys and personal settings live in the phone's keychain, not in this file,
// so the file can be shared as is.
function setting(key, fallback) {
  try { if (Keychain.contains(key)) { const v = Keychain.get(key); if (v) return v; } } catch (e) {}
  return fallback;
}


// Rate Lock-In for Scriptable
// How the note rates on outstanding U.S. mortgages are spread out: the share
// of loans below 3%, 3-3.99%, 4-4.99%, 5-5.99% and 6% or more, by quarter since
// 2013, from FHFA's National Mortgage Database (NMDB) outstanding residential
// mortgage statistics (a 5% sample of all closed-end first-lien mortgages,
// shares by loan count). The same data as MBA's "Distribution of Mortgage
// Rates on Loans Outstanding" slide.
// FHFA posts it as a free zipped CSV, quarterly with a lag. The phone
// downloads it (at most once a week, and only when FHFA's file changed),
// unpacks it in a hidden web page and keeps just the national rate series.
// Columns and series are found by name; a file without them is rejected with
// what it did find, never guessed. The market rate is Freddie Mac's 30-year
// fixed survey rate (FRED: MORTGAGE30US), averaged by quarter.
// Small widget: the stacked chart since 2013, the share below 4% and at 6%+.
// Tap for the full screen: the stacked chart by market (all, Fannie/Freddie,
// government, jumbo), the average outstanding rate vs the market rate, and
// the share in the money (rate at least 0.75 points above the market),
// all pinch-zoomable. Share as PDF: two 16:9 slides.

// ---- Update check (once a day; one shared request for all the Housing Widgets) ----
// When GitHub has a newer version of this widget: a thin yellow glow around the
// widget face, and an "Update ready" card in the full view with a Run Installer button.
const UPD_REPO = "r6mjz5hk4v-glitch/housing-widgets";
const UPD_CACHE = "housing-widgets-update-v3.json"; // v3: fingerprints from the title line down, with update notes
const UPD_SKIP = "housing-widgets-skipped.json";
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
  if (!mine || mine.hash === updHash(updBody(src, mine.sig))) return false;
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
const NMDB_URL = "https://www.fhfa.gov/document/d/nmdb/nmdb-outstanding-mortgage-statistics-national-census-areas-quarterly.zip";
const NMDB_PAGE = "https://www.fhfa.gov/data/nmdb"; // searched for the file if the address above stops working
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

const STORE_FILE = "rate-lock-in-v1.json";
const CHECK_HOURS = 24 * 7;   // FHFA posts quarterly; ask about once a week
const RATE_HOURS = 12;        // Freddie Mac's rate posts weekly (Thursdays)
const WIDGET_BUDGET_S = 24;   // a widget only gets seconds; past this it uses the saved copy
const WIDGET_MAX_MB = 8;      // a widget downloads FHFA's file only if it's this small; else the app does
const MAX_MB = 60;            // skip anything bigger than this
const ITM_BPS = 75;           // "in the money": note rate at least this far above the market rate
const PREVIEW_WIDGET_IN_APP = false;

// MBA's slide colors, brightened a little for a dark screen
const BUCKETS = [
  { key: "lt3", label: "Below 3%", short: "<3%", hex: "#B456C6" },
  { key: "r34", label: "3.00–3.99%", short: "3–4%", hex: "#4FA3E0" },
  { key: "r45", label: "4.00–4.99%", short: "4–5%", hex: "#3F9A4F" },
  { key: "r56", label: "5.00–5.99%", short: "5–6%", hex: "#E58A4E" },
  { key: "ge6", label: "6% or more", short: "6%+", hex: "#4C7FB0" },
];
const GRAY = "#98989F";
const AMBER = "#FF9F0A";
const RED = "#FF453A";
const GREEN = "#30D158";
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
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
  const top = [0x2c, 0x2c, 0x2e];
  const bottom = [0x1c, 0x1c, 0x1e];
  for (let i = 0; i < 34; i++) {
    const f = i / 33;
    const hex = "#" + top.map((c, j) => Math.round(c + (bottom[j] - c) * f).toString(16).padStart(2, "0")).join("");
    ctx.setFillColor(new Color(hex));
    ctx.fillRect(new Rect(0, (H * i) / 34, W, H / 34 + 1));
  }
  return ctx;
}
function roundRect(ctx, x, y, w, h, r, hex) {
  if (w <= 0) return;
  const p = new Path();
  p.addRoundedRect(new Rect(x, y, w, h), Math.min(r, w / 2), Math.min(r, h / 2));
  ctx.addPath(p);
  ctx.setFillColor(new Color(hex));
  ctx.fillPath();
}
function clockIcon(ctx, x, y, hex) {
  ctx.setStrokeColor(new Color(hex));
  ctx.setLineWidth(1.2);
  const c = new Path();
  c.addEllipse(new Rect(x - 4.5, y - 4.5, 9, 9));
  ctx.addPath(c);
  ctx.strokePath();
  const h = new Path();
  h.move(new Point(x, y - 2.6));
  h.addLine(new Point(x, y));
  h.addLine(new Point(x + 2, y + 1.1));
  ctx.addPath(h);
  ctx.strokePath();
}
function isoDay(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function nextLabel(s) {
  if (!s.next) return null;
  const [, mo, d] = s.next.split("-").map(Number);
  if (s.next < isoDay(new Date())) return { text: "due", hex: AMBER };
  return { text: `~${MON[mo - 1]} ${d}`, hex: GRAY };
}


// ---------- Saved copy (shared by the widget and the app, newest wins) ----------
function storePath() {
  const fm = FileManager.local();
  return fm.joinPath(fm.documentsDirectory(), STORE_FILE);
}
function readStore() {
  const fm = FileManager.local();
  for (const p of [storePath(), storePath() + ".tmp"]) {
    try {
      if (fm.fileExists(p)) {
        const s = JSON.parse(fm.readString(p));
        if (s && s.quarters && s.markets) return s;
      }
    } catch (e) {}
  }
  return null;
}
function writeStore(s) {
  const fm = FileManager.local();
  const p = storePath();
  const tmp = p + ".tmp";
  try {
    fm.writeString(tmp, JSON.stringify(s));
    if (fm.fileExists(p)) fm.remove(p);
    fm.move(tmp, p);
  } catch (e) {
    try { fm.writeString(p, JSON.stringify(s)); } catch (e2) {}
  }
}
const lastOf = (a) => (a && a.length ? a[a.length - 1] : "");
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

// ---------- Reading FHFA's zipped CSV ----------
// Runs inside a hidden web page (which has the unzipper). The CSV is long:
// one row per series, area, market and quarter. It's read as a stream, line
// by line, keeping only national rows of the interest-rate series, so the
// whole file never sits in memory as text. Plain browser JavaScript.
async function nmdbParse(b64) {
  var bin = atob(b64), buf = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  bin = null;
  var dv = new DataView(buf.buffer);
  var dec = new TextDecoder();
  var eocd = -1;
  for (var e = buf.length - 22; e >= Math.max(0, buf.length - 70000); e--) {
    if (dv.getUint32(e, true) === 0x06054b50) { eocd = e; break; }
  }
  if (eocd < 0) throw new Error("not a zip file (no zip directory)");
  var count = dv.getUint16(eocd + 10, true), p = dv.getUint32(eocd + 16, true), entries = [];
  for (var k = 0; k < count; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    var nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
    entries.push({
      name: dec.decode(buf.subarray(p + 46, p + 46 + nlen)),
      method: dv.getUint16(p + 10, true), csize: dv.getUint32(p + 20, true), usize: dv.getUint32(p + 24, true), off: dv.getUint32(p + 42, true),
    });
    p += 46 + nlen + xlen + clen;
  }
  var csvs = entries.filter(function (x) { return /\.csv$/i.test(x.name) && !/__MACOSX/.test(x.name); });
  if (!csvs.length) throw new Error("no CSV in FHFA's zip (it has: " + entries.map(function (x) { return x.name; }).join(", ") + ")");
  // the outstanding, national/census, quarterly table if it's named that way; else the biggest CSV
  csvs.sort(function (a, b) {
    var sa = (/outstanding/i.test(a.name) ? 2 : 0) + (/quarter/i.test(a.name) ? 1 : 0);
    var sb = (/outstanding/i.test(b.name) ? 2 : 0) + (/quarter/i.test(b.name) ? 1 : 0);
    return sb - sa || b.usize - a.usize;
  });
  var en = csvs[0];
  var start = en.off + 30 + dv.getUint16(en.off + 26, true) + dv.getUint16(en.off + 28, true);
  var data = buf.subarray(start, start + en.csize);
  var stream = new Blob([data]).stream();
  if (en.method === 8) stream = stream.pipeThrough(new DecompressionStream("deflate-raw"));
  else if (en.method !== 0) throw new Error("FHFA's zip uses an unsupported compression (" + en.method + ")");
  var reader = stream.pipeThrough(new TextDecoderStream()).getReader();

  function split(line) {
    if (line.indexOf('"') < 0) return line.split(",");
    var out = [], cur = "", q = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (q) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"') q = true;
      else if (ch === ",") { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    return out;
  }
  // which statistic a series id is: the five rate buckets and the average rate
  function which(id) {
    var s = String(id).toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (s.indexOf("INTRATE") < 0 && s.indexOf("INTERESTRATE") < 0) return null;
    s = s.replace("INTERESTRATE", "INTRATE");
    if (/^(AVE|AVG|MEAN)INTRATE$/.test(s)) return "avg";
    if (!/^PCTINTRATE/.test(s)) return null;
    var t = s.slice(10);
    if (/^(LT|LE|UNDER|BELOW)3$/.test(t)) return "lt3";
    if (t === "34" || t === "3TO4") return "r34";
    if (t === "45" || t === "4TO5") return "r45";
    if (t === "56" || t === "5TO6") return "r56";
    if (/^(GE|GT|OVER|ABOVE)6$/.test(t)) return "ge6";
    return null;
  }
  var head = null, col = {}, rows = 0, kept = 0, rest = "", seen = {}, geos = {}, out = {};
  function quarterOf(f) {
    var per = col.period != null ? String(f[col.period]).trim() : "", m = per.match(/^(\d{4})\s*-?\s*Q([1-4])$/i);
    if (m) return m[1] + "Q" + m[2];
    var y = col.year != null ? parseInt(f[col.year], 10) : NaN, q = col.quarter != null ? parseInt(String(f[col.quarter]).replace(/\D/g, ""), 10) : NaN;
    if (y > 1990 && q >= 1 && q <= 4) return y + "Q" + q;
    return null;
  }
  function onLine(line) {
    if (!line) return;
    if (!head) {
      head = split(line.replace(/^﻿/, "")).map(function (h) { return h.trim().toUpperCase(); });
      var find = function (re) { for (var i = 0; i < head.length; i++) if (re.test(head[i])) return i; return null; };
      col = {
        sid: find(/^SERIES_?ID$/), geo: find(/^GEO_?LEVEL$/), gname: find(/^GEO_?NAME$/), market: find(/^MARKET$/),
        period: find(/^PERIOD$/), year: find(/^YEAR$/), quarter: find(/^QUARTER$/), freq: find(/^FREQUENCY$/),
        sup: find(/^SUPPRESSED$/), v1: find(/^VALUE_?1$/),
      };
      if (col.sid == null || col.market == null || col.v1 == null || (col.period == null && col.year == null)) {
        throw new Error("FHFA's file is missing columns this needs (SERIESID, MARKET, PERIOD, VALUE1). It has: " + head.join(", "));
      }
      return;
    }
    rows++;
    if (line.indexOf("RATE") < 0 && line.indexOf("rate") < 0) return; // fast skip: not a rate series
    var f = split(line), id = f[col.sid], st = which(id);
    if (!st) { if (/RATE/i.test(id) && Object.keys(seen).length < 30) seen[id] = 1; return; }
    if (col.geo != null) {
      var gl = String(f[col.geo]).trim();
      geos[gl] = 1;
      if (!/^(national|nation|us|u\.s\.|united states)$/i.test(gl)) return;
    } else if (col.gname != null && !/united states|^us$|^u\.s\.$|national/i.test(String(f[col.gname]))) return;
    if (col.freq != null && f[col.freq] && !/^q/i.test(String(f[col.freq]).trim())) return;
    if (col.sup != null && String(f[col.sup]).trim() === "1") return;
    var v = parseFloat(f[col.v1]);
    if (!isFinite(v)) return;
    var q = quarterOf(f);
    if (!q) return;
    var mk = String(f[col.market]).trim();
    out[mk] = out[mk] || {};
    out[mk][q] = out[mk][q] || {};
    out[mk][q][st] = v;
    kept++;
  }
  for (;;) {
    var r = await reader.read();
    if (r.done) break;
    var chunk = rest + r.value, nl = chunk.lastIndexOf("\n");
    if (nl < 0) { rest = chunk; continue; }
    var lines = chunk.slice(0, nl).split("\n");
    rest = chunk.slice(nl + 1);
    for (var li = 0; li < lines.length; li++) onLine(lines[li].replace(/\r$/, ""));
  }
  onLine(rest.replace(/\r$/, ""));
  if (!kept) {
    throw new Error("no national interest-rate rows in FHFA's file (" + rows + " rows read from " + en.name + "). Rate-like series it has: " +
      (Object.keys(seen).join(", ") || "none") + ". Geography levels: " + (Object.keys(geos).join(", ") || "none"));
  }
  return { markets: out, file: en.name, rows: rows, kept: kept };
}

// ---------- Shaping what the file gave into the saved copy ----------
const MARKET_KEYS = [
  { key: "all", label: "All", long: "All mortgages", re: /^all\b/i },
  { key: "ent", label: "Fannie/Freddie", long: "Fannie Mae and Freddie Mac (Enterprise)", re: /enterprise/i },
  { key: "gov", label: "Govt", long: "Government (FHA, VA, USDA)", re: /government|non-?conv/i },
  { key: "jum", label: "Jumbo", long: "Jumbo", re: /jumbo/i },
];
function qAdd(q, n) {
  const t = +q.slice(0, 4) * 4 + (+q.slice(5) - 1) + n;
  return `${Math.floor(t / 4)}Q${(t % 4) + 1}`;
}
function shapeNmdb(raw) {
  const names = Object.keys(raw.markets);
  const picked = [];
  for (const mk of MARKET_KEYS) {
    const name = names.find((n) => mk.re.test(n) && !/purchase|refi/i.test(n));
    if (name) picked.push({ ...mk, name });
  }
  if (!picked.length || picked[0].key !== "all") {
    throw new Error("no 'All Mortgages' market in FHFA's file. Markets it has: " + names.join(", "));
  }
  // one timeline: every quarter any picked market has, filled in between
  let lo = null, hi = null;
  for (const p of picked) for (const q of Object.keys(raw.markets[p.name])) {
    if (!lo || q < lo) lo = q;
    if (!hi || q > hi) hi = q;
  }
  const quarters = [];
  for (let q = lo; q <= hi; q = qAdd(q, 1)) quarters.push(q);
  // shares come as percents; if they look like fractions, scale them
  const allQ = raw.markets[picked[0].name];
  const sample = Object.values(allQ).find((r) => BUCKETS.every((b) => typeof r[b.key] === "number"));
  if (!sample) throw new Error("FHFA's file has no quarter with all five rate buckets for all mortgages");
  const sum = BUCKETS.reduce((a, b) => a + sample[b.key], 0);
  const scale = sum < 2 ? 100 : 1;
  if (Math.abs(sum * scale - 100) > 3) throw new Error(`the five rate buckets add to ${Math.round(sum * scale)}%, not 100%`);
  const r1 = (v) => (typeof v === "number" ? Math.round(v * 10) / 10 : null);
  const markets = picked.map((p) => {
    const by = raw.markets[p.name];
    return {
      key: p.key, label: p.label, long: p.long, name: p.name,
      b: quarters.map((q) => (by[q] && BUCKETS.every((b) => typeof by[q][b.key] === "number") ? BUCKETS.map((b) => r1(by[q][b.key] * scale)) : null)),
      avg: quarters.map((q) => (by[q] && typeof by[q].avg === "number" ? Math.round(by[q].avg * 1000) / 1000 : null)),
    };
  });
  return { quarters, markets };
}

// ---------- Downloading ----------
function headerOf(resp, name) {
  if (!resp || !resp.headers) return null;
  const k = Object.keys(resp.headers).find((h) => h.toLowerCase() === name.toLowerCase());
  return k ? resp.headers[k] : null;
}
async function headInfo(url) {
  try {
    const req = new Request(url);
    req.method = "HEAD";
    req.timeoutInterval = 12;
    req.headers = { "User-Agent": UA };
    await req.load();
    const r = req.response || {};
    return { status: r.statusCode || 0, lm: headerOf(r, "Last-Modified"), size: parseFloat(headerOf(r, "Content-Length")) || 0 };
  } catch (e) {
    return { status: 0, lm: null, size: 0 };
  }
}
// If FHFA moves the file, look for it on the NMDB data page
async function discoverUrl() {
  try {
    const req = new Request(NMDB_PAGE);
    req.timeoutInterval = 15;
    req.headers = { "User-Agent": UA };
    const html = await req.loadString();
    const m = html.match(/href="([^"]*outstanding[^"]*national[^"]*quarterly[^"]*\.zip)"/i) ||
      html.match(/href="([^"]*outstanding[^"]*quarterly[^"]*\.zip)"/i);
    if (!m) return null;
    const h = m[1].replace(/&amp;/g, "&");
    return /^https?:/i.test(h) ? h : "https://www.fhfa.gov" + (h[0] === "/" ? "" : "/") + h;
  } catch (e) {
    return null;
  }
}
async function pollOut(wv, seconds) {
  for (let i = 0; i < seconds * 4; i++) {
    await sleep(250);
    const out = await wv.evaluateJavaScript("window.__out || ''", false);
    if (out) return JSON.parse(out);
  }
  throw new Error("timed out unpacking FHFA's file");
}
async function fetchNmdb(url, seconds) {
  const req = new Request(url);
  req.timeoutInterval = 60;
  req.headers = { "User-Agent": UA };
  const data = await req.load();
  const status = req.response ? req.response.statusCode : 0;
  if (status !== 200) throw new Error(`FHFA answered ${status || "nothing"}`);
  const lm = headerOf(req.response, "Last-Modified");
  const wv = updWV(new WebView());
  await wv.loadHTML(...updArgs("<!DOCTYPE html><html><body></body></html>"));
  const js =
    "window.__out='';(" + nmdbParse.toString() + ")(" + JSON.stringify(data.toBase64String()) + ")" +
    ".then(function(r){window.__out=JSON.stringify({ok:true,data:r});})" +
    ".catch(function(e){window.__out=JSON.stringify({ok:false,error:String(e&&e.message||e)});});0;";
  await wv.evaluateJavaScript(js, false);
  const out = await pollOut(wv, seconds);
  if (!out.ok) throw new Error(out.error);
  return { ...shapeNmdb(out.data), lastModified: lm, file: out.data.file };
}

// Freddie Mac's 30-year rate (weekly), averaged by quarter, plus the latest week
async function fetchPmms() {
  const url = "https://api.stlouisfed.org/fred/series/observations?series_id=MORTGAGE30US&api_key=" + FRED_KEY +
    "&file_type=json&observation_start=2012-01-01";
  const req = new Request(url);
  req.timeoutInterval = 20;
  const j = await req.loadJSON();
  const obs = (j.observations || []).filter((o) => o.value !== "." && isFinite(parseFloat(o.value)));
  if (!obs.length) throw new Error("FRED returned no Freddie Mac rates");
  const sums = {};
  for (const o of obs) {
    const q = `${o.date.slice(0, 4)}Q${Math.floor((+o.date.slice(5, 7) - 1) / 3) + 1}`;
    sums[q] = sums[q] || { t: 0, n: 0 };
    sums[q].t += parseFloat(o.value);
    sums[q].n++;
  }
  const byQ = {};
  for (const q of Object.keys(sums)) byQ[q] = Math.round((sums[q].t / sums[q].n) * 1000) / 1000;
  const last = obs[obs.length - 1];
  return { byQ, latest: { date: last.date, v: parseFloat(last.value) } };
}

// Today's reference rate: Optimal Blue's 30-year conforming index (daily),
// the same series the other widgets use. Shown as a line across the chart.
async function fetchOb() {
  const start = new Date(Date.now() - 45 * 86400000).toISOString().slice(0, 10);
  const url = "https://api.stlouisfed.org/fred/series/observations?series_id=OBMMIC30YF&api_key=" + FRED_KEY +
    "&file_type=json&observation_start=" + start;
  const req = new Request(url);
  req.timeoutInterval = 20;
  const j = await req.loadJSON();
  const obs = (j.observations || []).filter((o) => o.value !== "." && isFinite(parseFloat(o.value)));
  if (!obs.length) throw new Error("FRED returned no Optimal Blue rate");
  const last = obs[obs.length - 1];
  return { date: last.date, v: Math.round(parseFloat(last.value) * 1000) / 1000 };
}

// FHFA posts quarterly, roughly a quarter and a half after the quarter ends;
// the next file is estimated as about three months after this one
function estimateNext(lastModified) {
  const d = lastModified ? new Date(lastModified) : null;
  if (!d || isNaN(d.getTime())) return null;
  const n = new Date(d.getFullYear(), d.getMonth() + 3, Math.min(d.getDate(), 28));
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

// Bring the saved copy up to date. Older data never replaces newer. A widget
// skips FHFA's download when the file is big (the app does it instead).
// Throws only when there's nothing saved at all.
async function refresh(seconds, inWidget) {
  let s = readStore();
  const now = Date.now();
  const due = !s || !s.checkedAt || now - s.checkedAt >= CHECK_HOURS * 3600 * 1000;
  const rateDue = !s || !s.pmms || !s.pmmsAt || now - s.pmmsAt >= RATE_HOURS * 3600 * 1000;
  const errors = [];
  if (due) {
    try {
      let url = (s && s.url) || NMDB_URL;
      let h = await headInfo(url);
      if (h.status === 404 || h.status === 410) {
        const found = await discoverUrl();
        if (!found) throw new Error("FHFA's file moved and the NMDB page didn't list it");
        url = found;
        h = await headInfo(url);
      }
      // some servers refuse HEAD (403/405) but serve the file; then just download it
      if (h.status && ![200, 403, 405].includes(h.status)) throw new Error(`FHFA answered ${h.status}`);
      if (h.size > MAX_MB * 1e6) throw new Error(`FHFA's file is too big for a phone (${Math.round(h.size / 1e6)} MB)`);
      const changed = !s || !h.lm || h.lm !== s.fileModified;
      if (changed && inWidget && (!h.size || h.size > WIDGET_MAX_MB * 1e6)) {
        if (!s) throw new Error("open the script in Scriptable once to download FHFA's file");
        s.needsApp = true; // the widget says "open to update"
      } else if (changed) {
        const z = await fetchNmdb(url, Math.max(15, seconds - 4));
        if (!s || lastOf(z.quarters) >= lastOf(s.quarters)) {
          s = { ...(s || {}), quarters: z.quarters, markets: z.markets, fileModified: h.lm || z.lastModified, file: z.file };
        }
        s.needsApp = false;
      }
      s.url = url;
      s.checkedAt = s.needsApp ? now - (CHECK_HOURS - 6) * 3600 * 1000 : now;
      s.error = null;
    } catch (e) {
      errors.push(String(e.message || e));
      if (s) {
        s.checkedAt = now - (CHECK_HOURS - 6) * 3600 * 1000; // try again in about 6 hours
        s.error = errors[0];
      }
    }
  }
  if (!s) throw new Error(errors.join(" · ") || "No data yet");
  if (rateDue) {
    try {
      const p = await fetchPmms();
      s.pmms = p.byQ;
      s.pmmsLatest = p.latest;
      s.pmmsAt = now;
      s.pmmsError = null;
    } catch (e) {
      s.pmmsAt = now - (RATE_HOURS - 1) * 3600 * 1000;
      s.pmmsError = String(e.message || e);
    }
    try {
      s.obLatest = await fetchOb();
    } catch (e) {} // keeps the last one it had
  }
  if (!s.obLatest) {
    try { s.obLatest = await fetchOb(); } catch (e) {}
  }
  s.next = estimateNext(s.fileModified);
  writeStore(s);
  return s;
}

async function refreshWithin(seconds, inWidget) {
  let timer;
  const deadline = new Promise((_, rej) => { timer = Timer.schedule(seconds * 1000, false, () => rej(new Error("took too long"))); });
  try {
    return await Promise.race([refresh(seconds, inWidget), deadline]);
  } catch (e) {
    const s = readStore();
    if (s) return { ...s, error: s.error || String(e.message || e) };
    throw e;
  } finally {
    if (timer) timer.invalidate();
  }
}

// ---------- Shared math ----------
// The latest quarter with all five buckets for a market
function latestIdx(mk) {
  for (let i = mk.b.length - 1; i >= 0; i--) if (mk.b[i]) return i;
  return -1;
}
const below4 = (b) => b[0] + b[1];
// In the money at market rate r: loans whose note rate is at least r + 0.75.
// FHFA gives buckets, not exact rates, so this is a floor (buckets entirely
// above the line) and a ceiling (plus the bucket the line falls inside).
const EDGES = [[-Infinity, 3], [3, 4], [4, 5], [5, 6], [6, Infinity]];
function itm(b, r) {
  const t = r + ITM_BPS / 100;
  let lo = 0, hi = 0;
  EDGES.forEach(([a, z], k) => {
    if (a >= t) { lo += b[k]; hi += b[k]; }
    else if (z > t) hi += b[k];
  });
  return { lo: Math.round(lo * 10) / 10, hi: Math.round(hi * 10) / 10 };
}
const qLabel = (q) => `${q.slice(0, 4)} Q${q.slice(5)}`;
const qShort = (q) => `Q${q.slice(5)} ’${q.slice(2, 4)}`;

// ---------- Widget ----------
function smallImage(s) {
  const W = 170;
  const ctx = newCanvas(W, W);
  drawText(ctx, "Lock-In", new Rect(12, 10, 90, 17), Font.semiboldSystemFont(13), "#FFFFFF", "left");
  const mk = s.markets[0];
  const li = latestIdx(mk);
  // corner: the quarter shown, or "cached" / "open to update"
  const corner = s.error ? { t: "cached", hex: AMBER } : s.needsApp ? { t: "open app", hex: AMBER } : li >= 0 ? { t: qShort(s.quarters[li]), hex: GRAY } : null;
  if (corner) drawText(ctx, corner.t, new Rect(W - 82, 12, 70, 14), Font.semiboldSystemFont(10), corner.hex, "right");
  if (li < 0) {
    drawText(ctx, "No data yet", new Rect(12, 70, 146, 17), Font.mediumSystemFont(12), GRAY, "left");
    return ctx.getImage();
  }
  // the stacked chart: every quarter since the file starts, 0-100%
  const idx = [];
  mk.b.forEach((b, i) => { if (b) idx.push(i); });
  const x0 = 12, x1 = 158, y0 = 32, y1 = 112;
  const X = (n) => x0 + (n / Math.max(1, idx.length - 1)) * (x1 - x0);
  const Y = (v) => y1 - (v / 100) * (y1 - y0);
  for (let k = BUCKETS.length - 1; k >= 0; k--) {
    // band k: from the sum of buckets below it up to the sum including it
    const top = idx.map((i) => mk.b[i].slice(0, k + 1).reduce((a, v) => a + v, 0));
    const bot = idx.map((i) => mk.b[i].slice(0, k).reduce((a, v) => a + v, 0));
    const path = new Path();
    top.forEach((v, n) => { const pt = new Point(X(n), Y(Math.min(100, v))); if (n) path.addLine(pt); else path.move(pt); });
    for (let n = bot.length - 1; n >= 0; n--) path.addLine(new Point(X(n), Y(bot[n])));
    path.closeSubpath();
    ctx.addPath(path);
    ctx.setFillColor(new Color(BUCKETS[k].hex));
    ctx.fillPath();
  }
  drawText(ctx, "’" + s.quarters[idx[0]].slice(2, 4), new Rect(12, 113, 40, 12), Font.systemFont(9), GRAY, "left");
  drawText(ctx, "’" + s.quarters[li].slice(2, 4), new Rect(118, 113, 40, 12), Font.systemFont(9), GRAY, "right");
  // the two numbers: locked in below 4%, and 6% or more; change vs a year ago
  const b = mk.b[li];
  const ya = li >= 4 ? mk.b[li - 4] : null;
  const cols = [
    { label: "Below 4%", v: below4(b), was: ya ? below4(ya) : null, hex: BUCKETS[1].hex, x: 12 },
    { label: "6% or more", v: b[4], was: ya ? ya[4] : null, hex: "#7FA9D6", x: 90 },
  ];
  for (const c of cols) {
    drawText(ctx, c.label, new Rect(c.x, 126, 72, 12), Font.mediumSystemFont(10), GRAY, "left");
    drawText(ctx, `${Math.round(c.v)}%`, new Rect(c.x, 137, 44, 22), Font.boldSystemFont(19), c.hex, "left");
    if (c.was !== null) {
      const d = Math.round(c.v - c.was);
      drawText(ctx, `${d > 0 ? "+" : d < 0 ? "−" : ""}${Math.abs(d)} y/y`, new Rect(c.x + (c.v >= 9.5 ? 45 : 33), 145.5, 34, 12), Font.mediumSystemFont(9.5), GRAY, "left");
    }
  }
  return ctx.getImage();
}

function finishWidget(img, s) {
  const w = new ListWidget();
  w.backgroundImage = updRing(img);
  w.addSpacer();
  w.url = URLScheme.forRunningScript();
  w.refreshAfterDate = new Date(Date.now() + (s && s.error ? 2 : 12) * 3600 * 1000);
  return w;
}
function errorWidget(msg) {
  const w = new ListWidget();
  const g = new LinearGradient();
  g.colors = [new Color("#2C2C2E"), new Color("#1C1C1E")];
  g.locations = [0, 1];
  w.backgroundGradient = g;
  const t = w.addText("Lock-In");
  t.font = Font.semiboldSystemFont(13);
  t.textColor = new Color("#FFFFFF");
  w.addSpacer(4);
  const m = w.addText(String(msg));
  m.font = Font.systemFont(10);
  m.textColor = new Color(GRAY);
  w.addSpacer();
  w.url = URLScheme.forRunningScript();
  w.refreshAfterDate = new Date(Date.now() + 3600 * 1000);
  return w;
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


// ---------- Full screen ----------
// Note: the page script below avoids backticks, backslashes and dollar-brace
// on purpose, because the whole page lives inside a template literal.
const PAGE_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  :root { --bg:#1C1C1E; --fg:#FFFFFF; --gray:#98989F; --rule:#3A3A3C; }
  * { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  body { margin:0; padding:20px 18px 36px; background:var(--bg); color:var(--fg);
         font-family:-apple-system,system-ui,sans-serif; -webkit-user-select:none; user-select:none; }
  .ticker { font-size:26px; font-weight:800; letter-spacing:-0.3px; }
  .name { color:var(--gray); font-size:13.5px; font-weight:600; margin-top:3px; line-height:1.35; }
  .hint { color:var(--gray); font-size:12px; margin-top:6px; line-height:1.35; }
  .loading { font-size:15px; margin-top:40px; text-align:center; }
  .err { color:#FF9F0A; font-size:13px; margin-top:24px; line-height:1.4; }
  .err button { display:block; margin-top:10px; border:0; border-radius:10px; padding:9px 16px; background:#2C2C2E; color:#FFFFFF; font:inherit; font-weight:600; }
  .h2 { font-size:12px; font-weight:700; color:var(--gray); letter-spacing:0.4px; margin:24px 0 4px; text-transform:uppercase; }
  .ro { font-size:14px; font-weight:600; min-height:20px; margin-bottom:4px; font-variant-numeric:tabular-nums; }
  .ro span { color:var(--gray); font-weight:500; }
  svg.chart { display:block; width:100%; height:270px; }
  svg.chart.short { height:180px; }
  .wrap { position:relative; }
  .touch { position:absolute; left:0; top:0; right:0; bottom:0; touch-action:pan-y; }
  .note { color:var(--gray); font-size:10.5px; line-height:1.45; margin-top:22px; }
  .regions { display:flex; gap:6px; overflow-x:auto; margin:14px 0 2px; scrollbar-width:none; }
  .regions::-webkit-scrollbar { display:none; }
  .regions button { flex:none; border:0; border-radius:14px; padding:6px 12px; background:#2C2C2E; color:#FFFFFF; font:inherit; font-size:13px; font-weight:600; }
  .regions button.on { background:#FFFFFF; color:#000000; }
  .bk { display:grid; grid-template-columns:1fr auto 64px; gap:0 10px; font-size:13.5px; padding:5px 0;
        border-bottom:1px solid var(--rule); font-variant-numeric:tabular-nums; align-items:center; }
  .bk:last-child { border-bottom:0; }
  .bk i { display:inline-block; width:10px; height:10px; border-radius:2px; margin-right:8px; vertical-align:-1px; }
  .bk b { font-weight:700; text-align:right; }
  .bk span.c { color:var(--gray); text-align:right; font-size:12.5px; }
  .legend { display:flex; gap:14px; flex-wrap:wrap; font-size:12.5px; font-weight:600; margin-top:8px; align-items:center; }
  .legend i { display:inline-block; width:14px; height:3px; border-radius:2px; margin-right:6px; vertical-align:middle; }
  .legend i.box { height:10px; width:12px; }
</style>
</head>
<body>
<div class="ticker">Lock-In</div>
<div class="name">Note rates on outstanding mortgages · FHFA National Mortgage Database</div>
<div class="hint" id="progress"></div>
<div class="hint loading" id="loading">Loading FHFA data…</div>
<div class="hint err" id="err" style="display:none"></div>
<div id="blocks" style="display:none">
  <div class="regions" id="markets"></div>
  <div class="hint">Hold to read a quarter · pinch to zoom · double-tap to reset</div>
  <div class="h2">Distribution of rates on loans outstanding</div>
  <div class="ro" id="ro1"></div>
  <div class="wrap"><svg class="chart" id="c1"></svg><div class="touch" id="t1"></div></div>
  <div id="bk" style="margin-top:8px"></div>
  <div class="h2">Average rate outstanding vs the market</div>
  <div class="ro" id="ro2"></div>
  <div class="wrap"><svg class="chart short" id="c2"></svg><div class="touch" id="t2"></div></div>
  <div class="legend"><span><i style="background:#FFFFFF"></i><span id="avgLab">Average note rate outstanding</span></span><span><i style="background:#FF9F0A"></i>Freddie Mac 30Y (quarter avg)</span><span><i style="background:#64D2FF"></i>Today: Optimal Blue 30Y conforming (dotted)</span></div>
  <div class="h2" id="h3">In the money</div>
  <div class="ro" id="ro3"></div>
  <div class="wrap"><svg class="chart short" id="c3"></svg><div class="touch" id="t3"></div></div>
  <div class="legend"><span><i class="box" style="background:#30D158"></i>At least (whole buckets past the line)</span><span><i class="box" style="background:#30D158;opacity:0.35"></i>Up to (the bucket the line falls in)</span></div>
  <div class="hint" id="today"></div>
</div>
<div class="note" id="note"></div>
<script>
var D = __DATA__;
var MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
var COLORS = ["#B456C6", "#4FA3E0", "#3F9A4F", "#E58A4E", "#4C7FB0"];
var LABELS = ["Below 3%", "3.00–3.99%", "4.00–4.99%", "5.00–5.99%", "6% or more"];
var EDGES = [[-1e9, 3], [3, 4], [4, 5], [5, 6], [6, 1e9]];
var AMB = "#FF9F0A", GRN = "#30D158";
var state = { mk: 0, cursor: null };
var TL = [], view = { a: 0, b: 0 }, MIN_SPAN = 4;

function el(id) { return document.getElementById(id); }
function esc(s) { return String(s).split("&").join("&amp;").split("<").join("&lt;").split(">").join("&gt;").split('"').join("&quot;"); }
function qL(q) { return q.slice(0, 4) + " Q" + q.slice(5); }
function qS(q) { return "Q" + q.slice(5) + " ’" + q.slice(2, 4); }
function dLong(iso) { var p = iso.split("-"); return MONTHS[+p[1] - 1] + " " + (+p[2]) + ", " + p[0]; }
function MK() { return D.markets[state.mk] || D.markets[0]; }
function setView(a, b) { setViewQuiet(a, b); renderCharts(); }
function setViewQuiet(a, b) {
  var I = TL.length - 1, span = Math.round(Math.max(Math.min(MIN_SPAN, I), Math.min(I, b - a)));
  a = Math.max(0, Math.min(I - span, Math.round(a)));
  view.a = Math.max(0, a); view.b = view.a + span;
}
function resetView() { view.a = 0; view.b = Math.max(0, TL.length - 1); }
function niceStep(range, n) { var raw = range / (n || 5), p = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), f = raw / p; return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p; }
function sum(a, k0, k1) { var t = 0; for (var k = k0; k < k1; k++) t += a[k]; return t; }
function itm(b, r) {
  var t = r + D.itmBps / 100, lo = 0, hi = 0;
  for (var k = 0; k < 5; k++) {
    if (EDGES[k][0] >= t) { lo += b[k]; hi += b[k]; }
    else if (EDGES[k][1] > t) hi += b[k];
  }
  return { lo: lo, hi: hi };
}
function pct(v) { return (Math.round(v * 10) / 10).toFixed(1) + "%"; }
function signed(v, unit) { var r = Math.round(v); return (r > 0 ? "+" : r < 0 ? "−" : "") + Math.abs(r) + (unit || ""); }

// Shared frame: x by quarter (points), y from lo..hi. Every chart keeps the
// same right gutter for its labels, so the quarters line up across charts.
var RPAD = 76, SHORT = ["<3%", "3–4%", "4–5%", "5–6%", "6%+"];
// Labels in the right gutter, each near its y, pushed apart so none overlap
function sideLabels(F, items) {
  items.sort(function (p, q) { return p.y - q.y; });
  for (var k = 1; k < items.length; k++) if (items[k].y - items[k - 1].y < 14) items[k].y = items[k - 1].y + 14;
  var over = items.length ? items[items.length - 1].y - (F.B - 2) : 0;
  if (over > 0) items.forEach(function (it) { it.y -= over; });
  for (var k2 = items.length - 2; k2 >= 0; k2--) if (items[k2 + 1].y - items[k2].y < 14) items[k2].y = items[k2 + 1].y - 14;
  return items.map(function (it) {
    return '<text x="' + (F.R + 7) + '" y="' + (it.y + 4).toFixed(1) + '" font-size="11.5" fill="' + it.c + '">' +
      '<tspan font-weight="700">' + it.v + '</tspan>' + (it.t ? '<tspan dx="4" font-size="10.5" fill-opacity="0.85">' + it.t + '</tspan>' : '') + '</text>';
  }).join("");
}
function frame(svg, lo, hi, st, fmt) {
  var r = svg.getBoundingClientRect(), w = Math.max(240, r.width), h = Math.max(120, r.height);
  var L = 40, R = w - RPAD, T = 8, B = h - 22, n = view.b - view.a;
  svg.__geo = { L: L, w: R - L };
  var F = { X: function (i) { return L + (n ? (i - view.a) / n : 0.5) * (R - L); }, Y: function (v) { return B - (v - lo) / (hi - lo) * (B - T); }, L: L, R: R, T: T, B: B, h: h };
  var s = "";
  for (var v = lo; v <= hi + st / 2; v += st) {
    s += '<line x1="' + L + '" x2="' + R + '" y1="' + F.Y(v) + '" y2="' + F.Y(v) + '" stroke="#3A3A3C" stroke-width="0.6"/>';
    s += '<text x="' + (L - 6) + '" y="' + (F.Y(v) + 3.5) + '" fill="#98989F" font-size="10" text-anchor="end">' + fmt(v) + '</text>';
  }
  var lastX = -99, years = (view.b - view.a) / 4;
  for (var i = view.a; i <= view.b; i++) {
    var q = TL[i], lab = null;
    if (years <= 3) lab = q.slice(5) === "1" ? "’" + q.slice(2, 4) : "Q" + q.slice(5);
    else if (q.slice(5) === "1") lab = years > 9 ? "’" + q.slice(2, 4) : q.slice(0, 4);
    var x = F.X(i);
    if (lab && x - lastX > 26 && x > L + 6) { s += '<text x="' + x.toFixed(1) + '" y="' + (h - 6) + '" fill="#98989F" font-size="10" text-anchor="middle">' + lab + '</text>'; lastX = x; }
  }
  F.head = s;
  return F;
}
function cursorLine(F) {
  if (state.cursor == null || state.cursor < view.a || state.cursor > view.b) return "";
  var cx = F.X(state.cursor);
  return '<line x1="' + cx + '" x2="' + cx + '" y1="' + F.T + '" y2="' + F.B + '" stroke="#FFFFFF" stroke-width="1" stroke-dasharray="3 2"/>';
}
// runs of consecutive quarters where get(i) has a value
function runs(get) {
  var out = [], cur = [];
  for (var i = view.a; i <= view.b; i++) {
    if (get(i) == null) { if (cur.length) out.push(cur); cur = []; } else cur.push(i);
  }
  if (cur.length) out.push(cur);
  return out;
}
function area(F, run, top, bot, color, op) {
  var d = "";
  run.forEach(function (i, n) { d += (n ? "L" : "M") + F.X(i).toFixed(1) + "," + F.Y(top(i)).toFixed(1); });
  for (var n = run.length - 1; n >= 0; n--) d += "L" + F.X(run[n]).toFixed(1) + "," + F.Y(bot(run[n])).toFixed(1);
  return '<path d="' + d + 'Z" fill="' + color + '"' + (op != null ? ' fill-opacity="' + op + '"' : '') + '/>';
}
function line(F, get, color, width) {
  var d = "", pen = false;
  for (var i = view.a; i <= view.b; i++) {
    var v = get(i);
    if (v == null) { pen = false; continue; }
    d += (pen ? "L" : "M") + F.X(i).toFixed(1) + "," + F.Y(v).toFixed(1); pen = true;
  }
  return '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="' + width + '" stroke-linejoin="round" stroke-linecap="round"/>';
}
function rateAt(i) { var v = D.pmms ? D.pmms[TL[i]] : null; return v == null ? null : v; }
function itmAt(i) { var b = MK().b[i], r = rateAt(i); return b && r != null ? itm(b, r) : null; }

function drawStack(svg) {
  var mk = MK(), F = frame(svg, 0, 100, 20, function (v) { return v + "%"; }), s = F.head;
  runs(function (i) { return mk.b[i]; }).forEach(function (run) {
    for (var k = 4; k >= 0; k--) {
      (function (k) {
        s += area(F, run, function (i) { return Math.min(100, sum(mk.b[i], 0, k + 1)); }, function (i) { return sum(mk.b[i], 0, k); }, COLORS[k]);
      })(k);
    }
  });
  // each band labeled at the right, at its height, for the quarter being read
  var b = mk.b[curIdx()], items = [];
  if (b) for (var k = 0; k < 5; k++) items.push({ y: F.Y(sum(b, 0, k) + b[k] / 2), v: Math.round(b[k]) + "%", t: SHORT[k], c: COLORS[k] });
  svg.innerHTML = s + cursorLine(F) + sideLabels(F, items);
}
function drawRates(svg) {
  var mk = MK(), vals = [];
  for (var i = view.a; i <= view.b; i++) { if (mk.avg[i] != null) vals.push(mk.avg[i]); if (rateAt(i) != null) vals.push(rateAt(i)); }
  if (!vals.length) { svg.innerHTML = ""; return; }
  if (D.obLatest) vals.push(D.obLatest.v); // today's rate stays on the chart
  var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), st = niceStep((hi - lo) || 1, 4);
  lo = Math.floor(lo / st) * st; hi = Math.ceil(hi / st) * st; if (hi === lo) hi = lo + st;
  var F = frame(svg, lo, hi, st, function (v) { return v.toFixed(st < 1 ? 1 : 0) + "%"; }), s = F.head;
  runs(function (i) { return mk.avg[i] != null && rateAt(i) != null ? 1 : null; }).forEach(function (run) {
    s += area(F, run, function (i) { return Math.max(mk.avg[i], rateAt(i)); }, function (i) { return Math.min(mk.avg[i], rateAt(i)); }, "#FFFFFF", 0.08);
  });
  // today's Optimal Blue rate: a dotted reference line across the whole chart
  if (D.obLatest) {
    var yo = F.Y(D.obLatest.v);
    s += '<line x1="' + F.L + '" x2="' + F.R + '" y1="' + yo.toFixed(1) + '" y2="' + yo.toFixed(1) + '" stroke="#64D2FF" stroke-width="1.6" stroke-dasharray="2 3"/>';
  }
  s += line(F, rateAt, AMB, 2) + line(F, function (i) { return mk.avg[i]; }, "#FFFFFF", 2.4);
  var ci = curIdx(), items = [];
  if (D.obLatest) items.push({ y: F.Y(D.obLatest.v), v: D.obLatest.v.toFixed(2) + "%", t: "today", c: "#64D2FF" });
  if (rateAt(ci) != null) items.push({ y: F.Y(rateAt(ci)), v: rateAt(ci).toFixed(2) + "%", t: "", c: AMB });
  if (mk.avg[ci] != null) items.push({ y: F.Y(mk.avg[ci]), v: mk.avg[ci].toFixed(2) + "%", t: "", c: "#FFFFFF" });
  svg.innerHTML = s + cursorLine(F) + sideLabels(F, items);
}
function drawItm(svg) {
  var hiV = 0;
  for (var i = view.a; i <= view.b; i++) { var x = itmAt(i); if (x) hiV = Math.max(hiV, x.hi); }
  var st = niceStep(Math.max(hiV, 5), 4), top = Math.max(st, Math.ceil(hiV / st) * st);
  var F = frame(svg, 0, top, st, function (v) { return Math.round(v) + "%"; }), s = F.head;
  runs(itmAt).forEach(function (run) {
    s += area(F, run, function (i) { return itmAt(i).hi; }, function () { return 0; }, GRN, 0.32);
    s += area(F, run, function (i) { return itmAt(i).lo; }, function () { return 0; }, GRN, 0.9);
  });
  var x = itmAt(curIdx()), items = [];
  if (x) {
    if (Math.round(x.lo) === Math.round(x.hi)) items.push({ y: F.Y(x.hi), v: Math.round(x.hi) + "%", t: "", c: GRN });
    else { items.push({ y: F.Y(x.hi), v: Math.round(x.hi) + "%", t: "up to", c: GRN }); items.push({ y: F.Y(x.lo), v: Math.round(x.lo) + "%", t: "at least", c: GRN }); }
  }
  svg.innerHTML = s + cursorLine(F) + sideLabels(F, items);
}

// The quarter being read: under the finger, or the newest in view with data
function curIdx() {
  var mk = MK(), i = state.cursor != null ? state.cursor : view.b;
  if (state.cursor == null) while (i > view.a && !mk.b[i]) i--;
  return i;
}
function readouts() {
  var mk = MK(), i = curIdx(), q = TL[i], b = mk.b[i], ya = i >= 4 ? mk.b[i - 4] : null;
  el("ro1").innerHTML = esc(qL(q)) + " <span>· " + esc(mk.long) + "</span>";
  var rows = "";
  for (var k = 4; k >= 0; k--) {
    rows += '<div class="bk"><span><i style="background:' + COLORS[k] + '"></i>' + LABELS[k] + '</span><b>' + (b ? pct(b[k]) : "n/a") +
      '</b><span class="c">' + (b && ya ? signed(b[k] - ya[k], " y/y") : "") + '</span></div>';
  }
  el("bk").innerHTML = rows;
  var a = mk.avg[i], r = rateAt(i);
  var qa = q ? " (" + qS(q) + " avg)" : "";
  el("ro2").innerHTML = (a != null ? "Outstanding " + a.toFixed(2) + "%" : "Outstanding n/a") + " <span>\u00b7</span> " +
    (r != null ? "Freddie " + r.toFixed(2) + "%<span>" + qa + "</span>" : "Freddie n/a") +
    (a != null && r != null ? " <span>\u00b7 gap " + signed((r - a) * 100, " bps") + "</span>" : "") +
    (D.obLatest && a != null ? '<br><span style="color:#64D2FF;font-weight:600">Today: OB ' + D.obLatest.v.toFixed(2) + "% (" + dLong(D.obLatest.date) + ")</span> <span>\u00b7 " +
      signed((D.obLatest.v - a) * 100, " bps") + " vs " + esc(qS(q)) + " outstanding</span>" : "");
  el("avgLab").textContent = "Average note rate outstanding (" + mk.label + ")";
  var x = itmAt(i);
  el("h3").textContent = "In the money · note rate ≥ market + " + (D.itmBps / 100).toFixed(2);
  el("ro3").innerHTML = x ? esc(qS(q)) + " at " + r.toFixed(2) + "% <span>·</span> " + (Math.round(x.lo) === Math.round(x.hi) ? pct(x.lo) : "at least " + pct(x.lo) + ", up to " + pct(x.hi)) : "n/a";
  // today's rate against the newest quarter FHFA has
  var li = mk.b.length - 1; while (li > 0 && !mk.b[li]) li--;
  var TODAY = D.obLatest ? { v: D.obLatest.v, date: D.obLatest.date, who: "Optimal Blue rate" } : D.pmmsLatest ? { v: D.pmmsLatest.v, date: D.pmmsLatest.date, who: "Freddie Mac rate" } : null;
  if (TODAY && mk.b[li]) {
    var t = itm(mk.b[li], TODAY.v);
    el("today").textContent = "At today\u2019s " + TODAY.who + " of " + TODAY.v.toFixed(2) + "% (" + dLong(TODAY.date) + ") against FHFA\u2019s latest quarter (" + qS(TL[li]) + "): " +
      (Math.round(t.lo) === Math.round(t.hi) ? pct(t.lo) : "at least " + pct(t.lo) + ", up to " + pct(t.hi)) + " of " + (mk.key === "all" ? "all mortgages" : mk.label + " loans") + " would save " + D.itmBps + "+ bps.";
  } else el("today").textContent = "";
}
function renderCharts() { drawStack(el("c1")); drawRates(el("c2")); drawItm(el("c3")); readouts(); }
function renderPicker() {
  el("markets").innerHTML = D.markets.map(function (m, k) { return '<button data-k="' + k + '"' + (k === state.mk ? ' class="on"' : '') + '>' + esc(m.label) + '</button>'; }).join("");
}
function renderAll() {
  renderPicker();
  renderCharts();
  el("note").textContent = "Share of closed-end first-lien residential mortgages outstanding at the end of each quarter, by note rate, weighted by loan count. " +
    "From FHFA’s National Mortgage Database, a nationally representative 5% sample of mortgages in the credit-bureau files; FHFA posts it quarterly with a lag" +
    (D.next ? " (the next file is estimated around " + dLong(D.next) + ")" : "") + ". The average note rate is FHFA’s too. " +
    "Market rate: Freddie Mac’s Primary Mortgage Market Survey 30-year fixed (FRED: MORTGAGE30US), averaged by quarter. " +
    "In the money = note rate at least " + (D.itmBps / 100).toFixed(2) + " points above that quarter’s market rate. FHFA gives rate buckets, not exact rates, " +
    "so this is a range: “at least” counts buckets entirely above the line, “up to” adds the bucket the line falls in. With rates in the 6s, the line falls inside the open-ended 6%+ bucket, so the floor is often 0%. " +
    "Markets are FHFA’s: Fannie/Freddie = Enterprise; Govt = FHA, VA and USDA (Government/Non-Conventional); Jumbo = above the conforming limit. " +
    "Sources: Federal Housing Finance Agency (FHFA), National Mortgage Database outstanding residential mortgage statistics" + (D.fileModified ? " (file dated " + D.fileModified + ")" : "") + "; Freddie Mac PMMS via FRED.";
  el("progress").textContent = D.progress || "";
  el("progress").style.color = /couldn|unreachable|cached|open/i.test(D.progress || "") ? "#FF9F0A" : "";
}

// One finger reads a quarter on all charts. Two fingers pinch to zoom and drag
// to pan; double-tap resets to the full history. A vertical swipe still scrolls.
var fingers = {}, pinch = null, pinchLock = false, rafId = 0, pendingView = null, lastTap = null, activeSvg = "c1";
function fingerIds() { return Object.keys(fingers); }
function posAt(clientX) {
  var svg = el(activeSvg), g = svg.__geo || { L: 40, w: 300 }, r = svg.getBoundingClientRect();
  var f = Math.max(0, Math.min(1, (clientX - r.left - g.L) / g.w));
  return { f: f, pos: view.a + f * (view.b - view.a) };
}
function idxAt(clientX) { return Math.max(view.a, Math.min(view.b, Math.round(posAt(clientX).pos))); }
function pinchNow() {
  var ks = fingerIds(), p = fingers[ks[0]], q = fingers[ks[1]];
  var dx = p.x - q.x, dy = p.y - q.y;
  return { dist: Math.max(Math.sqrt(dx * dx + dy * dy), 10), mid: (p.x + q.x) / 2 };
}
function scheduleView(a, b) {
  pendingView = [a, b];
  if (rafId) return;
  rafId = requestAnimationFrame(function () { rafId = 0; var v = pendingView; pendingView = null; setView(v[0], v[1]); });
}
function scrub(i) { state.cursor = i; renderCharts(); }
function onDown(svgId, e) {
  fingers[e.pointerId] = { x: e.clientX, y: e.clientY };
  var n = fingerIds().length;
  if (n === 1) activeSvg = svgId;
  if (n === 2) {
    var st = pinchNow();
    pinch = { dist: st.dist, n: view.b - view.a, anchor: posAt(st.mid).pos };
    pinchLock = true; lastTap = null; state.cursor = null;
  } else if (n === 1 && !pinchLock) {
    var now = Date.now();
    if (lastTap && now - lastTap.t < 320 && Math.abs(e.clientX - lastTap.x) < 30) {
      lastTap = null; state.cursor = null; resetView(); renderCharts(); return;
    }
    lastTap = { t: now, x: e.clientX };
    scrub(idxAt(e.clientX));
  }
}
function onMove(svgId, e) {
  if (!fingers[e.pointerId]) return;
  fingers[e.pointerId] = { x: e.clientX, y: e.clientY };
  if (pinch && fingerIds().length >= 2) {
    var st = pinchNow(), I = TL.length - 1;
    var n = Math.max(MIN_SPAN, Math.min(I, pinch.n * pinch.dist / st.dist));
    var a = pinch.anchor - posAt(st.mid).f * n;
    scheduleView(a, a + n);
  } else if (!pinchLock) {
    scrub(idxAt(e.clientX));
  }
}
function onUp(svgId, e) {
  delete fingers[e.pointerId];
  var n = fingerIds().length;
  if (n < 2) pinch = null;
  if (n === 0) { if (!pinchLock) scrub(null); pinchLock = false; }
}
["1", "2", "3"].forEach(function (k) {
  var layer = el("t" + k), id = "c" + k;
  layer.addEventListener("pointerdown", function (e) { onDown(id, e); });
  layer.addEventListener("pointermove", function (e) { onMove(id, e); });
  layer.addEventListener("pointerup", function (e) { onUp(id, e); });
  layer.addEventListener("pointercancel", function (e) { onUp(id, e); });
  layer.addEventListener("pointerleave", function (e) { onUp(id, e); });
});
document.addEventListener("gesturestart", function (e) { e.preventDefault(); });
el("markets").addEventListener("click", function (e) {
  var t = e.target;
  if (!t || t.getAttribute("data-k") == null) return;
  state.mk = +t.getAttribute("data-k"); state.cursor = null;
  renderPicker(); renderCharts();
});
window.addEventListener("resize", function () { if (D && rendered) renderCharts(); });

// Draw safely: never a silent black screen
var rendered = false, tries = 0;
function showError(msg) {
  el("loading").style.display = "none";
  var e = el("err"); e.style.display = "";
  e.innerHTML = "Couldn’t draw the charts: " + esc(msg) + '<button id="retry">Retry</button>';
  el("retry").onclick = function () { e.style.display = "none"; tries = 0; if (D) safeRender(); else { el("loading").style.display = ""; window.__wantData = true; } };
}
function safeRender() {
  if (!D) { window.__wantData = true; return; }
  if (document.body.clientWidth < 50 && tries++ < 25) { setTimeout(safeRender, 120); return; }
  try {
    el("blocks").style.display = "";
    renderAll();
    el("loading").style.display = "none"; el("err").style.display = "none";
    rendered = true; window.__rendered = true;
  } catch (e) { el("blocks").style.display = "none"; showError((e && e.message) || String(e)); }
}
window.onerror = function (msg) { if (!rendered) showError(String(msg)); };
window.update = function (n) {
  var prevKey = D && D.markets && D.markets[state.mk] ? D.markets[state.mk].key : null;
  var keep = D && TL.length && view.b !== TL.length - 1 ? { a: TL[view.a], b: TL[view.b] } : null;
  D = n; window.__wantData = false;
  TL = D.quarters;
  state.mk = 0;
  if (prevKey) D.markets.forEach(function (m, k) { if (m.key === prevKey) state.mk = k; });
  var a = keep ? TL.indexOf(keep.a) : -1, b = keep ? TL.indexOf(keep.b) : -1;
  if (a >= 0 && b > a) { view.a = a; view.b = b; } else resetView();
  state.cursor = null;
  safeRender();
};
window.shareInfo = function () { var q = TL.length ? TL[curIdx()] : null; return { title: "Rate Lock-In", name: MK() ? MK().label : "", asOf: q ? qL(q) : "" }; };

// Share as PDF: 16:9 slides for the quarters on screen and the market picked.
// 1) the distribution (MBA's chart); 2) the average rate outstanding vs the
// market rate, and the share in the money, side by side. Each has a headline
// that states the point, the chart large, labels at the right edge, and a
// dark banner crediting the sources. Vector, so it stays sharp.
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
  var PC = [[146, 50, 142], [72, 155, 214], [50, 108, 46], [219, 122, 63], [45, 91, 128]];
  var PS = ["below 3%", "3.00-3.99%", "4.00-4.99%", "5.00-5.99%", "6% or more"];
  var OBC = [0, 119, 200];
  var OUT = [28, 28, 30], MKT = [214, 118, 0], ITM = [30, 150, 70], ITML = [190, 230, 200];
  function font(bold, size, c) { doc.setFont(FACE, bold ? "bold" : "normal"); doc.setFontSize(size); doc.setTextColor(c[0], c[1], c[2]); }
  var mk = MK(), a0 = view.a, b0 = view.b;
  while (b0 > a0 && !mk.b[b0]) b0--;
  while (a0 < b0 && !mk.b[a0]) a0++;
  var Q = TL.slice(a0, b0 + 1), n = Q.length, last = Q[n - 1];
  var lastData = mk.b.length - 1; while (lastData > 0 && !mk.b[lastData]) lastData--;
  var endsNowQ = b0 >= lastData; // today's reference line only when the view runs to FHFA's latest quarter
  function qP(q) { return q.slice(0, 4) + " Q" + q.slice(5); }
  var span = qP(Q[0]) + " to " + qP(last);
  var mkName = mk.key === "all" ? "Mortgages" : mk.key === "ent" ? "Fannie/Freddie Mortgages" : mk.key === "gov" ? "Government Mortgages" : "Jumbo Mortgages";
  var mkSub = mk.key === "all" ? "all mortgages" : mk.long;

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
  function frameP(top, L, R, lo, hi, st, fmt, bot) {
    var F = { L: L, R: R, T: top + 58, B: bot || H - 92 };
    F.X = function (i) { return F.L + (n === 1 ? 0.5 : i / (n - 1)) * (F.R - F.L); };
    F.Y = function (v) { return F.B - (v - lo) / (hi - lo) * (F.B - F.T); };
    doc.setLineWidth(0.5);
    for (var v = lo; v <= hi + st / 2; v += st) {
      doc.setDrawColor(RULE[0], RULE[1], RULE[2]); doc.line(F.L, F.Y(v), F.R, F.Y(v));
      font(false, 8.5, GRY); doc.text(fmt(v), F.L - 6, F.Y(v) + 3, { align: "right" });
    }
    doc.setDrawColor(150, 150, 155); doc.line(F.L, F.B, F.R, F.B);
    var lastX = -99, years = (n - 1) / 4;
    for (var i = 0; i < n; i++) {
      var q = Q[i], lab = null;
      if (years <= 3) lab = q.slice(5) === "1" ? q.slice(0, 4) : "Q" + q.slice(5);
      else if (q.slice(5) === "1") lab = q.slice(0, 4);
      var x = F.X(i);
      if (!lab || x - lastX < 30) continue;
      doc.setDrawColor(150, 150, 155); doc.line(x, F.B, x, F.B + 3);
      font(false, 8.5, GRY); doc.text(lab, x, F.B + 13, { align: "center" }); lastX = x;
    }
    return F;
  }
  function poly(pts, c) {
    if (pts.length < 3) return;
    var rel = [];
    for (var k = 1; k < pts.length; k++) rel.push([pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]]);
    doc.setFillColor(c[0], c[1], c[2]);
    doc.lines(rel, pts[0][0], pts[0][1], [1, 1], "F", true);
  }
  function lineP(F, get, c, w) {
    doc.setDrawColor(c[0], c[1], c[2]); doc.setLineWidth(w); if (doc.setLineJoin) doc.setLineJoin("round");
    var px = null, py = null;
    for (var i = 0; i < n; i++) {
      var v = get(i);
      if (v == null) continue;
      var x = F.X(i), y = F.Y(v);
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
    items.forEach(function (it) { it.w = doc.getTextWidth(it.t); total += (it.box ? 14 : 22) + it.w + 22; });
    var x = cx - (total - 22) / 2;
    items.forEach(function (it) {
      if (it.box) { doc.setFillColor(it.c[0], it.c[1], it.c[2]); doc.rect(x, y - 7.5, 9, 9, "F"); x += 14; }
      else { doc.setLineWidth(it.lw || 2); doc.setDrawColor(it.c[0], it.c[1], it.c[2]); doc.line(x, y - 3, x + 16, y - 3); x += 22; }
      font(false, 9, INK); doc.text(it.t, x, y); x += it.w + 22;
    });
  }
  var pages = 2;
  function banner(page) {
    var bh = 44, by = H - bh;
    doc.setFillColor(28, 28, 30); doc.rect(0, by, W, bh, "F");
    doc.setFillColor(201, 162, 39); doc.rect(W - 176, by + 6, 2, bh - 12, "F");
    font(false, 7.2, [235, 235, 240]);
    var src = "Source: Federal Housing Finance Agency (FHFA), National Mortgage Database, outstanding residential mortgage statistics (" + mkSub +
      ", share of loans by count, end of quarter)." +
      (page === 2 ? " Market rate: Freddie Mac Primary Mortgage Market Survey 30-year fixed (MORTGAGE30US) via FRED, quarterly average, same quarters as FHFA's data" +
        (D.obLatest && endsNowQ ? "; dotted line = today's Optimal Blue 30-year conforming rate index (OBMMIC30YF, " + D.obLatest.date + "), for reference" : "") + ". In the money = note rate at least " +
        (D.itmBps / 100).toFixed(2) + " points above the market rate; a range, since FHFA reports rate buckets." : "");
    doc.text(doc.splitTextToSize(src, W - 176 - 40 - 110), 28, by + 15);
    font(false, 7.5, [200, 200, 205]);
    doc.text("Data through " + qP(last), W - 188, by + 20, { align: "right" });
    doc.text(page + " of " + pages, W - 188, by + 31, { align: "right" });
    font(true, 12.5, [255, 255, 255]);
    doc.text("Rate", W - 162, by + 20);
    doc.text("Lock-In", W - 162, by + 34);
  }
  function p1(v) { return (Math.round(v * 10) / 10).toFixed(1) + "%"; }
  function p0(v) { return Math.round(v) + "%"; }
  var B = Q.map(function (q, i) { return mk.b[a0 + i]; });

  // ---- 1. The distribution ----
  var lb = B[n - 1];
  var top = headline(p0(lb[0] + lb[1]) + " of Outstanding " + mkName + " Carry Rates Below 4%; " + p0(lb[4]) + " Are at 6% or More");
  titles(top, "Distribution of Mortgage Rates on Loans Outstanding", "Quarterly, share of " + mkSub + " by note rate · " + span, W / 2);
  var F = frameP(top, 70, W - 146, 0, 100, 10, function (v) { return v + "%"; }, H - 70);
  for (var k = 4; k >= 0; k--) {
    var pts = [];
    for (var i = 0; i < n; i++) if (B[i]) pts.push([F.X(i), F.Y(Math.min(100, sum(B[i], 0, k + 1)))]);
    for (var j = n - 1; j >= 0; j--) if (B[j]) pts.push([F.X(j), F.Y(sum(B[j], 0, k))]);
    poly(pts, PC[k]);
  }
  // each band labeled at the right edge, at its height: the share, then the rate range
  var ends = [];
  for (var k2 = 0; k2 < 5; k2++) ends.push({ y: F.Y(sum(lb, 0, k2) + lb[k2] / 2), t: p1(lb[k2]), r: PS[k2], c: PC[k2] });
  ends.sort(function (p, q) { return p.y - q.y; });
  for (var e1 = 1; e1 < ends.length; e1++) if (ends[e1].y - ends[e1 - 1].y < 14) ends[e1].y = ends[e1 - 1].y + 14;
  var ov = ends[ends.length - 1].y - F.B;
  if (ov > 0) ends.forEach(function (it) { it.y -= ov; });
  ends.forEach(function (it) {
    font(true, 10.5, it.c); doc.text(it.t, F.R + 8, it.y + 3.5);
    var tw = doc.getTextWidth(it.t);
    font(false, 9.5, it.c); doc.text(it.r, F.R + 12 + tw, it.y + 3.5);
  });
  banner(1);

  // ---- 2. Average rate vs the market, and in the money ----
  doc.addPage([W, H], "landscape");
  var AV = Q.map(function (q, i) { return mk.avg[a0 + i]; }), MR = Q.map(function (q) { return D.pmms ? D.pmms[q] : null; });
  var IT = B.map(function (b, i) { return b && MR[i] != null ? itm(b, MR[i]) : null; });
  var la = AV[n - 1], lm = MR[n - 1], li = IT[n - 1];
  var OBT = D.obLatest && endsNowQ ? D.obLatest : null;
  var h1 = la != null && lm != null ? "Outstanding " + mkName + " Average " + la.toFixed(2) + "% vs a " + lm.toFixed(2) + "% " + qP(last).slice(5) + " Market Rate" + (OBT ? " (" + OBT.v.toFixed(2) + "% Today)" : "") : "Average Rate Outstanding vs the Market Rate";
  var h2 = li ? (Math.round(li.hi) === 0 ? "; Almost None Are in the Money" : "; At Most " + p0(li.hi) + " Are in the Money") : "";
  top = headline(h1 + h2);
  var halves = [{ L: 62, R: W / 2 - 58 }, { L: W / 2 + 50, R: W - 64 }];
  // left: two rates
  var vals = [];
  AV.forEach(function (v) { if (v != null) vals.push(v); }); MR.forEach(function (v) { if (v != null) vals.push(v); });
  if (OBT) vals.push(OBT.v);
  var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), st = niceStep((hi - lo) || 1, 5);
  lo = Math.floor(lo / st) * st; hi = Math.ceil(hi / st) * st; if (hi === lo) hi = lo + st;
  var cxL = (halves[0].L + halves[0].R) / 2;
  titles(top, "Average Rate Outstanding vs Market Rate", "Quarterly, % · gap " + (la != null && lm != null ? Math.round((lm - la) * 100) + " bps in " + qP(last) : "n/a"), cxL);
  var FL = frameP(top, halves[0].L, halves[0].R, lo, hi, st, function (v) { return v.toFixed(st < 1 ? 1 : 0) + "%"; });
  if (OBT) {
    doc.setDrawColor(OBC[0], OBC[1], OBC[2]); doc.setLineWidth(1.3); if (doc.setLineDashPattern) doc.setLineDashPattern([1.5, 2.5], 0);
    doc.line(FL.L, FL.Y(OBT.v), FL.R, FL.Y(OBT.v)); if (doc.setLineDashPattern) doc.setLineDashPattern([], 0);
  }
  lineP(FL, function (i) { return MR[i]; }, MKT, 2);
  lineP(FL, function (i) { return AV[i]; }, OUT, 2.4);
  var el2 = [];
  if (OBT) el2.push({ y: FL.Y(OBT.v), t: OBT.v.toFixed(2) + "% today", c: OBC });
  if (lm != null) el2.push({ y: FL.Y(lm), t: lm.toFixed(2) + "%", c: MKT });
  if (la != null) el2.push({ y: FL.Y(la), t: la.toFixed(2) + "%", c: OUT });
  endLabels(FL, el2, 6);
  legend(FL, [{ t: "Avg rate outstanding", c: OUT, lw: 2.4 }, { t: "Freddie 30Y (qtr avg)", c: MKT, lw: 2 }].concat(OBT ? [{ t: "Today: OB 30Y", c: OBC, lw: 1.3 }] : []), cxL);
  // right: in the money
  var hv = 0; IT.forEach(function (x) { if (x) hv = Math.max(hv, x.hi); });
  var st2 = niceStep(Math.max(hv, 5), 5), top2 = Math.max(st2, Math.ceil(hv / st2) * st2);
  var cxR = (halves[1].L + halves[1].R) / 2;
  titles(top, "Share of Loans in the Money", "Quarterly · note rate at least " + (D.itmBps / 100).toFixed(2) + " above the market rate", cxR);
  var FR = frameP(top, halves[1].L, halves[1].R, 0, top2, st2, function (v) { return Math.round(v) + "%"; });
  [["hi", ITML], ["lo", ITM]].forEach(function (pair) {
    var seg = [];
    function flush() {
      if (seg.length >= 2) {
        var pts = seg.map(function (i) { return [FR.X(i), FR.Y(IT[i][pair[0]])]; });
        pts.push([FR.X(seg[seg.length - 1]), FR.Y(0)]); pts.push([FR.X(seg[0]), FR.Y(0)]);
        poly(pts, pair[1]);
      }
      seg = [];
    }
    for (var i = 0; i < n; i++) { if (IT[i]) seg.push(i); else flush(); }
    flush();
  });
  if (li) endLabels(FR, Math.round(li.lo) === Math.round(li.hi) ? [{ y: FR.Y(li.hi), t: p0(li.hi), c: ITM }] :
    [{ y: FR.Y(li.hi), t: "up to " + p0(li.hi), c: ITM }, { y: FR.Y(li.lo), t: "at least " + p0(li.lo), c: ITM }], 6);
  legend(FR, [{ t: "At least", c: ITM, box: true }, { t: "Up to", c: ITML, box: true }], cxR);
  banner(2);
  return doc;
};

if (D) window.update(D); else window.__wantData = true;
</script>
__SHARE__
</body>
</html>`;

function progressOf(s, loading) {
  const bits = [];
  if (s.error) bits.push(`FHFA's file couldn't be refreshed: ${s.error}. Showing the saved copy.`);
  if (s.pmmsError) bits.push(`Freddie Mac rate unreachable (${s.pmmsError}); showing the saved copy.`);
  if (loading) bits.push("Checking FHFA and FRED for anything newer…");
  return bits.join(" ");
}
function pagePayload(s, progress) {
  return {
    quarters: s.quarters,
    markets: s.markets.map((m) => ({ key: m.key, label: m.label, long: m.long, b: m.b, avg: m.avg })),
    pmms: s.pmms || null,
    pmmsLatest: s.pmmsLatest || null,
    obLatest: s.obLatest || null,
    fileModified: s.fileModified ? new Date(s.fileModified).toISOString().slice(0, 10) : null,
    next: s.next || null,
    itmBps: ITM_BPS,
    progress,
  };
}
async function openFullScreen(s, loading) {
  const wv = updWV(new WebView());
  await wv.loadHTML(...updArgs(PAGE_HTML.replace("__DATA__", () => "null").replace("__SHARE__", () => "<script>" + SHARE_PAGE_JS + "</script>")));
  let json = JSON.stringify(pagePayload(s, progressOf(s, loading)));
  const push = async () => { try { await wv.evaluateJavaScript(`window.update(${json})`); } catch (e) {} };
  const ask = async (expr) => { try { return await wv.evaluateJavaScript(expr); } catch (e) { return null; } };
  await presentWithSharing(wv, async (isOpen) => {
    await sleep(250);
    for (let i = 0; i < 8 && isOpen(); i++) {
      await push();
      await sleep(400);
      if ((await ask("window.__rendered === true")) === true) break;
    }
    let checked = !loading;
    const t0 = Date.now();
    while (isOpen()) {
      await sleep(700);
      if (!isOpen()) break;
      if ((await ask("window.__wantData === true")) === true) await push();
      if (!checked && Date.now() - t0 > 1200) {
        checked = true;
        let fresh;
        try { fresh = await refreshWithin(150, false); } catch (e) { fresh = { ...s, error: String(e.message || e) }; }
        json = JSON.stringify(pagePayload(fresh, progressOf(fresh, false)));
        if (isOpen()) await push();
      }
    }
  });
}

// ---------- Run ----------
if (config.runsInWidget || PREVIEW_WIDGET_IN_APP) {
  let widget;
  try {
    const s = await refreshWithin(WIDGET_BUDGET_S, true);
    widget = finishWidget(smallImage(s), s);
  } catch (e) {
    widget = errorWidget(`Open the script in Scriptable once to download FHFA's data. (${e.message || e})`);
  }
  if (config.runsInWidget) Script.setWidget(widget);
  else await widget.presentSmall();
} else {
  try {
    const saved = readStore();
    if (saved) await openFullScreen(saved, true);
    else await openFullScreen(await refreshWithin(150, false), false);
  } catch (e) {
    const a = new Alert();
    a.title = "Couldn't load FHFA's data";
    a.message = String(e.message || e) + "\n\nCheck the connection and run it again.";
    a.addAction("OK");
    await a.present();
  }
}
Script.complete();
