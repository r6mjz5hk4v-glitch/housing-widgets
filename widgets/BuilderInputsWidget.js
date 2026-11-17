// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-green; icon-glyph: hammer;

// ---- Shared settings (saved on this phone by the Setup script) ----
// Keys and personal settings live in the phone's keychain, not in this file,
// so the file can be shared as is.
function setting(key, fallback) {
  try { if (Keychain.contains(key)) { const v = Keychain.get(key); if (v) return v; } } catch (e) {}
  return fallback;
}


// Builder Inputs for Scriptable
// How much of new-home price appreciation building costs can explain (an
// estimate). What costs don't explain is left blank, not labeled.
// - Price: Census price index of new single-family houses sold, including the
//   lot, constant quality (holds size and features fixed), quarterly, 2005 = 100.
//   Downloaded from Census as a spreadsheet; built-in history 2012-2025.
// - Materials: BLS producer price index, net inputs to single-family
//   construction, goods less food and energy (FRED WPUIP23111013), monthly.
//   Lumber (FRED WPU081) is split out of it; "other materials" is the rest.
// - Labor: average hourly earnings, construction production workers (FRED
//   AHECONS), monthly, not seasonally adjusted.
// - Lot: Census median lot value of new single-family spec homes by year
//   started, via NAHB (annual; update LOT_VALUES each summer).
// - Median: Census median sales price of new houses sold (FRED MSPNHSUS),
//   monthly, averaged by quarter. Anchors the index in dollars: the base
//   quarter's median grown by the index = the same house at later prices.
// - Materials breakdown: BLS producer price indexes for the main products in a
//   house (COMPONENTS below), each on its own; fetched when the script is opened.
// Split: each cost's change times its share of the price (NAHB 2024 Cost of
// Constructing a Home survey) = the points of price change it explains.
// Costs are lagged two quarters: what builders paid shows up at closing later.
// Small widget: the latest quarter's split. Tap for the full screen: pinch any
// time chart to zoom, tap to read, tap a chip to hide a line. Share as PDF.

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

const PREVIEW_WIDGET_IN_APP = false;
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

const CENSUS_PRICE_XLSX = "https://www.census.gov/construction/nrs/xls/price_sold_cust.xlsx";
const FILE = "builder-margins-v3.json";
const REFRESH_HOURS = 12;
const WIDGET_SECONDS = 20;
const TITLE = "Builder Inputs";

// Shares of a new home's sales price, NAHB Cost of Constructing a Home 2024:
// construction 64.4%, finished lot 13.7% (profit 11.0%, overhead 5.7%,
// commission 2.8%, financing 1.5%, marketing 0.8% make up the rest).
const SHARE_CONSTRUCTION = 0.644;
const SHARE_LOT = 0.137;
// NAHB doesn't split construction into materials and labor; this is an
// assumption (roughly 55/45), so treat the materials/labor line as rough.
const MATERIALS_OF_CONSTRUCTION = 0.55;
// Lumber's share of the price: NAHB put the softwood lumber products in an
// average new single-family home (framing lumber, OSB, plywood) at $16,927 at
// April 2020 prices, about 4.3% of that year's average new-home price. Rounded
// to 4.5%, an assumption. It's carved out of materials: other materials = the
// BLS materials index less lumber at that weight.
const SHARE_LUMBER = 0.045;
const LAG_QUARTERS = 2;       // costs paid show up in prices about 6 months later
const BASE_QUARTER = "2019-Q4"; // "since" view starts from here (pre-COVID)
const FIRST_SPLIT = "2020-Q1";  // the quarterly split starts here

// Census median lot value, new single-family spec homes by year started (NAHB):
// 2020 $53K ("up 18%", so 2019 about $45K), 2021 $55K, 2022 $56K, 2023 $58K,
// 2024 $60K, 2025 $59K. Each year sits at mid-year and is drawn straight between.
// The materials breakdown: BLS producer price indexes (FRED IDs), monthly, not
// seasonally adjusted. BLS stopped publishing OSB in 2019, so it isn't here.
const COMPONENTS = [
  ["WPU083103035", "Softwood plywood"], ["WPU082", "Millwork (doors, windows, trim)"],
  ["WPU133301", "Ready-mix concrete"], ["WPU137", "Gypsum (drywall)"], ["WPU139201", "Insulation"],
  ["WPU136101", "Asphalt roofing & siding"], ["WPU1017", "Steel mill products"],
  ["WPU10260314", "Copper wire & cable"], ["WPU105", "Plumbing fixtures"], ["WPU124", "Household appliances"],
];
// What single-family construction buys of each product: BEA 2017 input-output
// Use table (detail, before redefinitions, producer prices), industry 233411,
// $ millions. Used only as each product's share of the materials bill.
const BEA_W = {
  lum: [1912, ""], WPU083103035: [3292, "+ OSB, trusses"], WPU082: [1400, ""], WPU133301: [3409, ""],
  WPU137: [871, ""], WPU139201: [1196, ""], WPU136101: [376, ""], WPU1017: [322, ""],
  WPU10260314: [491, ""], WPU105: [838, ""], WPU124: [2285, ""],
};
const LOT_VALUES = [[2019, 45000], [2020, 53000], [2021, 55000], [2022, 56000], [2023, 58000], [2024, 60000], [2025, 59000]];

// Census price index, houses sold incl. lot (2005 = 100), Q1-Q4, from Census's
// table; the live download replaces these and adds newer quarters.
const PRICE_SEED = {
  2012: [94.0, 95.2, 98.9, 100.0], 2013: [101.4, 104.7, 104.8, 105.8], 2014: [106.8, 112.7, 112.1, 114.4],
  2015: [111.0, 110.8, 112.8, 116.9], 2016: [119.0, 119.0, 122.4, 123.7], 2017: [124.7, 126.4, 128.4, 127.8],
  2018: [129.8, 131.0, 132.5, 135.1], 2019: [129.9, 133.9, 137.7, 137.1], 2020: [135.7, 137.5, 143.3, 144.9],
  2021: [153.3, 159.3, 167.3, 174.6], 2022: [181.5, 185.4, 186.5, 186.7], 2023: [185.7, 184.2, 198.4, 186.4],
  2024: [187.7, 195.0, 189.8, 194.2], 2025: [196.3, 195.8, 197.6, 198.6],
};

const GRAY = "#98989F";
const C = {
  mat: "#FF9F0A", lab: "#64A8FF", lot: "#BF5AF2", price: "#FFFFFF", lum: "#FFD60A", all: "#8E8E93", med: "#FF6B6B",
  pmat: "#C26A00", plab: "#0A62D0", plot: "#8E3BB8", pprice: "#1C1C1E", plum: "#B38600", pall: "#8E8E93", pmed: "#D1343F",
};

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

// ---------- Sources ----------
async function fredMonthly(id) {
  const req = new Request(`https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=${FRED_KEY}&file_type=json&observation_start=2010-01-01`);
  req.timeoutInterval = 20;
  const j = await req.loadJSON();
  if (!j.observations) throw new Error(j.error_message || `FRED has no ${id}`);
  return j.observations.filter((o) => o.value !== ".").map((o) => ({ m: o.date.slice(0, 7), v: parseFloat(o.value) }));
}

// Census publishes the index as an Excel file. It's unzipped and read in a
// hidden web page: find the row with the quarter headings, then read each
// year's four quarters from the first table under it.
const XLSX_JS = `
window.__out = "";
(async function () {
  try {
    var b = atob(window.__b64), u = new Uint8Array(b.length);
    for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
    var dv = new DataView(u.buffer), e = -1;
    for (var i2 = u.length - 22; i2 >= Math.max(0, u.length - 70000); i2--) { if (dv.getUint32(i2, true) === 0x06054b50) { e = i2; break; } }
    if (e < 0) throw new Error("not a spreadsheet");
    var n = dv.getUint16(e + 10, true), p = dv.getUint32(e + 16, true), files = {};
    for (var k = 0; k < n; k++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      var nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
      var name = new TextDecoder().decode(u.subarray(p + 46, p + 46 + nl));
      files[name] = { method: dv.getUint16(p + 10, true), size: dv.getUint32(p + 20, true), at: dv.getUint32(p + 42, true) };
      p += 46 + nl + xl + cl;
    }
    async function read(nm) {
      var f = files[nm]; if (!f) return null;
      var start = f.at + 30 + dv.getUint16(f.at + 26, true) + dv.getUint16(f.at + 28, true), data = u.subarray(start, start + f.size);
      if (f.method === 0) return new TextDecoder().decode(data);
      return await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text();
    }
    var xml = function (t) { return new DOMParser().parseFromString(t, "application/xml"); };
    var strings = [], ssT = await read("xl/sharedStrings.xml");
    if (ssT) { var si = xml(ssT).getElementsByTagName("si"); for (var s = 0; s < si.length; s++) strings.push(si[s].textContent); }
    var sheets = Object.keys(files).filter(function (f) { return f.indexOf("xl/worksheets/sheet") === 0; }).sort();
    var colOf = function (ref) { var c = 0; for (var q = 0; q < ref.length; q++) { var ch = ref.charCodeAt(q); if (ch < 65 || ch > 90) break; c = c * 26 + (ch - 64); } return c - 1; };
    var ORD = [["first", "1st"], ["second", "2nd"], ["third", "3rd"], ["fourth", "4th"]];
    var qOf = function (t) {
      t = String(t || "");
      for (var o = 0; o < 4; o++) {
        if ((t.indexOf("quarter") >= 0 || t.indexOf("qtr") >= 0) && (t.indexOf(ORD[o][0]) >= 0 || t.indexOf(ORD[o][1]) >= 0)) return o + 1;
        var qq2 = "q" + (o + 1), at = t.indexOf(qq2);
        if (at >= 0 && (at === 0 || " -:".indexOf(t.charAt(at - 1)) >= 0) && t.length === at + 2) return o + 1;
      }
      return 0;
    };
    var out = [];
    for (var sh = 0; sh < sheets.length && !out.length; sh++) {
      var rows = xml(await read(sheets[sh])).getElementsByTagName("row"), qcol = null, seen = {}, byRow = {}, lastY = 0;
      for (var r = 0; r < rows.length; r++) {
        var cells = rows[r].getElementsByTagName("c"), vals = [];
        for (var c2 = 0; c2 < cells.length; c2++) {
          var cell = cells[c2], t = cell.getAttribute("t"), vEl = cell.getElementsByTagName("v")[0], v = "";
          if (t === "s" && vEl) v = strings[+vEl.textContent] || "";
          else if (t === "inlineStr") v = cell.textContent;
          else if (vEl) v = vEl.textContent;
          vals[colOf(cell.getAttribute("r") || "A")] = String(v).trim();
        }
        var low = []; for (var li = 0; li < vals.length; li++) low.push(String(vals[li] || "").toLowerCase());
        var find = function (words) { for (var w = 0; w < low.length; w++) for (var z = 0; z < words.length; z++) if (low[w].indexOf(words[z]) >= 0) return w; return -1; };
        var hq = [find(["first quarter", "1st quarter", "first qtr", "1st qtr"]), find(["second quarter", "2nd quarter", "second qtr", "2nd qtr"]), find(["third quarter", "3rd quarter", "third qtr", "3rd qtr"]), find(["fourth quarter", "4th quarter", "fourth qtr", "4th qtr"])];
        if (hq[0] >= 0 && hq[1] >= 0 && hq[2] >= 0 && hq[3] >= 0) { if (qcol && out.length) break; qcol = hq; continue; }
        // other layout: one quarter per row (year in a cell or carried down, a quarter label, then the index)
        for (var w2 = 0; w2 < low.length; w2++) { var yy = parseInt(low[w2], 10); if (String(yy) === String(low[w2] || "").slice(0, 4) && yy > 1960 && yy < 2100) { lastY = yy; break; } }
        var qn = 0, qat = -1;
        for (var w3 = 0; w3 < low.length && !qn; w3++) qn = qOf(low[w3]), qat = w3;
        if (qn && lastY && !qcol) { for (var w4 = qat + 1; w4 < vals.length; w4++) { var xv = parseFloat(vals[w4]); if (isFinite(xv) && xv > 20 && xv < 1000) { if (!byRow[lastY + "-Q" + qn]) byRow[lastY + "-Q" + qn] = xv; break; } } }
        if (!qcol) continue;
        var y = parseInt(vals[0], 10);
        if (!(y > 1960 && y < 2100) || seen[y]) continue;
        seen[y] = 1;
        for (var qq = 0; qq < 4; qq++) { var x = parseFloat(vals[qcol[qq]]); if (qcol[qq] >= 0 && isFinite(x) && x > 0) out.push({ k: y + "-Q" + (qq + 1), v: x }); }
      }
      if (!out.length && Object.keys(byRow).length >= 8) out = Object.keys(byRow).sort().map(function (kk) { return { k: kk, v: byRow[kk] }; });
    }
    if (!out.length) throw new Error("no quarterly index found in the spreadsheet");
    window.__out = JSON.stringify(out);
  } catch (err) { window.__out = "ERR " + (err && err.message ? err.message : err); }
})();
0;
`;
async function censusPrice() {
  const req = new Request(CENSUS_PRICE_XLSX);
  req.timeoutInterval = 40;
  const data = await req.load();
  const st = req.response && req.response.statusCode;
  if (st !== 200) throw new Error(`Census price index: status ${st}`);
  const wv = updWV(new WebView());
  await wv.loadHTML(...updArgs("<!DOCTYPE html><html><body></body></html>"));
  await wv.evaluateJavaScript("window.__b64 = " + JSON.stringify(data.toBase64String()) + ";0", false);
  await wv.evaluateJavaScript(XLSX_JS, false);
  for (let i = 0; i < 120; i++) {
    await sleep(250);
    const out = await wv.evaluateJavaScript("window.__out", false);
    if (out) {
      if (out.startsWith("ERR ")) throw new Error("Census price index: " + out.slice(4));
      return JSON.parse(out);
    }
  }
  throw new Error("Census price index: still reading after 30 seconds");
}

