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


// Borrower Credit for Scriptable
// How borrower credit is holding up, from two public New York Fed sources:
// - Quarterly Report on Household Debt and Credit (NY Fed Consumer Credit
//   Panel / Equifax), a spreadsheet each quarter (hhd_c_report_YYYYqN.xlsx):
//   new seriously delinquent balances by loan type (page 14) and where 30-60-day
//   late mortgages go next quarter (page 16).
// - SCE Credit Access Survey (Feb, Jun, Oct), frbny-sce-credit-access-data.xlsx:
//   rejection rates for mortgage and refinance applications, and discouraged
//   borrowers (didn't apply because they expected a no).
// Plus HUD's monthly FHA Single Family Loan Performance Trends (PDF, read with
// pdf.js): FHA delinquency, seasonally adjusted, back to 2015; who's falling
// behind (Table 3: by credit score, loan purpose, first-time buyer, down payment
// assistance, vintage, loan size, property type), why (Table 2: new 90+ day
// delinquencies by reason) and failure rates by fiscal-year cohort (Figure 1,
// read from the chart's lines).
// The spreadsheets are unzipped and read in a hidden web page. Small widget:
// mortgages newly 90+ days late since 2003. Tap for the full screen: pinch any
// chart to zoom, tap to read a date, tap a chip to hide a line. Share as PDF.

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

const PREVIEW_WIDGET_IN_APP = false;
const FILE = "mortgage-credit-v1.json";
const TITLE = "Borrower Credit";
const CHECK_HOURS = 24;        // look for a newer quarter's report this often
const SCE_CHECK_HOURS = 24 * 7; // the survey file is re-read weekly
const WIDGET_SECONDS = 20;
const HHDC_URL = (q) => `https://www.newyorkfed.org/medialibrary/interactives/householdcredit/data/xls/hhd_c_report_${q}.xlsx`;
const HHDC_PAGES = ["https://www.newyorkfed.org/microeconomics/hhdc/background.html", "https://www.newyorkfed.org/microeconomics/databank.html"];
const SCE_URL = "https://www.newyorkfed.org/medialibrary/interactives/sce/sce/downloads/data/frbny-sce-credit-access-data.xlsx";
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const GRAY = "#98989F";
// NBER recessions in this window (stable history)
const RECESSIONS = [["2001-03", "2001-11"], ["2007-12", "2009-06"], ["2020-02", "2020-04"]];

// ---------- Saved copy ----------
function docPath(name) { const fm = FileManager.local(); return fm.joinPath(fm.documentsDirectory(), name); }
function readJSON(name) {
  const fm = FileManager.local(), p = docPath(name);
  for (const q of [p, p + ".tmp"]) { try { if (fm.fileExists(q)) return JSON.parse(fm.readString(q)); } catch (e) {} }
  return null;
}
function writeJSON(name, obj) {
  const fm = FileManager.local(), p = docPath(name), tmp = p + ".tmp";
  try { fm.writeString(tmp, JSON.stringify(obj)); if (fm.fileExists(p)) fm.remove(p); fm.move(tmp, p); }
  catch (e) { try { fm.writeString(p, JSON.stringify(obj)); } catch (e2) {} }
}
const sleep = (ms) => new Promise((r) => Timer.schedule(ms, false, r));
const hoursSince = (iso) => (iso ? (Date.now() - new Date(iso).getTime()) / 3600000 : Infinity);