// ---------- Refresh: keeps the last good copy of each piece ----------
async function refresh(saved, force, allowWebView) {
  if (saved && !force && hoursSince(saved.checked) < REFRESH_HOURS) return saved;
  const prev = saved || {};
  const out = { price: prev.price || null, mat: prev.mat || null, lum: prev.lum || null, wage: prev.wage || null, med: prev.med || null, comps: Object.assign({}, prev.comps || {}), errors: [] };
  const jobs = [
    ["mat", () => fredMonthly("WPUIP23111013")],
    ["lum", () => fredMonthly("WPU081")],
    ["wage", () => fredMonthly("AHECONS")],
    ["med", () => fredMonthly("MSPNHSUS")],
  ];
  if (allowWebView) jobs.push(["price", () => censusPrice()]);
  const missing = [];
  await Promise.all(jobs.map(async ([k, f]) => {
    try { const v = await f(); if (v && v.length) out[k] = v; }
    catch (e) { out.errors.push(e.message || String(e)); }
  }).concat(allowWebView ? COMPONENTS.map(async ([id, name]) => {
    try { const v = await fredMonthly(id); if (v && v.length) out.comps[id] = v.filter((x) => x.m >= "2015"); else missing.push(name); }
    catch (e) { missing.push(name); }
  }) : []));
  if (missing.length) out.errors.push("Materials breakdown, couldn't get: " + missing.join(", "));
  if (!out.mat && !out.wage) throw new Error(out.errors.join(" · ") || "Couldn't reach FRED");
  out.checked = new Date().toISOString();
  out.priceChecked = allowWebView && !out.errors.some((x) => x.startsWith("Census")) ? out.checked : prev.priceChecked || null;
  if (!out.errors.length) out.errors = null;
  writeJSON(FILE, out);
  return out;
}

// ---------- The split ----------
const qIdx = (k) => +k.slice(0, 4) * 4 + +k.slice(6) - 1;
const qKey = (i) => `${Math.floor(i / 4)}-Q${(i % 4) + 1}`;
const qLabel = (i) => `Q${(i % 4) + 1} ${Math.floor(i / 4)}`;
function quarterly(pts) {
  const sum = {}, n = {};
  for (const p of pts || []) { const i = +p.m.slice(0, 4) * 4 + Math.floor((+p.m.slice(5, 7) - 1) / 3); sum[i] = (sum[i] || 0) + p.v; n[i] = (n[i] || 0) + 1; }
  const out = {};
  for (const i in sum) if (n[i] === 3) out[i] = sum[i] / 3;
  return out;
}
// Lot values: each year at mid-year (July), straight lines between, flat beyond the ends
function lotQuarterly(fromQ, toQ) {
  const pts = LOT_VALUES.map(([y, v]) => [y * 12 + 6, v]), out = {};
  const at = (mi) => {
    if (mi <= pts[0][0]) return pts[0][1];
    for (let k = 1; k < pts.length; k++) if (mi <= pts[k][0]) { const [a, va] = pts[k - 1], [b, vb] = pts[k]; return va + ((vb - va) * (mi - a)) / (b - a); }
    return pts[pts.length - 1][1];
  };
  for (let q = fromQ; q <= toQ; q++) { const y = Math.floor(q / 4), m0 = (q % 4) * 3; out[q] = (at(y * 12 + m0) + at(y * 12 + m0 + 1) + at(y * 12 + m0 + 2)) / 3; }
  return out;
}
function priceMap(s) {
  const P = {};
  for (const y in PRICE_SEED) PRICE_SEED[y].forEach((v, k) => { P[+y * 4 + k] = v; });
  for (const r of s.price || []) P[qIdx(r.k)] = r.v;
  return P;
}
// Pieces of the split, in stacking order
const PARTS = [["lum", "Lumber"], ["mat", "Other materials"], ["lab", "Labor"], ["lot", "Lot"]];
function compute(s) {
  const P = priceMap(s), M = quarterly(s.mat), W = quarterly(s.wage), LB = quarterly(s.lum);
  const qs = Object.keys(P).map(Number).sort((a, b) => a - b);
  const lastP = qs[qs.length - 1];
  const LOT = lotQuarterly(qs[0] - 12, lastP + 8);
  const wM = SHARE_CONSTRUCTION * MATERIALS_OF_CONSTRUCTION, wLum = SHARE_LUMBER, wW = SHARE_CONSTRUCTION * (1 - MATERIALS_OF_CONSTRUCTION), wL = SHARE_LOT, L = LAG_QUARTERS;
  const r = wLum / wM; // lumber's weight inside materials
  const pct = (a, b) => (a != null && b ? (a / b - 1) * 100 : null);
  const rows = [];
  for (let q = qIdx(FIRST_SPLIT); q <= lastP; q++) {
    const price = pct(P[q], P[q - 4]), m = pct(M[q - L], M[q - L - 4]), lb = pct(LB[q - L], LB[q - L - 4]), w = pct(W[q - L], W[q - L - 4]), l = pct(LOT[q - L], LOT[q - L - 4]);
    if (price == null || m == null || lb == null || w == null || l == null) continue;
    rows.push({ q, price, lum: wLum * lb, mat: wM * m - wLum * lb, lab: wW * w, lot: wL * l });
  }
  const b = qIdx(BASE_QUARTER), last = rows.length ? rows[rows.length - 1].q : lastP;
  let cum = null;
  const cp = pct(P[last], P[b]), cm = pct(M[last - L], M[b - L]), cb = pct(LB[last - L], LB[b - L]), cw = pct(W[last - L], W[b - L]), cl = pct(LOT[last - L], LOT[b - L]);
  if (cp != null && cm != null && cb != null && cw != null && cl != null) cum = { from: b, to: last, price: cp, lum: wLum * cb, mat: wM * cm - wLum * cb, lab: wW * cw, lot: wL * cl, raw: { lum: cb, mat: (cm - r * cb) / (1 - r), all: cm, lab: cw, lot: cl } };
  // Indexed to the base quarter = 100, on a month axis (t = year*12 + month-1);
  // quarterly series sit at the middle month of their quarter
  const mi = (m) => +m.slice(0, 4) * 12 + +m.slice(5, 7) - 1;
  const t0 = Math.floor(b / 4) * 12 + (b % 4) * 3;
  const baseOf = (pts) => { const v = (pts || []).filter((x) => { const t = mi(x.m); return t >= t0 && t < t0 + 3; }); return v.length === 3 ? v.reduce((a, x) => a + x.v, 0) / 3 : null; };
  const monthly = (pts, b0) => (b0 ? (pts || []).filter((x) => mi(x.m) >= t0 - 3).map((x) => ({ t: mi(x.m), v: (x.v / b0) * 100 })) : []);
  const M0 = baseOf(s.mat), L0 = baseOf(s.lum), W0 = baseOf(s.wage);
  const MD = quarterly(s.med), anchor = MD[b] || null;
  const idx = { price: [], med: [], lot: [], lum: monthly(s.lum, L0), all: monthly(s.mat, M0), lab: monthly(s.wage, W0), mat: [] };
  if (M0 && L0) {
    const lumAt = {}; (s.lum || []).forEach((x) => { lumAt[x.m] = x.v; });
    idx.mat = (s.mat || []).filter((x) => mi(x.m) >= t0 - 3 && lumAt[x.m] != null).map((x) => ({ t: mi(x.m), v: ((x.v / M0 - r * (lumAt[x.m] / L0)) / (1 - r)) * 100 }));
  }
  const lastLotT = LOT_VALUES[LOT_VALUES.length - 1][0] * 12 + 6;
  for (let q = b - 1; q <= lastP; q++) {
    const t = Math.floor(q / 4) * 12 + (q % 4) * 3 + 1;
    if (P[q] && P[b]) idx.price.push({ t, v: (P[q] / P[b]) * 100 });
    if (t <= lastLotT && LOT[q] && LOT[b]) idx.lot.push({ t, v: (LOT[q] / LOT[b]) * 100 });
  }
  if (anchor) Object.keys(MD).map(Number).sort((x, y) => x - y).forEach((q) => { if (q >= b - 1) idx.med.push({ t: Math.floor(q / 4) * 12 + (q % 4) * 3 + 1, v: (MD[q] / anchor) * 100 }); });
  // Dollars: the base quarter's median is the anchor. A cost's dollars per
  // house = its share x the anchor x its index; points of price change x the
  // anchor (or the year-earlier same-house price) = dollars per house.
  if (anchor) rows.forEach((r) => { r.yb = (anchor * P[r.q - 4]) / P[b]; });
  const dol = anchor ? {
    anchor,
    mul: { price: anchor, med: anchor, lum: wLum * anchor, mat: (wM - wLum) * anchor, all: wM * anchor, lab: wW * anchor, lot: wL * anchor },
    act: { lab: W0, lot: LOT[b] },
  } : null;
  // The materials breakdown: each product's latest month vs its base-quarter
  // average, and vs the same month a year earlier
  const comps = [];
  const one = (key, name, pts) => {
    const b0 = baseOf(pts); if (!b0 || !pts.length) return;
    const lp = pts[pts.length - 1], ago = pts.find((x) => mi(x.m) === mi(lp.m) - 12);
    comps.push({ key, name, m: lp.m, since: (lp.v / b0 - 1) * 100, yoy: ago ? (lp.v / ago.v - 1) * 100 : null });
  };
  COMPONENTS.forEach(([id, name]) => one(id, name, (s.comps || {})[id]));
  one("lum", "Lumber", s.lum);
  one("all", "All builder materials (BLS)", s.mat);
  if (cp != null && P[lastP - 4]) comps.push({ key: "price", name: "New-home price", m: qLabel(lastP), since: pct(P[lastP], P[b]), yoy: pct(P[lastP], P[lastP - 4]) });
  comps.sort((x, y) => y.since - x.since);
  // Impact: price change x share of the materials bill (shares among the
  // products present), in points
  const wsum = comps.reduce((a, x) => a + (BEA_W[x.key] ? BEA_W[x.key][0] : 0), 0);
  comps.forEach((x) => { const bw = BEA_W[x.key]; if (bw && wsum) { x.w = bw[0] / wsum * 100; x.imp = x.w * x.since / 100; if (bw[1]) x.wn = bw[1]; } });
  const latestMonth = (pts) => (pts && pts.length ? pts[pts.length - 1].m : null);
  return {
    rows, cum, idx, comps, lastP, base: b, dol, lotThrough: LOT_VALUES[LOT_VALUES.length - 1][0],
    weights: { lum: wLum, mat: wM - wLum, lab: wW, lot: wL },
    through: { price: qLabel(lastP), mat: latestMonth(s.mat), lum: latestMonth(s.lum), lab: latestMonth(s.wage) },
  };
}

// ---------- Small widget ----------
function drawText(ctx, str, rect, font, hex, align) {
  ctx.setFont(font); ctx.setTextColor(new Color(hex));
  if (align === "right") ctx.setTextAlignedRight(); else if (align === "center") ctx.setTextAlignedCenter(); else ctx.setTextAlignedLeft();
  ctx.drawTextInRect(str, rect);
}
const sgn = (v, d) => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(d == null ? 1 : d);
// The face: the same house (the base quarter's median grown by the price
// index) vs the median new-home price, in dollars, gap shaded
const fK = (v) => `$${Math.round(v / 1000)}K`;
function smallImage(s) {
  const W = 170, ctx = new DrawContext();
  ctx.size = new Size(W, W); ctx.opaque = true; ctx.respectScreenScale = true;
  for (let i = 0; i < 34; i++) {
    const f = i / 33, c = [0x2c, 0x2c, 0x2e].map((v, j) => Math.round(v + ([0x1c, 0x1c, 0x1e][j] - v) * f).toString(16).padStart(2, "0")).join("");
    ctx.setFillColor(new Color("#" + c)); ctx.fillRect(new Rect(0, (W * i) / 34, W, W / 34 + 1));
  }
  drawText(ctx, TITLE, new Rect(14, 10, 142, 17), Font.boldSystemFont(13), "#FFFFFF", "left");
  const R = compute(s), A = R.dol && R.dol.anchor, P = R.idx.price, M = R.idx.med;
  if (!A || P.length < 2 || M.length < 2) { drawText(ctx, "Open the script once to load the median price", new Rect(14, 60, 142, 40), Font.systemFont(11), GRAY, "left"); return ctx.getImage(); }
  const lastQ = (pts) => { const t = pts[pts.length - 1].t; return `Q${Math.floor((t % 12) / 3) + 1} ${Math.floor(t / 12)}`; };
  drawText(ctx, `Same house vs median · ${lastQ(P)}`, new Rect(14, 27, 142, 13), Font.mediumSystemFont(9.5), GRAY, "left");
  const L = 14, Rr = 108, T = 50, B = 140;
  const a = P[0].t, b = Math.max(P[P.length - 1].t, M[M.length - 1].t);
  const all = P.concat(M).map((p) => (p.v / 100) * A), hi = Math.max(...all), lo = Math.min(...all), pad = (hi - lo) * 0.08;
  const X = (t) => L + ((t - a) / Math.max(1, b - a)) * (Rr - L), Y = (v) => T + ((hi + pad - v) / (hi - lo + 2 * pad)) * (B - T);
  // shaded gap where both have a point
  const mAt = {}; M.forEach((p) => { mAt[p.t] = p.v; });
  const both = P.filter((p) => mAt[p.t] != null);
  if (both.length > 1) {
    const g = new Path();
    g.addLines(both.map((p) => new Point(X(p.t), Y((p.v / 100) * A))).concat(both.slice().reverse().map((p) => new Point(X(p.t), Y((mAt[p.t] / 100) * A)))));
    g.closeSubpath(); ctx.addPath(g); ctx.setFillColor(new Color(C.med, 0.22)); ctx.fillPath();
  }
  // year ticks
  for (let y = Math.ceil(a / 12); y * 12 <= b; y++) if (y % 2 === 0) drawText(ctx, `'${String(y).slice(2)}`, new Rect(X(y * 12) - 12, B + 4, 24, 11), Font.mediumSystemFont(8.5), GRAY, "center");
  const line = (pts, hex, w) => { const p = new Path(); p.addLines(pts.map((q) => new Point(X(q.t), Y((q.v / 100) * A)))); ctx.addPath(p); ctx.setStrokeColor(new Color(hex)); ctx.setLineWidth(w); ctx.strokePath(); };
  line(M, C.med, 2); line(P, "#FFFFFF", 2.4);
  // latest values at the right edge, kept apart
  let yS = Y((P[P.length - 1].v / 100) * A), yM = Y((M[M.length - 1].v / 100) * A);
  if (Math.abs(yS - yM) < 24) { const mid = (yS + yM) / 2, up = yS <= yM; yS = mid + (up ? -12 : 12); yM = mid + (up ? 12 : -12); }
  [[yS, fK((P[P.length - 1].v / 100) * A), "same house", "#FFFFFF"], [yM, fK((M[M.length - 1].v / 100) * A), "median", C.med]].forEach(([y, v, n, hex]) => {
    const yy = Math.max(T - 6, Math.min(B - 14, y - 8));
    drawText(ctx, v, new Rect(Rr + 4, yy, 54, 13), Font.boldSystemFont(11.5), hex, "left");
    drawText(ctx, n, new Rect(Rr + 4, yy + 12, 54, 10), Font.mediumSystemFont(8), hex, "left");
  });
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
<title>Builder Inputs</title>
<style>
  :root { --bg:#1C1C1E; --fg:#FFFFFF; --gray:#98989F; }
  * { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  body { margin:0; padding:20px 16px 36px; background:var(--bg); color:var(--fg);
         font-family:-apple-system,system-ui,sans-serif; -webkit-user-select:none; user-select:none; }
  .ticker { font-size:26px; font-weight:800; letter-spacing:-0.3px; }
  .hint { color:var(--gray); font-size:12px; margin-top:6px; line-height:1.4; }
  .h2 { font-size:12px; font-weight:700; color:var(--gray); letter-spacing:0.4px; margin:26px 0 2px; text-transform:uppercase; }
  .sub { color:var(--gray); font-size:11.5px; margin-bottom:4px; }
  .legend { display:flex; flex-wrap:wrap; gap:6px; margin:6px 0 4px; }
  .chip { border-radius:10px; padding:5px 8px; background:#2C2C2E; font-size:12.5px; font-weight:700; line-height:1.25; font-variant-numeric:tabular-nums; }
  .chip.tog { cursor:pointer; }
  .chip.off { opacity:0.35; }
  .chip .v { color:#FFFFFF; }
  .chip.sum { background:transparent; border:1px solid #3A3A3C; color:var(--gray); }
  .wrap { position:relative; }
  .touch { position:absolute; left:0; top:0; right:0; bottom:0; touch-action:pan-y; }
  svg { display:block; width:100%; }
  .dt { width:100%; border-collapse:collapse; font-size:12px; font-variant-numeric:tabular-nums; margin-top:6px; }
  .dt th { color:var(--gray); font-weight:600; font-size:10.5px; text-align:right; padding:4px 3px; border-bottom:1px solid #3A3A3C; }
  .dt td { text-align:right; padding:6px 3px; border-bottom:1px solid #2C2C2E; font-weight:600; }
  .dt th:first-child, .dt td:first-child { text-align:left; }
  .dt td small { display:block; color:var(--gray); font-weight:500; font-size:9.5px; }
  .dt tr.tot td { border-top:1px solid #636366; font-weight:800; }
  .note { color:var(--gray); font-size:10.5px; line-height:1.45; margin-top:24px; }
  .warn { color:#FF9F0A; }
  .seg { display:inline-flex; background:#2C2C2E; border-radius:9px; padding:2px; margin-top:10px; }
  .seg div { padding:5px 14px; border-radius:7px; font-size:13px; font-weight:700; color:var(--gray); cursor:pointer; }
  .seg div.on { background:#636366; color:#FFFFFF; }
</style>
</head>
<body>
<div class="ticker">Builder Inputs</div>
<div class="seg" id="mode"><div data-m="idx">Index / %</div><div data-m="usd">Dollars</div></div>
<div class="hint" id="win"></div>
<div class="hint warn" id="errs"></div>
<div id="charts"></div>
<div id="dtw"><div class="h2" id="dth"></div><div class="sub" id="dts"></div><table class="dt" id="dt"></table></div>
<div class="note" id="note"></div>
__SHARE__
<script>
var D = __DATA__;
var PARTS = [["lum", "Lumber"], ["mat", "Other materials"], ["lab", "Labor"], ["lot", "Lot"]];
var hidden = {}, HV = null, cur = null, mode = "idx";
var SHORT = { price: "Price", lum: "Lumber", mat: "Other mat.", all: "All mat.", lab: "Wages", lot: "Lot", med: "Median" };
function el(id) { return document.getElementById(id); }
function esc(s) { return String(s).split("&").join("&amp;").split("<").join("&lt;").split(">").join("&gt;"); }
var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function qLabel(i) { return "Q" + ((i % 4) + 1) + " " + Math.floor(i / 4); }
function qShort(i) { return "Q" + ((i % 4) + 1) + " '" + String(Math.floor(i / 4)).slice(2); }
function mLabel(t) { t = Math.round(t); return MON[((t % 12) + 12) % 12] + " " + Math.floor(t / 12); }
function mShort(t) { t = Math.round(t); return MON[((t % 12) + 12) % 12] + " '" + String(Math.floor(t / 12)).slice(2); }
function mOfStr(m) { return (+m.slice(0, 4)) * 12 + (+m.slice(5, 7)) - 1; }
function q2t(q) { return Math.floor(q / 4) * 12 + (q % 4) * 3 + 1; }
function t2q(t) { return Math.floor(t / 12) * 4 + Math.floor((((t % 12) + 12) % 12) / 3); }
function sg(v, d) { var s = Math.abs(v).toFixed(d == null ? 1 : d); return (parseFloat(s) === 0 ? "" : v > 0 ? "+" : "-") + s; }
function nice(range, n) { var rough = range / (n || 4), p = Math.pow(10, Math.floor(Math.log(rough) / Math.LN10)), c = [1, 2, 2.5, 5, 10]; for (var i = 0; i < c.length; i++) if (c[i] * p >= rough) return c[i] * p; return 10 * p; }
function col(k) { return k === "price" ? "#FFFFFF" : D.colors[k]; }
function W(svg) { return svg.clientWidth || 360; }
function baseName() { return qLabel(D.base); }
function baseShort() { return qShort(D.base); }

// ---- the charts ----
// Time charts share one date window: pinch any of them to zoom (down to 9
// months), drag two fingers to pan, tap to read a date on all of them, tap a
// chip to hide or show its line, double-tap to go back to the full range.
var CH = [
  { id: "split", kind: "split", h: 250 },
  { id: "wf", kind: "wf" },
  { id: "med", kind: "lines", h: 210, title: "Median price vs the same house", sub: "Same house: Census constant-quality index. Median: what new homes actually sold for (quarterly average)", subUsd: "Same house: the BASEQ median grown by Census's constant-quality index. Median: what new homes actually sold for. Shaded: the gap, mostly smaller and cheaper homes being sold", lines: [["price", "Same house"], ["med", "Median price"]] },
  { id: "cp", kind: "cp" },
  { id: "ix", kind: "lines", h: 230, sub: "", subUsd: "Dollars per house (estimates): each cost's share of the same-house price, moved by its own index, stacked; the lines are the same-house price and the actual median", lines: [["price", "Price"], ["med", "Median price"], ["lum", "Lumber"], ["mat", "Other materials"], ["lab", "Labor"], ["lot", "Lot value"]] },
  { id: "lum", kind: "lines", h: 190, title: "Lumber", sub: "BLS lumber price index", subUsd: "Lumber per house (estimate): about 4.5% of the same-house price, moved by the BLS lumber index", lines: [["lum", "Lumber"], ["price", "New-home price", 1]] },
  { id: "mat", kind: "lines", h: 190, title: "Other materials", sub: "BLS builder-materials index with lumber taken out (estimate); dashed: the whole index", subUsd: "Other materials per house (estimate); dashed: all materials including lumber", lines: [["mat", "Other materials"], ["all", "All materials", 2], ["price", "New-home price", 1]] },
  { id: "lab", kind: "lines", h: 190, title: "Construction wages", sub: "Average hourly pay, construction production workers", subUsd: "Average hourly pay, construction production workers (actual)", lines: [["lab", "Wages"], ["price", "New-home price", 1]] },
  { id: "lot", kind: "lines", h: 190, title: "Lot values", sub: "Census median lot value, new spec homes; annual, drawn straight between years", subUsd: "Census median lot value, new spec homes (actual); annual, drawn straight between years", lines: [["lot", "Lot value"], ["price", "New-home price", 1]] },
];
function span() {
  var a = q2t(D.base) - 1, b = -Infinity;
  D.rows.forEach(function (r) { b = Math.max(b, q2t(r.q) + 1); });
  Object.keys(D.idx).forEach(function (k) { D.idx[k].forEach(function (p) { b = Math.max(b, p.t); }); });
  return { a: a, b: b };
}
var MIN_SPAN = 9;
function clampView(v) {
  var S = span(), w = Math.max(MIN_SPAN, Math.min(S.b - S.a, v.b - v.a));
  var a = Math.max(S.a, Math.min(S.b - w, v.a));
  return { a: a, b: a + w };
}
function isFull() { var S = span(); return HV.a <= S.a + 0.01 && HV.b >= S.b - 0.01; }
function valAt(pts, t) { var v = null; for (var i = 0; i < pts.length; i++) { if (pts[i].t <= t + 1.01) v = pts[i]; else break; } return v; }
function lastIn(pts) { var v = null; for (var i = 0; i < pts.length; i++) if (pts[i].t >= HV.a - 1.01 && pts[i].t <= HV.b + 1.01) v = pts[i]; return v; }
function ticks(X, h) {
  var s = "", w = HV.b - HV.a, t;
  if (w > 30) {
    var step = w > 120 ? 2 : 1;
    for (var y = Math.ceil(HV.a / 12); y * 12 <= HV.b; y++) if (y % step === 0) s += '<text x="' + X(y * 12) + '" y="' + (h - 5) + '" font-size="9.5" fill="#8E8E93" text-anchor="middle">' + y + "</text>";
  } else {
    var every = w > 15 ? 6 : 3;
    for (t = Math.ceil(HV.a); t <= HV.b; t++) if (((t % 12) + 12) % 12 % every === 0) s += '<text x="' + X(t) + '" y="' + (h - 5) + '" font-size="9.5" fill="#8E8E93" text-anchor="middle">' + mShort(t) + "</text>";
  }
  return s;
}
function grid(Y, lo, hi, st, L, R, fmt, zero) {
  var s = "";
  for (var v = lo; v <= hi + 1e-9; v += st) { var z = Math.abs(v - zero) < 1e-9; s += '<line x1="' + L + '" x2="' + R + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '" stroke="' + (z ? "#636366" : "#3A3A3C") + '"' + (z && zero === 100 ? ' stroke-dasharray="4 3"' : "") + '/><text x="' + (L - 4) + '" y="' + (Y(v) + 3.5).toFixed(1) + '" font-size="10" fill="#8E8E93" text-anchor="end">' + fmt(v) + "</text>"; }
  return s;
}
function rightLabels(items, R, B) {
  items.sort(function (a, b) { return a.y - b.y; });
  for (var k = 1; k < items.length; k++) if (items[k].y - items[k - 1].y < 23) items[k].y = items[k - 1].y + 23;
  var over = items.length ? items[items.length - 1].y - B + 4 : 0; if (over > 0) items.forEach(function (it) { it.y -= over; });
  return items.map(function (it) { return '<text x="' + (R + 6) + '" y="' + (it.y + 1).toFixed(1) + '" font-size="12" font-weight="700" fill="' + it.c + '">' + esc(it.t) + '</text><text x="' + (R + 6) + '" y="' + (it.y + 12).toFixed(1) + '" font-size="9.5" fill="' + it.c + '">' + esc(it.n) + "</text>"; }).join("");
}
function chip(ci, k, color, html, toggle) {
  return '<div class="chip' + (toggle ? " tog" : "") + (hidden[ci + ":" + k] ? " off" : "") + '" data-c="' + ci + '" data-k="' + k + '" style="color:' + color + '">' + html + "</div>";
}

// Dollars: "$412K", "$21.4K", "$38.10"; signed versions for changes
function fK(v) { var a = Math.abs(v), k = a / 1000; return (v < 0 ? "-" : "") + "$" + (a >= 1e5 ? k.toFixed(0) + "K" : a >= 1000 ? k.toFixed(a >= 1e4 || Math.abs(k - Math.round(k)) < 1e-6 ? 0 : 1) + "K" : a.toFixed(a < 100 && Math.abs(a - Math.round(a)) > 1e-6 ? 2 : 0)); }
function sK(v) { var s = fK(Math.abs(v)); return (Math.abs(v) < 0.5 ? "" : v > 0 ? "+" : "-") + s; }
function usd() { return mode === "usd" && D.dol; }
// a line's dollars per index point: actual units for wages and lots on their
// own charts, otherwise its share of the same-house price
function mulOf(c, k) { if (c.id !== "ix" && D.dol.act[k]) return D.dol.act[k]; return D.dol.mul[k]; }

// 1) The split by quarter: stacked bars and the price change as a line; any
// gap between the bars and the line is what costs don't explain, left blank
function drawSplit(ci) {
  var c = CH[ci], svg = el("s" + ci), w = W(svg), h = c.h, L = 40, R = w - 60, T = 8, B = h - 20, $ = usd();
  var X = function (t) { return L + (t - HV.a) / (HV.b - HV.a) * (R - L); };
  var rows = D.rows.filter(function (r) { var t = q2t(r.q); return t >= HV.a - 1.5 && t <= HV.b + 1.5; });
  var f = function (r, k) { var v = k === "price" ? r.price : r[k]; return $ ? v / 100 * r.yb : v; };
  var on = PARTS.filter(function (p) { return !hidden[ci + ":" + p[0]]; }), showP = !hidden[ci + ":price"];
  var hi = $ ? 1000 : 1, lo = -hi;
  rows.forEach(function (r) { var up = 0, dn = 0; on.forEach(function (p) { var v = f(r, p[0]); if (v > 0) up += v; else dn += v; }); hi = Math.max(hi, up, showP ? f(r, "price") : 0); lo = Math.min(lo, dn, showP ? f(r, "price") : 0); });
  var st = nice(hi - lo, 5); hi = Math.ceil(hi / st) * st; lo = Math.floor(lo / st) * st;
  var Y = function (v) { return T + (hi - v) / (hi - lo) * (B - T); };
  var slot = 3 / (HV.b - HV.a) * (R - L), bw = Math.max(1.5, slot * 0.72);
  var selQ = cur == null ? null : t2q(cur), s = '<defs><clipPath id="k' + ci + '"><rect x="' + L + '" y="0" width="' + (R - L) + '" height="' + h + '"/></clipPath></defs>';
  s += grid(Y, lo, hi, st, L, R, function (v) { return $ ? sK(v) : sg(v, st % 1 ? 1 : 0) + "%"; }, 0);
  s += '<g clip-path="url(#k' + ci + ')">';
  rows.forEach(function (r) {
    var up = 0, dn = 0, x = X(q2t(r.q));
    on.forEach(function (p) {
      var v2 = f(r, p[0]), y0, y1;
      if (v2 >= 0) { y0 = Y(up + v2); y1 = Y(up); up += v2; } else { y0 = Y(dn); y1 = Y(dn + v2); dn += v2; }
      s += '<rect x="' + (x - bw / 2).toFixed(1) + '" y="' + y0.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(0.5, y1 - y0).toFixed(1) + '" fill="' + D.colors[p[0]] + '" opacity="' + (selQ === r.q || selQ == null ? 0.9 : 0.55) + '"/>';
    });
  });
  if (showP) {
    var d = ""; rows.forEach(function (r, k) { d += (k ? "L" : "M") + X(q2t(r.q)).toFixed(1) + "," + Y(f(r, "price")).toFixed(1); });
    s += '<path d="' + d + '" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linejoin="round"/>';
    rows.forEach(function (r) { s += '<circle cx="' + X(q2t(r.q)).toFixed(1) + '" cy="' + Y(f(r, "price")).toFixed(1) + '" r="' + (selQ === r.q ? 4 : 2.4) + '" fill="#FFFFFF" stroke="#1C1C1E" stroke-width="1"/>'; });
  }
  if (selQ != null) s += '<line x1="' + X(q2t(selQ)) + '" x2="' + X(q2t(selQ)) + '" y1="' + T + '" y2="' + B + '" stroke="#FFFFFF" stroke-opacity="0.5" stroke-dasharray="3 3"/>';
  s += "</g>";
  var r2 = null; rows.forEach(function (r) { if (selQ == null || r.q <= selQ) r2 = r; });
  if (r2 && showP) s += rightLabels([{ y: Y(f(r2, "price")), t: $ ? sK(f(r2, "price")) : sg(r2.price) + "%", n: "price", c: "#FFFFFF" }], R, B);
  s += ticks(X, h);
  svg.innerHTML = s; svg.__g = { L: L, R: R };
  el("t" + ci).textContent = "New-home price vs what costs explain" + (r2 ? " · " + qLabel(r2.q) : "");
  el("u" + ci).textContent = $ ? "Change from a year earlier, dollars per house (same house, priced from the " + baseShort() + " median). Bars: what each cost explains (lagged 6 months). Line: the price change." : "Change from a year earlier. Bars: points of the price change each cost explains (costs lagged 6 months). Line: the price change.";
  if (!r2) { el("g" + ci).innerHTML = ""; return; }
  var tot = PARTS.reduce(function (a, p) { return a + f(r2, p[0]); }, 0);
  el("g" + ci).innerHTML = chip(ci, "price", "#FFFFFF", 'Price <span class="v">' + ($ ? sK(f(r2, "price")) : sg(r2.price) + "%") + "</span>", 1) +
    PARTS.map(function (p) { return chip(ci, p[0], D.colors[p[0]], p[1] + ' <span class="v">' + ($ ? sK(f(r2, p[0])) : sg(r2[p[0]])) + "</span>", 1); }).join("") +
    '<div class="chip sum">Costs explain <span class="v">' + ($ ? sK(tot) : sg(tot) + " pts") + "</span></div>";
}

// 2) Since the base quarter: each cost's share of the cumulative price
// change, end to end, then their total and the price change itself
function wfItems(c, $) {
  var k$ = $ ? D.dol.anchor / 100 : 1, run = 0;
  var items = PARTS.map(function (p) { var v = c[p[0]] * k$, it = { k: p[0], n: p[1], v: v, a: run }; run += v; it.b = run; return it; });
  items.push({ k: "tot", n: "Costs explain", v: run, a: 0, b: run }, { k: "price", n: "Price change", v: c.price * k$, a: 0, b: c.price * k$ });
  return items;
}
function drawWf(ci) {
  var svg = el("s" + ci), w = W(svg), c = D.cum, $ = usd();
  el("t" + ci).textContent = c ? "Since " + qLabel(c.from) + ": what costs explain" : "";
  el("u" + ci).textContent = c ? ($ ? "Dollars per house: the " + baseShort() + " median (" + fK(D.dol.anchor) + ") times each piece's points. Through " + qLabel(c.to) + "; costs lagged 6 months." : "Points of the price change since " + qLabel(c.from) + " (through " + qLabel(c.to) + "; costs lagged 6 months)") : "";
  if (!c) { svg.innerHTML = ""; return; }
  var items = wfItems(c, $), lo = 0, hi = 0;
  items.forEach(function (it) { lo = Math.min(lo, it.a, it.b); hi = Math.max(hi, it.a, it.b); });
  var L = 106, R = w - 62, rowH = 30, T = 4, X = function (v) { return L + (v - lo) / Math.max(1e-9, hi - lo) * (R - L); };
  var s = '<line x1="' + X(0) + '" x2="' + X(0) + '" y1="' + T + '" y2="' + (T + rowH * items.length) + '" stroke="#636366"/>';
  items.forEach(function (it, i) {
    var y = T + i * rowH + 6, x0 = X(Math.min(it.a, it.b)), x1 = X(Math.max(it.a, it.b)), cc = it.k === "price" ? "#FFFFFF" : it.k === "tot" ? "#C7C7CC" : D.colors[it.k], bold = it.k === "price" || it.k === "tot";
    if (it.k === "tot") s += '<line x1="' + (L - 100) + '" x2="' + (w - 4) + '" y1="' + (y - 4) + '" y2="' + (y - 4) + '" stroke="#3A3A3C"/>';
    s += '<text x="' + (L - 8) + '" y="' + (y + 13) + '" font-size="11.5" font-weight="' + (bold ? 700 : 600) + '" fill="' + cc + '" text-anchor="end">' + esc(it.n) + "</text>";
    s += '<rect x="' + x0.toFixed(1) + '" y="' + y + '" width="' + Math.max(1, x1 - x0).toFixed(1) + '" height="17" rx="2" fill="' + (it.k === "tot" ? "none" : cc) + '" stroke="' + (it.k === "tot" ? cc : "none") + '" stroke-width="1.5" opacity="' + (it.v >= 0 ? 0.92 : 0.45) + '"/>';
    s += '<text x="' + (x1 + 5).toFixed(1) + '" y="' + (y + 13) + '" font-size="11.5" font-weight="700" fill="' + cc + '">' + ($ ? sK(it.v) : sg(it.v) + (it.k === "price" ? "%" : " pts")) + "</text>";
  });
  svg.setAttribute("height", T + rowH * items.length + 4);
  svg.innerHTML = s;
  el("g" + ci).innerHTML = "";
}

// Indexed lines (each = 100 in the base quarter), or dollars. In dollars the
// combined chart stacks the costs under the same-house price, and the median
// chart shades the gap between the same house and what actually sold.
function lineSpecs(ci) {
  var c = CH[ci], $ = usd();
  return c.lines.filter(function (ln) { return D.idx[ln[0]] && D.idx[ln[0]].length && !($ && ln[2] === 1); });
}
function stackAt(t, on) {
  var out = {}, run = 0;
  on.forEach(function (k) { var p = valAt(D.idx[k] || [], t); var v = p ? p.v / 100 * D.dol.mul[k] : 0; out[k] = [run, run + v]; run += v; });
  out.tot = run; return out;
}
function drawLines(ci) {
  var c = CH[ci], svg = el("s" + ci), w = W(svg), h = c.h, L = 40, R = w - 64, T = 8, B = h - 20, $ = usd();
  var X = function (t) { return L + (t - HV.a) / (HV.b - HV.a) * (R - L); };
  var specs = lineSpecs(ci), stack = $ && c.id === "ix";
  var vis = specs.filter(function (ln) { return !hidden[ci + ":" + ln[0]]; });
  var lines = stack ? vis.filter(function (ln) { return ln[0] === "price" || ln[0] === "med"; }) : vis;
  var parts = stack ? ["lot", "lab", "mat", "lum"].filter(function (k) { return !hidden[ci + ":" + k]; }) : [];
  var mul = function (k) { return $ ? mulOf(c, k) / 100 : 1; };
  var qts = (D.idx.price || []).filter(function (p) { return p.t >= HV.a - 3 && p.t <= HV.b + 3; }).map(function (p) { return p.t; });
  var hi = -Infinity, lo = Infinity;
  lines.forEach(function (ln) { D.idx[ln[0]].forEach(function (p) { if (p.t >= HV.a - 1.5 && p.t <= HV.b + 1.5) { hi = Math.max(hi, p.v * mul(ln[0])); lo = Math.min(lo, p.v * mul(ln[0])); } }); });
  if (stack) { qts.forEach(function (t) { hi = Math.max(hi, stackAt(t, parts).tot); }); lo = 0; }
  if (!isFinite(hi)) { hi = $ ? 1000 : 110; lo = $ ? 0 : 90; }
  if (!$) { hi = Math.max(hi, 100); lo = Math.min(lo, 100); }
  var pad = Math.max($ ? 0 : 2, (hi - lo) * 0.08); hi += pad; if (!stack) lo -= pad;
  if ($ && lo < 0) lo = 0;
  var st = nice(hi - lo, 4); hi = Math.ceil(hi / st) * st; lo = Math.floor(lo / st) * st;
  var Y = function (v) { return T + (hi - v) / (hi - lo) * (B - T); };
  var s = '<defs><clipPath id="k' + ci + '"><rect x="' + L + '" y="0" width="' + (R - L) + '" height="' + h + '"/></clipPath></defs>';
  s += grid(Y, lo, hi, st, L, R, function (v) { return $ ? fK(v) : String(+v.toFixed(1)); }, $ ? -1 : 100);
  s += '<g clip-path="url(#k' + ci + ')">';
  var labels = [], at = cur;
  if (stack && qts.length) {
    var S = qts.map(function (t) { return stackAt(t, parts); });
    parts.forEach(function (k) {
      var d = "M" + qts.map(function (t, i) { return X(t).toFixed(1) + "," + Y(S[i][k][1]).toFixed(1); }).join("L");
      for (var i = qts.length - 1; i >= 0; i--) d += "L" + X(qts[i]).toFixed(1) + "," + Y(S[i][k][0]).toFixed(1);
      s += '<path d="' + d + 'Z" fill="' + D.colors[k] + '" fill-opacity="0.75"/>';
    });
  }
  if ($ && c.id === "med" && !hidden[ci + ":price"] && !hidden[ci + ":med"]) {
    var P1 = D.idx.price, d2 = "", back = "";
    P1.forEach(function (p) { var m = valAt(D.idx.med, p.t); if (!m || m.t !== p.t) return; d2 += (d2 ? "L" : "M") + X(p.t).toFixed(1) + "," + Y(p.v * mul("price")).toFixed(1); back = "L" + X(p.t).toFixed(1) + "," + Y(m.v * mul("med")).toFixed(1) + back; });
    if (d2) s += '<path d="' + d2 + back + 'Z" fill="' + D.colors.med + '" fill-opacity="0.18"/>';
  }
  lines.slice().reverse().forEach(function (ln) {
    var pts = D.idx[ln[0]], cc = col(ln[0]), d = "", faint = ln[2] === 1, dash = ln[2] === 2, m = mul(ln[0]), main = lines[0] === ln && c.id !== "ix";
    pts.forEach(function (p, k) { d += (k ? "L" : "M") + X(p.t).toFixed(1) + "," + Y(p.v * m).toFixed(1); });
    s += '<path d="' + d + '" fill="none" stroke="' + cc + '" stroke-width="' + (faint || dash ? 1.4 : main || ln[0] === "price" ? 2.6 : 1.9) + '" stroke-opacity="' + (faint ? 0.45 : 1) + '"' + (dash ? ' stroke-dasharray="4 3"' : "") + ' stroke-linejoin="round"/>';
    var p2 = at == null ? lastIn(pts) : valAt(pts, at);
    if (p2) {
      if (at != null) s += '<circle cx="' + X(p2.t).toFixed(1) + '" cy="' + Y(p2.v * m).toFixed(1) + '" r="3.2" fill="' + cc + '" stroke="#1C1C1E" stroke-width="1"/>';
      labels.push({ y: Y(p2.v * m), t: $ ? fK(p2.v * m) : sg(p2.v - 100, 0) + "%", n: c.id === "med" ? ln[1] : SHORT[ln[0]] || ln[1], c: cc });
    }
  });
  if (stack) { var tq = at == null ? qts[qts.length - 1] : (valAt(D.idx.price, at) || {}).t; if (tq != null) { var st2 = stackAt(tq, parts); if (parts.length) labels.push({ y: Y(st2.tot), t: fK(st2.tot), n: "Costs", c: "#C7C7CC" }); } }
  if (at != null) s += '<line x1="' + X(at) + '" x2="' + X(at) + '" y1="' + T + '" y2="' + B + '" stroke="#FFFFFF" stroke-opacity="0.5" stroke-dasharray="3 3"/>';
  s += "</g>" + rightLabels(labels, R, B) + ticks(X, h);
  svg.innerHTML = s; svg.__g = { L: L, R: R };
  var ttl = c.id === "ix" ? ($ ? "What a new house costs to build" : "Prices and costs since " + baseName()) : c.title;
  el("t" + ci).textContent = ttl + " · " + (at == null ? "latest" : mLabel(at));
  var sub = $ ? (c.subUsd || c.sub || "").split("BASEQ").join(baseShort()) : (c.sub ? c.sub + ". " : "") + baseName() + " = 100; labels: change since then";
  el("u" + ci).textContent = sub + (c.id === "lot" || c.id === "ix" ? ". Lot values end at mid-" + D.lotThrough : "");
  el("g" + ci).innerHTML = specs.map(function (ln) {
    var pts = D.idx[ln[0]] || [], p2 = at == null ? lastIn(pts) : valAt(pts, at), m = mul(ln[0]);
    if (stack && ln[0] !== "price" && ln[0] !== "med") { var tq2 = at == null ? qts[qts.length - 1] : (valAt(D.idx.price, at) || {}).t, sv = tq2 == null ? null : stackAt(tq2, [ln[0]]).tot; return chip(ci, ln[0], col(ln[0]), esc(ln[1]) + (sv != null ? ' <span class="v">' + fK(sv) + "</span>" : ""), 1); }
    return chip(ci, ln[0], col(ln[0]), esc(ln[1]) + (p2 ? ' <span class="v">' + ($ ? fK(p2.v * m) : sg(p2.v - 100, 0) + "%") + "</span>" : ""), 1);
  }).join("");
}

function drawCp(ci) {
  var svg = el("s" + ci), w = W(svg);
  el("t" + ci).textContent = "Materials: where the increase came from";
  var rs = impRows(), tot = impTot(rs);
  el("g" + ci).innerHTML = "";
  if (rs.length < 3 || !(tot > 0.5)) { svg.innerHTML = ""; svg.setAttribute("height", 1); el("u" + ci).textContent = rs.length < 3 ? "Downloads the first time the full screen opens with a connection." : "Materials prices are about flat since " + baseShort() + ", so there's no increase to split."; return; }
  var months = {}; rs.forEach(function (x) { months[x.m] = (months[x.m] || []).concat([x.name]); });
  var ms = Object.keys(months).sort(), latest = ms[ms.length - 1];
  var behind = ms.slice(0, -1).map(function (m) { return months[m].join(", ") + " through " + mLabel(mOfStr(m)); }).join("; ");
  el("u" + ci).textContent = "Each product's share of the rise in materials costs since " + baseShort() + " (its price change times its share of materials). BLS producer price indexes, " + mLabel(mOfStr(latest)) + (behind ? " (" + behind + ")" : "") + "; shares of materials from BEA's 2017 input-output table.";
  var sh = function (x) { return x.imp / tot * 100; };
  var lo = 0, hi = 0; rs.forEach(function (x) { lo = Math.min(lo, sh(x)); hi = Math.max(hi, sh(x)); });
  var nameW = Math.min(128, w * 0.34), L = nameW + 8, R = w - 40, rowH = 36, T = 4, X = function (v) { return L + (v - lo) / Math.max(1e-9, hi - lo) * (R - L); };
  var s = '<line x1="' + X(0) + '" x2="' + X(0) + '" y1="' + T + '" y2="' + (T + rowH * rs.length) + '" stroke="#636366"/>';
  rs.forEach(function (x, i) {
    var y = T + i * rowH, cc = x.key === "lum" ? D.colors.lum : "#FF9F0A", np = nameParts(x), v = sh(x);
    s += '<text x="' + nameW + '" y="' + (y + 15) + '" font-size="11.5" font-weight="600" fill="' + cc + '" text-anchor="end">' + esc(np[0]) + "</text>";
    if (np[1]) s += '<text x="' + nameW + '" y="' + (y + 27) + '" font-size="9.5" fill="#98989F" text-anchor="end">' + esc(np[1]) + "</text>";
    var a = X(Math.min(0, v)), b = X(Math.max(0, v));
    s += '<rect x="' + a.toFixed(1) + '" y="' + (y + 5) + '" width="' + Math.max(1, b - a).toFixed(1) + '" height="13" rx="2" fill="' + cc + '" opacity="0.92"/>';
    s += '<text x="' + ((v >= 0 ? b + 4 : a - 4)).toFixed(1) + '" y="' + (y + 15.5) + '" font-size="11.5" font-weight="700" fill="' + cc + '" text-anchor="' + (v >= 0 ? "start" : "end") + '">' + Math.round(v) + "%</text>";
    s += '<text x="' + L + '" y="' + (y + 29) + '" font-size="9.5" fill="#98989F">' + x.w.toFixed(0) + "% of materials · " + (x.since >= 0 ? "up " : "down ") + Math.abs(x.since).toFixed(0) + "%</text>";
  });
  var ty = T + rowH * rs.length + 6;
  s += '<rect x="0" y="' + ty + '" width="' + w + '" height="30" rx="8" fill="#2C2C2E"/>';
  s += '<text x="10" y="' + (ty + 19.5) + '" font-size="12.5" fill="#FFFFFF">These ' + rs.length + ' materials cost <tspan font-weight="700" fill="#FF9F0A">' + Math.abs(tot).toFixed(0) + "% more</tspan> than in " + baseShort() + "</text>";
  svg.setAttribute("height", ty + 34);
  svg.innerHTML = s;
}

// Impact: each product's price change times its share of the materials bill
// (BEA), so a big input with a modest rise can outweigh a small one that soared
function impRows() { return (D.comps || []).filter(function (x) { return x.imp != null; }).sort(function (a, b) { return b.imp - a.imp; }); }
function impTot(rs) { return rs.reduce(function (a, x) { return a + x.imp; }, 0); }
function nameParts(x) { var nm = x.name, i = nm.indexOf(" ("); if (i > 0) return [nm.slice(0, i), nm.slice(i + 2, -1)]; if (x.wn) return [nm, x.wn]; i = nm.indexOf(" & "); return nm.length > 20 && i > 0 ? [nm.slice(0, i), nm.slice(i + 1)] : [nm, ""]; }

// 4-8) Indexed lines: each = 100 in the base quarter

function build() {
  el("charts").innerHTML = CH.map(function (c, i) {
    var time = c.kind === "split" || c.kind === "lines";
    return '<div class="h2" id="t' + i + '"></div><div class="sub" id="u' + i + '"></div><div class="legend" id="g' + i + '"></div><div class="wrap"><svg id="s' + i + '"' + (c.h ? ' height="' + c.h + '"' : "") + '></svg>' + (time ? '<div class="touch" data-i="' + i + '"></div>' : "") + "</div>";
  }).join("");
  var ts = el("charts").querySelectorAll(".touch");
  for (var t = 0; t < ts.length; t++) bindZoom(ts[t]);
}
function setMode(m) {
  mode = m && D && D.dol ? m : "idx";
  var ds = el("mode").querySelectorAll("div");
  for (var i = 0; i < ds.length; i++) ds[i].className = ds[i].getAttribute("data-m") === mode ? "on" : "";
  el("mode").style.display = D && D.dol ? "" : "none";
}
el("mode").addEventListener("click", function (e) {
  var t = e.target && e.target.getAttribute ? e.target.getAttribute("data-m") : null;
  if (!t || t === mode) return;
  setMode(t); renderAll();
});
function drawTime() {
  el("win").textContent = mLabel(HV.a) + " to " + mLabel(HV.b) + (isFull() ? "" : " (zoomed)") + " · pinch a chart to zoom, tap to read, tap a chip to hide a line, double-tap to reset";
  CH.forEach(function (c, i) { if (c.kind === "split") drawSplit(i); else if (c.kind === "lines") drawLines(i); });
  if (el("dt")) drawDt();
}
// How the dollars are built: each cost's share of the price x the base
// quarter's median = its dollars then; x its own index since = its dollars now
var SRC = { lum: "NAHB lumber per home", mat: "NAHB, less lumber", lab: "NAHB, 45% of build", lot: "NAHB 2024", price: "Census index" };
function dolTable() {
  if (!D.dol) return null;
  var A = D.dol.anchor, rows = [], tot = { then: 0, now: 0 };
  PARTS.forEach(function (p) {
    var k = p[0], pt = at(k), m = D.dol.mul[k];
    if (!pt) return;
    var r = { k: k, n: p[1], share: m / A * 100, src: SRC[k], then: m, chg: pt.v - 100, now: m * pt.v / 100, t: pt.t };
    tot.then += r.then; tot.now += r.now; rows.push(r);
  });
  var pp = at("price");
  return { A: A, rows: rows, tot: { n: "Costs", share: tot.then / A * 100, then: tot.then, now: tot.now, chg: (tot.now / tot.then - 1) * 100 }, price: pp ? { n: "Same-house price", share: 100, src: SRC.price, then: A, chg: pp.v - 100, now: A * pp.v / 100, t: pp.t } : null };
}
function at(k) { var pts = D.idx[k] || []; return cur == null ? lastIn(pts) : valAt(pts, cur); }
function drawDt() {
  var T = dolTable();
  el("dtw").style.display = T ? "" : "none";
  if (!T) return;
  el("dth").textContent = "How the dollars are built" + (cur == null ? "" : " · " + mLabel(cur));
  el("dts").textContent = "Share of the price x the " + baseShort() + " median (" + fK(T.A) + ") = dollars then; x the cost's own index since = dollars now. Estimates, not lagged; the 'what costs explain' bars use costs from 6 months earlier.";
  function tr(r, cls) {
    return '<tr' + (cls ? ' class="' + cls + '"' : "") + '><td style="color:' + (r.k ? D.colors[r.k] : "#FFFFFF") + '">' + esc(r.n) + (r.src ? "<small>" + esc(r.src) + "</small>" : "") + "</td><td>" + r.share.toFixed(1) + "%</td><td>" + fK(r.then) + "</td><td>" + sg(r.chg, 0) + "%</td><td>" + fK(r.now) + "<small>" + sK(r.now - r.then) + "</small></td></tr>";
  }
  el("dt").innerHTML = "<tr><th>Cost</th><th>Share</th><th>" + esc(baseShort()) + "</th><th>Index</th><th>" + (cur == null ? "Latest" : esc(mShort(cur))) + "</th></tr>" +
    T.rows.map(function (r) { return tr(r); }).join("") + tr(T.tot, "tot") + (T.price ? tr(T.price) : "");
}
function renderAll() {
  if (!D) return;
  setMode(mode);
  if (!HV) HV = span();
  HV = clampView(HV);
  el("errs").textContent = D.errors ? "Couldn't refresh: " + D.errors.join(" · ") + " (showing the last good copy)" : "";
  drawTime();
  CH.forEach(function (c, i) { if (c.kind === "wf") drawWf(i); else if (c.kind === "cp") drawCp(i); });
  drawDt();
  el("note").textContent = D.note + " Checked " + D.checked + ".";
}
el("charts").addEventListener("click", function (e) {
  var t = e.target && e.target.closest ? e.target.closest(".chip.tog") : null;
  if (!t) return;
  var key = t.getAttribute("data-c") + ":" + t.getAttribute("data-k");
  hidden[key] = !hidden[key];
  drawTime();
});
function bindZoom(t) {
  var start = null, lastTap = 0, tapStart = null, ci = +t.getAttribute("data-i");
  function px(e) { var r = t.getBoundingClientRect(); return e.clientX - r.left; }
  function geom() { return el("s" + ci).__g || { L: 36, R: 300 }; }
  t.addEventListener("touchstart", function (e) {
    if (e.touches.length === 2) {
      e.preventDefault();
      var x1 = px(e.touches[0]), x2 = px(e.touches[1]);
      start = { d: Math.max(20, Math.abs(x2 - x1)), c: (x1 + x2) / 2, v: { a: HV.a, b: HV.b }, g: geom() };
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
      drawTime();
    } else if (tapStart && e.touches.length === 1 && Math.abs(e.touches[0].clientY - tapStart.y) > 10) tapStart = null;
  }, { passive: false });
  t.addEventListener("touchend", function (e) {
    if (e.touches.length < 2) start = null;
    if (tapStart && e.changedTouches.length === 1 && Date.now() - tapStart.t < 400) {
      var now = Date.now();
      if (now - lastTap < 320) { HV = span(); cur = null; lastTap = 0; drawTime(); }
      else { lastTap = now; pick(tapStart.x); }
      tapStart = null;
    }
  });
  t.addEventListener("click", function (e) { if (!("ontouchstart" in window)) pick(px(e)); });
  t.addEventListener("gesturestart", function (e) { e.preventDefault(); });
  function pick(x) {
    var g = geom(), f = (x - g.L) / (g.R - g.L);
    if (f < 0 || f > 1) { cur = null; drawTime(); return; }
    var m = Math.round(HV.a + f * (HV.b - HV.a));
    cur = cur === m ? null : m;
    drawTime();
  }
}
window.update = function (d) { D = d; HV = null; renderAll(); };
window.addEventListener("resize", renderAll);
build();
renderAll();
// Share as PDF: 16:9 slides. 1) The split by quarter on its own. 2) Since the
// base quarter: what costs explain, and prices vs costs indexed. 3) The
// materials breakdown. 4) Lumber and other materials. 5) Wages and lots.
// Time charts use the dates zoomed to on screen and skip hidden lines.
// Headlines state the takeaway; captions explain; labels at the right edge;
// a dark banner credits the sources. Vector.
window.printPdf = function (jsPDF, fonts) {
  var W = 792, H = 445.5, PAGES = D.dol ? 7 : 6;
  var doc = new jsPDF({ unit: "pt", format: [W, H], orientation: "landscape" });
  var FACE = "helvetica";
  if (fonts && fonts.regular && fonts.bold) {
    doc.addFileToVFS("Narrow-Regular.ttf", fonts.regular); doc.addFont("Narrow-Regular.ttf", "Narrow", "normal");
    doc.addFileToVFS("Narrow-Bold.ttf", fonts.bold); doc.addFont("Narrow-Bold.ttf", "Narrow", "bold");
    FACE = "Narrow";
  }
  var INK = [28, 28, 30], GRY = [110, 110, 115], RULE = [222, 222, 226], SOFT = [160, 160, 165];
  function rgb(hex) { return [1, 3, 5].map(function (i) { return parseInt(hex.slice(i, i + 2), 16); }); }
  function pc(k) { return k === "price" ? INK : k === "tot" ? [120, 120, 125] : rgb(D.pcolors[k]); }
  function font(bold, size, c) { doc.setFont(FACE, bold ? "bold" : "normal"); doc.setFontSize(size); doc.setTextColor(c[0], c[1], c[2]); }
  function clean(t) { return String(t).split("−").join("-").split("’").join("'").split("–").join("-").split("…").join("...").split("&amp;").join("&"); }
  function tc(t) { var small = { and: 1, of: 1, the: 1, vs: 1, a: 1 }; return String(t).split(" ").map(function (w, i) { return i && small[w] ? w : w.charAt(0).toUpperCase() + w.slice(1); }).join(" "); }
  function alpha(a) { if (doc.GState) doc.setGState(new doc.GState({ opacity: a, "stroke-opacity": a })); }
  function headline(text) {
    var size = 21, lines;
    do { font(true, size, INK); lines = doc.splitTextToSize(clean(text), W - 72); size -= 1; } while (lines.length > 1 && size > 15);
    if (lines.length > 2) lines = [lines[0], lines.slice(1).join(" ")];
    doc.text(lines, 36, 42);
    return 42 + (lines.length - 1) * (size + 4);
  }
  function caption(text, x0, x1, y, max) { font(false, 8.4, GRY); doc.text(doc.splitTextToSize(clean(text), x1 - x0).slice(0, max || 4), x0, y); }
  function titles(top, t, sub, cx) { font(true, 11.5, INK); doc.text(clean(t), cx, top + 28, { align: "center" }); font(false, 8.5, GRY); doc.text(clean(sub), cx, top + 41, { align: "center" }); }
  function labels(items, x, B) {
    items.sort(function (a, b) { return a.y - b.y; });
    for (var k = 1; k < items.length; k++) if (items[k].y - items[k - 1].y < 20) items[k].y = items[k - 1].y + 20;
    var over = items.length ? items[items.length - 1].y - B : 0; if (over > 0) items.forEach(function (it) { it.y -= over; });
    items.forEach(function (it) { font(true, 9.5, it.c); doc.text(clean(it.t), x, it.y + 2); font(false, 8, it.c); doc.text(clean(it.n), x, it.y + 11); });
  }
  function banner(page) {
    var bh = 44, by = H - bh;
    doc.setFillColor(28, 28, 30); doc.rect(0, by, W, bh, "F");
    doc.setFillColor(201, 162, 39); doc.rect(W - 176, by + 6, 2, bh - 12, "F");
    font(false, 7, [235, 235, 240]); doc.text(doc.splitTextToSize(clean(D.sources), W - 176 - 40 - 110).slice(0, 4), 28, by + 10);
    font(false, 7.5, [200, 200, 205]); doc.text(clean("Prices through " + D.through.price), W - 188, by + 20, { align: "right" }); doc.text(page + " of " + PAGES + " · estimate", W - 188, by + 31, { align: "right" });
    font(true, 12.5, [255, 255, 255]); doc.text("Builder", W - 162, by + 20); doc.text("Inputs", W - 162, by + 34);
  }
  function hgrid(Y, lo, hi, st, L, R, fmt, zero) {
    for (var v = lo; v <= hi + 1e-9; v += st) {
      var z = Math.abs(v - zero) < 1e-9;
      doc.setDrawColor(z ? 150 : RULE[0], z ? 150 : RULE[1], z ? 155 : RULE[2]); doc.setLineWidth(z ? 0.8 : 0.5);
      if (z && zero === 100) doc.setLineDashPattern([3, 2], 0);
      doc.line(L, Y(v), R, Y(v)); doc.setLineDashPattern([], 0);
      font(false, 8, GRY); doc.text(fmt(v), L - 5, Y(v) + 3, { align: "right" });
    }
  }
  function xticks(X, B) {
    var w = HV.b - HV.a;
    if (w > 30) { for (var y = Math.ceil(HV.a / 12); y * 12 <= HV.b; y++) { font(false, 8, GRY); doc.text(String(y), X(y * 12), B + 11, { align: "center" }); } }
    else { var every = w > 15 ? 6 : 3; for (var t = Math.ceil(HV.a); t <= HV.b; t++) if (((t % 12) + 12) % 12 % every === 0) { font(false, 8, GRY); doc.text(clean(mShort(t)), X(t), B + 11, { align: "center" }); } }
  }
  function clipTo(L, T, R, B) { doc.saveGraphicsState(); doc.rect(L, T, R - L, B - T, null); doc.clip(); doc.discardPath(); }
  var win = mLabel(HV.a) + " to " + mLabel(HV.b), bn = baseName(), bs = baseShort(), $ = usd();
  var ci1 = 0, ciMed = 2, ciIx = 4, ciL = 5, ciM = 6, ciW = 7, ciLot = 8;
  function isOn(ci, k) { return !hidden[ci + ":" + k]; }
  function at(k) { var pts = D.idx[k] || []; return cur == null ? lastIn(pts) : valAt(pts, cur); }
  function pctTxt(p) { return p ? sg(p.v - 100, 0) + "%" : "n/a"; }
  var UNIT = { lum: " per House", mat: " per House", lab: "/hr", lot: "" };
  function upDown(name, k, ci) {
    var p = at(k); if (!p) return name + " n/a";
    var v = p.v - 100, s = name + (v >= 0 ? " Up " : " Down ") + Math.abs(v).toFixed(0) + "%";
    return $ ? s + " (" + fK(p.v / 100 * mulOf(CH[ci], k)) + UNIT[k] + ")" : s;
  }

  // a line chart in a box: indexed, or dollars (stacked costs on the
  // combined chart; the gap shaded on the median chart)
  function lineChart(ci, x0, x1, T, B) {
    var c = CH[ci], L = x0 + 6, R = x1 - 58, X = function (t) { return L + (t - HV.a) / (HV.b - HV.a) * (R - L); };
    var specs = lineSpecs(ci), stack = $ && c.id === "ix";
    var vis = specs.filter(function (ln) { return isOn(ci, ln[0]); });
    var lines = stack ? vis.filter(function (ln) { return ln[0] === "price" || ln[0] === "med"; }) : vis;
    var parts = stack ? ["lot", "lab", "mat", "lum"].filter(function (k) { return isOn(ci, k); }) : [];
    var mul = function (k) { return $ ? mulOf(c, k) / 100 : 1; };
    var qts = (D.idx.price || []).filter(function (p) { return p.t >= HV.a - 3 && p.t <= HV.b + 3; }).map(function (p) { return p.t; });
    var hi = -Infinity, lo = Infinity;
    lines.forEach(function (ln) { D.idx[ln[0]].forEach(function (p) { if (p.t >= HV.a - 1.5 && p.t <= HV.b + 1.5) { hi = Math.max(hi, p.v * mul(ln[0])); lo = Math.min(lo, p.v * mul(ln[0])); } }); });
    if (stack) { qts.forEach(function (t) { hi = Math.max(hi, stackAt(t, parts).tot); }); lo = 0; }
    if (!isFinite(hi)) { hi = $ ? 1000 : 110; lo = $ ? 0 : 90; }
    if (!$) { hi = Math.max(hi, 100); lo = Math.min(lo, 100); }
    var pad = Math.max($ ? 0 : 2, (hi - lo) * 0.08); hi += pad; if (!stack) lo -= pad;
    if ($ && lo < 0) lo = 0;
    var st = nice(hi - lo, 4); hi = Math.ceil(hi / st) * st; lo = Math.floor(lo / st) * st;
    var Y = function (v) { return T + (hi - v) / (hi - lo) * (B - T); };
    hgrid(Y, lo, hi, st, L, R, function (v) { return $ ? fK(v) : String(+v.toFixed(1)); }, $ ? -1 : 100);
    var its = [];
    clipTo(L, T - 2, R, B + 2);
    if (stack && qts.length) {
      var S = qts.map(function (t) { return stackAt(t, parts); });
      parts.forEach(function (k) {
        var pts = [], cc = pc(k);
        qts.forEach(function (t, i) { pts.push([X(t), Y(S[i][k][1])]); });
        for (var i = qts.length - 1; i >= 0; i--) pts.push([X(qts[i]), Y(S[i][k][0])]);
        doc.setFillColor(cc[0], cc[1], cc[2]); alpha(0.8);
        doc.lines(pts.slice(1).map(function (p, j) { return [p[0] - pts[j][0], p[1] - pts[j][1]]; }), pts[0][0], pts[0][1], [1, 1], "F", true);
        alpha(1);
      });
    }
    if ($ && c.id === "med" && isOn(ci, "price") && isOn(ci, "med")) {
      var top = [], bot = [];
      D.idx.price.forEach(function (p) { var m = valAt(D.idx.med, p.t); if (!m || m.t !== p.t) return; top.push([X(p.t), Y(p.v * mul("price"))]); bot.unshift([X(p.t), Y(m.v * mul("med"))]); });
      var poly = top.concat(bot), mc = pc("med");
      if (poly.length > 2) { doc.setFillColor(mc[0], mc[1], mc[2]); alpha(0.15); doc.lines(poly.slice(1).map(function (p, j) { return [p[0] - poly[j][0], p[1] - poly[j][1]]; }), poly[0][0], poly[0][1], [1, 1], "F", true); alpha(1); }
    }
    lines.slice().reverse().forEach(function (ln) {
      var pts = D.idx[ln[0]], cc = pc(ln[0]), faint = ln[2] === 1, dash = ln[2] === 2, main = lines[0] === ln && c.id !== "ix", m = mul(ln[0]);
      if (faint) cc = SOFT;
      doc.setDrawColor(cc[0], cc[1], cc[2]); doc.setLineWidth(faint || dash ? 1.1 : main || ln[0] === "price" ? 2.2 : 1.6);
      if (dash) doc.setLineDashPattern([3, 2], 0);
      for (var k = 1; k < pts.length; k++) doc.line(X(pts[k - 1].t), Y(pts[k - 1].v * m), X(pts[k].t), Y(pts[k].v * m));
      doc.setLineDashPattern([], 0);
      var p2 = cur == null ? lastIn(pts) : valAt(pts, cur);
      if (p2) its.push({ y: Y(p2.v * m), t: $ ? fK(p2.v * m) : sg(p2.v - 100, 0) + "%", n: c.id === "med" ? ln[1] : SHORT[ln[0]] || ln[1], c: cc });
    });
    if (stack && parts.length) { var tq = cur == null ? qts[qts.length - 1] : (valAt(D.idx.price, cur) || {}).t; if (tq != null) { var s2 = stackAt(tq, parts); its.push({ y: Y(s2.tot), t: fK(s2.tot), n: "Costs", c: [120, 120, 125] }); } }
    if (cur != null) { doc.setDrawColor(150, 150, 155); doc.setLineWidth(0.6); doc.setLineDashPattern([2, 2], 0); doc.line(X(cur), T, X(cur), B); doc.setLineDashPattern([], 0); }
    doc.restoreGraphicsState();
    labels(its, R + 6, B);
    xticks(X, B);
    if (stack) { var lx = L; parts.slice().reverse().forEach(function (k) { var cc = pc(k), tx = SHORT[k]; doc.setFillColor(cc[0], cc[1], cc[2]); doc.rect(lx, B + 16, 7, 7, "F"); font(false, 8, INK); doc.text(tx, lx + 10, B + 22); lx += doc.getTextWidth(tx) + 20; }); }
  }

  // ---- slide 1: the split by quarter ----
  var rows = D.rows.filter(function (r) { var t = q2t(r.q); return t >= HV.a - 1.5 && t <= HV.b + 1.5; });
  var selQ = cur == null ? null : t2q(cur), last = null; rows.forEach(function (r) { if (selQ == null || r.q <= selQ) last = r; });
  var f = function (r, k) { var v = k === "price" ? r.price : r[k]; return $ ? v / 100 * r.yb : v; };
  var unitTxt = function (v, price) { return $ ? sK(v) : price ? sg(v) + "%" : sg(v) + " pts"; };
  if (last) {
    var costs = PARTS.reduce(function (a, p) { return a + f(last, p[0]); }, 0);
    var top = headline($ ? qLabel(last.q) + ": Same-House Price " + (last.price >= 0 ? "Up " : "Down ") + fK(Math.abs(f(last, "price"))) + " (" + sg(last.price) + "%) From a Year Ago; Costs Alone Would Have " + (costs >= 0 ? "Added " : "Cut ") + fK(Math.abs(costs))
      : qLabel(last.q) + ": New-Home Prices " + (last.price >= 0 ? "Up " : "Down ") + Math.abs(last.price).toFixed(1) + "% From a Year Ago; Costs Alone Would Have " + (costs >= 0 ? "Added " : "Cut ") + Math.abs(costs).toFixed(1) + " Pts");
    var on = PARTS.filter(function (p) { return isOn(ci1, p[0]); }), showP = isOn(ci1, "price");
    var L0 = 74, R = W - 110, T = top + 62, B = H - 132, hi = $ ? 1000 : 1, lo = -hi;
    rows.forEach(function (r) { var up = 0, dn = 0; on.forEach(function (p) { var v = f(r, p[0]); if (v > 0) up += v; else dn += v; }); hi = Math.max(hi, up, showP ? f(r, "price") : 0); lo = Math.min(lo, dn, showP ? f(r, "price") : 0); });
    var st = nice(hi - lo, 5); hi = Math.ceil(hi / st) * st; lo = Math.floor(lo / st) * st;
    var X = function (t) { return L0 + (t - HV.a) / (HV.b - HV.a) * (R - L0); }, Y = function (v) { return T + (hi - v) / (hi - lo) * (B - T); }, bw = Math.max(1.5, 3 / (HV.b - HV.a) * (R - L0) * 0.72);
    titles(top, "New-Home Price vs What Costs Explain, Change From a Year Earlier", win + ($ ? " · dollars per house, same house priced from the " + bs + " median" : " · bars: points each cost explains") + " (costs lagged 6 months) · line: the price change", (L0 + R) / 2);
    hgrid(Y, lo, hi, st, L0, R, function (v) { return $ ? sK(v) : sg(v, st % 1 ? 1 : 0) + "%"; }, 0);
    clipTo(L0, T - 2, R, B + 2);
    rows.forEach(function (r) {
      var up = 0, dn = 0, x = X(q2t(r.q));
      on.forEach(function (p) {
        var v2 = f(r, p[0]), y0, y1, cc = pc(p[0]);
        if (v2 >= 0) { y0 = Y(up + v2); y1 = Y(up); up += v2; } else { y0 = Y(dn); y1 = Y(dn + v2); dn += v2; }
        doc.setFillColor(cc[0], cc[1], cc[2]); doc.rect(x - bw / 2, y0, bw, Math.max(0.4, y1 - y0), "F");
      });
    });
    if (showP) {
      doc.setDrawColor(INK[0], INK[1], INK[2]); doc.setLineWidth(1.6);
      for (var k2 = 1; k2 < rows.length; k2++) doc.line(X(q2t(rows[k2 - 1].q)), Y(f(rows[k2 - 1], "price")), X(q2t(rows[k2].q)), Y(f(rows[k2], "price")));
      doc.setFillColor(INK[0], INK[1], INK[2]); rows.forEach(function (r) { doc.circle(X(q2t(r.q)), Y(f(r, "price")), 1.8, "F"); });
    }
    doc.restoreGraphicsState();
    if (showP) labels([{ y: Y(f(last, "price")), t: unitTxt(f(last, "price"), 1), n: "price " + qShort(last.q), c: INK }], R + 8, B);
    xticks(X, B);
    var lx = L0;
    on.forEach(function (p) { var cc = pc(p[0]), tx = clean(p[1] + " " + unitTxt(f(last, p[0]))); doc.setFillColor(cc[0], cc[1], cc[2]); doc.rect(lx, B + 19, 8, 8, "F"); font(false, 8.5, INK); doc.text(tx, lx + 11, B + 26); lx += doc.getTextWidth(tx) + 24; });
    font(true, 8.5, INK); doc.text(clean("Costs explain " + unitTxt(costs) + " · price " + unitTxt(f(last, "price"), 1)), lx + 4, B + 26);
    caption("How to read it: each cost's change from a year earlier, times its share of a new home's price, gives the points of price change it explains (NAHB 2024: construction 64.4%, split about 55/45 materials/labor, an assumption; lumber about 4.5% of the price, from NAHB's lumber-per-home estimate; lot 13.7%). Costs are lagged two quarters because what builders pay shows up at closing later. Any gap between the bars and the price line is what costs don't explain." + ($ ? " Dollars: points times the same house's price a year earlier, with the same house priced from the " + bn + " median new-home price (" + fK(D.dol.anchor) + ")." : " Price: Census constant-quality index (holds size and features fixed), including the lot."), L0 - 38, W - 40, B + 44, 4);
    banner(1);
  }

  // ---- slide 2: since the base quarter ----
  doc.addPage([W, H], "landscape");
  var c = D.cum;
  var top2 = "Prices and Costs Since " + bn, items = c ? wfItems(c, $) : [];
  if (c) {
    var lead = items.slice(0, 4).sort(function (a, b) { return b.v - a.v; })[0], tot = items[4], pr = items[5];
    top2 = $ ? "Since " + qLabel(c.from) + ": Same-House Price Up " + fK(pr.v) + " (" + sg(c.price, 0) + "%); Costs Explain " + fK(tot.v) + ", Led by " + tc(lead.n) + " (" + fK(lead.v) + ")"
      : "Since " + qLabel(c.from) + ": New-Home Prices " + sg(c.price, 0) + "%; Costs Explain " + sg(tot.v, 0) + " Pts, Led by " + tc(lead.n) + " (" + sg(lead.v, 0) + ")";
  }
  top2 = headline(top2);
  var cT = top2 + 62, cB = H - 124, gap = 60, x0 = 66, x1 = W - 30, cw = (x1 - x0 - gap) / 2;
  if (c) {
    var aL = x0 + 72, aR = x0 + cw - 50, mn = 0, mx = 0;
    items.forEach(function (it) { mn = Math.min(mn, it.a, it.b); mx = Math.max(mx, it.a, it.b); });
    var XW = function (val) { return aL + (val - mn) / Math.max(1e-9, mx - mn) * (aR - aL); }, rowH = (cB - cT) / items.length;
    titles(top2, "What Costs Explain", ($ ? "Dollars per house" : "Points of the price change") + " since " + qLabel(c.from) + ", through " + qLabel(c.to) + " (costs lagged 6 months)", (x0 + x0 + cw) / 2);
    doc.setDrawColor(150, 150, 155); doc.setLineWidth(0.8); doc.line(XW(0), cT, XW(0), cB);
    items.forEach(function (it, i) {
      var y = cT + i * rowH + rowH * 0.2, bh = rowH * 0.58, cc = pc(it.k), xa = XW(Math.min(it.a, it.b)), xb = XW(Math.max(it.a, it.b));
      if (it.k === "tot") { doc.setDrawColor(RULE[0], RULE[1], RULE[2]); doc.setLineWidth(0.6); doc.line(x0 - 30, y - rowH * 0.12, x0 + cw, y - rowH * 0.12); }
      font(it.k === "price" || it.k === "tot", 9.5, cc); doc.text(clean(it.n), aL - 6, y + bh * 0.72, { align: "right" });
      if (it.k === "tot") { doc.setDrawColor(cc[0], cc[1], cc[2]); doc.setLineWidth(1.2); doc.rect(xa, y, Math.max(0.8, xb - xa), bh, "S"); }
      else { doc.setFillColor(cc[0], cc[1], cc[2]); doc.rect(xa, y, Math.max(0.8, xb - xa), bh, "F"); }
      font(true, 9.5, cc); doc.text(clean($ ? sK(it.v) : sg(it.v, 1) + (it.k === "price" ? "%" : " pts")), xb + 4, y + bh * 0.72);
    });
    caption("Each bar: the part of the cumulative price change explained by that cost (its change since " + qLabel(c.from) + " times its share of the price), end to end" + ($ ? ", in dollars on the " + fK(D.dol.anchor) + " " + bn + " median" : "") + ". Raw cost changes: lumber " + sg(c.raw.lum, 0) + "%, other materials " + sg(c.raw.mat, 0) + "%, wages " + sg(c.raw.lab, 0) + "%, lot values " + sg(c.raw.lot, 0) + "%. The gap to the price change is what costs don't explain.", x0 - 30, x0 + cw + 10, H - 100, 5);
  }
  var bL = x0 + cw + gap;
  titles(top2, $ ? "What a New House Costs to Build, per House" : "Prices and Costs Since " + bn + " (" + bn + " = 100)", win + ($ ? " · costs stacked (estimates); lines: same-house and median price" : " · labels: change since " + bs), (bL + x1 - 58) / 2);
  lineChart(ciIx, bL, x1, cT, cB - ($ ? 12 : 0));
  caption($ ? "Each cost: its share of the " + bn + " same-house price (NAHB shares), moved by its own index since then; not lagged. Same house: the " + bn + " median grown by Census's constant-quality index. Median: what new homes actually sold for. The blank space between the costs and the price line is what costs don't explain."
    : "Each line indexed to its " + bn + " level. Price: Census constant-quality index; median: what new homes actually sold for. Other materials: the BLS builder-materials index with lumber taken out (estimate). Lot values end at mid-" + D.lotThrough + ".", bL - 30, x1, H - 100, 5);
  banner(2);

  // ---- slide 3: how the price index works, and the median vs the same house ----
  doc.addPage([W, H], "landscape");
  var pS = at("price"), pM = at("med"), A = D.dol ? D.dol.anchor : null;
  var sameNow = pS && A ? pS.v / 100 * A : null, medNow = pM && A ? pM.v / 100 * A : null;
  var top3 = headline(sameNow && medNow ? "The Same New House Now Costs " + fK(sameNow) + " (" + pctTxt(pS) + " Since " + bn + "); the Median New Home Sold for " + fK(medNow) + " (" + pctTxt(pM) + ")" : "How the Price Index Works, and the Median vs the Same House");
  var eT = top3 + 62, eB = H - 110, ex0 = 50, ex1 = ex0 + cw - 10;
  titles(top3, "How the Price Index Works", "Census's constant-quality index vs the median sale price", (ex0 + ex1) / 2);
  function house(cx, by, s, cc) { doc.setFillColor(cc[0], cc[1], cc[2]); doc.rect(cx - s * 0.5, by - s * 0.62, s, s * 0.62, "F"); doc.triangle(cx - s * 0.62, by - s * 0.6, cx + s * 0.62, by - s * 0.6, cx, by - s * 1.05, "F"); doc.setFillColor(255, 255, 255); doc.rect(cx - s * 0.1, by - s * 0.3, s * 0.2, s * 0.3, "F"); }
  function arrow(xa, xb, y) { doc.setDrawColor(150, 150, 155); doc.setLineWidth(1); doc.line(xa, y, xb - 4, y); doc.setFillColor(150, 150, 155); doc.triangle(xb, y, xb - 6, y - 3.5, xb - 6, y + 3.5, "F"); }
  var latestTxt = cur == null ? "Latest" : mLabel(cur), hx1 = ex0 + 120, hx2 = ex1 - 40, rowsE = [
    { n: "Price index: the same house, re-priced", a: A, b: sameNow, s2: 1, c: INK },
    { n: "Median: whatever actually sold", a: A, b: medNow, s2: sameNow && medNow ? Math.max(0.6, Math.min(1, medNow / sameNow)) : 0.8, c: pc("med") },
  ];
  rowsE.forEach(function (r, i) {
    var y = eT + 10 + i * 78;
    font(true, 9.5, r.c); doc.text(clean(r.n), ex0, y);
    house(hx1, y + 52, 34, r.c); house(hx2, y + 52, 34 * r.s2, r.c); arrow(hx1 + 30, hx2 - 30, y + 36);
    font(false, 8, GRY); doc.text(bs, hx1, y + 64, { align: "center" }); doc.text(clean(latestTxt), hx2, y + 64, { align: "center" });
    if (r.a) { font(true, 9.5, INK); doc.text(fK(r.a), hx1 + 24, y + 30); doc.text(r.b ? fK(r.b) : "", hx2 + 24, y + 30); }
  });
  caption("Census prices every new home sold by its features (floor area, bedrooms, bathrooms, garage and more, with separate models by region), then re-prices one fixed set of features each quarter: a Laspeyres index, like the CPI's fixed basket. A shift to smaller homes or cheaper areas pulls the median down but not the index. Here the index is turned into dollars by starting it at the " + bn + " median new-home price" + (A ? " (" + fK(A) + ")" : "") + ".", ex0, ex1, eT + 175, 7);
  var mL = ex1 + 50;
  titles(top3, $ ? "Same House vs Median Price, Dollars" : "Same House vs Median Price (" + bn + " = 100)", win + ($ ? " · shaded: the gap" : ""), (mL + x1 - 58) / 2);
  lineChart(ciMed, mL, x1, eT, H - 124);
  caption("Same house: Census's constant-quality price index of new houses sold, including the lot" + ($ ? ", started at the " + bn + " median" : "") + ". Median: Census's median sale price of new houses sold, averaged by quarter. When the median runs below the same-house line, buyers are getting smaller or cheaper-located homes for their money, for example when builders build smaller homes to keep payments affordable.", mL - 30, x1, H - 100, 5);
  banner(3);

  // ---- slide 4: where the materials increase came from: each product's
  // price change x its share of materials (BEA), as a share of the total ----
  doc.addPage([W, H], "landscape");
  var cs = D.comps || [];
  var rsI = cs.filter(function (x) { return x.imp != null; }).sort(function (a, b) { return b.imp - a.imp; });
  var totI = rsI.reduce(function (a, x) { return a + x.imp; }, 0), ok4 = rsI.length >= 3 && totI > 0.5;
  var shI = function (x) { return x.imp / totI * 100; };
  var top3s = rsI.slice(0, 3), topSh = ok4 ? top3s.reduce(function (a, x) { return a + shI(x); }, 0) : 0;
  var top3 = headline(ok4 ? "Since " + bn + ": " + top3s.map(function (x) { return tc(x.name.split(" (")[0]); }).join(", ").replace(/, ([^,]*)$/, " and $1") + " Account for " + topSh.toFixed(0) + "% of the Rise in Materials Costs" : "Building Materials: Where the Increase Came From");
  if (ok4) {
    var ms = {}; rsI.forEach(function (x) { ms[x.m] = 1; }); var mk = Object.keys(ms).sort();
    titles(top3 - 6, "Share of the Rise in Materials Costs Since " + bn, "Each product's price change times its share of materials · BLS producer price indexes, latest " + mLabel(mOfStr(mk[mk.length - 1])) + (mk.length > 1 ? " (some through " + mLabel(mOfStr(mk[0])) + ")" : "") + " · shares from BEA's 2017 input-output table", W / 2);
    var T3 = top3 + 56, B3 = H - 132, nL = 236, bx0 = nL + 10, bx1 = W - 290, cx = W - 226, rh = (B3 - T3) / rsI.length, lo3 = 0, hi3 = 0;
    rsI.forEach(function (x) { lo3 = Math.min(lo3, shI(x)); hi3 = Math.max(hi3, shI(x)); });
    var X3 = function (v) { return bx0 + (v - lo3) / Math.max(1e-9, hi3 - lo3) * (bx1 - bx0); };
    font(true, 8, GRY); doc.text("Share of the rise", bx0, T3 - 5); doc.text("Share of materials", cx, T3 - 5); doc.text("Price change", cx + 100, T3 - 5);
    doc.setDrawColor(150, 150, 155); doc.setLineWidth(0.8); doc.line(X3(0), T3, X3(0), B3);
    rsI.forEach(function (x, i) {
      var y = T3 + i * rh, cy = y + rh / 2, cc = x.key === "lum" ? pc("lum") : pc("mat"), v = shI(x);
      if (i % 2 === 0) { doc.setFillColor(246, 246, 248); doc.rect(36, y, W - 72, rh, "F"); }
      font(true, 9.5, cc); doc.text(clean(x.name), nL, cy + 3.3, { align: "right" });
      var a = X3(Math.min(0, v)), b = X3(Math.max(0, v));
      doc.setFillColor(cc[0], cc[1], cc[2]); doc.rect(a, cy - rh * 0.28, Math.max(0.8, b - a), rh * 0.56, "F");
      font(true, 9.5, cc); doc.text(Math.round(v) + "%", v >= 0 ? b + 4 : a - 4, cy + 3.3, { align: v >= 0 ? "left" : "right" });
      font(false, 9, INK); doc.text(x.w.toFixed(0) + "%", cx, cy + 3.3); doc.text((x.since >= 0 ? "up " : "down ") + Math.abs(x.since).toFixed(0) + "%", cx + 100, cy + 3.3);
    });
    var ty = B3 + 8;
    doc.setFillColor(238, 238, 241); doc.rect(36, ty, W - 72, 18, "F");
    font(false, 9, INK); var lab = "These " + rsI.length + " materials cost", lw = doc.getTextWidth(lab); doc.text(lab, 44, ty + 12.3);
    font(true, 9, pc("mat")); var t2 = totI.toFixed(0) + "% more", lw2 = doc.getTextWidth(t2); doc.text(t2, 44 + lw + 4, ty + 12.3);
    font(false, 9, INK); doc.text("than in " + bn + ", weighted by each product's share of materials", 44 + lw + lw2 + 8, ty + 12.3);
    caption("Share of the rise: each product's own BLS producer price index (latest month vs its " + bn + " average) times its share of what single-family construction bought of these " + rsI.length + " products in BEA's 2017 input-output table, as a percent of the total rise. Share of materials is of these products' cost, not the home price. BEA shares are at producer prices and held fixed; the plywood share includes OSB and trusses, which BEA groups together. BLS stopped publishing OSB in 2019.", 36, W - 40, H - 86, 3);
  }
  banner(4);

  // ---- slides 5 and 6: the biggest inputs on their own ----
  var PT = { lum: "Lumber per House (Estimate)", mat: "Other Materials per House (Estimate)", lab: "Construction Wages per Hour", lot: "Median Lot Value, New Spec Homes" };
  function pairSlide(page, a, b, headA, headB, capA, capB) {
    doc.addPage([W, H], "landscape");
    var top = headline("Since " + bn + ": " + upDown(headA[0], headA[1], a) + " and " + upDown(headB[0], headB[1], b) + ", vs New-Home Prices " + pctTxt(at("price")));
    var T = top + 62, B = H - 124, x0 = 66, x1 = W - 30, gap = 60, cw = (x1 - x0 - gap) / 2;
    [[a, x0, capA], [b, x0 + cw + gap, capB]].forEach(function (z) {
      var cc = CH[z[0]];
      titles(top, $ ? PT[cc.id] : cc.title + " vs New-Home Price (" + bn + " = 100)", win + ($ ? "" : " · gray: new-home price"), (z[1] + z[1] + cw - 58) / 2);
      lineChart(z[0], z[1], z[1] + cw, T, B);
      caption(z[2], z[1] - 30, z[1] + cw, H - 100, 5);
    });
    banner(page);
  }
  pairSlide(5, ciL, ciM, ["Lumber", "lum"], ["Other Materials", "mat"],
    "BLS lumber price index, monthly. Lumber is roughly 4.5% of a new home's price (NAHB's lumber-per-home estimate), so even big swings move home prices by a point or two." + ($ ? " Dollars: 4.5% of the " + bn + " same-house price, moved by the index." : ""),
    "The BLS single-family construction materials index (dashed) with lumber taken out at its weight: an estimate of everything else a builder buys, from concrete and drywall to windows and appliances." + ($ ? " Dollars: its share of the " + bn + " same-house price, moved by the index." : ""));
  pairSlide(6, ciW, ciLot, ["Wages", "lab"], ["Lot Values", "lot"],
    "Average hourly pay of construction production workers, not seasonally adjusted. What builders pay subcontractors can run ahead of wages when crews are scarce, so this likely understates labor cost.",
    "Census median lot value for new spec homes, one value per year (placed at mid-year) and drawn straight between years; it ends at mid-" + D.lotThrough + ". A median, not adjusted for location or lot size.");
  // ---- slide 7 (appendix): how the dollars are built ----
  var DT = dolTable();
  if (DT) {
    doc.addPage([W, H], "landscape");
    var top7 = headline("How the Dollars Are Built: Each Cost's Share of the Price x the " + bn + " Median (" + fK(DT.A) + ") x Its Own Price Index");
    var cols = [{ h: "Cost", x: 60, a: "left" }, { h: "Share of price", x: 225, a: "right" }, { h: "Source of the share", x: 240, a: "left" }, { h: bs + " dollars", x: 555, a: "right" }, { h: "Index change", x: 630, a: "right" }, { h: (cur == null ? "Latest" : mShort(cur)) + " dollars", x: 705, a: "right" }, { h: "Change", x: 760, a: "right" }];
    var y7 = top7 + 46, rh7 = 30;
    font(true, 9, GRY); cols.forEach(function (cc) { doc.text(clean(cc.h), cc.x, y7, { align: cc.a }); });
    doc.setDrawColor(RULE[0], RULE[1], RULE[2]); doc.setLineWidth(0.8); doc.line(50, y7 + 7, W - 30, y7 + 7);
    var SRC7 = { lum: "NAHB: $16.9K of lumber per home (Apr 2020 prices)", mat: "NAHB 2024: construction 64.4% x 55% materials, less lumber", lab: "NAHB 2024: construction 64.4% x 45% labor", lot: "NAHB 2024: finished lot 13.7%", price: "Census constant-quality index" };
    function row7(r, bold, cc) {
      y7 += rh7;
      font(bold, 10.5, cc); doc.text(clean(r.n), 60, y7);
      font(bold, 10.5, INK); doc.text(r.share.toFixed(1) + "%", 225, y7, { align: "right" });
      font(false, 8.5, GRY); doc.text(clean(r.k ? SRC7[r.k] : r.n === "Costs" ? "Sum of the four" : SRC7.price), 240, y7);
      font(bold, 10.5, INK); doc.text(fK(r.then), 555, y7, { align: "right" }); doc.text(sg(r.chg, 0) + "%", 630, y7, { align: "right" }); doc.text(fK(r.now), 705, y7, { align: "right" });
      font(bold, 10.5, cc); doc.text(sK(r.now - r.then), 760, y7, { align: "right" });
      doc.setDrawColor(RULE[0], RULE[1], RULE[2]); doc.setLineWidth(0.4); doc.line(50, y7 + 10, W - 30, y7 + 10);
    }
    DT.rows.forEach(function (r) { row7(r, false, pc(r.k)); });
    doc.setDrawColor(120, 120, 125); doc.setLineWidth(0.8); doc.line(50, y7 + 10, W - 30, y7 + 10);
    row7(DT.tot, true, INK);
    if (DT.price) row7(DT.price, true, INK);
    caption("Example: lumber is " + DT.rows[0].share.toFixed(1) + "% of the price, so " + DT.rows[0].share.toFixed(1) + "% x " + fK(DT.A) + " = " + fK(DT.rows[0].then) + " in " + bn + "; the lumber index is " + sg(DT.rows[0].chg, 0) + "% since, so " + fK(DT.rows[0].then) + " x " + (1 + DT.rows[0].chg / 100).toFixed(2) + " = " + fK(DT.rows[0].now) + ". The shares are NAHB's 2024 Cost of Constructing a Home survey and lumber-per-home estimate; the 55/45 materials/labor split and lumber's 4.5% are assumptions. Each index runs through its latest month (lot values through mid-" + D.lotThrough + "). These are levels, not lagged; the 'what costs explain' bars on slides 1 and 2 use costs from 6 months earlier, so their dollars differ. The share of the price not covered by these costs is left blank.", 60, W - 40, y7 + 34, 6);
    banner(7);
  }
  return doc;
};

window.shareInfo = function () { return { title: "Builder Inputs", name: "New-home price and building costs", asOf: D && D.rows.length ? qLabel(D.rows[D.rows.length - 1].q) : "" }; };
</script>
</body>
</html>`;


// ---------- Run ----------
const SOURCES = "Sources: U.S. Census Bureau (constant-quality price index of new houses sold, including lot; median sales price of new houses sold, MSPNHSUS); BLS producer price indexes via FRED (single-family construction inputs WPUIP23111013, lumber WPU081, and the products in the materials breakdown); BLS hourly earnings of construction production workers (AHECONS); NAHB (2024 Cost of Constructing a Home shares, lumber per home, and Census lot values); BEA 2017 input-output accounts (what single-family construction buys of each product).";
const NOTE = "An estimate, not a measurement. Price: Census's constant-quality index of new single-family houses sold, including the lot (quarterly; holds size and features fixed, so a shift to smaller homes doesn't look like a price cut). Costs: lumber (BLS lumber index), other materials (BLS's single-family construction inputs index, goods less food and energy, with lumber taken out at its share), labor (construction production workers' hourly pay), lot (Census median lot value of new spec homes, annual, via NAHB; drawn straight between years). Each cost's change times its share of the price gives the points it explains: construction 64.4% and lot 13.7% (NAHB 2024), construction split about 55/45 materials/labor and lumber at 4.5% of the price (NAHB's $16.9K of lumber products per home at April 2020 prices); the splits are assumptions. Costs are lagged two quarters, because what builders pay shows up at closing later. What costs don't explain is left blank: it includes builder profit, overhead, commissions, incentives, shifts in the shares, and noise. Buydowns and closing-cost help don't lower the recorded price. Dollars: the median new-home price in the base quarter, grown by the price index, is the same house at later prices; each cost in dollars is its share of that price times its own index (estimates), except the wage and lot charts, which show actual hourly pay and the Census median lot value. The median itself shifts with the mix of homes sold (size, location), which the index holds fixed. Materials breakdown: each product's share of the rise in materials costs since the base quarter = its BLS producer price index change (latest month vs its base-quarter average) times its share of what single-family construction bought of these products in BEA's 2017 input-output table (industry 233411, producer prices; the plywood share includes OSB and trusses, which BEA groups together; held fixed), as a percent of the total. Share of materials is of these products' cost, not the home price. BLS stopped publishing OSB in 2019. BLS revises recent months.";
function payload(s) {
  const R = compute(s);
  return {
    rows: R.rows, cum: R.cum, idx: R.idx, dol: R.dol, comps: R.comps, base: R.base, lotThrough: R.lotThrough, through: R.through, weights: R.weights,
    colors: { lum: C.lum, mat: C.mat, lab: C.lab, lot: C.lot, all: C.all, med: C.med },
    pcolors: { lum: C.plum, mat: C.pmat, lab: C.plab, lot: C.plot, all: C.pall, med: C.pmed },
    sources: SOURCES, note: NOTE, errors: s.errors || null,
    checked: s.checked ? new Date(s.checked).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "",
  };
}
async function openFullScreen(saved) {
  const wv = updWV(new WebView());
  await wv.loadHTML(...updArgs(PAGE_HTML.replace("__DATA__", () => JSON.stringify(saved ? payload(saved) : null)).replace("__SHARE__", () => "<script>" + SHARE_PAGE_JS + "</script>")));
  await presentWithSharing(wv, async (isOpen) => {
    try {
      // the price index (a spreadsheet read in a hidden page) and the materials breakdown are only fetched here
      const fresh = await refresh(saved, !saved || !saved.priceChecked || hoursSince(saved.priceChecked) >= REFRESH_HOURS || Object.keys(saved.comps || {}).length < COMPONENTS.length || !saved.med, true);
      if (fresh !== saved && isOpen()) await wv.evaluateJavaScript(`window.update(${JSON.stringify(payload(fresh))});0`);
    } catch (e) {
      if (!saved) { try { await wv.evaluateJavaScript(`document.getElementById("errs").textContent = ${JSON.stringify("Couldn't load the data: " + (e.message || e))};0`); } catch (e2) {} }
    }
  });
}
if (config.runsInWidget || PREVIEW_WIDGET_IN_APP) {
  let widget;
  try {
    let s = readJSON(FILE);
    if (!s || hoursSince(s.checked) >= REFRESH_HOURS) {
      const fresh = await Promise.race([refresh(s, false, false).catch(() => null), sleep(WIDGET_SECONDS * 1000).then(() => null)]);
      if (fresh) s = fresh;
    }
    if (!s) throw new Error("Open the script once in Scriptable to download the data.");
    widget = new ListWidget();
    widget.backgroundImage = updRing(smallImage(s));
    widget.addSpacer();
    widget.url = URLScheme.forRunningScript();
    widget.refreshAfterDate = new Date(Date.now() + 6 * 3600 * 1000);
  } catch (e) {
    widget = errorWidget(e.message || String(e));
  }
  if (config.runsInWidget) Script.setWidget(widget);
  else await widget.presentSmall();
} else {
  const s = readJSON(FILE);
  await openFullScreen(s);
}
Script.complete();