// ---------- Reading a spreadsheet ----------
// Runs inside a hidden web page: unzip the xlsx and return the rows of the
// sheets whose names are in window.__want (all sheets if empty), each row as
// { column letter: text }. Calls completion() with JSON.
function XLSX_READER() {
  (async function () {
    try {
      var bin = atob(window.__b64), u8 = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
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
      var want = window.__want || [], out = {};
      for (var si = 0; si < sheets.length; si++) {
        if (want.length && want.indexOf(sheets[si].name) < 0) continue;
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
// Download an xlsx and read the wanted sheets; null if the address has no xlsx
async function readXlsx(url, want) {
  const r = new Request(url);
  r.timeoutInterval = 60;
  r.headers = { "User-Agent": UA };
  const data = await r.load();
  const b64 = data ? data.toBase64String() : "";
  if (!b64.startsWith("UEsD")) return null; // a 404 page, not a spreadsheet
  const wv = updWV(new WebView());
  await wv.loadHTML(...updArgs("<html><body></body></html>"));
  await wv.evaluateJavaScript(`window.__b64 = "${b64}"; window.__want = ${JSON.stringify(want || [])}; 0`);
  const res = JSON.parse(await wv.evaluateJavaScript(`(${XLSX_READER.toString()})()`, true));
  if (res.error) throw new Error(res.error);
  return res.sheets;
}

// ---------- The Household Debt and Credit report ----------
// Quarter labels look like "03:Q1" (2003 Q1) or "99:Q2"; as a month index
// (year x 12 + month), the middle month of the quarter.
function qLab(s) {
  const m = String(s).match(/^(\d{2}):Q([1-4])$/);
  if (!m) return null;
  const y = +m[1] < 50 ? 2000 + +m[1] : 1900 + +m[1];
  return y * 12 + (+m[2] - 1) * 3 + 1;
}
const num = (v) => { const x = parseFloat(v); return isFinite(x) ? x : null; };
// The first row whose cells include all of the given headers; returns
// { row index, header -> column letter }
function headerRow(rows, needs) {
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const cols = {};
    Object.keys(rows[i]).forEach((c) => { cols[rows[i][c].toUpperCase()] = c; });
    if (needs.every((h) => cols[h.toUpperCase()])) return { i, cols };
  }
  return null;
}
function qSeries(rows, hdr, names) {
  const out = {};
  names.forEach((n) => (out[n] = []));
  for (let i = hdr.i + 1; i < rows.length; i++) {
    const t = qLab(rows[i].A);
    if (t === null) continue;
    names.forEach((n) => { const c = hdr.cols[n.toUpperCase()], v = c ? num(rows[i][c]) : null; if (v !== null) out[n].push({ t, v }); });
  }
  return out;
}
const HH_SHEETS = ["Page 6 Data", "Page 7 Data", "Page 14 Data", "Page 16 Data"];
function parseHhdc(sh) {
  const p14 = sh["Page 14 Data"], p16 = sh["Page 16 Data"], p6 = sh["Page 6 Data"], p7 = sh["Page 7 Data"];
  if (!p14 || !p16 || !p6) throw new Error("the report's layout changed (pages 6, 14 or 16 missing)");
  const h14 = headerRow(p14, ["MORTGAGE", "AUTO", "CC"]);
  const h16 = headerRow(p16, ["To current", "To 90+ days late"]);
  const h6 = headerRow(p6, ["<620", "760+"]);
  if (!h14 || !h16 || !h6) throw new Error("the report's column headings changed");
  const del = qSeries(p14, h14, ["MORTGAGE", "HELOC", "AUTO", "CC", "STUDENT LOAN"]);
  const late = qSeries(p16, h16, ["To current", "To 90+ days late"]);
  const bands = ["<620", "620-659", "660-719", "720-759", "760+"];
  const ob = qSeries(p6, h6, bands);
  const orig = ob["<620"].map((p) => ({ t: p.t, b: bands.map((k) => { const q = ob[k].find((x) => x.t === p.t); return q ? q.v : 0; }) })).filter((p) => p.b.some((v) => v > 0));
  let med = [], brk = null;
  if (p7) {
    const h7 = headerRow(p7, ["Median", "25th percentile", "10th percentile"]);
    if (h7) { const m7 = qSeries(p7, h7, ["Median", "25th percentile", "10th percentile"]); med = m7.Median.map((p) => ({ t: p.t, v: p.v, p25: (m7["25th percentile"].find((x) => x.t === p.t) || {}).v, p10: (m7["10th percentile"].find((x) => x.t === p.t) || {}).v })); }
    // the note on the score model: "VantageScore 4.0 (2026Q1+)"
    p7.slice(0, 6).forEach((r) => Object.values(r).forEach((v) => { const m = String(v).match(/VantageScore[^(]*\((\d{4})Q([1-4])/i); if (m) brk = +m[1] * 12 + (+m[2] - 1) * 3 + 1; }));
  }
  return {
    del: { mortgage: del.MORTGAGE, heloc: del.HELOC, auto: del.AUTO, card: del.CC, student: del["STUDENT LOAN"] },
    cure: late["To current"], roll: late["To 90+ days late"], orig, med, brk,
  };
}
// The newest report: the quarter after the saved one, then the last few
// quarters at the usual address, then the links on the NY Fed's pages
async function fetchHhdc(have, say) {
  say = say || (async () => {});
  const tries = [], d = new Date();
  for (let i = -1; i <= 4; i++) {
    const t = new Date(d.getFullYear(), d.getMonth() - 3 * i, 1), q = t.getFullYear() + "q" + (Math.floor(t.getMonth() / 3) + 1);
    if (!tries.includes(q)) tries.push(q);
  }
  tries.sort().reverse();
  for (const q of tries) {
    if (have && have.q >= q) return null; // nothing newer than what's saved
    try {
      await say("Looking for the " + q.toUpperCase() + " report...");
      const sh = await readXlsx(HHDC_URL(q), HH_SHEETS);
      if (sh) return { q, ...parseHhdc(sh) };
    } catch (e) { if (/layout|headings/.test(e.message)) throw e; }
  }
  // fall back to whatever the pages link to
  for (const page of HHDC_PAGES) {
    try {
      const r = new Request(page); r.headers = { "User-Agent": UA }; r.timeoutInterval = 20;
      const html = await r.loadString(), m = html.match(/hhd_c_report_(\d{4}q[1-4])\.xlsx/i);
      if (m && !(have && have.q >= m[1].toLowerCase())) { const sh = await readXlsx(HHDC_URL(m[1].toLowerCase()), HH_SHEETS); if (sh) return { q: m[1].toLowerCase(), ...parseHhdc(sh) }; }
    } catch (e) {}
  }
  return null;
}

// ---------- The SCE Credit Access Survey ----------
// Sheet "overall": a header row starting "date", one row per wave (YYYYMM).
// Columns are found by name; their exact names can change between releases.
function parseSce(sh) {
  const rows = sh.overall;
  if (!rows) throw new Error("the survey file's layout changed");
  let hi = -1;
  for (let i = 0; i < Math.min(8, rows.length); i++) if (rows[i].A && rows[i].A.toLowerCase() === "date") { hi = i; break; }
  if (hi < 0) throw new Error("the survey file's headings changed");
  const H = rows[hi], names = Object.keys(H).map((c) => ({ c, n: H[c] }));
  const find = (test) => { const f = names.find((x) => test(x.n.toLowerCase())); return f ? f.c : null; };
  const col = {
    mrej: find((n) => /reject/.test(n) && /mort/.test(n) && !/refi/.test(n)),
    rrej: find((n) => /reject/.test(n) && /refi/.test(n)),
    rej: find((n) => /^rejectedfromoneormore/.test(n)),
    disc: find((n) => n === "discouraged"),
  };
  const out = [];
  for (let i = hi + 1; i < rows.length; i++) {
    const r = rows[i], d = String(r.A || "");
    if (!/^\d{6}$/.test(d) || (r.B && r.B.toLowerCase() !== "all")) continue;
    const p = { t: +d.slice(0, 4) * 12 + +d.slice(4, 6) - 1 };
    Object.keys(col).forEach((k) => { if (col[k]) { const v = num(r[col[k]]); if (v !== null) p[k] = v; } });
    out.push(p);
  }
  return { waves: out, found: Object.keys(col).filter((k) => col[k]), headers: names.map((x) => x.n) };
}
async function fetchSce() {
  const sh = await readXlsx(SCE_URL, ["overall"]);
  if (!sh) throw new Error("the survey file wasn't there");
  return parseSce(sh);
}

// ---------- Refresh ----------
async function refresh(saved, force, say) {
  say = say || (async () => {});
  const s = saved ? JSON.parse(JSON.stringify(saved)) : {};
  const errors = [];
  if (force || !s.hh || hoursSince(s.hhChecked) >= CHECK_HOURS) {
    await say("Checking the NY Fed's Household Debt and Credit report...");
    try { const h = await fetchHhdc(s.hh, say); if (h) s.hh = h; s.hhChecked = new Date().toISOString(); }
    catch (e) { errors.push("Household Debt and Credit: " + (e.message || e)); }
  }
  if (force || !s.sce || hoursSince(s.sceChecked) >= SCE_CHECK_HOURS) {
    await say("Reading the Credit Access survey...");
    try { s.sce = await fetchSce(); s.sceChecked = new Date().toISOString(); }
    catch (e) { errors.push("Credit Access survey: " + (e.message || e)); }
  }
  s.errors = errors.length ? errors : null;
  s.checked = new Date().toISOString();
  if (s.hh || s.sce) writeJSON(FILE, s);
  return s;
}

// ---------- Small widget ----------
// ---------- FHA delinquency (HUD) ----------
// HUD's monthly "FHA Single Family Loan Performance Trends" PDF, Table 1:
// 13 months of 30-, 60-, 90-day, foreclosure, bankruptcy and serious
// delinquency rates, not adjusted and seasonally adjusted. HUD names the file
// differently from month to month (FHALPT_AUG2026, FHALPT-JULY2026,
// FHALPT_Mar2026, older ones under /images/), so the address is guessed.
// Newer files win where months overlap (HUD revises).
const FHA_FROM = 2015 * 12;          // backfill to Jan 2015
const FHA_TRIES_PER_OPEN = 12;       // report months tried per open (each is up to ~36 quick guesses)
const FHA_RETRY_DAYS = 30;           // a month that wasn't found is retried after this long
const PDFJS = [
  ["https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js", "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js"],
  ["https://cdn.jsdelivr.net/npm/pdfjs-dist@2.16.105/build/pdf.min.js", "https://cdn.jsdelivr.net/npm/pdfjs-dist@2.16.105/build/pdf.worker.min.js"],
];
const MON3 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONF = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthName = (t) => `${MON3[t % 12]} ${Math.floor(t / 12)}`;
function hudUrls(t) {
  const y = Math.floor(t / 12), m = t % 12, out = [];
  // HUD's habits by era: older reports under /dfiles/Housing/images/ as FHALPT_Mar2024,
  // 2025 under /dfiles/Housing/documents/, 2026 under /default/files/ (often upper case)
  const D1 = "https://www.hud.gov/sites/default/files/Housing/documents/", D2 = "https://www.hud.gov/sites/dfiles/Housing/documents/", D3 = "https://www.hud.gov/sites/dfiles/Housing/images/";
  const dirs = y >= 2026 ? [D1, D2, D3] : y === 2025 ? [D2, D1, D3] : [D3, D2, D1];
  const up = [MON3[m].toUpperCase(), MONF[m].toUpperCase()], low = [MON3[m], MONF[m]];
  const names = (y >= 2026 ? up.concat(low) : low.concat(up)).concat(m === 8 ? ["Sept", "SEPT"] : []);
  for (const dir of dirs) for (const n of names) for (const sep of ["_", "-", ""]) out.push(`${dir}FHALPT${sep}${n}${y}.pdf`);
  return out;
}
async function hudFile(t) {
  let answered = 0;
  for (const url of hudUrls(t)) {
    try {
      const r = new Request(url); r.timeoutInterval = 15; r.headers = { "User-Agent": UA };
      const data = await r.load(), status = r.response && r.response.statusCode;
      answered++;
      if (status && status >= 400) continue;
      const b64 = data ? data.toBase64String() : "";
      if (b64.startsWith("JVBERi")) return { url, b64 };
    } catch (e) {}
  }
  // no answer at all means no connection, not a missing report
  if (!answered) throw new Error("couldn't reach hud.gov");
  return null;
}
// pdf.js in one hidden page, reused for every file; returns text lines per page
// (and, with wantFig, Figure 1's lines read back as numbers)
let PDF_WV = null;
async function pdfPages(b64, maxPages) { return (await pdfRead(b64, maxPages, false)).pages; }
async function pdfRead(b64, maxPages, wantFig) {
  if (!PDF_WV) {
    for (const [lib, worker] of PDFJS) {
      const wv = updWV(new WebView());
      // the worker script loads up front too, so pdf.js runs it in-page (no Web Worker needed)
      await wv.loadHTML(...updArgs(`<html><head><script src="${lib}"></script><script src="${worker}"></script></head><body></body></html>`));
      if (await wv.evaluateJavaScript("typeof pdfjsLib !== 'undefined'")) { await wv.evaluateJavaScript(`window.__w = ${JSON.stringify(worker)}; 0`); PDF_WV = wv; break; }
    }
    if (!PDF_WV) throw new Error("couldn't load the PDF reader");
  }
  await PDF_WV.evaluateJavaScript(`window.__b64 = "${b64}"; window.__max = ${maxPages || 5}; window.__fig = ${wantFig ? "true" : "false"}; 0`);
  const res = JSON.parse(await PDF_WV.evaluateJavaScript(`(function () {
  // Figure 1 (failure rate by fiscal-year cohort) is drawn as vector lines: read them back.
  // Each cohort is a stroked polyline starting at month 0, 0%; the axis labels give the
  // scale and the legend gives the years (oldest cohort = longest line).
  function hudFigure(pg) {
    var O = pdfjsLib.OPS;
    return Promise.all([pg.getOperatorList(), pg.getTextContent()]).then(function (r) {
      var ol = r[0], tc = r[1], ctm = [1, 0, 0, 1, 0, 0], stack = [], lines = [];
      function mul(m, n) { return [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]]; }
      for (var i = 0; i < ol.fnArray.length; i++) {
        var f = ol.fnArray[i], a = ol.argsArray[i];
        if (f === O.save) stack.push(ctm.slice());
        else if (f === O.restore) ctm = stack.pop() || [1, 0, 0, 1, 0, 0];
        else if (f === O.transform) ctm = mul(ctm, a);
        else if (f === O.paintFormXObjectBegin && a && a[0]) { stack.push(ctm.slice()); ctm = mul(ctm, a[0]); }
        else if (f === O.paintFormXObjectEnd) ctm = stack.pop() || [1, 0, 0, 1, 0, 0];
        else if (f === O.constructPath && ol.fnArray[i + 1] === O.stroke) {
          var ops = a[0], args = a[1], pts = [], j = 0, ok = true;
          for (var k = 0; k < ops.length; k++) {
            var op = ops[k];
            if (op === O.moveTo || op === O.lineTo) { if (op === O.moveTo && pts.length) ok = false; pts.push([args[j], args[j + 1]]); j += 2; }
            else if (op === O.curveTo) { pts.push([args[j + 4], args[j + 5]]); j += 6; }
            else if (op === O.curveTo2 || op === O.curveTo3) { pts.push([args[j + 2], args[j + 3]]); j += 4; }
            else if (op === O.rectangle) { ok = false; j += 4; }
          }
          if (ok && pts.length >= 6) lines.push(pts.map(function (p) { return [ctm[0] * p[0] + ctm[2] * p[1] + ctm[4], ctm[1] * p[0] + ctm[3] * p[1] + ctm[5]]; }));
        }
      }
      // the axes: y labels 0..4 (%) down the left, x labels 0..160 (months) along the bottom
      var nums = tc.items.map(function (it) { return { s: it.str.trim(), x: it.transform[4] + (it.width || 0) / 2, y: it.transform[5] }; }).filter(function (t) { return /^[0-9]{1,3}$/.test(t.s); });
      function fit(pts) { // least squares: pos = a + b * value
        var n = pts.length, sx = 0, sy = 0, sxx = 0, sxy = 0;
        pts.forEach(function (p) { sx += p[0]; sy += p[1]; sxx += p[0] * p[0]; sxy += p[0] * p[1]; });
        var b = (n * sxy - sx * sy) / (n * sxx - sx * sx);
        return n >= 3 && isFinite(b) ? b : null;
      }
      var rowsY = {}; nums.forEach(function (t) { var k = Math.round(t.y); (rowsY[k] = rowsY[k] || []).push(t); });
      var xRow = Object.keys(rowsY).map(function (k) { return rowsY[k]; }).filter(function (r) { return r.length >= 6; }).sort(function (p, q) { return q.length - p.length; })[0] || [];
      var rest = nums.filter(function (t) { return xRow.indexOf(t) < 0; });
      var minX = Math.min.apply(null, rest.map(function (t) { return t.x; }));
      var yl = rest.filter(function (t) { return t.x < minX + 25 && +t.s <= 20; });
      var py = fit(yl.map(function (t) { return [+t.s, t.y]; })), px = fit(xRow.map(function (t) { return [+t.s, t.x]; }));
      var years = tc.items.map(function (it) { return it.str.trim(); }).filter(function (s) { return /^(19|20)[0-9]{2}$/.test(s); }).map(Number);
      years = years.filter(function (y, k) { return years.indexOf(y) === k; }).sort(function (p, q) { return p - q; });
      if (!py || !px || !lines.length) return { error: "couldn't find Figure 1's axes or lines" };
      lines.sort(function (p, q) { return q.length - p.length; });
      if (years.length !== lines.length) return { error: "Figure 1 has " + lines.length + " lines but " + years.length + " years in its legend" };
      var series = lines.map(function (pts, k) {
        var x0 = pts[0][0], y0 = pts[0][1], n = pts.length, step = (pts[n - 1][0] - x0) / Math.max(1, n - 1);
        // points one month apart (HUD's usual): the point's position is its month
        var monthly = Math.abs(step - px) < px * 0.1 && pts.every(function (p, i) { return Math.abs(p[0] - x0 - i * step) < step * 0.3; });
        return { fy: years[k], pts: pts.map(function (p, i) { return [monthly ? i : Math.round((p[0] - x0) / px), Math.round((p[1] - y0) / py * 1000) / 1000]; }) };
      });
      return { series: series };
    });
  }
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
            if (++done === n) {
              var fp = -1;
              if (window.__fig) for (var q = 0; q < pages.length; q++) { var all = (pages[q] || []).join(" "); if (all.indexOf("Months Since Origination") >= 0 && all.indexOf("Failure Rate") >= 0) fp = q; }
              if (fp < 0) { doc.destroy(); completion(JSON.stringify({ pages: pages, fig: window.__fig ? { error: "no Figure 1 page" } : null })); return; }
              doc.getPage(fp + 1).then(hudFigure).then(function (fig) { doc.destroy(); completion(JSON.stringify({ pages: pages, fig: fig })); })
                .catch(function (e) { doc.destroy(); completion(JSON.stringify({ pages: pages, fig: { error: String(e && e.message || e) } })); });
            }
          }).catch(function (e) { completion(JSON.stringify({ error: "page " + p + ": " + e })); });
        })(p);
      }).catch(function (e) { completion(JSON.stringify({ error: String(e && e.message || e) })); });
    } catch (e) { completion(JSON.stringify({ error: String(e && e.message || e) })); }
  })()`, true));
  if (res.error) throw new Error(res.error);
  return res;
}
// Table 1 rows: "Aug 2025 8,120,561 5.97 2.10 3.53 0.43 0.48 4.44" or
// "Sep 8,150,049 5.94 ..." (the year carries over). Returns { t: { n: [...], s: [...] } }
// with [30-day, 60-day, serious] for the not-adjusted (n) and adjusted (s) panels.
function parseHud(pages) {
  const out = {}, row = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*(\d{4})?\s+(\d{1,3}(?:,\d{3})+)\s+((?:\d+\.\d+\s*){5,6})$/;
  let panel = null, year = null, lastM = null, rows = 0;
  for (const lines of pages) {
    for (const l of lines) {
      if (rows && /^Table\s*2\b/i.test(l)) return out;
      if (/seasonally adjusted/i.test(l)) { panel = /non/i.test(l) ? "n" : "s"; year = null; lastM = null; continue; }
      const m = l.match(row);
      if (!m || !panel) continue;
      const mi = MON3.indexOf(m[1]);
      if (m[2]) year = +m[2]; else if (year != null && lastM != null && mi <= lastM) year++;
      if (year == null) continue;
      lastM = mi;
      const v = m[4].trim().split(/\s+/).map(Number);
      // serious = 90-day + foreclosure + bankruptcy; skip rows that don't add up
      if (v.length === 6 && Math.abs(v[2] + v[3] + v[4] - v[5]) > 0.06) continue;
      const t = year * 12 + mi;
      (out[t] = out[t] || {})[panel] = [v[0], v[1], v[v.length - 1]];
      rows++;
    }
  }
  return out;
}
// Table 2 rows: "2025 Q3 160,718 26.74 13.49 19.95 13.61 2.51 8.85 3.89 10.96" (fiscal quarters),
// plus the current quarter's months: "2025 Q4 - Aug 67,781 26.61 ...". Returns rows
// { k, fy, q, mon, n, sh: [income, unemployed, obligations, illness, marital, noContact, emergency, other] }.
const T2_REASONS = ["Reduction of income", "Unemployed", "Excessive obligations", "Death or illness", "Marital difficulties", "No contact", "National emergency", "Other"];
function parseHudT2(pages) {
  const out = [], row = /^(\d{4})\s*Q([1-4])(?:\s*-\s*([A-Za-z]{3})[a-z]*)?\s+(\d{1,3}(?:,\d{3})*)\s+((?:\d+\.\d+\s*){8})$/;
  let on = false;
  for (const lines of pages) for (const l of lines) {
    if (/^Table\s*2\.\s*New 90/i.test(l)) { on = true; continue; }
    if (on && /^Table\s*3\./i.test(l)) { if (out.length) return out; on = false; continue; } // the contents page lists the tables too
    if (!on) continue;
    const m = l.match(row);
    if (!m) continue;
    const sh = m[5].trim().split(/\s+/).map(Number), sum = sh.reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 100) > 1.5) continue; // shares should add to 100
    const fy = +m[1], q = +m[2], mon = m[3] ? MON3.indexOf(m[3][0].toUpperCase() + m[3].slice(1, 3).toLowerCase()) : null;
    out.push({ k: `${fy}Q${q}${mon != null ? "-" + mon : ""}`, fy, q, mon, n: +m[4].replace(/,/g, ""), sh });
  }
  return out;
}
// Table 3: serious delinquency (and the other rates) by loan and property characteristics.
// Rows "Purchase 72.83 13.89 6.55 2.36 4.02 0.47 0.49 4.98": label, IIF share (or a loan
// count on the panel's total row), all past due, 30, 60, 90+, foreclosure, bankruptcy, serious.
const T3_PANELS = [
  ["purpose", /^Loan Purpose$/i], ["refi", /^Refinance$/i], ["score", /^Credit Score Range$/i], ["cohort", /^Fiscal Year Cohort$/i],
  ["amount", /^Loan Amount at Origination/i], ["property", /^Property Type$/i], ["firstTime", /^Purchase Loan Type$/i], ["dpa", /^Down Payment Assistance/i],
];
function parseHudT3(pages) {
  const out = {}, row = /^(.+?)\s+(\d{1,3}(?:,\d{3})+|\d+\.\d+)\s+((?:-?\d+\.\d+\s*){7})$/;
  let on = false, panel = null, parent = null;
  for (const lines of pages) for (const l of lines) {
    if (/^Table\s*3\.\s*Delinquency Rates by Loan/i.test(l)) { on = true; continue; }
    if (on && (/^Table\s*4\./i.test(l) || /^IIF = insurance in force/i.test(l))) { on = false; continue; }
    if (!on) continue;
    const head = T3_PANELS.find(([, re]) => re.test(l.trim()));
    if (head) { panel = head[0]; parent = null; out[panel] = out[panel] || { rows: [] }; continue; }
    const m = l.match(row);
    if (!m || !panel) continue;
    const v = m[3].trim().split(/\s+/).map(Number), label = m[1].trim();
    // serious = 90+ + foreclosure + bankruptcy; a row that doesn't add up was misread
    if (Math.abs(v[3] + v[4] + v[5] - v[6]) > 0.06) continue;
    const r = { label, past: v[0], d30: v[1], d60: v[2], d90: v[3], fc: v[4], bk: v[5], sdq: v[6] };
    if (/,/.test(m[2])) { out[panel].total = { ...r, count: +m[2].replace(/,/g, "") }; continue; }
    r.share = +m[2];
    if (panel === "refi") {
      if (/^(Conventional|FHA|Streamline)$/i.test(label)) parent = label;
      else if (parent) r.label = `${parent} ${label.toLowerCase()}`;
    }
    out[panel].rows.push(r);
  }
  return Object.keys(out).length ? out : null;
}
const HUD_XV = 1; // bump to re-read the newest reports when the readers change
const nowMonth = () => { const d = new Date(); return d.getFullYear() * 12 + d.getMonth(); };
// read one month's report into f; true if found
async function readHudMonth(f, t) {
  const got = await hudFile(t);
  f.tried[t] = new Date().toISOString();
  if (!got) return false;
  await readHudReport(f, t, got);
  return true;
}
function newestHud(f) { const ts = Object.keys(f.files || {}).map(Number); return ts.length ? Math.max(...ts) : -1; }
async function readHudReport(f, t, got) {
  const want = t >= newestHud(f); // the newest report also gives Table 2 and Figure 1
  const r = await pdfRead(got.b64, want ? 14 : 8, want);
  const rows = parseHud(r.pages);
  const ks = Object.keys(rows);
  if (!ks.length) throw new Error(`couldn't find Table 1 in the ${monthName(t)} report`);
  ks.forEach((k) => { if (!(f.src[k] > t)) { f.pts[k] = rows[k]; f.src[k] = t; } });
  f.files[t] = got.url;
  // Table 3 from every report read (the newest two years are kept)
  const t3 = parseHudT3(r.pages);
  f.t3 = f.t3 || {};
  if (t3) f.t3[t] = t3;
  Object.keys(f.t3).map(Number).sort((a, b) => b - a).slice(26).forEach((k) => delete f.t3[k]);
  if (want) {
    const t2 = parseHudT2(r.pages);
    if (t2.length) { f.t2 = t2; f.t2At = t; }
    f.t2Err = t2.length ? null : `couldn't find Table 2 in the ${monthName(t)} report`;
    if (r.fig && r.fig.series) { f.fig = { t, series: r.fig.series }; f.figErr = null; }
    else f.figErr = `Figure 1 in the ${monthName(t)} report: ${(r.fig && r.fig.error) || "not read"}`;
    if (!t3) f.t3Err = `couldn't find Table 3 in the ${monthName(t)} report`; else f.t3Err = null;
    f.xv = HUD_XV;
  }
}
// re-read a report already found (its address is known)
async function rereadHud(f, t) {
  const r = new Request(f.files[t]); r.timeoutInterval = 30; r.headers = { "User-Agent": UA };
  const data = await r.load();
  const b64 = data ? data.toBase64String() : "";
  if (!b64.startsWith("JVBERi")) throw new Error(`HUD's ${monthName(t)} report didn't download`);
  await readHudReport(f, t, { url: f.files[t], b64 });
}
// HUD's newest report, saved once and opened in the app (Quick Look), not Safari
async function openHudPdf(s) {
  const f = s && s.fha, ts = f ? Object.keys(f.files).map(Number) : [];
  if (!ts.length) throw new Error("No HUD report has been read yet");
  const t = Math.max(...ts), fm = FileManager.local(), path = docPath(`hud-fha-${t}.pdf`);
  if (!fm.fileExists(path)) {
    const r = new Request(f.files[t]); r.timeoutInterval = 30; r.headers = { "User-Agent": UA };
    const data = await r.load();
    if (!data || !data.toBase64String().startsWith("JVBERi")) throw new Error("HUD's site didn't return the PDF");
    fm.write(path, data);
    // keep only the newest
    try { fm.listContents(fm.documentsDirectory()).filter((n) => /^hud-fha-\d+\.pdf$/.test(n) && n !== `hud-fha-${t}.pdf`).forEach((n) => fm.remove(docPath(n))); } catch (e) {}
  }
  await QuickLook.present(path, true);
}
async function refreshFha(saved, say, keepGoing) {
  say = say || (async () => {});
  keepGoing = keepGoing || (() => true);
  const s = saved ? JSON.parse(JSON.stringify(saved)) : {};
  const f = s.fha || { pts: {}, src: {}, files: {}, tried: {}, floor: null };
  if (f.floor != null && hoursSince(f.floorAt) > 180 * 24) f.floor = null; // look further back again twice a year
  const fresh = (t) => f.tried[t] && hoursSince(f.tried[t]) < FHA_RETRY_DAYS * 24;
  const errs = [];
  let tries = 0;
  try {
    // 1) the newest report: HUD posts a month's report about 6 to 8 weeks after it ends
    const filesT = Object.keys(f.files).map(Number), newest = filesT.length ? Math.max(...filesT) : -1;
    if (!f.checked || hoursSince(f.checked) >= CHECK_HOURS) {
      for (let t = nowMonth() - 1; t > newest && t >= nowMonth() - 5; t--) {
        await say(`Looking for HUD's ${monthName(t)} FHA report...`);
        tries++;
        if (await readHudMonth(f, t)) break;
      }
      f.checked = new Date().toISOString();
    }
    // 1b) Tables 2-3 and Figure 1: the newest report, and Table 3 from a year earlier (for comparison)
    const nt = newestHud(f);
    if (nt >= 0 && (f.xv !== HUD_XV || !f.t3 || !f.t3[nt] || !f.t2 || (!f.fig && !f.figErr))) {
      await say(`Reading HUD's ${monthName(nt)} report in full...`);
      try { await rereadHud(f, nt); f.xv = HUD_XV; } catch (e) { errs.push("HUD report tables: " + (e.message || e)); }
    }
    const ya = [nt - 12, nt - 11, nt - 13].find((k) => f.files[k]);
    if (nt >= 0 && !(f.t3 && [nt - 12, nt - 11, nt - 13].some((k) => f.t3[k]))) {
      try {
        if (ya != null) { await say(`Reading HUD's ${monthName(ya)} report for the year-ago comparison...`); await rereadHud(f, ya); }
        else if (!f.tried[nt - 12] || hoursSince(f.tried[nt - 12]) > FHA_RETRY_DAYS * 24) { await say(`Looking for HUD's ${monthName(nt - 12)} report for the year-ago comparison...`); tries++; await readHudMonth(f, nt - 12); }
      } catch (e) { errs.push("HUD year-ago report: " + (e.message || e)); }
    }
    // 2) backfill: the newest month with no data, read from a report that covers it
    // (each report holds 13 months). Stops after a year of nothing found.
    let misses = 0;
    for (let tm = Math.max(...Object.keys(f.files).map(Number), nowMonth() - 3); tm >= FHA_FROM && tries < FHA_TRIES_PER_OPEN && keepGoing(); tm--) {
      if (f.floor != null && tm <= f.floor) break;
      if (f.src[tm] != null) { misses = 0; continue; } // a report already covered this month
      let found = false;
      for (let ft = tm; ft <= tm + 12 && tries < FHA_TRIES_PER_OPEN; ft++) {
        if (f.files[ft] || fresh(ft) || ft >= nowMonth()) continue;
        await say(`Reading HUD's FHA reports back to ${Math.floor(FHA_FROM / 12)}: ${monthName(ft)}...`);
        tries++;
        if (await readHudMonth(f, ft)) { found = true; break; }
      }
      if (found) { misses = 0; continue; }
      if (++misses >= 12) { f.floor = tm; f.floorAt = new Date().toISOString(); break; }
    }
  } catch (e) { errs.push("HUD FHA report: " + (e.message || e)); }
  s.fha = f;
  s.fhaErrors = errs.length ? errs : null;
  writeJSON(FILE, s);
  return s;
}

// ---------- Conventional comparison: Fannie Mae and Freddie Mac ----------
// Each company's monthly report (PDF) gives its single-family serious delinquency
// rate (90+ days late or in foreclosure; not seasonally adjusted) for the last 13
// months in a table, and the newest month in its highlights. Read with pdf.js.
const GSE = {
  fnm: { name: "Fannie Mae", url: (t) => { const y = Math.floor(t / 12), m = t % 12, last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); return [`https://www.fanniemae.com/media/document/pdf/${String(m + 1).padStart(2, "0")}${last}${String(y).slice(2)}.pdf`]; },
    lead: /serious delinquency rate[^%]{0,160}?(\d+\.\d+)\s*%/i },
  fre: { name: "Freddie Mac", url: (t) => { const y = Math.floor(t / 12), m = t % 12; return [`https://www.freddiemac.com/investors/financials/pdf/${String(m + 1).padStart(2, "0")}${String(y).slice(2)}mvs.pdf`]; },
    lead: /single-family (?:serious )?delinquency rate[^%]{0,160}?(\d+\.\d+)\s*%/i },
};
const GSE_TRIES_PER_OPEN = 6; // reports tried per company per open
// rows like "July 2025 0.42% 1.12% 0.54% 0.53% 0.64%" or "Feb 0.41% 1.25% ...";
// the column is the one whose newest value matches the highlights (else the 4th)
function parseGse(pages, t, lead) {
  const all = pages.flat(), text = all.join(" ");
  const lm = text.match(lead), want = lm ? +lm[1] : null;
  const row = new RegExp(`^(${MON3.join("|")})[a-z]*\\.?\\s*(\\d{4})?\\s+((?:\\d+\\.\\d+%?\\s*){3,8})$`);
  // runs of consecutive month rows: each run is one table
  const runs = [];
  let cur = null;
  for (const l of all) {
    const m = l.match(row);
    if (!m) { if (cur && cur.length) runs.push(cur); cur = null; continue; }
    (cur = cur || []).push({ mi: MON3.indexOf(m[1]), y: m[2] ? +m[2] : null, v: m[3].trim().split(/\s+/).map((x) => +x.replace("%", "")) });
  }
  if (cur && cur.length) runs.push(cur);
  for (const run of runs.filter((r) => r.length >= 6)) {
    // years: given, or worked back from the report's month (the newest row)
    const asc = run.length > 1 && ((run[1].mi - run[0].mi + 12) % 12) === 1;
    const ordered = asc ? run.slice() : run.slice().reverse();
    let y = Math.floor(t / 12), prev = null;
    for (let i = ordered.length - 1; i >= 0; i--) {
      const r = ordered[i];
      if (r.y) y = r.y; else if (prev != null && r.mi > prev) y--;
      r.t = y * 12 + r.mi; prev = r.mi;
    }
    const newest = ordered[ordered.length - 1];
    if (newest.t !== t) continue;
    const n = Math.min(...ordered.map((r) => r.v.length));
    let col = -1;
    if (want != null) col = newest.v.findIndex((v, k) => k < n && Math.abs(v - want) < 0.005);
    if (col < 0 && want == null && n >= 4) col = 3;
    if (col < 0) continue;
    const out = {};
    ordered.forEach((r) => { if (r.v[col] != null && r.v[col] < 20) out[r.t] = r.v[col]; });
    return out;
  }
  // no table: the newest month from the highlights alone
  if (want != null) { const o = {}; o[t] = want; return o; }
  return null;
}
async function gseFile(k, t) {
  let answered = 0;
  for (const url of GSE[k].url(t)) {
    try {
      const r = new Request(url); r.timeoutInterval = 20; r.headers = { "User-Agent": UA };
      const data = await r.load(), status = r.response && r.response.statusCode;
      answered++;
      if (status && status >= 400) continue;
      const b64 = data ? data.toBase64String() : "";
      if (b64.startsWith("JVBERi")) return { url, b64 };
    } catch (e) {}
  }
  if (!answered) throw new Error(`couldn't reach ${GSE[k].name}`);
  return null;
}
async function readGse(g, k, t) {
  g.tried[t] = new Date().toISOString();
  const got = await gseFile(k, t);
  if (!got) return false;
  const rows = parseGse(await pdfPages(got.b64, 30), t, GSE[k].lead);
  if (!rows || !Object.keys(rows).length) throw new Error(`couldn't find the serious delinquency rate in ${GSE[k].name}'s ${monthName(t)} report`);
  Object.keys(rows).forEach((m) => { if (!(g.src[m] > t)) { g.pts[m] = rows[m]; g.src[m] = t; } });
  g.files[t] = got.url;
  return true;
}
async function refreshGse(saved, say, keepGoing) {
  say = say || (async () => {});
  keepGoing = keepGoing || (() => true);
  const s = saved ? JSON.parse(JSON.stringify(saved)) : {};
  s.gse = s.gse || {};
  const errs = [];
  for (const k of Object.keys(GSE)) {
    const g = s.gse[k] = s.gse[k] || { pts: {}, src: {}, files: {}, tried: {}, floor: null };
    const fresh = (t) => g.tried[t] && hoursSince(g.tried[t]) < FHA_RETRY_DAYS * 24;
    let tries = 0;
    try {
      // newest: last month's report comes out three to five weeks after the month ends
      const files = Object.keys(g.files).map(Number), newest = files.length ? Math.max(...files) : -1;
      if (!g.checked || hoursSince(g.checked) >= CHECK_HOURS) {
        for (let t = nowMonth() - 1; t > newest && t >= nowMonth() - 4 && keepGoing(); t--) {
          await say(`Looking for ${GSE[k].name}'s ${monthName(t)} report...`);
          tries++;
          if (await readGse(g, k, t)) break;
        }
        g.checked = new Date().toISOString();
      }
      // back to 2015: one report covers 13 months, so step back a year at a time
      if (g.floor != null && hoursSince(g.floorAt) > 180 * 24) g.floor = null; // look further back again twice a year
      for (let loop = 0; loop < 12 && tries < GSE_TRIES_PER_OPEN && keepGoing(); loop++) {
        const have = Object.keys(g.pts).map(Number);
        const oldest = have.length ? Math.min(...have) : nowMonth();
        if (oldest <= FHA_FROM || (g.floor != null && oldest - 1 <= g.floor)) break;
        let found = false, triedAny = false;
        for (let t = oldest - 1; t >= oldest - 3 && tries < GSE_TRIES_PER_OPEN; t--) {
          if (g.files[t] || fresh(t)) continue;
          await say(`Reading ${GSE[k].name}'s reports back to ${Math.floor(FHA_FROM / 12)}: ${monthName(t)}...`);
          tries++; triedAny = true;
          if (await readGse(g, k, t)) { found = true; break; }
        }
        if (found) continue;
        if (triedAny) { g.floor = oldest - 1; g.floorAt = new Date().toISOString(); } // nothing older on their site under these names
        break;
      }
      g.err = null;
    } catch (e) { g.err = String(e.message || e); errs.push(`${GSE[k].name}: ${g.err}`); }
  }
  s.gseErrors = errs.length ? errs : null;
  writeJSON(FILE, s);
  return s;
}

function drawText(ctx, str, rect, font, hex, align) {
  ctx.setFont(font); ctx.setTextColor(new Color(hex));
  if (align === "right") ctx.setTextAlignedRight(); else if (align === "center") ctx.setTextAlignedCenter(); else ctx.setTextAlignedLeft();
  ctx.drawTextInRect(str, rect);
}
const qName = (t) => `Q${Math.floor((t % 12) / 3) + 1} ${Math.floor(t / 12)}`;
// The face: balances newly 90+ days late (% of balances, annualized) since 2003,
// for mortgages, auto loans and credit cards
function smallImage(s) {
  const W = 170, ctx = new DrawContext();
  ctx.size = new Size(W, W); ctx.opaque = true; ctx.respectScreenScale = true;
  for (let i = 0; i < 34; i++) {
    const f = i / 33, c = [0x2c, 0x2c, 0x2e].map((v, j) => Math.round(v + ([0x1c, 0x1c, 0x1e][j] - v) * f).toString(16).padStart(2, "0")).join("");
    ctx.setFillColor(new Color("#" + c)); ctx.fillRect(new Rect(0, (W * i) / 34, W, W / 34 + 1));
  }
  drawText(ctx, TITLE, new Rect(14, 10, 142, 17), Font.boldSystemFont(13), "#FFFFFF", "left");
  const del = (s && s.hh && s.hh.del) || {}, P = del.mortgage || [];
  const LINES = [[del.card, "#BF5AF2", "Card"], [del.auto, "#64D2FF", "Auto"], [P, "#FF9F0A", "Mortgage"]].filter((l) => l[0] && l[0].length > 3);
  if (P.length < 4) { drawText(ctx, "Open the script once to load the NY Fed data", new Rect(14, 60, 142, 40), Font.systemFont(11), GRAY, "left"); return ctx.getImage(); }
  const last = P[P.length - 1];
  drawText(ctx, `New 90+ delinquency · ${qName(last.t)}`, new Rect(14, 27, 142, 13), Font.mediumSystemFont(9.5), GRAY, "left");
  const L = 14, R = 122, T = 46, B = 132, a = P[0].t, b = last.t, hi = Math.max(...LINES.map((l) => Math.max(...l[0].map((p) => p.v)))) * 1.06;
  const X = (t) => L + ((t - a) / Math.max(1, b - a)) * (R - L), Y = (v) => B - (v / hi) * (B - T);
  ctx.setFillColor(new Color("#3A3A3C")); ctx.fillRect(new Rect(L, B, R - L, 0.8));
  RECESSIONS.forEach(([f, t]) => {
    const x0 = Math.max(a, +f.slice(0, 4) * 12 + +f.slice(5, 7) - 1), x1 = Math.min(b, +t.slice(0, 4) * 12 + +t.slice(5, 7) - 1);
    if (x1 > x0) { ctx.setFillColor(new Color("#FFFFFF", 0.07)); ctx.fillRect(new Rect(X(x0), T, X(x1) - X(x0), B - T)); }
  });
  // mortgage drawn last so it sits on top; latest values at the right edge, nudged apart
  const labs = [];
  LINES.forEach(([pts, col]) => {
    const p = new Path(); p.addLines(pts.map((q) => new Point(X(q.t), Y(q.v))));
    ctx.addPath(p); ctx.setStrokeColor(new Color(col)); ctx.setLineWidth(col === "#FF9F0A" ? 2 : 1.4); ctx.strokePath();
    const e = pts[pts.length - 1];
    ctx.setFillColor(new Color(col)); ctx.fillEllipse(new Rect(X(e.t) - 2.5, Y(e.v) - 2.5, 5, 5));
    labs.push({ y: Y(e.v), t: `${e.v.toFixed(1)}%`, c: col });
  });
  labs.sort((u, v) => u.y - v.y);
  for (let k = 1; k < labs.length; k++) if (labs[k].y - labs[k - 1].y < 13) labs[k].y = labs[k - 1].y + 13;
  const over = labs.length ? labs[labs.length - 1].y - (B - 4) : 0;
  if (over > 0) labs.forEach((l) => (l.y -= over));
  labs.forEach((l) => drawText(ctx, l.t, new Rect(R + 4, l.y - 7.5, 46, 14), Font.boldSystemFont(11), l.c, "left"));
  drawText(ctx, String(Math.floor(a / 12)), new Rect(L - 2, B + 3, 40, 11), Font.mediumSystemFont(8.5), GRAY, "left");
  drawText(ctx, String(Math.floor(b / 12)), new Rect(R - 40, B + 3, 42, 11), Font.mediumSystemFont(8.5), GRAY, "right");
  // a color key in place of a caption
  let kx = 14;
  [...LINES].reverse().forEach(([, col, name]) => { drawText(ctx, "● " + name, new Rect(kx, 151, 60, 11), Font.semiboldSystemFont(8.5), col, "left"); kx += name.length * 5.2 + 18; });
  return ctx.getImage();
}
function errorWidget(msg) {
  const w = new ListWidget();
  const g = new LinearGradient(); g.colors = [new Color("#2C2C2E"), new Color("#1C1C1E")]; g.locations = [0, 1];
  w.backgroundGradient = g;
  const t = w.addText(TITLE); t.font = Font.semiboldSystemFont(12); t.textColor = new Color("#FFFFFF");
  w.addSpacer(4);
  const m = w.addText(String(msg)); m.font = Font.systemFont(10); m.textColor = new Color(GRAY);
  w.addSpacer(); w.url = URLScheme.forRunningScript();
  return w;
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
function schedSpfNext(lastQi) { const q = lastQi + 1, y = Math.floor(q / 4), m0 = (q % 4) * 3 + 1; return schedDay(y, m0, 15); }
// This widget's sources (all estimated; none is on FRED's calendar). Month
// indexes are year x 12 + month (0-11).
function bcSchedule(s) {
  const rows = [], mi = (t) => `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
  const lastT = (arr) => (arr && arr.length ? arr[arr.length - 1].t : null);
  const hq = s.hh && s.hh.q; // "2026q3"
  if (hq) { const y = +hq.slice(0, 4), q = +hq.slice(5), endNext = y * 12 + q * 3 + 2 /* next quarter's last month */, rel = endNext + 2; rows.push(schedEst("NY Fed household debt report", `Q${q} ${y}`, [schedDay(Math.floor(rel / 12), rel % 12, 3), schedDay(Math.floor(rel / 12), rel % 12, 14)], "quarterly, about 5-6 weeks after quarter-end", { checked: s.hhChecked, err: (s.errors || []).filter((e) => /Household/.test(e)).join("; "), cadence: "checks daily" })); }
  const w = lastT(s.sce && s.sce.waves);
  if (w != null) { const rel = w + 5; rows.push(schedEst("NY Fed credit access survey", schedMonName(mi(w)) + " wave", [schedDay(Math.floor(rel / 12), rel % 12, 1), schedDay(Math.floor((rel + 1) / 12), (rel + 1) % 12, 20)], "every 4 months (Feb, Jun, Oct waves)", { checked: s.sceChecked, err: (s.errors || []).filter((e) => /Credit Access/.test(e)).join("; "), cadence: "checks weekly" })); }
  const ft = s.fha && s.fha.pts ? Math.max(...Object.keys(s.fha.pts).map(Number)) : null;
  ["fnm", "fre"].forEach((k) => {
    const g = s.gse && s.gse[k], ts = g ? Object.keys(g.pts || {}).map(Number) : [];
    if (!ts.length) return;
    const lt = Math.max(...ts), nm = lt + 1, end = schedIso(new Date(Date.UTC(Math.floor(nm / 12), (nm % 12) + 1, 0)));
    rows.push(schedEst(`${GSE[k].name} delinquency`, schedMonName(mi(lt)), [schedPlus(end, 18), schedPlus(end, 32)], "monthly report, about 3-4 weeks after month-end", { checked: g.checked, err: g.err || "", cadence: "checks daily" }));
  });
  if (ft != null && isFinite(ft)) { const nm = ft + 1, end = new Date(Date.UTC(Math.floor(nm / 12), (nm % 12) + 1, 0)); const e0 = schedIso(end); rows.push(schedEst("HUD FHA loan performance", schedMonName(mi(ft)), [schedPlus(e0, 40), schedPlus(e0, 65)], "monthly, about 6-9 weeks after month-end", { checked: s.fha && s.fha.checked, err: (s.fhaErrors || []).join("; "), cadence: "checks daily" })); }
  return rows;
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

// ---------- Full screen ----------
// The page script avoids backticks, backslashes and dollar-brace on purpose,
// because the whole page lives inside a template literal.
const PAGE_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<title>Borrower Credit</title>
<script>
window.onerror = function (m, src, line) { var e = document.getElementById("errs"); if (e) e.textContent = "Page error: " + m + " (line " + line + ")"; };
</script>
<style>
  :root { --bg:#1C1C1E; --fg:#FFFFFF; --gray:#98989F; }
  * { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  body { margin:0; padding:20px 16px 36px; background:var(--bg); color:var(--fg);
         font-family:-apple-system,system-ui,sans-serif; -webkit-user-select:none; user-select:none; }
  .ticker { font-size:26px; font-weight:800; letter-spacing:-0.3px; }
  .hint { color:var(--gray); font-size:12px; margin-top:4px; line-height:1.4; }
  .sec { border-top:1px solid #2C2C2E; margin-top:16px; padding-top:12px; }
  .st { display:flex; justify-content:space-between; align-items:baseline; gap:8px; }
  .st b { font-size:17px; }
  .val { font-size:13.5px; font-weight:700; text-align:right; font-variant-numeric:tabular-nums; }
  .legend { display:flex; flex-wrap:wrap; gap:6px; margin:8px 0 4px; align-items:center; }
  .chip { border-radius:10px; padding:5px 8px; background:#2C2C2E; font-size:12px; font-weight:700; line-height:1.25; }
  .chip.tog { cursor:pointer; }
  .chip.off { opacity:0.35; }
  .seg { display:inline-flex; background:#2C2C2E; border-radius:8px; padding:2px; }
  .seg div { padding:4px 10px; border-radius:6px; font-size:12px; font-weight:700; color:var(--gray); cursor:pointer; }
  .seg div.on { background:#636366; color:#FFFFFF; }
  .wrap { position:relative; }
  .touch { position:absolute; left:0; top:0; right:0; bottom:0; touch-action:pan-y; }
  svg { display:block; width:100%; }
  .ds { color:var(--gray); font-size:11px; line-height:1.45; margin-top:4px; }
  .subh { color:#C7C7CC; font-size:12.5px; font-weight:700; margin:12px 0 2px; }
  .note { color:var(--gray); font-size:10.5px; line-height:1.45; margin-top:24px; }
  .warn { color:#FF9F0A; }
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
  .lnk { color:#64A8FF; text-decoration:underline; cursor:pointer; }
  .hl { font-size:14px; font-weight:600; color:#E5E5EA; margin:6px 0 4px; line-height:1.35; }
  .chip.hpick, .chip.hfy { cursor:pointer; }
  .chip.hpick.sel { background:#636366; color:#FFFFFF; }
  .touch2 { position:absolute; left:0; top:0; right:0; bottom:0; touch-action:pan-y; }
  #hbs { height:200px; }
</style>
</head>
<body>
<div class="ticker">Borrower Credit</div>
<div class="hint">Delinquency and rejections · New York Fed and HUD</div>
<div id="sched" style="display:none"></div>
<div class="hint" id="win"></div>
<div class="hint warn" id="errs"></div>
<div id="charts"></div>
<div class="hint" style="margin-top:14px">Pinch any chart to zoom · tap to read a date on all of them · tap a chip to hide a line · double-tap to reset</div>
<div class="note" id="note"></div>
__SHARE__
<script>
var D = __DATA__;
function el(id) { return document.getElementById(id); }
function esc(s) { return String(s).split("&").join("&amp;").split("<").join("&lt;").split(">").join("&gt;"); }
var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function qName(t) { return "Q" + (Math.floor((((t % 12) + 12) % 12) / 3) + 1) + " " + Math.floor(t / 12); }
function mName(t) { return MON[((t % 12) + 12) % 12] + " " + Math.floor(t / 12); }
function nice(range, n) { if (!(range > 0)) return 1; var rough = range / (n || 4), p = Math.pow(10, Math.floor(Math.log(rough) / Math.LN10)), c = [1, 2, 2.5, 5, 10]; for (var i = 0; i < c.length; i++) if (c[i] * p >= rough) return c[i] * p; return 10 * p; }
var BANDS = ["<620", "620-659", "660-719", "720-759", "760+"], BCOL = ["#FF453A", "#FF9F0A", "#FFD60A", "#64D2FF", "#30D158"];
var hidden = { "0:heloc": 1, "0:student": 1, "5:d60": 1 }, HV = null, cur = null, origMode = "share";
// The charts. Lines: [key, label, color, style] (style 2 = dashed)
var CH = [
  { id: "del", kind: "lines", h: 210, title: "Going seriously delinquent", fmt: "pct1",
    ds: "Share of each loan type's balances that became 90+ days late in the past year (four-quarter sum). Gray columns are recessions.",
    lines: [["mortgage", "Mortgage", "#FF9F0A"], ["auto", "Auto", "#64D2FF"], ["card", "Card", "#BF5AF2"], ["heloc", "HELOC", "#FFD60A"], ["student", "Student", "#30D5C8"]] },
  { id: "late", kind: "lines", h: 200, title: "Where late mortgages go", fmt: "pct0",
    ds: "Of mortgages 30-60 days late at the start of each quarter: the share caught up (current) by the end, and the share that fell to 90+ days late.",
    lines: [["cure", "Back to current", "#30D158"], ["roll", "Rolled to 90+", "#FF453A"]] },
  { id: "orig", kind: "orig", h: 220, title: "Who's getting mortgages",
    ds: "New mortgage dollars each quarter by the borrower's credit score at origination." },
  { id: "med", kind: "lines", h: 130, title: "", sub: "Credit score of new mortgages", fmt: "int",
    ds: "Median credit score of new mortgages; the 25th and 10th percentiles show the lower end.",
    lines: [["med", "Median", "#FFFFFF"], ["p25", "25th pct.", "#8E8E93", 2], ["p10", "10th pct.", "#636366", 2]] },
  { id: "rej", kind: "lines", h: 200, title: "Applications rejected", fmt: "pct0", dots: true,
    ds: "NY Fed Survey of Consumer Expectations, Credit Access (Feb, Jun, Oct): share of applicants rejected, and share of people who didn't apply because they expected a no.",
    lines: [["mrej", "Mortgage", "#FF9F0A"], ["rrej", "Refi", "#BF5AF2"], ["rej", "Any credit", "#64A8FF"], ["disc", "Discouraged", "#98989F", 2]] },
  { id: "fha", kind: "lines", h: 200, title: "FHA delinquency", fmt: "pct1",
    ds: "Share of active FHA single-family loans, seasonally adjusted (HUD, monthly). Serious: 90+ days late, in foreclosure or in bankruptcy. 30-day and 60-day: earlier stages. For comparison, conventional loans: Fannie Mae's and Freddie Mac's single-family serious delinquency (90+ days late or in foreclosure; not seasonally adjusted, and bankruptcies aren't counted separately), from their monthly reports.",
    lines: [["sdq", "FHA serious", "#FF453A"], ["d30", "FHA 30-day", "#FFD60A"], ["d60", "FHA 60-day", "#FF9F0A"], ["fnm", "Fannie Mae (conv.)", "#64D2FF"], ["fre", "Freddie Mac (conv.)", "#30D158"]] },
];
// on screen, FHA sits right under "Going seriously delinquent"
var ORDER = [0, 5, 1, 4], FHA_MSG = "";
function series(ci, k) {
  var c = CH[ci];
  if (c.id === "del") return (D.del && D.del[k]) || [];
  if (c.id === "late") return D[k] || [];
  if (c.id === "med") return (D.med || []).map(function (p) { return { t: p.t, v: k === "med" ? p.v : p[k] }; }).filter(function (p) { return p.v != null; });
  if (c.id === "fha" && (k === "fnm" || k === "fre")) return (D.gse && D.gse[k]) || [];
  if (c.id === "fha") return (D.fha || []).filter(function (p) { return p[k] != null; }).map(function (p) { return { t: p.t, v: p[k] }; });
  if (c.id === "rej") return (D.waves || []).filter(function (p) { return p[k] != null; }).map(function (p) { return { t: p.t, v: p[k] }; });
  return [];
}
// lines that have data (the survey's mortgage columns may be missing; then "any credit" shows)
function specs(ci) {
  var c = CH[ci];
  return (c.lines || []).filter(function (ln) {
    if (c.id === "rej" && ln[0] === "rej" && series(ci, "mrej").length) return false;
    return series(ci, ln[0]).length > 0;
  });
}
function span() {
  var a = Infinity, b = -Infinity;
  ORDER.forEach(function (ci) { specs(ci).forEach(function (ln) { series(ci, ln[0]).forEach(function (p) { a = Math.min(a, p.t); b = Math.max(b, p.t); }); }); });
  return { a: a - 1, b: b + 1 };
}
var MIN_SPAN = 12;
function clampView(v) {
  var S = span(), w = Math.max(MIN_SPAN, Math.min(S.b - S.a, v.b - v.a));
  var a = Math.max(S.a, Math.min(S.b - w, v.a));
  return { a: a, b: a + w };
}
function valAt(pts, t, gap) { var v = null; for (var i = 0; i < pts.length; i++) { if (pts[i].t <= t + 1.01) v = pts[i]; else break; } return v && t - v.t <= (gap || 3) ? v : null; }
function lastIn(pts) { var v = null; for (var i = 0; i < pts.length; i++) if (pts[i].t >= HV.a - 1.01 && pts[i].t <= HV.b + 1.01) v = pts[i]; return v; }
function readAt(ci, pts) { return cur == null ? lastIn(pts) : valAt(pts, cur, CH[ci].id === "rej" ? 4 : 3); }
function fmtv(f, v) { return f === "pct1" ? v.toFixed(1) + "%" : f === "pct0" ? Math.round(v) + "%" : String(Math.round(v)); }
function ticks(X, h) {
  var s = "", w = HV.b - HV.a;
  if (w > 30) {
    var step = w > 150 ? 5 : w > 72 ? 2 : 1;
    for (var y = Math.ceil(HV.a / 12), n = 0; y * 12 <= HV.b && n < 400; y++, n++) if (y % step === 0) s += '<text x="' + X(y * 12) + '" y="' + (h - 5) + '" font-size="9.5" fill="#8E8E93" text-anchor="middle">' + y + "</text>";
  } else {
    for (var t = Math.ceil(HV.a), n = 0; t <= HV.b && n < 400; t++, n++) if (((t % 12) + 12) % 12 % 3 === 0) s += '<text x="' + X(t) + '" y="' + (h - 5) + '" font-size="9.5" fill="#8E8E93" text-anchor="middle">' + MON[((t % 12) + 12) % 12] + " '" + String(Math.floor(t / 12)).slice(2) + "</text>";
  }
  return s;
}
function recs(X, T, B) {
  var s = "";
  (D.recessions || []).forEach(function (r) {
    var a = Math.max(HV.a, +r[0].slice(0, 4) * 12 + +r[0].slice(5, 7) - 1), b = Math.min(HV.b, +r[1].slice(0, 4) * 12 + +r[1].slice(5, 7) - 1);
    if (b > a) s += '<rect x="' + X(a).toFixed(1) + '" y="' + T + '" width="' + (X(b) - X(a)).toFixed(1) + '" height="' + (B - T) + '" fill="#FFFFFF" fill-opacity="0.07"/>';
  });
  return s;
}
function grid(Y, lo, hi, st, L, R, f) {
  var s = "";
  for (var v = lo, n = 0; v <= hi + 1e-9 && n < 40; v += st, n++) s += '<line x1="' + L + '" x2="' + R + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '" stroke="#3A3A3C" stroke-width="0.6"/><text x="' + (L - 4) + '" y="' + (Y(v) + 3.5).toFixed(1) + '" font-size="10" fill="#8E8E93" text-anchor="end">' + fmtv(f === "pct1" ? "pct0" : f, v) + "</text>";
  return s;
}
function rightLabels(items, R, T, B) {
  items.sort(function (a, b) { return a.y - b.y; });
  for (var k = 1; k < items.length; k++) if (items[k].y - items[k - 1].y < 13) items[k].y = items[k - 1].y + 13;
  var over = items.length ? items[items.length - 1].y - B : 0; if (over > 0) items.forEach(function (it) { it.y -= over; });
  return items.map(function (it) { return '<text x="' + (R + 5) + '" y="' + (it.y + 3.5).toFixed(1) + '" font-size="10.5" font-weight="700" fill="' + it.c + '">' + esc(it.t) + "</text>"; }).join("");
}
function cursorLine(X, T, B) { return cur == null || cur < HV.a || cur > HV.b ? "" : '<line x1="' + X(cur).toFixed(1) + '" x2="' + X(cur).toFixed(1) + '" y1="' + T + '" y2="' + B + '" stroke="#FFFFFF" stroke-opacity="0.6" stroke-dasharray="3 2"/>'; }

function build() {
  el("charts").innerHTML = ORDER.map(function (i) { var c = CH[i];
    var head = c.title ? '<div class="sec"><div class="st"><b>' + esc(c.title) + '</b><span class="val" id="v' + i + '"></span></div>' : '<div><div class="st"><span class="subh">' + esc(c.sub) + '</span><span class="val" id="v' + i + '"></span></div>';
    return head + '<div class="legend" id="g' + i + '"></div><div class="wrap"><svg id="s' + i + '" style="height:' + c.h + 'px"></svg><div class="touch" data-i="' + i + '"></div></div><div class="ds" id="u' + i + '">' + esc(c.ds) + "</div>" + (c.id === "fha" ? '<div class="ds" id="hudl"></div>' : "") + "</div>" + (c.id === "fha" ? buildHud() : "");
  }).join("");
  Array.prototype.forEach.call(document.querySelectorAll(".touch"), bindZoom);
  Array.prototype.forEach.call(document.querySelectorAll(".touch2"), bindHud);
}
// ---- a line chart
// FHA data starts in 2020: its chart shows the shared dates trimmed to its own data,
// so it isn't a sliver at the right edge (zoom in and it follows the other charts)
function drawLines(ci) {
  if (CH[ci].id !== "fha") return drawLines0(ci);
  var keep = HV, a = Infinity, b = -Infinity;
  specs(ci).forEach(function (ln) { series(ci, ln[0]).forEach(function (p) { a = Math.min(a, p.t - 1); b = Math.max(b, p.t + 1); }); });
  var a2 = Math.max(HV.a, a), b2 = Math.min(HV.b, b);
  if (b2 - a2 >= MIN_SPAN) HV = { a: a2, b: b2 };
  try { drawLines0(ci); } finally { HV = keep; }
}
function drawLines0(ci) {
  var c = CH[ci], svg = el("s" + ci), w = svg.clientWidth || 360, h = c.h, L = 36, R = w - 52, T = 8, B = h - 20;
  var sp = specs(ci), on = sp.filter(function (ln) { return !hidden[ci + ":" + ln[0]]; });
  el("g" + ci).innerHTML = sp.length > 1 ? sp.map(function (ln) { return '<span class="chip tog' + (hidden[ci + ":" + ln[0]] ? " off" : "") + '" data-c="' + ci + '" data-k="' + ln[0] + '" style="color:' + ln[2] + '">&#9679; ' + esc(ln[1]) + "</span>"; }).join("") : "";
  var vals = [];
  on.forEach(function (ln) { series(ci, ln[0]).forEach(function (p) { if (p.t >= HV.a - 1 && p.t <= HV.b + 1) vals.push(p.v); }); });
  if (!vals.length) { svg.innerHTML = '<text x="' + L + '" y="30" fill="#8E8E93" font-size="12">' + (sp.length ? "No data in these dates" : c.id === "fha" && FHA_MSG ? esc(FHA_MSG) : "Not loaded yet") + "</text>"; el("v" + ci).textContent = ""; svg.__g = { L: L, R: R, a: HV.a, b: HV.b }; return; }
  var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), pad = (hi - lo) * 0.1 || 1;
  if (c.fmt !== "int") lo = Math.max(0, lo - pad); else lo -= pad;
  hi += pad;
  var st = nice(hi - lo, 4); lo = Math.floor(lo / st) * st; hi = Math.ceil(hi / st) * st;
  var X = function (t) { return L + (t - HV.a) / (HV.b - HV.a) * (R - L); }, Y = function (v) { return B - (v - lo) / (hi - lo) * (B - T); };
  var s = '<defs><clipPath id="cp' + ci + '"><rect x="' + L + '" y="0" width="' + (R - L) + '" height="' + h + '"/></clipPath></defs>';
  s += recs(X, T, B) + grid(Y, lo, hi, st, L, R, c.fmt) + ticks(X, h);
  if (c.id === "med" && D.brk && D.brk > HV.a && D.brk < HV.b) s += '<line x1="' + X(D.brk - 1.5) + '" x2="' + X(D.brk - 1.5) + '" y1="' + T + '" y2="' + B + '" stroke="#FFFFFF" stroke-opacity="0.5" stroke-dasharray="2 2"/>';
  var labs = [], read = [];
  on.slice().reverse().forEach(function (ln) {
    var pts = series(ci, ln[0]), d = "";
    pts.forEach(function (p, k) { d += (k ? "L" : "M") + X(p.t).toFixed(1) + "," + Y(p.v).toFixed(1); });
    var bold = ln[0] === "mortgage" || ln[0] === "mrej" || ln[0] === "med" || ln[0] === "sdq" || ln[0] === "fnm" || ln[0] === "fre" || c.id === "late";
    s += '<path d="' + d + '" clip-path="url(#cp' + ci + ')" fill="none" stroke="' + ln[2] + '" stroke-width="' + (bold ? 2.6 : 1.7) + '"' + (ln[3] === 2 ? ' stroke-dasharray="4 3"' : "") + ' stroke-opacity="' + (bold || c.id === "rej" ? 1 : 0.75) + '" stroke-linejoin="round"/>';
    if (c.dots) pts.forEach(function (p) { if (p.t >= HV.a && p.t <= HV.b) s += '<circle cx="' + X(p.t).toFixed(1) + '" cy="' + Y(p.v).toFixed(1) + '" r="2.3" fill="' + ln[2] + '"/>'; });
    var r = readAt(ci, pts);
    if (r) { s += '<circle cx="' + X(r.t).toFixed(1) + '" cy="' + Y(r.v).toFixed(1) + '" r="3.6" fill="' + ln[2] + '" stroke="#1C1C1E" stroke-width="1.5"/>'; labs.push({ y: Y(r.v), t: fmtv(c.fmt, r.v), c: ln[2] }); read.unshift({ n: ln[1], v: fmtv(c.fmt, r.v), c: ln[2], t: r.t }); }
  });
  s += rightLabels(labs, R, T, B) + cursorLine(X, T, B);
  svg.innerHTML = s; svg.__g = { L: L, R: R, a: HV.a, b: HV.b };
  var when = read.length ? (c.id === "rej" || c.id === "fha" ? mName(read[0].t) : qName(read[0].t)) : "";
  el("v" + ci).innerHTML = read.slice(0, 2).map(function (x) { return '<span style="color:' + x.c + '">' + esc((on.length > 1 ? x.n + " " : "") + x.v) + "</span>"; }).join(" · ") + (when ? '<br><span style="color:#8E8E93;font-size:11px;font-weight:600">' + when + "</span>" : "");
}
// ---- originations by credit score: stacked bars, share or dollars
function drawOrig(ci) {
  var c = CH[ci], svg = el("s" + ci), w = svg.clientWidth || 360, h = c.h, L = 36, R = w - 52, T = 8, B = h - 20;
  var O = (D.orig || []).filter(function (p) { return p.t >= HV.a - 1 && p.t <= HV.b + 1; }), share = origMode === "share";
  el("g" + ci).innerHTML = '<span class="seg" id="oseg"><div data-o="share"' + (share ? ' class="on"' : "") + '>% share</div><div data-o="usd"' + (share ? "" : ' class="on"') + ">$ volume</div></span>" +
    BANDS.map(function (b, k) { return '<span class="chip" style="color:' + BCOL[k] + '">&#9679; ' + esc(b) + "</span>"; }).join("");
  if (!O.length) { svg.innerHTML = '<text x="' + L + '" y="30" fill="#8E8E93" font-size="12">Not loaded yet</text>'; svg.__g = { L: L, R: R }; el("v" + ci).textContent = ""; return; }
  var tot = function (p) { return p.b.reduce(function (a, x) { return a + x; }, 0); };
  var hi = share ? 100 : Math.max.apply(null, O.map(tot)) * 1.08, st = share ? 25 : nice(hi, 4); if (!share) hi = Math.ceil(hi / st) * st;
  var X = function (t) { return L + (t - HV.a) / (HV.b - HV.a) * (R - L); }, Y = function (v) { return B - v / hi * (B - T); };
  var s = '<defs><clipPath id="cp' + ci + '"><rect x="' + L + '" y="0" width="' + (R - L) + '" height="' + h + '"/></clipPath></defs>';
  s += grid(Y, 0, hi, st, L, R, share ? "pct0" : "int") + ticks(X, h) + '<g clip-path="url(#cp' + ci + ')">';
  var bw = Math.max(1, (X(3) - X(0)) * 0.8);
  O.forEach(function (p) {
    var acc = 0, T0 = tot(p);
    p.b.forEach(function (v, k) { var x = share ? v / T0 * 100 : v; s += '<rect x="' + (X(p.t) - bw / 2).toFixed(1) + '" y="' + Y(acc + x).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(0, Y(acc) - Y(acc + x)).toFixed(1) + '" fill="' + BCOL[k] + '" fill-opacity="0.85"/>'; acc += x; });
  });
  s += "</g>";
  if (D.brk && D.brk > HV.a && D.brk < HV.b) { var xb = X(D.brk - 1.5); s += '<line x1="' + xb + '" x2="' + xb + '" y1="' + T + '" y2="' + B + '" stroke="#FFFFFF" stroke-dasharray="2 2"/><text x="' + (xb - 3) + '" y="' + (T + 10) + '" fill="#FFFFFF" font-size="9" text-anchor="end">score model change</text>'; }
  var r = cur == null ? O[O.length - 1] : valAt(O, cur, 3);
  if (r) {
    var T1 = tot(r), acc = 0, labs = [];
    r.b.forEach(function (v, k) { var x = share ? v / T1 * 100 : v; if (k === 0 || k === 4) labs.push({ y: Y(acc + x / 2), t: share ? Math.round(x) + "%" : "$" + Math.round(v) + "B", c: BCOL[k] }); acc += x; });
    s += rightLabels(labs, R, T, B) + cursorLine(X, T, B);
    var m = (D.med || []).filter(function (p) { return p.t === r.t; })[0];
    el("v" + ci).innerHTML = "$" + Math.round(T1) + "B" + (m ? " · median " + Math.round(m.v) : "") + '<br><span style="color:#8E8E93;font-size:11px;font-weight:600">' + qName(r.t) + "</span>";
  }
  svg.innerHTML = s; svg.__g = { L: L, R: R };
  el("u" + ci).textContent = c.ds + (D.brk ? " The credit score model changed to VantageScore 4.0 in " + qName(D.brk) + " (dashed line), so the bands shift there." : "");
}
function drawAll() {
  if (!D) return;
  if (!HV) HV = span();
  HV = clampView(HV);
  ORDER.forEach(function (i) { if (CH[i].kind === "orig") drawOrig(i); else drawLines(i); });
  el("win").textContent = (cur == null ? "" : "Reading " + qName(cur) + " · ") + "Household Debt and Credit through " + (D.hhAsOf || "n/a") + " · Credit Access survey through " + (D.sceAsOf || "n/a") + (D.fhaAsOf ? " · FHA through " + D.fhaAsOf : "");
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
function renderAll() {
  if (!D) return;
  window.__sched = D.sched; renderSched(D.sched);
  el("errs").textContent = D.errors ? "Couldn't refresh: " + D.errors.join(" · ") + " (showing the last good copy)" : "";
  drawAll();
  safe(renderHud);
  if (el("hudl")) el("hudl").innerHTML = D.fhaPdf ? 'HUD report (PDF): <span class="lnk" data-hud="1">' + esc(D.fhaPdf) + "</span>" : "";
  el("note").textContent = D.note + (D.sceMissing ? " " + D.sceMissing : "") + " Checked " + D.checked + ".";
}
el("charts").addEventListener("click", function (e) {
  var o = e.target && e.target.closest ? e.target.closest("[data-o]") : null;
  if (o) { origMode = o.getAttribute("data-o"); drawAll(); return; }
  var t = e.target && e.target.closest ? e.target.closest(".chip.tog") : null;
  if (!t) return;
  var key = t.getAttribute("data-c") + ":" + t.getAttribute("data-k");
  hidden[key] = !hidden[key];
  drawAll();
});
function bindZoom(t) {
  var start = null, lastTap = 0, tapStart = null, ci = +t.getAttribute("data-i");
  function px(e) { var r = t.getBoundingClientRect(); return e.clientX - r.left; }
  function geom() { return el("s" + ci).__g || { L: 36, R: 300 }; }
  t.addEventListener("touchstart", function (e) {
    if (e.touches.length === 2) {
      e.preventDefault();
      var x1 = px(e.touches[0]), x2 = px(e.touches[1]);
      var g0 = geom();
      start = { d: Math.max(20, Math.abs(x2 - x1)), c: (x1 + x2) / 2, v: { a: g0.a != null ? g0.a : HV.a, b: g0.b != null ? g0.b : HV.b }, g: g0 };
      tapStart = null;
    } else if (e.touches.length === 1) tapStart = { x: px(e.touches[0]), y: e.touches[0].clientY, t: Date.now() };
  }, { passive: false });
  t.addEventListener("touchmove", function (e) {
    if (e.touches.length === 2 && start) {
      e.preventDefault();
      var x1 = px(e.touches[0]), x2 = px(e.touches[1]), d = Math.max(20, Math.abs(x2 - x1)), c = (x1 + x2) / 2;
      var g = start.g, w0 = start.v.b - start.v.a, w = w0 * start.d / d;
      var anchor = start.v.a + (start.c - g.L) / (g.R - g.L) * w0, fNow = (c - g.L) / (g.R - g.L);
      HV = clampView({ a: anchor - fNow * w, b: anchor - fNow * w + w });
      drawAll();
    } else if (tapStart && e.touches.length === 1 && Math.abs(e.touches[0].clientY - tapStart.y) > 10) tapStart = null;
  }, { passive: false });
  t.addEventListener("touchend", function (e) {
    if (e.touches.length < 2) start = null;
    if (tapStart && e.changedTouches.length === 1 && Date.now() - tapStart.t < 400) {
      var now = Date.now();
      if (now - lastTap < 320) { HV = span(); cur = null; lastTap = 0; drawAll(); }
      else { lastTap = now; pick(tapStart.x); }
      tapStart = null;
    }
  });
  t.addEventListener("click", function (e) { if (!("ontouchstart" in window)) pick(px(e)); });
  t.addEventListener("gesturestart", function (e) { e.preventDefault(); });
  function pick(x) {
    var g = geom(), f = (x - g.L) / (g.R - g.L);
    if (f < 0 || f > 1) { cur = null; drawAll(); return; }
    var a = g.a != null ? g.a : HV.a, b = g.b != null ? g.b : HV.b, m = Math.round(a + f * (b - a));
    cur = cur === m ? null : m;
    drawAll();
  }
}
// ---- HUD's FHA report beyond Table 1: who's falling behind, why, and failure rates by vintage
var HP = { panel: "score", t2cur: null, figCur: null, figOff: {}, rOff: {} };
var PANELS = [["score", "Credit score"], ["purpose", "Purpose"], ["refi", "Refi type"], ["firstTime", "First-time"], ["dpa", "Down payment"], ["cohort", "Vintage"], ["amount", "Loan size"], ["property", "Property"]];
var REASONS = [["Reduction of income", "#FF9F0A"], ["Unemployed", "#FF453A"], ["Excessive obligations", "#BF5AF2"], ["Death or illness", "#64D2FF"], ["Marital difficulties", "#FFD60A"], ["No contact", "#8E8E93"], ["National emergency", "#30D5C8"], ["Other", "#636366"]];
var FIGCOL = ["#3A5A8C", "#46679B", "#5375AA", "#6083B9", "#6E92C7", "#7CA1D4", "#8BB0E0", "#30D5C8", "#30D158", "#FFD60A", "#FF9F0A", "#FF453A", "#FF375F", "#BF5AF2"];
function rowName(panel, label) {
  if (panel === "cohort") return /^[0-9]/.test(label) ? "FY" + label : label;
  if (panel === "amount") return label.indexOf("<") === 0 ? "Under $" + label.slice(1).trim() + "K" : label.indexOf(">") === 0 ? "Over $" + label.slice(1).trim() + "K" : "$" + label + "K";
  if (panel === "score" && label.indexOf("<") === 0) return "Under " + label.slice(1).trim();
  if (panel === "dpa") return label === "No DPA" ? label : label === "Relative" ? "Gift from relative" : label.replace("Seller Funded", "Seller-funded") + " DPA";
  if (panel === "firstTime") return label + " buyers";
  return label;
}
// the sentence over the bars: the worst group vs the best (groups under 1% of loans left out)
function t3Line(panel, P) {
  var rows = (P && P.rows || []).filter(function (r) { return r.share >= 1; });
  if (panel === "cohort") rows = rows.filter(function (r, k, all) { return k < all.length - 1; }); // the current year's loans are too new to compare
  if (rows.length < 2) return null;
  var hi = rows[0], lo = rows[0];
  rows.forEach(function (r) { if (r.sdq > hi.sdq) hi = r; if (r.sdq < lo.sdq) lo = r; });
  return { hi: hi, lo: lo, x: lo.sdq > 0 ? hi.sdq / lo.sdq : null };
}
function hudSec(id, title) { return '<div class="sec" id="' + id + '"><div class="st"><b>' + esc(title) + '</b><span class="val" id="' + id + 'v"></span></div>'; }
function buildHud() {
  return hudSec("hb", "FHA: who's falling behind") + '<div class="legend" id="hbseg"></div><div class="hl" id="hbl"></div><svg id="hbs"></svg><div class="ds" id="hbd"></div></div>' +
    hudSec("hw", "FHA: why they fall behind") + '<div class="hl" id="hwl"></div><div class="subh">New 90+ day delinquencies per quarter</div><div class="wrap"><svg id="hwn" style="height:110px"></svg><div class="touch2" data-h="hwn"></div></div>' +
    '<div class="subh">Share by reason</div><div class="wrap"><svg id="hws" style="height:190px"></svg><div class="touch2" data-h="hws"></div></div><div class="legend" id="hwg"></div><div class="ds" id="hwd"></div></div>' +
    hudSec("hf", "FHA: failing, by vintage") + '<div class="hl" id="hfl"></div><div class="legend" id="hfg"></div><div class="wrap"><svg id="hfs" style="height:220px"></svg><div class="touch2" data-h="hfs"></div></div><div class="ds" id="hfd"></div></div>';
}
function renderHud() {
  var H = D.hud || {};
  ["hb", "hw", "hf"].forEach(function (id) { if (el(id)) el(id).style.display = ""; });
  drawWho(H); drawWhy(H); drawFig(H);
}
function pct2(v) { return v.toFixed(2) + "%"; }
// ---- who's falling behind: serious delinquency by group, hollow bars a year earlier
function drawWho(H) {
  var box = el("hbs"); if (!box) return;
  var T3 = H.t3, A = H.t3Ago;
  if (!T3) { box.style.height = "40px"; box.innerHTML = '<text x="0" y="24" fill="#8E8E93" font-size="12">' + esc(H.errs && H.errs.length ? H.errs[0] : "Not loaded yet") + "</text>"; el("hbseg").innerHTML = ""; el("hbl").textContent = ""; el("hbv").textContent = ""; return; }
  if (!T3[HP.panel]) HP.panel = "score";
  el("hbseg").innerHTML = PANELS.filter(function (p) { return T3[p[0]]; }).map(function (p) { return '<span class="chip hpick' + (p[0] === HP.panel ? " sel" : "") + '" data-p="' + p[0] + '">' + esc(p[1]) + "</span>"; }).join("");
  var P = T3[HP.panel], PA = A && A[HP.panel], rows = P.rows, tot = P.total;
  var w = box.clientWidth || 360, rh = 30, top = 18, h = top + rows.length * rh + 8, LW = 118, R = w - 92;
  var mx = 0; rows.forEach(function (r) { mx = Math.max(mx, r.sdq); var a = PA && PA.rows.filter(function (q) { return q.label === r.label; })[0]; if (a) mx = Math.max(mx, a.sdq); });
  mx = Math.ceil(mx * 1.05) || 1;
  var X = function (v) { return LW + v / mx * (R - LW); }, s = "";
  if (tot) s += '<line x1="' + X(tot.sdq) + '" x2="' + X(tot.sdq) + '" y1="' + (top - 4) + '" y2="' + (h - 4) + '" stroke="#FFFFFF" stroke-opacity="0.55" stroke-dasharray="3 3"/><text x="' + X(tot.sdq) + '" y="' + (top - 7) + '" fill="#C7C7CC" font-size="10" text-anchor="middle">all ' + pct2(tot.sdq) + "</text>";
  rows.forEach(function (r, k) {
    var y = top + k * rh, a = PA && PA.rows.filter(function (q) { return q.label === r.label; })[0];
    s += '<text x="0" y="' + (y + 12) + '" fill="#FFFFFF" font-size="12" font-weight="700">' + esc(rowName(HP.panel, r.label)) + "</text>";
    s += '<text x="0" y="' + (y + 25) + '" fill="#8E8E93" font-size="10">' + (r.share != null ? r.share.toFixed(r.share < 1 ? 2 : 1) + "% of loans" : "") + "</text>";
    s += '<rect x="' + LW + '" y="' + (y + 5) + '" width="' + Math.max(1, X(r.sdq) - LW).toFixed(1) + '" height="16" rx="2" fill="#FF453A" fill-opacity="' + (r.share < 1 ? 0.45 : 0.9) + '"/>';
    if (a) s += '<rect x="' + LW + '" y="' + (y + 3) + '" width="' + Math.max(1, X(a.sdq) - LW).toFixed(1) + '" height="20" rx="2" fill="none" stroke="#C7C7CC" stroke-width="1" stroke-dasharray="2 2"/>';
    var d = a ? r.sdq - a.sdq : null;
    s += '<text x="' + (R + 6) + '" y="' + (y + 13) + '" fill="#FFFFFF" font-size="12" font-weight="700">' + pct2(r.sdq) + "</text>";
    if (d != null) s += '<text x="' + (R + 6) + '" y="' + (y + 25) + '" fill="' + (d > 0.05 ? "#FF9F0A" : d < -0.05 ? "#30D158" : "#8E8E93") + '" font-size="10">' + (d >= 0 ? "+" : "") + d.toFixed(2) + " in a year</text>";
  });
  box.setAttribute("viewBox", "0 0 " + w + " " + h); box.style.height = h + "px"; box.innerHTML = s;
  var L = t3Line(HP.panel, P);
  el("hbl").textContent = L && L.x ? rowName(HP.panel, L.hi.label) + " runs " + L.x.toFixed(1) + "x the serious delinquency of " + rowName(HP.panel, L.lo.label) + " (" + pct2(L.hi.sdq) + " vs " + pct2(L.lo.sdq) + ")" : "";
  el("hbv").innerHTML = tot ? pct2(tot.sdq) + '<br><span style="color:#8E8E93;font-size:11px;font-weight:600">' + esc(H.t3At || "") + "</span>" : "";
  el("hbd").textContent = "Serious delinquency (90+ days late, in foreclosure or in bankruptcy) as a share of active FHA loans in each group, HUD's " + (H.t3At || "") + " report (Table 3). Dashed outlines: the same group in the " + (H.t3AgoAt || "year-earlier") + " report" + (A ? "" : ", not read yet") + ". Dashed line: all loans in the panel." + (HP.panel === "score" ? " Streamline refinances have no credit score, so they're left out here." : "") + (HP.panel === "cohort" ? " Fiscal years start in October; the newest year's loans are too young to compare." : "");
}
// fiscal quarter label, and the order of Table 2's rows
function t2Name(r, short) { return r.mon != null ? MON[r.mon] + (short ? "" : " " + (r.mon >= 9 ? r.fy - 1 : r.fy)) : (short ? "Q" + r.q + " '" + String(r.fy).slice(2) : "FY" + r.fy + " Q" + r.q); }
// ---- why: new 90+ day delinquencies per quarter, and the share by reason
// Hidden reasons drop out of both charts: the shares of the reasons left add to 100%,
// and the count is only the loans for the reasons left.
function visSum(r) { var t = 0; r.sh.forEach(function (v, j) { if (!HP.rOff[j]) t += v; }); return t; }
function shOf(r, j) { var t = visSum(r); return t > 0 ? r.sh[j] / t * 100 : 0; }
function nOf(r) { var t = r.sh.reduce(function (a, b) { return a + b; }, 0) || 100; return Math.round(r.n * visSum(r) / t); }
function anyOff() { for (var j = 0; j < 8; j++) if (HP.rOff[j]) return true; return false; }
function drawWhy(H) {
  var nS = el("hwn"), sS = el("hws"); if (!nS) return;
  var rows = H.t2 || [];
  if (!rows.length) { nS.innerHTML = '<text x="0" y="24" fill="#8E8E93" font-size="12">Not loaded yet</text>'; sS.innerHTML = ""; el("hwg").innerHTML = ""; el("hwl").textContent = ""; el("hwv").textContent = ""; return; }
  var q = rows.filter(function (r) { return r.mon == null; }), w = nS.clientWidth || 360, L = 36, R = w - 8;
  // quarters
  var mx = Math.max(1, Math.max.apply(null, q.map(nOf))), st = nice(mx, 3), hi = Math.ceil(mx / st) * st, h1 = 110, B1 = h1 - 18;
  var bw = (R - L) / Math.max(1, q.length), s = "";
  for (var v = 0; v <= hi + 1e-9; v += st) s += '<line x1="' + L + '" x2="' + R + '" y1="' + (B1 - v / hi * (B1 - 6)).toFixed(1) + '" y2="' + (B1 - v / hi * (B1 - 6)).toFixed(1) + '" stroke="#3A3A3C" stroke-width="0.6"/><text x="' + (L - 4) + '" y="' + (B1 - v / hi * (B1 - 6) + 3.5).toFixed(1) + '" font-size="10" fill="#8E8E93" text-anchor="end">' + (v >= 1000 ? Math.round(v / 1000) + "K" : v) + "</text>";
  var sel = HP.t2cur != null && rows[HP.t2cur] ? rows[HP.t2cur] : rows[rows.length - 1];
  q.forEach(function (r, k) {
    var x = L + k * bw, y = B1 - nOf(r) / hi * (B1 - 6);
    s += '<rect x="' + (x + bw * 0.15).toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + (bw * 0.7).toFixed(1) + '" height="' + (B1 - y).toFixed(1) + '" fill="#FF453A" fill-opacity="' + (sel === r ? 1 : 0.6) + '"/>';
    if (r.q === 1) s += '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (h1 - 4) + '" font-size="9.5" fill="#8E8E93" text-anchor="middle">FY' + String(r.fy).slice(2) + "</text>";
  });
  nS.setAttribute("viewBox", "0 0 " + w + " " + h1); nS.innerHTML = s; nS.__g = { L: L, bw: bw, rows: q };
  // shares, every row (the current quarter's months at the right)
  var h2 = 190, B2 = h2 - 18, bw2 = (R - L) / rows.length, s2 = "";
  [0, 25, 50, 75, 100].forEach(function (v) { var y = B2 - v / 100 * (B2 - 6); s2 += '<line x1="' + L + '" x2="' + R + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="#3A3A3C" stroke-width="0.6"/><text x="' + (L - 4) + '" y="' + (y + 3.5).toFixed(1) + '" font-size="10" fill="#8E8E93" text-anchor="end">' + v + "%</text>"; });
  rows.forEach(function (r, k) {
    var x = L + k * bw2, acc = 0, tot = visSum(r) || 100;
    r.sh.forEach(function (v, j) { if (HP.rOff[j]) return; var a = acc / tot * 100, b = (acc + v) / tot * 100; s2 += '<rect x="' + (x + bw2 * 0.1).toFixed(1) + '" y="' + (B2 - b / 100 * (B2 - 6)).toFixed(1) + '" width="' + (bw2 * 0.8).toFixed(1) + '" height="' + ((b - a) / 100 * (B2 - 6)).toFixed(1) + '" fill="' + REASONS[j][1] + '" fill-opacity="' + (sel === r ? 1 : 0.7) + '"/>'; acc += v; });
    if (r.mon == null && r.q === 1) s2 += '<text x="' + (x + bw2 / 2).toFixed(1) + '" y="' + (h2 - 4) + '" font-size="9.5" fill="#8E8E93" text-anchor="middle">FY' + String(r.fy).slice(2) + "</text>";
    if (r.mon != null && (k === rows.length - 1 || rows[k + 1].mon == null)) s2 += '<text x="' + (x + bw2 / 2).toFixed(1) + '" y="' + (h2 - 4) + '" font-size="9.5" fill="#8E8E93" text-anchor="middle">' + MON[r.mon] + "</text>";
  });
  if (sel) { var xs = L + rows.indexOf(sel) * bw2; s2 += '<rect x="' + (xs + bw2 * 0.05).toFixed(1) + '" y="5" width="' + (bw2 * 0.9).toFixed(1) + '" height="' + (B2 - 5) + '" fill="none" stroke="#FFFFFF" stroke-width="1.2"/>'; }
  sS.setAttribute("viewBox", "0 0 " + w + " " + h2); sS.innerHTML = s2; sS.__g = { L: L, bw: bw2, rows: rows };
  el("hwg").innerHTML = REASONS.map(function (rr, j) { return '<span class="chip hreason' + (HP.rOff[j] ? " off" : "") + '" data-r="' + j + '" style="color:' + rr[1] + '">&#9679; ' + esc(rr[0]) + (HP.rOff[j] ? "" : " " + shOf(sel, j).toFixed(1) + "%") + "</span>"; }).join("");
  el("hwv").innerHTML = nOf(sel).toLocaleString("en-US") + ' new<br><span style="color:#8E8E93;font-size:11px;font-weight:600">' + esc(t2Name(sel)) + (sel.mon != null ? " (one month)" : "") + (anyOff() ? " · reasons shown" : "") + "</span>";
  el("hwl").textContent = whyLine(rows) || "";
  el("hwd").textContent = "Loans newly 90+ days late each fiscal quarter (the fiscal year starts in October), and the reason servicers reported, from HUD's " + (H.t2At || "") + " report (Table 2). The current quarter shows month by month. National emergency includes the COVID-19 pandemic; Other includes property problems, job transfers, business failure, payment disputes and more. Tap a bar to read it; tap a reason to hide or show it: the shares re-scale to the reasons left, and the count above shows only their loans." + (anyOff() ? " Showing " + REASONS.filter(function (rr, j) { return !HP.rOff[j]; }).length + " of 8 reasons." : "");
}
// the top reason now, and the biggest move in a year (latest full quarter vs four quarters earlier)
function whyLine(rows) {
  var q = rows.filter(function (r) { return r.mon == null; }), last = rows[rows.length - 1];
  if (!last) return null;
  // "national emergency" (mostly COVID) and "other" aren't reasons anyone acts on: left out of the sentence
  var ok = function (j) { return !HP.rOff[j] && (j < 6 || (HP.rOff[0] && HP.rOff[1] && HP.rOff[2] && HP.rOff[3] && HP.rOff[4] && HP.rOff[5])); };
  var top = -1; for (var j0 = 0; j0 < 8; j0++) if (ok(j0) && (top < 0 || shOf(last, j0) > shOf(last, top))) top = j0;
  if (top < 0) return null;
  var out = REASONS[top][0] + " leads at " + shOf(last, top).toFixed(1) + "% of new 90+ delinquencies" + (anyOff() ? " among the reasons shown" : "") + " (" + t2Name(last) + ")";
  if (q.length >= 5) {
    var a = q[q.length - 1], b = q[q.length - 5], big = -1;
    for (var j = 0; j < 8; j++) if (ok(j) && (big < 0 || Math.abs(shOf(a, j) - shOf(b, j)) > Math.abs(shOf(a, big) - shOf(b, big)))) big = j;
    var d = big < 0 ? 0 : shOf(a, big) - shOf(b, big);
    if (Math.abs(d) >= 1) out += "; " + REASONS[big][0].toLowerCase() + " " + (d > 0 ? "up " : "down ") + Math.abs(d).toFixed(1) + " pts from " + t2Name(b);
  }
  return out;
}
// ---- failure rate by fiscal-year cohort, by months since origination
function figAt(sr, m) { for (var i = 0; i < sr.pts.length; i++) if (sr.pts[i][0] === m) return sr.pts[i][1]; return null; }
function ordinal(n) { var s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
function figLine(F) {
  // the newest cohort with a year of history, against every older cohort at the same age
  var c = F.slice().reverse().filter(function (sr) { return sr.pts[sr.pts.length - 1][0] >= 12; })[0];
  if (!c) return null;
  var m = c.pts[c.pts.length - 1][0], v = c.pts[c.pts.length - 1][1];
  var others = F.filter(function (sr) { return sr !== c && figAt(sr, m) != null; }).map(function (sr) { return { fy: sr.fy, v: figAt(sr, m) }; });
  if (!others.length) return null;
  var higher = others.filter(function (o) { return o.v > v; }).length, prev = others.filter(function (o) { return o.fy === c.fy - 1; })[0];
  return { fy: c.fy, m: m, v: v, rank: higher + 1, n: others.length + 1, prev: prev, worst: higher === 0 };
}
function drawFig(H) {
  var svg = el("hfs"); if (!svg) return;
  var F = H.fig;
  if (!F || !F.length) { svg.innerHTML = '<text x="0" y="24" fill="#8E8E93" font-size="12">' + esc((H.errs || []).filter(function (e) { return e.indexOf("Figure") === 0; })[0] || "Not loaded yet") + "</text>"; el("hfg").innerHTML = ""; el("hfl").textContent = ""; el("hfv").textContent = ""; return; }
  var w = svg.clientWidth || 360, h = 220, L = 36, R = w - 40, T = 8, B = h - 20;
  var on = F.filter(function (sr) { return !HP.figOff[sr.fy]; }), mxM = 0, mxV = 0;
  F.forEach(function (sr) { mxM = Math.max(mxM, sr.pts[sr.pts.length - 1][0]); });
  on.forEach(function (sr) { sr.pts.forEach(function (p) { mxV = Math.max(mxV, p[1]); }); });
  var st = nice(mxV || 1, 4), hi = Math.ceil((mxV || 1) / st) * st, mxX = Math.ceil(mxM / 12) * 12;
  var X = function (m) { return L + m / mxX * (R - L); }, Y = function (v) { return B - v / hi * (B - T); }, s = "";
  for (var v = 0; v <= hi + 1e-9; v += st) s += '<line x1="' + L + '" x2="' + R + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '" stroke="#3A3A3C" stroke-width="0.6"/><text x="' + (L - 4) + '" y="' + (Y(v) + 3.5).toFixed(1) + '" font-size="10" fill="#8E8E93" text-anchor="end">' + (st < 1 ? v.toFixed(1) : v) + "%</text>";
  for (var m = 0; m <= mxX; m += 24) s += '<text x="' + X(m).toFixed(1) + '" y="' + (h - 5) + '" font-size="9.5" fill="#8E8E93" text-anchor="middle">' + (m === 0 ? "0" : m / 12 + " yr") + "</text>";
  var col = function (sr) { return FIGCOL[Math.max(0, FIGCOL.length - (F.length - F.indexOf(sr)))]; }, labs = [];
  on.forEach(function (sr) {
    var d = ""; sr.pts.forEach(function (p, k) { d += (k ? "L" : "M") + X(p[0]).toFixed(1) + "," + Y(p[1]).toFixed(1); });
    var newest = F.indexOf(sr) >= F.length - 3;
    s += '<path d="' + d + '" fill="none" stroke="' + col(sr) + '" stroke-width="' + (newest ? 2.4 : 1.5) + '" stroke-linejoin="round"/>';
    var last = sr.pts[sr.pts.length - 1], at = HP.figCur != null ? figAt(sr, HP.figCur) : null;
    if (HP.figCur != null && at != null) s += '<circle cx="' + X(HP.figCur).toFixed(1) + '" cy="' + Y(at).toFixed(1) + '" r="3" fill="' + col(sr) + '"/>';
    if (HP.figCur == null) labs.push({ y: Y(last[1]), t: "'" + String(sr.fy).slice(2), c: col(sr), x: X(last[0]) });
  });
  labs.forEach(function (lb) { s += '<text x="' + (lb.x + 3).toFixed(1) + '" y="' + (lb.y + 3.5).toFixed(1) + '" font-size="9.5" font-weight="700" fill="' + lb.c + '">' + lb.t + "</text>"; });
  if (HP.figCur != null) s += '<line x1="' + X(HP.figCur).toFixed(1) + '" x2="' + X(HP.figCur).toFixed(1) + '" y1="' + T + '" y2="' + B + '" stroke="#FFFFFF" stroke-opacity="0.6" stroke-dasharray="3 2"/>';
  svg.setAttribute("viewBox", "0 0 " + w + " " + h); svg.innerHTML = s; svg.__g = { L: L, R: R, mx: mxX };
  el("hfg").innerHTML = F.map(function (sr) { var at = HP.figCur != null ? figAt(sr, HP.figCur) : sr.pts[sr.pts.length - 1][1]; return '<span class="chip hfy' + (HP.figOff[sr.fy] ? " off" : "") + '" data-fy="' + sr.fy + '" style="color:' + col(sr) + '">&#9679; FY' + String(sr.fy).slice(2) + (at != null ? " " + at.toFixed(2) + "%" : "") + "</span>"; }).join("");
  var fl = figLine(F);
  el("hfl").textContent = fl ? "FY" + fl.fy + " loans: " + pct2(fl.v) + " failed by month " + fl.m + ", " + (fl.worst ? "the highest" : "the " + ordinal(fl.rank) + "-highest") + " of " + fl.n + " cohorts at that age" + (fl.prev ? " (FY" + fl.prev.fy + ": " + pct2(fl.prev.v) + ")" : "") : "";
  el("hfv").innerHTML = HP.figCur != null ? "Month " + HP.figCur + '<br><span style="color:#8E8E93;font-size:11px;font-weight:600">since origination</span>' : esc(H.figAt || "");
  el("hfd").textContent = "Loans that went to claim or are in foreclosure, as a share of each fiscal year's FHA loans, by months since origination (HUD's " + (H.figAt || "") + " report, Figure 1, read from the chart's lines; good to about 0.01 points). Tap a year to hide it; tap the chart to read a month.";
}
document.addEventListener("click", function (e) {
  var t = e.target && e.target.closest ? e.target.closest(".hpick, .hfy, .hreason") : null;
  if (!t) return;
  if (t.getAttribute("data-r")) { var rj = t.getAttribute("data-r"); HP.rOff[rj] = !HP.rOff[rj]; }
  if (t.getAttribute("data-p")) HP.panel = t.getAttribute("data-p");
  if (t.getAttribute("data-fy")) { var fy = t.getAttribute("data-fy"); HP.figOff[fy] = !HP.figOff[fy]; }
  safe(renderHud);
});
function bindHud(t) {
  var id = t.getAttribute("data-h"), lastTap = 0;
  function pick(x) {
    var g = el(id).__g; if (!g) return;
    if (id === "hfs") { var m = Math.round((x - g.L) / (g.R - g.L) * g.mx); HP.figCur = m < 0 || m > g.mx || HP.figCur === m ? null : m; }
    else { var k = Math.floor((x - g.L) / g.bw), r = g.rows[k]; if (!r) { HP.t2cur = null; } else { var all = (D.hud && D.hud.t2) || []; HP.t2cur = all.indexOf(r); } }
    safe(renderHud);
  }
  t.addEventListener("click", function (e) { var r = t.getBoundingClientRect(); pick(e.clientX - r.left); });
}
function safe(f) { try { f(); } catch (e) { el("errs").textContent = "Display error: " + (e && e.message || e); } }
window.update = function (d) { var had = !!D; D = d; if (!had) HV = null; safe(renderAll); };
var hudWanted = false;
window.__takeHud = function () { var w = hudWanted; hudWanted = false; return w; };
document.addEventListener("click", function (e) { var t = e.target && e.target.closest ? e.target.closest("[data-hud]") : null; if (t) hudWanted = true; });
window.setFhaStatus = function (t) { FHA_MSG = t; if (D && !(D.fha || []).length) safe(drawAll); };
window.setStatus = function (t) { if (!D) el("errs").textContent = t; };
window.addEventListener("resize", function () { safe(renderAll); });
safe(build);
if (D) safe(renderAll); else el("errs").textContent = "Loading the NY Fed data (the first time takes a minute)...";
// Share as PDF: 16:9 slides, the dates zoomed to on screen, hidden lines
// skipped. 1) Delinquency: new 90+ by loan type | where late mortgages go.
// 2) FHA delinquency, then who's falling behind, why, and failing by vintage. (Originations by credit score | score of new
// mortgages. 4) Rejections.
// Plain titles; captions explain; labels at the right edge; a dark banner
// credits the sources. Vector.
window.printPdf = function (jsPDF, fonts) {
  if (!D) throw new Error("The data hasn't loaded yet");
  var W = 792, H = 445.5, hasRej = specs(4).length > 0, hasFha = specs(5).length > 0, PAGES = 1 + (hasRej ? 1 : 0) + (hasFha ? 1 : 0) + (D.hud && D.hud.t3 && D.hud.t3.score ? 1 : 0) + (D.hud && D.hud.t2 && D.hud.t2.length ? 1 : 0) + (D.hud && D.hud.fig && D.hud.fig.length ? 1 : 0), PG = 0;
  var doc = new jsPDF({ unit: "pt", format: [W, H], orientation: "landscape" });
  var FACE = "helvetica";
  if (fonts && fonts.regular && fonts.bold) {
    doc.addFileToVFS("Narrow-Regular.ttf", fonts.regular); doc.addFont("Narrow-Regular.ttf", "Narrow", "normal");
    doc.addFileToVFS("Narrow-Bold.ttf", fonts.bold); doc.addFont("Narrow-Bold.ttf", "Narrow", "bold");
    FACE = "Narrow";
  }
  var INK = [28, 28, 30], GRY = [110, 110, 115], RULE = [222, 222, 226];
  // phone colors -> print colors
  var PMAP = { "#FF9F0A": [194, 106, 0], "#64D2FF": [0, 119, 200], "#BF5AF2": [142, 59, 184], "#FFD60A": [179, 134, 0], "#30D5C8": [18, 150, 140],
    "#30D158": [30, 158, 69], "#FF453A": [215, 0, 21], "#FFFFFF": [28, 28, 30], "#8E8E93": [120, 120, 125], "#636366": [160, 160, 165], "#98989F": [110, 110, 115], "#64A8FF": [10, 98, 208] };
  function pc(hex) { return PMAP[hex] || [28, 28, 30]; }
  function font(bold, size, c) { doc.setFont(FACE, bold ? "bold" : "normal"); doc.setFontSize(size); doc.setTextColor(c[0], c[1], c[2]); }
  function clean(t) { return String(t).split("−").join("-").split("’").join("'").split("–").join("-").split("…").join("...").split("&amp;").join("&"); }
  function headline(text) { font(true, 21, INK); doc.text(clean(text), 36, 42); return 42; }
  function titles(x, w, t, sub, top) { font(true, 11.5, INK); doc.text(clean(t), x, top + 26); font(false, 8.5, GRY); doc.text(doc.splitTextToSize(clean(sub), w).slice(0, 1), x, top + 38); }
  function caption(text, x, w, y) { font(false, 8, GRY); doc.text(doc.splitTextToSize(clean(text), w).slice(0, 4), x, y, { lineHeightFactor: 1.2 }); }
  function banner(page, rng) {
    var bh = 44, by = H - bh;
    doc.setFillColor(28, 28, 30); doc.rect(0, by, W, bh, "F");
    doc.setFillColor(201, 162, 39); doc.rect(W - 176, by + 6, 2, bh - 12, "F");
    font(false, 7, [235, 235, 240]); doc.text(doc.splitTextToSize(clean(D.sources), W - 176 - 40 - 110).slice(0, 4), 28, by + 11);
    font(false, 7.5, [200, 200, 205]); doc.text(clean(rng || qName(Math.ceil(HV.a)) + " to " + qName(Math.floor(HV.b))), W - 188, by + 20, { align: "right" }); doc.text(page + " of " + PAGES, W - 188, by + 31, { align: "right" });
    font(true, 12.5, [255, 255, 255]); doc.text("Borrower", W - 162, by + 20); doc.text("Credit", W - 162, by + 34);
  }
  function box(L, R, T, B, lo, hi, f, recsOn) {
    var F = { L: L, R: R, T: T, B: B };
    F.X = function (t) { return L + (t - HV.a) / (HV.b - HV.a) * (R - L); };
    F.Y = function (v) { return B - (v - lo) / (hi - lo) * (B - T); };
    if (recsOn) (D.recessions || []).forEach(function (r) {
      var a = Math.max(HV.a, +r[0].slice(0, 4) * 12 + +r[0].slice(5, 7) - 1), b = Math.min(HV.b, +r[1].slice(0, 4) * 12 + +r[1].slice(5, 7) - 1);
      if (b > a) { doc.setFillColor(236, 236, 240); doc.rect(F.X(a), T, F.X(b) - F.X(a), B - T, "F"); }
    });
    var st = nice(hi - lo, 5);
    for (var v = lo, n = 0; v <= hi + 1e-9 && n < 40; v += st, n++) { doc.setDrawColor(RULE[0], RULE[1], RULE[2]); doc.setLineWidth(0.5); doc.line(L, F.Y(v), R, F.Y(v)); font(false, 8, GRY); doc.text(fmtv(f === "pct1" ? "pct0" : f, v), L - 5, F.Y(v) + 3, { align: "right" }); }
    doc.setDrawColor(150, 150, 155); doc.line(L, B, R, B);
    var wv = HV.b - HV.a, last = -99;
    if (wv > 30) { var step = wv > 150 ? 5 : wv > 72 ? 2 : 1; for (var y = Math.ceil(HV.a / 12), n = 0; y * 12 <= HV.b && n < 400; y++, n++) if (y % step === 0) { var x = F.X(y * 12); if (x - last > 26) { font(false, 8, GRY); doc.text(String(y), x, B + 11, { align: "center" }); last = x; } } }
    else for (var t = Math.ceil(HV.a), n = 0; t <= HV.b && n < 400; t++, n++) if (((t % 12) + 12) % 12 % 3 === 0) { var x2 = F.X(t); if (x2 - last > 30) { font(false, 8, GRY); doc.text(clean(MON[((t % 12) + 12) % 12] + " '" + String(Math.floor(t / 12)).slice(2)), x2, B + 11, { align: "center" }); last = x2; } }
    return F;
  }
  function clipTo(F) { doc.saveGraphicsState(); doc.rect(F.L, F.T - 2, F.R - F.L, F.B - F.T + 4, null); doc.clip(); doc.discardPath(); }
  function ends(F, items) {
    items.sort(function (a, b) { return a.y - b.y; });
    for (var k = 1; k < items.length; k++) if (items[k].y - items[k - 1].y < 12) items[k].y = items[k - 1].y + 12;
    items.forEach(function (it) { font(true, 9.5, it.c); doc.text(clean(it.t), F.R + 6, it.y + 3.5); });
  }
  function legend(items, x, y) {
    items.forEach(function (it) { doc.setDrawColor(it.c[0], it.c[1], it.c[2]); doc.setLineWidth(it.lw || 2); if (it.dash) doc.setLineDashPattern([3, 2], 0); doc.line(x, y - 3, x + 14, y - 3); doc.setLineDashPattern([], 0); font(false, 8.5, INK); doc.text(clean(it.t), x + 18, y); x += 18 + doc.getTextWidth(clean(it.t)) + 14; });
  }
  // a line chart from the phone's chart ci
  function lineChart(ci, x0, x1, T, B, title, sub) {
    // the survey starts in 2013: on its own slide, start the dates there
    var keepA = HV.a;
    if (CH[ci].id === "rej" || CH[ci].id === "fha") { var f0 = Infinity; specs(ci).forEach(function (ln) { series(ci, ln[0]).forEach(function (p) { f0 = Math.min(f0, p.t); }); }); if (f0 - 3 > HV.a && f0 - 3 < HV.b - 12) HV.a = f0 - 3; }
    try { lineChart0(ci, x0, x1, T, B, title, sub); } finally { HV.a = keepA; }
  }
  function lineChart0(ci, x0, x1, T, B, title, sub) {
    var c = CH[ci], on = specs(ci).filter(function (ln) { return !hidden[ci + ":" + ln[0]]; }), vals = [];
    on.forEach(function (ln) { series(ci, ln[0]).forEach(function (p) { if (p.t >= HV.a - 1 && p.t <= HV.b + 1) vals.push(p.v); }); });
    titles(x0, x1 - x0, title, sub, T - 48);
    if (!vals.length) return;
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), pad = (hi - lo) * 0.1 || 1;
    lo = c.fmt === "int" ? lo - pad : Math.max(0, lo - pad); hi += pad;
    var st = nice(hi - lo, 5); lo = Math.floor(lo / st) * st; hi = Math.ceil(hi / st) * st;
    var F = box(x0 + 30, x1 - 52, T, B, lo, hi, c.fmt, c.id !== "rej"), labs = [];
    clipTo(F);
    on.slice().reverse().forEach(function (ln) {
      var pts = series(ci, ln[0]), col = pc(ln[2]), bold = ln[0] === "mortgage" || ln[0] === "mrej" || ln[0] === "med" || ln[0] === "sdq" || c.id === "late";
      doc.setDrawColor(col[0], col[1], col[2]); doc.setLineWidth(bold ? 2.2 : 1.4); if (ln[3] === 2) doc.setLineDashPattern([3, 2], 0);
      for (var k = 1; k < pts.length; k++) if (pts[k].t >= HV.a - 3 && pts[k - 1].t <= HV.b + 3) doc.line(F.X(pts[k - 1].t), F.Y(pts[k - 1].v), F.X(pts[k].t), F.Y(pts[k].v));
      doc.setLineDashPattern([], 0);
      if (c.dots) pts.forEach(function (p) { if (p.t >= HV.a && p.t <= HV.b) { doc.setFillColor(col[0], col[1], col[2]); doc.circle(F.X(p.t), F.Y(p.v), 1.6, "F"); } });
      var r = readAt(ci, pts); if (r) labs.push({ y: F.Y(r.v), t: fmtv(c.fmt, r.v), c: col });
    });
    doc.restoreGraphicsState();
    if (c.id === "med" && D.brk && D.brk > HV.a && D.brk < HV.b) { doc.setDrawColor(120, 120, 125); doc.setLineWidth(0.6); doc.setLineDashPattern([2, 2], 0); doc.line(F.X(D.brk - 1.5), F.T, F.X(D.brk - 1.5), F.B); doc.setLineDashPattern([], 0); }
    ends(F, labs);
    legend(on.map(function (ln) { return { t: ln[1], c: pc(ln[2]), dash: ln[3] === 2 }; }), x0 + 30, B + 26);
  }

  var L1 = 36, half = (W - 72 - 30) / 2, L2 = 36 + half + 30, T0 = 110, B0 = H - 44 - 92;
  // ---- 1. Delinquency ----
  headline("Mortgage Delinquency");
  lineChart(0, L1, L1 + half, T0, B0, "Balances Newly 90+ Days Late, by Loan Type", "% of balances, four-quarter sum");
  caption(CH[0].ds, L1, half, H - 44 - 40);
  lineChart(1, L2, L2 + half, T0, B0, "Where 30-60-Day Late Mortgages Go", "% of late mortgages, next quarter");
  caption(CH[1].ds, L2, half, H - 44 - 40);
  banner(++PG);

  // ---- FHA ----
  if (hasFha) {
    doc.addPage([W, H], "landscape");
    // the headline: FHA's serious rate against the conventional (GSE) rate
    var fl = series(5, "sdq"), gl = ["fnm", "fre"].map(function (k) { var x = series(5, k); return x.length ? x[x.length - 1].v : null; }).filter(function (v) { return v != null; });
    var fv = fl.length ? fl[fl.length - 1].v : null, gv = gl.length ? gl.reduce(function (a, b) { return a + b; }, 0) / gl.length : null;
    headlineFit(fv != null && gv ? "FHA Serious Delinquency at " + fv.toFixed(1) + "%, About " + (fv / gv).toFixed(0) + "x Conventional Loans' " + gv.toFixed(1) + "% (Fannie and Freddie)" : fv != null ? "FHA Serious Delinquency at " + fv.toFixed(1) + "%" : "FHA Delinquency");
    lineChart(5, L1, W - 36, T0, B0, "FHA Loans Past Due, With Conventional Loans for Comparison", "% of loans; FHA seasonally adjusted (HUD); Fannie Mae and Freddie Mac serious delinquency, not adjusted");
    caption(CH[5].ds, L1, W - 72, H - 44 - 40);
    var fs = series(5, "sdq").filter(function (p) { return p.t >= HV.a && p.t <= HV.b; });
    banner(++PG, fs.length ? mName(fs[0].t) + " to " + mName(fs[fs.length - 1].t) : null);
  }
  // ---- HUD extras: who's falling behind, why, failing by vintage ----
  function headlineFit(text) {
    var size = 21, lines;
    do { font(true, size, INK); lines = doc.splitTextToSize(clean(text), W - 72); size -= 1; } while (lines.length > 1 && size > 15);
    doc.text(lines.slice(0, 2), 36, 42);
    return lines.length > 1 ? 18 : 0;
  }
  function pdfName(panel, label) { return clean(rowName(panel, label)); }
  function titleCase(t) { var small = ["of", "at", "from", "in", "a", "an", "the", "and", "to", "by", "vs", "for", "on"]; return t.split(" ").map(function (w, k) { return k && small.indexOf(w) >= 0 ? w : w.charAt(0).toUpperCase() + w.slice(1); }).join(" "); }
  // horizontal bars of serious delinquency, hollow outlines a year earlier
  function whoBars(panel, x0, x1, T, B) {
    var P = HU.t3[panel], PA = HU.t3Ago && HU.t3Ago[panel], rows = P.rows, tot = P.total;
    var LW = x0 + 92, R = x1 - 58, rh = Math.min(30, (B - T) / rows.length), mx = 0;
    rows.forEach(function (r) { mx = Math.max(mx, r.sdq); var a = PA && PA.rows.filter(function (q) { return q.label === r.label; })[0]; if (a) mx = Math.max(mx, a.sdq); });
    mx = Math.ceil(mx * 1.05) || 1;
    var X = function (v) { return LW + v / mx * (R - LW); }, red = pc("#FF453A");
    rows.forEach(function (r, k) {
      var y = T + k * rh, bh = Math.min(14, rh * 0.55), a = PA && PA.rows.filter(function (q) { return q.label === r.label; })[0];
      font(true, rh < 18 ? 8 : 9.5, INK); doc.text(pdfName(panel, r.label), x0, y + rh / 2 + (rh < 18 ? 2.5 : 0));
      if (rh >= 18 && r.share != null) { font(false, 7.5, GRY); doc.text(r.share.toFixed(r.share < 1 ? 2 : 1) + "% of loans", x0, y + rh / 2 + 9); }
      doc.setFillColor(red[0], red[1], red[2]); doc.rect(LW, y + (rh - bh) / 2, Math.max(0.8, X(r.sdq) - LW), bh, "F");
      if (a) { doc.setDrawColor(90, 90, 96); doc.setLineWidth(0.7); doc.setLineDashPattern([2, 1.5], 0); doc.rect(LW, y + (rh - bh) / 2 - 2, Math.max(0.8, X(a.sdq) - LW), bh + 4); doc.setLineDashPattern([], 0); }
      font(true, rh < 18 ? 8 : 9.5, INK); doc.text(r.sdq.toFixed(2) + "%", R + 5, y + rh / 2 + (rh < 18 ? 2.5 : 0));
      if (a && rh >= 18) { var d = r.sdq - a.sdq; font(false, 7.5, d > 0.05 ? pc("#FF9F0A") : d < -0.05 ? pc("#30D158") : GRY); doc.text((d >= 0 ? "+" : "") + d.toFixed(2) + " yr", R + 5, y + rh / 2 + 9); }
    });
    if (tot) { doc.setDrawColor(28, 28, 30); doc.setLineWidth(0.8); doc.setLineDashPattern([3, 2], 0); doc.line(X(tot.sdq), T - 2, X(tot.sdq), T + rows.length * rh + 2); doc.setLineDashPattern([], 0); font(false, 7.5, INK); doc.text("all loans " + tot.sdq.toFixed(2) + "%", X(tot.sdq), T + rows.length * rh + 11, { align: "center" }); }
  }
  function panelPhrase(panel, L) {
    if (!L || !L.x) return null;
    var hi = pdfName(panel, L.hi.label), lo = pdfName(panel, L.lo.label), x = L.x.toFixed(1) + "x";
    if (panel === "score") return "FHA Borrowers Scoring " + hi + " Are " + x + " as Likely to Be Seriously Delinquent as Those Scoring " + lo;
    if (panel === "dpa" || panel === "firstTime") return hi + " Run " + x + " " + lo;
    return hi + " Runs " + x + " " + lo;
  }
  var HU = D.hud || {};
  if (HU.t3 && HU.t3.score) {
    doc.addPage([W, H], "landscape");
    var hA = panelPhrase("score", t3Line("score", HU.t3.score)), hB = HU.t3.dpa ? panelPhrase("dpa", t3Line("dpa", HU.t3.dpa)) : null;
    var dy = headlineFit([hA, hB].filter(Boolean).join("; ") || "FHA Serious Delinquency by Borrower and Loan");
    var cap = "Serious delinquency: 90+ days late, in foreclosure or in bankruptcy, % of active FHA loans in each group (HUD " + (HU.t3At || "") + ", Table 3). Dashed outlines: the same group a year earlier (" + (HU.t3AgoAt || "n/a") + "). Dashed line: all loans in the panel. First-time vs repeat covers purchase loans only.";
    titles(L1, half, "By Credit Score", "Serious delinquency, % of loans · streamline refis have no score", T0 - 48 + dy);
    whoBars("score", L1, L1 + half, T0 + dy, B0);
    var midY = T0 + dy + (HU.t3.firstTime ? 92 : 0);
    if (HU.t3.firstTime) { titles(L2, half, "First-Time vs Repeat Buyers", "Purchase loans, serious delinquency %", T0 - 48 + dy); whoBars("firstTime", L2, L2 + half, T0 + dy, T0 + dy + 50); }
    if (HU.t3.dpa) { if (HU.t3.firstTime) titles(L2, half, "By Down Payment Assistance", "Serious delinquency, % of loans", midY - 36); else titles(L2, half, "By Down Payment Assistance", "Serious delinquency, % of loans", T0 - 48 + dy); whoBars("dpa", L2, L2 + half, HU.t3.firstTime ? midY + 12 : T0 + dy, B0); }
    caption(cap, L1, W - 72, H - 44 - 28);
    banner(++PG, "HUD " + (HU.t3At || ""));
  }
  if (HU.t2 && HU.t2.length) {
    doc.addPage([W, H], "landscape");
    var dy2 = headlineFit(whyLine(HU.t2) ? titleCase(whyLine(HU.t2)).split("Pts").join("Points") : "Why FHA Borrowers Fall Behind");
    var Q = HU.t2.filter(function (r) { return r.mon == null; }), all = HU.t2;
    titles(L1, half, "New 90+ Day Delinquencies", "Loans per fiscal quarter" + (anyOff() ? ", for the reasons shown" : "") + " (fiscal years start in October)", T0 - 48 + dy2);
    var mxn = Math.max(1, Math.max.apply(null, Q.map(nOf))), stn = nice(mxn, 4), hin = Math.ceil(mxn / stn) * stn, Lq = L1 + 34, Rq = L1 + half, Tq = T0 + dy2, Bq = B0;
    for (var v = 0; v <= hin + 1e-9; v += stn) { var yy = Bq - v / hin * (Bq - Tq); doc.setDrawColor(RULE[0], RULE[1], RULE[2]); doc.setLineWidth(0.5); doc.line(Lq, yy, Rq, yy); font(false, 8, GRY); doc.text(v >= 1000 ? Math.round(v / 1000) + "K" : String(v), Lq - 5, yy + 3, { align: "right" }); }
    var bq = (Rq - Lq) / Q.length, rc = pc("#FF453A");
    Q.forEach(function (r, k) { var x = Lq + k * bq, y = Bq - nOf(r) / hin * (Bq - Tq); doc.setFillColor(rc[0], rc[1], rc[2]); doc.rect(x + bq * 0.15, y, bq * 0.7, Bq - y, "F"); if (r.q === 1) { font(false, 8, GRY); doc.text("FY" + String(r.fy).slice(2), x + bq / 2, Bq + 11, { align: "center" }); } });
    var hidN = REASONS.filter(function (rr, j) { return HP.rOff[j]; }).map(function (rr) { return rr[0]; });
    titles(L2, half, "Share by Reason", (anyOff() ? "% of the reasons shown" : "% of new 90+ day delinquencies") + "; the current quarter month by month", T0 - 48 + dy2);
    if (hidN.length) { font(true, 8.5, pc("#FF9F0A")); doc.text(doc.splitTextToSize(clean("Showing " + (8 - hidN.length) + " of 8 reasons; hidden: " + hidN.join(", ")), W - 72).slice(0, 2), L1, T0 - 48 + dy2 + 4); }
    var Ls = L2 + 30, Rs = L2 + half - 4, bs = (Rs - Ls) / all.length;
    [0, 25, 50, 75, 100].forEach(function (v) { var yy = Bq - v / 100 * (Bq - Tq); doc.setDrawColor(RULE[0], RULE[1], RULE[2]); doc.setLineWidth(0.5); doc.line(Ls, yy, Rs, yy); font(false, 8, GRY); doc.text(v + "%", Ls - 5, yy + 3, { align: "right" }); });
    all.forEach(function (r, k) {
      var x = Ls + k * bs, acc = 0, tot = visSum(r) || 100;
      r.sh.forEach(function (v, j) { if (HP.rOff[j]) return; var c = pc(REASONS[j][1]), a = acc / tot * 100, b2 = (acc + v) / tot * 100; doc.setFillColor(c[0], c[1], c[2]); doc.rect(x + bs * 0.1, Bq - b2 / 100 * (Bq - Tq), bs * 0.8, (b2 - a) / 100 * (Bq - Tq), "F"); acc += v; });
      if (r.mon == null && r.q === 1) { font(false, 8, GRY); doc.text("FY" + String(r.fy).slice(2), x + bs / 2, Bq + 11, { align: "center" }); }
      if (r.mon != null && (k === all.length - 1 || all[k + 1].mon == null)) { font(false, 8, GRY); doc.text(MON[r.mon], x + bs / 2, Bq + 11, { align: "center" }); }
    });
    var lx = L1, ly = Bq + 26, last = all[all.length - 1];
    REASONS.forEach(function (rr, j) { var off = HP.rOff[j], c = off ? [190, 190, 195] : pc(rr[1]), t = rr[0] + (off ? " (hidden)" : " " + shOf(last, j).toFixed(1) + "%"); font(false, 8, INK); var tw = doc.getTextWidth(t) + 22; if (lx + tw > W - 36) { lx = L1; ly += 11; } doc.setFillColor(c[0], c[1], c[2]); doc.rect(lx, ly - 6.5, 7, 7, "F"); doc.text(t, lx + 10, ly); lx += tw; });
    banner(++PG, "HUD " + (HU.t2At || ""));
  }
  if (HU.fig && HU.fig.length) {
    doc.addPage([W, H], "landscape");
    var fl = figLine(HU.fig);
    var dy3 = headlineFit(fl ? "FY" + fl.fy + " FHA Loans: " + fl.v.toFixed(2) + "% Failed by Month " + fl.m + ", " + (fl.worst ? "the Highest" : "the " + ordinal(fl.rank) + "-Highest") + " of " + fl.n + " Cohorts at That Age" + (fl.prev ? " (FY" + fl.prev.fy + ": " + fl.prev.v.toFixed(2) + "%)" : "") : "FHA Failure Rate by Fiscal Year");
    titles(L1, W - 72, "Failure Rate by Fiscal Year of Origination", "Claims plus active foreclosures, % of each fiscal year's loans, by months since origination", T0 - 48 + dy3);
    var F = HU.fig, mxM = 0, mxV = 0; F.forEach(function (sr) { mxM = Math.max(mxM, sr.pts[sr.pts.length - 1][0]); sr.pts.forEach(function (p) { mxV = Math.max(mxV, p[1]); }); });
    var stf = nice(mxV || 1, 4), hif = Math.ceil((mxV || 1) / stf) * stf, mxX = Math.ceil(mxM / 12) * 12, Lf = L1 + 30, Rf = W - 36 - 40, Tf = T0 + dy3, Bf = B0;
    var XF = function (m) { return Lf + m / mxX * (Rf - Lf); }, YF = function (v) { return Bf - v / hif * (Bf - Tf); };
    for (var v3 = 0; v3 <= hif + 1e-9; v3 += stf) { doc.setDrawColor(RULE[0], RULE[1], RULE[2]); doc.setLineWidth(0.5); doc.line(Lf, YF(v3), Rf, YF(v3)); font(false, 8, GRY); doc.text((stf < 1 ? v3.toFixed(1) : String(v3)) + "%", Lf - 5, YF(v3) + 3, { align: "right" }); }
    for (var m3 = 0; m3 <= mxX; m3 += 12) { font(false, 8, GRY); doc.text(m3 === 0 ? "0" : m3 / 12 + " yr", XF(m3), Bf + 11, { align: "center" }); }
    F.forEach(function (sr, k) {
      var newest = k >= F.length - 3, c = newest ? pc(["#FF9F0A", "#FF453A", "#BF5AF2"][k - (F.length - 3)]) : [150 - k * 6, 165 - k * 6, 190 - k * 6];
      doc.setDrawColor(c[0], c[1], c[2]); doc.setLineWidth(newest ? 2 : 1.1);
      for (var i = 1; i < sr.pts.length; i++) doc.line(XF(sr.pts[i - 1][0]), YF(sr.pts[i - 1][1]), XF(sr.pts[i][0]), YF(sr.pts[i][1]));
      var lp = sr.pts[sr.pts.length - 1]; font(newest, 7.5, c); doc.text("FY" + String(sr.fy).slice(2), XF(lp[0]) + 3, YF(lp[1]) + 2.5);
    });
    caption("Read from the lines of HUD's Figure 1 (" + (HU.figAt || "") + " report), good to about 0.01 points. A loan that has gone to claim or is in foreclosure counts as a failure. The three newest fiscal years in color.", L1, W - 72, H - 44 - 28);
    banner(++PG, "HUD " + (HU.figAt || ""));
  }

  // ---- 3. Rejections ----
  if (hasRej) {
    doc.addPage([W, H], "landscape");
    headline("Credit Applications Rejected");
    lineChart(4, L1, W - 36, T0, B0, "Rejection Rates and Discouraged Borrowers", "% of applicants rejected; % who didn't apply expecting a no");
    caption(CH[4].ds + (D.sceMissing ? " " + D.sceMissing : ""), L1, W - 72, H - 44 - 40);
    banner(++PG);
  }
  return doc;
};

window.shareInfo = function () { return { title: "Borrower Credit", name: "Delinquency and rejections", asOf: D ? D.hhAsOf || "" : "" }; };
</script>
</body>
</html>`;


// ---------- Run ----------
const SOURCES = "Sources: Federal Reserve Bank of New York, Quarterly Report on Household Debt and Credit (NY Fed Consumer Credit Panel/Equifax): new seriously delinquent balances, 30-60-day late mortgage transitions; NY Fed SCE Credit Access Survey (rejections, discouraged borrowers); U.S. Department of HUD/FHA, Single Family Loan Performance Trends: Tables 1-3 (delinquency, reasons, loan characteristics) and Figure 1 (failure rates, read from the chart). Gray columns: NBER recessions.";
const NOTE = "Delinquency: the share of each loan type's balances that became 90+ days late over the past four quarters, as the NY Fed reports it. Late mortgages: of balances 30-60 days late, the share current or 90+ days late a quarter later. Rejections: from the NY Fed's Credit Access Survey, fielded every four months to about 1,000 households, so single readings are noisy; the rejection rate is among people who applied, and discouraged borrowers are people who wanted credit but didn't apply because they expected to be turned down. FHA: share of active FHA single-family loans by count, seasonally adjusted, from HUD's monthly report; serious delinquency is 90+ days late plus in foreclosure plus in bankruptcy. Who's falling behind: serious delinquency for each group of active FHA loans in HUD's newest report (Table 3), with the same group a year earlier; shares are each group's share of loans in its panel (streamline refinances have no credit score, so they're left out of the score panel). Why: HUD's reasons for new 90+ day delinquencies by fiscal quarter (October starts the fiscal year), with the current quarter's months so far; National emergency includes the COVID-19 pandemic. Failing by vintage: loans gone to claim or in foreclosure as a share of each fiscal year's loans, by months since origination, read from the lines of HUD's Figure 1, so values are good to about 0.01 points. The NY Fed and HUD revise recent periods.";
function payload(s) {
  if (!s) return null;
  const hh = s.hh || {}, sce = s.sce || {}, waves = sce.waves || [];
  const lastT = (arr) => (arr && arr.length ? arr[arr.length - 1].t : null);
  const qn = (t) => (t == null ? null : `Q${Math.floor((t % 12) / 3) + 1} ${Math.floor(t / 12)}`);
  const mn = (t) => (t == null ? null : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][t % 12] + " " + Math.floor(t / 12));
  const found = sce.found || [];
  const fp = (s.fha && s.fha.pts) || {};
  const fha = Object.keys(fp).map(Number).sort((a, b) => a - b).filter((t) => fp[t].s).map((t) => ({ t, d30: fp[t].s[0], d60: fp[t].s[1], sdq: fp[t].s[2] }));
  const errs = [].concat(s.errors || [], s.fhaErrors || [], s.gseErrors || []);
  const gs = (k) => { const p = (s.gse && s.gse[k] && s.gse[k].pts) || {}; return Object.keys(p).map(Number).sort((a, b) => a - b).map((t) => ({ t, v: p[t] })); };
  return {
    fha, fhaAsOf: fha.length ? mn(fha[fha.length - 1].t) : null,
    hud: hudPayload(s.fha, mn),
    gse: { fnm: gs("fnm"), fre: gs("fre") },
    sched: bcSchedule(s),
    fhaPdf: s.fha && Object.keys(s.fha.files || {}).length ? mn(Math.max(...Object.keys(s.fha.files).map(Number))) : null,
    del: hh.del || null, cure: hh.cure || [], roll: hh.roll || [], orig: hh.orig || [], med: hh.med || [], brk: hh.brk || null,
    waves, recessions: RECESSIONS,
    hhAsOf: qn(lastT(hh.del && hh.del.mortgage)), sceAsOf: mn(lastT(waves)),
    sceMissing: waves.length && !found.includes("mrej") ? "The survey file has no mortgage-specific rejection column this release, so the chart shows the rejection rate for any credit. Columns: " + (sce.headers || []).join(", ") + "." : "",
    sources: SOURCES, note: NOTE, errors: errs.length ? errs : null,
    checked: s.checked ? new Date(s.checked).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "",
  };
}
// Tables 2-3 and Figure 1 for the page: the newest report, and Table 3 a year earlier
function hudPayload(f, mn) {
  if (!f) return null;
  const ks = Object.keys(f.t3 || {}).map(Number).sort((a, b) => a - b), now = ks.length ? ks[ks.length - 1] : null;
  const ago = now == null ? null : [now - 12, now - 11, now - 13].find((k) => f.t3[k]);
  return {
    t3: now != null ? f.t3[now] : null, t3At: now != null ? mn(now) : null,
    t3Ago: ago != null ? f.t3[ago] : null, t3AgoAt: ago != null ? mn(ago) : null,
    t2: f.t2 || [], t2At: f.t2At != null ? mn(f.t2At) : null,
    fig: f.fig ? f.fig.series : null, figAt: f.fig ? mn(f.fig.t) : null,
    errs: [f.t3Err, f.t2Err, f.figErr].filter(Boolean),
  };
}
async function openFullScreen(saved) {
  const wv = updWV(new WebView());
  await wv.loadHTML(...updArgs(PAGE_HTML.replace("__DATA__", () => JSON.stringify(payload(saved))).replace("__SHARE__", () => "<script>" + SHARE_PAGE_JS + "</script>")));
  await presentWithSharing(wv, async (isOpen) => {
    // taps on the HUD report link, answered while the downloads below carry on
    let latest = saved;
    const poll = (async () => {
      while (isOpen()) {
        await sleep(500);
        let want = false;
        try { want = await wv.evaluateJavaScript("window.__takeHud ? window.__takeHud() : false"); } catch (e) {}
        if (!want) continue;
        try { await openHudPdf(latest); }
        catch (e) { const a = new Alert(); a.title = "Couldn't open HUD's PDF"; a.message = e.message || String(e); a.addAction("OK"); await a.present(); }
      }
    })();
    try {
      await sleep(700); // let the page draw before the downloads start
      const say = async (t) => { try { if (isOpen()) await wv.evaluateJavaScript(`window.setStatus(${JSON.stringify(t)});0`); } catch (e) {} };
      const fresh = await refresh(saved, false, say);
      latest = fresh;
      if (isOpen() && (fresh.hh || fresh.sce)) await wv.evaluateJavaScript(`window.update(${JSON.stringify(payload(fresh))});0`);
      else if (isOpen() && fresh.errors) await wv.evaluateJavaScript(`document.getElementById("errs").textContent = ${JSON.stringify("Couldn't load: " + fresh.errors.join(" · "))};0`);
      // then HUD's FHA reports (the first time, a few minutes to read back to 2015)
      const sayF = async (t) => { try { if (isOpen()) await wv.evaluateJavaScript(`window.setFhaStatus(${JSON.stringify(t)});0`); } catch (e) {} };
      const withFha = await refreshFha(fresh, sayF, isOpen);
      latest = withFha;
      if (isOpen() && (withFha.hh || withFha.sce || withFha.fha)) await wv.evaluateJavaScript(`window.update(${JSON.stringify(payload(withFha))});0`);
      // then Fannie and Freddie for the conventional comparison
      const withGse = await refreshGse(withFha, sayF, isOpen);
      latest = withGse;
      await sayF("");
      if (isOpen() && (withGse.hh || withGse.sce || withGse.fha)) await wv.evaluateJavaScript(`window.update(${JSON.stringify(payload(withGse))});0`);
    } catch (e) {
      try { await wv.evaluateJavaScript(`document.getElementById("errs").textContent = ${JSON.stringify("Couldn't load the data: " + (e.message || e))};0`); } catch (e2) {}
    }
    await poll;
  });
}
if (config.runsInWidget || PREVIEW_WIDGET_IN_APP) {
  let widget;
  try {
    let s = readJSON(FILE);
    if (!s || !s.hh) {
      const fresh = await Promise.race([refresh(s, false).catch(() => null), sleep(WIDGET_SECONDS * 1000).then(() => null)]);
      if (fresh && fresh.hh) s = fresh;
    }
    if (!s || !s.hh) throw new Error("Open the script once in Scriptable to download the NY Fed data.");
    widget = new ListWidget();
    widget.backgroundImage = updRing(smallImage(s));
    widget.addSpacer();
    widget.url = URLScheme.forRunningScript();
    widget.refreshAfterDate = new Date(Date.now() + 12 * 3600 * 1000);
  } catch (e) {
    widget = errorWidget(e.message || String(e));
  }
  if (config.runsInWidget) Script.setWidget(widget);
  else await widget.presentSmall();
} else {
  await openFullScreen(readJSON(FILE));
}
Script.complete();
// Update test, Nov 17, 2026 (no change in behavior)
