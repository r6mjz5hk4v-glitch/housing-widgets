
// ---- Shared settings (saved on this phone by the Setup script) ----
// Keys and personal settings live in the phone's keychain, not in this file,
// so the file can be shared as is.
function setting(key, fallback) {
  try { if (Keychain.contains(key)) { const v = Keychain.get(key); if (v) return v; } } catch (e) {}
  return fallback;
}

// Consumer Sentiment Widget for Scriptable (small widget)
// University of Michigan consumer sentiment via FRED (UMCSENT, monthly), with
// NBER recessions (USREC) shaded in the full-screen view. All FRED, no scraping.
// At Michigan's request, FRED posts this series a month late, so the widget
// trails the headline number you hear on the news.
// Home screen: a gauge with the needle on sentiment's range since 1978, the
// long-run average as a white tick, and the change from the prior month.
// Tap for the full-screen view: the index with recessions shaded, and its
// change from a year earlier, pinch-zoomable.

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

const TICKER = "SENTIMENT";
const NAME = "University of Michigan";
const CACHE_FILE = "sentiment-v1.json";

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
  w.backgroundImage = img;
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
  w.backgroundImage = img;
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

// ---------- Full-screen view: stacked monthly panels ----------
// Note: the page script below avoids backticks, backslashes and dollar-brace
// on purpose, because the whole page lives inside a template literal.
const MONTHLY_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  :root { --bg:#1C1C1E; --fg:#FFFFFF; --gray:#98989F; }
  * { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  body { margin:0; padding:20px 18px 32px; background:var(--bg); color:var(--fg);
         font-family:-apple-system,system-ui,sans-serif;
         -webkit-user-select:none; user-select:none; }
  .ticker { font-size:28px; font-weight:700; }
  .name { color:var(--gray); font-size:15px; font-weight:600; margin-top:2px; }
  .month { font-size:15px; font-weight:600; margin-top:12px; min-height:20px; }
  .hint { color:var(--gray); font-size:12px; margin-top:2px; }
  .panel { margin-top:20px; }
  .ptitle { display:flex; align-items:baseline; font-variant-numeric:tabular-nums; }
  .ptitle b { font-size:16px; }
  .ptitle .val { margin-left:auto; font-size:20px; font-weight:600; }
  .legend { display:flex; flex-wrap:wrap; font-size:13px; font-weight:600;
            margin-top:4px; min-height:18px; font-variant-numeric:tabular-nums; }
  .legend > span { margin:2px 14px 2px 0; }
  .legend i { display:inline-block; width:12px; height:4px; border-radius:2px;
              vertical-align:middle; margin-right:5px; }
  .legend span span { color:var(--gray); font-weight:500; margin-left:4px; }
  .wrap { position:relative; margin-top:6px; }
  svg.chart { display:block; width:100%; height:150px; }
  .touch { position:absolute; left:0; top:0; right:0; bottom:0; touch-action:pan-y; }
  .note { color:var(--gray); font-size:11px; line-height:1.45; margin-top:20px; }
  .cbox { margin-top:22px; background:#2C2C2E; border-radius:12px; padding:14px 14px 12px; }
  .cbox .ch { font-size:12px; font-weight:700; color:var(--gray); letter-spacing:0.3px; text-transform:uppercase; }
  .cbox .cs { font-size:12px; font-weight:700; color:var(--gray); letter-spacing:0.3px; text-transform:uppercase; margin-top:14px; }
  .lk { display:flex; align-items:flex-start; padding:10px 0; border-top:1px solid #3A3A3C; -webkit-tap-highlight-color:transparent; }
  .cbox .ch + .lk, .cbox .cs + .lk { border-top:none; }
  .lk .d { flex:none; width:58px; color:var(--gray); font-size:13px; font-weight:600; padding-top:1px; font-variant-numeric:tabular-nums; }
  .lk .t { flex:1; font-size:15px; line-height:1.35; }
  .lk .t .s { font-size:12px; color:var(--gray); margin-top:2px; }
  .lk.on .t { color:#64A8FF; }
  .lk .ar { flex:none; color:var(--gray); font-size:20px; line-height:18px; margin-left:10px; }
  .lk.on:active, .lk.tap { opacity:0.5; }
  html, body { -webkit-text-size-adjust:100%; text-size-adjust:100%; }
  @media (max-width: 360px) {
    body { padding:16px 12px 28px; }
    .ticker { font-size:24px; }
    .ptitle .val { font-size:18px; }
    .legend { font-size:12px; }
  }
</style>
</head>
<body>
  <div class="ticker" id="ticker"></div>
  <div class="name" id="name"></div>
  <div class="month" id="month"></div>
  <div class="hint">Pinch to zoom, drag with two fingers to pan, double-tap to reset</div>
  <div class="hint" id="progress"></div>
  <div id="panels"></div>
  <div class="cbox" id="cbox" style="display:none"></div>
  <div class="hint" id="unote" style="color:#FF9F0A;margin-top:10px"></div>
  <div class="note" id="note"></div>

<script>
var D = __DATA__;
var GREEN = D.green, RED = D.red, GRAY = "#98989F";
var MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
var MONTHS_LONG = ["January","February","March","April","May","June","July","August",
                   "September","October","November","December"];
var P = [], I_MIN = 0, I_MAX = 0, FULL = 0, MIN_SPAN = D.minMonths - 1, LEAD = 0;
var view = { a: 0, b: 0 }, geo = [], touched = false, pendingData = null, LAST_W = 0;

function el(id) { return document.getElementById(id); }
function idx(m) { var p = m.split("-"); return (+p[0]) * 12 + (+p[1]) - 1; }
function mOf(i) { var y = Math.floor(i / 12), mo = (i % 12) + 1; return y + "-" + (mo < 10 ? "0" : "") + mo; }
function fmtShort(i) { var m = mOf(i).split("-"); return MONTHS[+m[1] - 1] + " '" + m[0].slice(2); }
function fmtLong(i) { var m = mOf(i).split("-"); return MONTHS_LONG[+m[1] - 1] + " " + m[0]; }
function fmtV(v, unit, dec) {
  if (unit === "%") return v.toFixed(dec) + "%";
  if (unit === "K") return Math.round(v) + "K";
  if (unit === "mo") return v.toFixed(1) + " mo";
  if (unit === "$K") return "$" + Math.round(v) + "K";
  if (unit === "$T") return "$" + v.toFixed(2) + "T";
  if (unit === "M") return v.toFixed(2) + "M";
  return v.toFixed(dec);
}
function signedPct(v) {
  var s = Math.abs(v).toFixed(1);
  return (parseFloat(s) === 0 ? "" : v > 0 ? "+" : "-") + s + "%";
}
// Bar values: percent (default), index points, or billions of dollars
function barFmt(v, pn, dec) {
  var d = dec === undefined ? (pn.unit === "$B" ? 0 : 1) : dec;
  var s = Math.abs(v).toFixed(d), zero = parseFloat(s) === 0, sign = zero ? "" : v > 0 ? "+" : "-";
  if (pn.unit === "pts") return sign + s;
  if (pn.unit === "$B") return sign + "$" + s + "B";
  return sign + s + "%";
}
function barColor(v, pn) {
  if (parseFloat(Math.abs(v).toFixed(1)) === 0) return GRAY;
  if (pn.upColor) return v > 0 ? pn.upColor : pn.downColor;
  return (pn.goodUp ? v > 0 : v < 0) ? GREEN : RED;
}
function niceStep(range) {
  var rough = range / 4, pow = Math.pow(10, Math.floor(Math.log(rough) / Math.LN10));
  var c = [1, 2, 2.5, 5, 10];
  for (var i = 0; i < c.length; i++) if (c[i] * pow >= rough) return c[i] * pow;
  return 10 * pow;
}

// (Re)load the panels: at open, and when fresher data arrives
function load(Dn) {
  P = Dn.panels;
  I_MIN = Infinity; I_MAX = -Infinity;
  LEAD = -1;
  for (var k = 0; k < P.length; k++) {
    var pn = P[k];
    if (pn.kind === "seasonal") continue; // year-over-year overlay: not on the timeline
    if (LEAD < 0) LEAD = k;
    pn.list = pn.kind === "bars" ? [{ pts: pn.pts }] : pn.series;
    for (var s = 0; s < pn.list.length; s++) {
      var sr = pn.list[s];
      sr.by = {};
      for (var j = 0; j < sr.pts.length; j++) {
        var i = idx(sr.pts[j].m);
        sr.by[i] = sr.pts[j].v;
        if (i < I_MIN) I_MIN = i;
        if (i > I_MAX) I_MAX = i;
      }
    }
  }
  // The timeline ends at the newest month of the first panel's data, so a
  // month that simply isn't published yet never shows up as a gap
  var lead = P[LEAD].list[0].pts;
  if (lead.length) I_MAX = idx(lead[lead.length - 1].m);
  // A newer release from Michigan itself (a hollow dot) extends the timeline
  for (var mk = 0; mk < P.length; mk++) {
    (P[mk].marks || []).forEach(function (q) { if (idx(q.m) > I_MAX) I_MAX = idx(q.m); });
  }
  FULL = Math.max(MIN_SPAN, I_MAX - I_MIN);
  el("progress").textContent = Dn.progress || "";
  el("progress").style.color = (Dn.progress || "").indexOf("unreachable") >= 0 ? "#FF9F0A" : "";
  el("note").textContent = Dn.note;
  drawLinks(Dn.links);
  el("unote").textContent = Dn.umichNote || "";
}
// Michigan's links: this month's release, then the special reports. A tap
// is handed to Scriptable, which opens it in Safari over this view.
var OPEN_Q = null;
window.__takeOpen = function () { var u = OPEN_Q; OPEN_Q = null; return u; };
function div(cls, text) { var x = document.createElement("div"); x.className = cls; if (text) x.textContent = text; return x; }
function linkRow(box, date, title, sub, url) {
  var r = div("lk" + (url ? " on" : ""));
  r.appendChild(div("d", date));
  var t = div("t", title);
  if (sub) t.appendChild(div("s", sub));
  r.appendChild(t);
  if (url) {
    r.appendChild(div("ar", "\u203A"));
    r.addEventListener("click", function () {
      OPEN_Q = url;
      r.classList.add("tap");
      setTimeout(function () { r.classList.remove("tap"); }, 900);
    });
  }
  box.appendChild(r);
}
function drawLinks(L) {
  var box = el("cbox");
  box.innerHTML = "";
  box.style.display = L ? "" : "none";
  if (!L) return;
  box.appendChild(div("ch", "From the University of Michigan"));
  linkRow(box, L.release.date, L.release.title, L.release.sub, L.release.url);
  if (L.reports.length) {
    box.appendChild(div("cs", "Special reports"));
    L.reports.forEach(function (r) { linkRow(box, r.date, r.title, "", r.url); });
    if (!L.reports.some(function (r) { return r.url; })) box.appendChild(div("s hint", "Links weren't found on Michigan's page, so these are titles only."));
  }
  if (L.more) linkRow(box, "", "All special reports", "", L.more);
}
load(D);

// One block per panel: title (and value), legend, chart with a touch layer
(function () {
  var html = "";
  for (var k = 0; k < P.length; k++) {
    html += '<div class="panel"><div class="ptitle"><b>' + P[k].title + '</b>' +
            (P[k].kind === "bars" ? '<span class="val" id="val' + k + '"></span>' : '') + '</div>' +
            '<div class="legend" id="leg' + k + '"></div>' +
            '<div class="wrap"><svg class="chart" id="svg' + k + '" xmlns="http://www.w3.org/2000/svg"></svg>' +
            (P[k].kind === "seasonal" ? '' : '<div class="touch" id="touch' + k + '"></div>') + '</div></div>';
  }
  el("panels").innerHTML = html;
})();

function setView(a, b) {
  var span = Math.round(Math.max(MIN_SPAN, Math.min(FULL, b - a)));
  a = Math.round(a);
  if (a < I_MAX - FULL) a = I_MAX - FULL;
  if (a + span > I_MAX) a = I_MAX - span;
  view.a = a;
  view.b = a + span;
  for (var k = 0; k < P.length; k++) draw(k);
  show(null);
}
function resetView() {
  var span = Math.min(FULL, D.defaultMonths - 1);
  setView(I_MAX - span, I_MAX);
}

// Year-over-year overlay: January to December across, one line per year.
// Every year is a faint line; last year and this year are bright and labeled.
function drawSeasonal(k) {
  var pn = P[k], svg = el("svg" + k);
  var w = svg.clientWidth || 340, h = svg.clientHeight || 150;
  LAST_W = w;
  // Scale to fit if the real width turns out different, until refit redraws
  svg.setAttribute("viewBox", "0 0 " + w + " " + h);
  svg.setAttribute("preserveAspectRatio", "xMinYMin meet");
  var m = { l: 4, r: 46, t: 8, b: 20 }, pw = w - m.l - m.r;
  var vals = [];
  for (var a = 0; a < pn.years.length; a++) for (var b = 0; b < pn.years[a].pts.length; b++) vals.push(pn.years[a].pts[b].v);
  if (!vals.length) { svg.innerHTML = ""; return; }
  var hi = Math.max.apply(null, vals), lo = Math.min.apply(null, vals), pad = (hi - lo) * 0.08;
  hi += pad; lo = Math.max(0, lo - pad);
  var x = function (mo) { return m.l + (mo - 1) * pw / 11; };
  var y = function (v) { return m.t + (hi - v) / (hi - lo) * (h - m.t - m.b); };
  var out = "", step = niceStep(hi - lo);
  for (var t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step) {
    out += '<line x1="' + m.l + '" x2="' + (w - m.r) + '" y1="' + y(t) + '" y2="' + y(t) + '" stroke="#3A3A3C" stroke-width="1"/>';
    out += '<text x="' + (w - m.r + 6) + '" y="' + (y(t) + 4) + '" fill="#98989F" font-size="11">' + fmtV(t, pn.unit, 0) + '</text>';
  }
  var n = pn.years.length;
  for (var i = 0; i < n; i++) {
    var yr = pn.years[i], recent = i >= n - 2, cur = i === n - 1;
    var col = cur ? "#A9CCFF" : recent ? "#5A8FDB" : "#5A8FDB";
    var d = "", pen = false, prev = 0;
    for (var j = 0; j < yr.pts.length; j++) {
      var p = yr.pts[j];
      d += (pen && p.mo === prev + 1 ? "L" : "M") + x(p.mo).toFixed(1) + " " + y(p.v).toFixed(1) + " ";
      pen = true; prev = p.mo;
    }
    out += '<path d="' + d + '" fill="none" stroke="' + col + '" stroke-opacity="' + (recent ? 1 : 0.2) +
           '" stroke-width="' + (cur ? 2.6 : recent ? 1.8 : 1) + '" stroke-linejoin="round" stroke-linecap="round"/>';
    if (recent && yr.pts.length) {
      var lp = yr.pts[yr.pts.length - 1];
      if (cur) out += '<circle cx="' + x(lp.mo) + '" cy="' + y(lp.v) + '" r="3" fill="' + col + '"/>';
      out += '<text x="' + (x(lp.mo) + 6) + '" y="' + (y(lp.v) + 4) + '" fill="' + col + '" font-size="11" font-weight="600">' + yr.year + '</text>';
    }
  }
  var ticks = [[1, "Jan"], [4, "Apr"], [7, "Jul"], [10, "Oct"], [12, "Dec"]];
  for (var q = 0; q < ticks.length; q++) {
    out += '<text x="' + x(ticks[q][0]) + '" y="' + (h - 5) + '" fill="#98989F" font-size="11" text-anchor="' +
           (q === 0 ? "start" : q === ticks.length - 1 ? "end" : "middle") + '">' + ticks[q][1] + '</text>';
  }
  svg.innerHTML = out;
  el("leg" + k).textContent = pn.legend || "";
}

function draw(k) {
  if (P[k].kind === "seasonal") return drawSeasonal(k);
  var pn = P[k], svg = el("svg" + k);
  var w = svg.clientWidth || 340, h = svg.clientHeight || 150;
  LAST_W = w;
  // Scale to fit if the real width turns out different, until refit redraws
  svg.setAttribute("viewBox", "0 0 " + w + " " + h);
  svg.setAttribute("preserveAspectRatio", "xMinYMin meet");
  var m = { l: 4, r: 46, t: 8, b: 20 };
  var n = view.b - view.a + 1, pw = w - m.l - m.r, slot = pw / n;
  var cx = function (i) { return m.l + (i - view.a + 0.5) * slot; };
  var g = { m: m, w: w, slot: slot, cx: cx, y: null };
  geo[k] = g;
  var out = "", i, v;

  if (pn.kind === "bars") {
    // Year-over-year bars around zero; a month with no number is a dashed slot
    var mx = 1;
    for (i = view.a; i <= view.b; i++) {
      v = pn.list[0].by[i];
      if (v !== undefined) mx = Math.max(mx, Math.abs(v));
    }
    var stepB = niceStep(mx * 2);
    mx = Math.ceil(mx / stepB) * stepB;
    var mid = m.t + (h - m.t - m.b) / 2, half = (h - m.t - m.b) / 2;
    var yb = function (val) { return mid - val / mx * half; };
    g.y = yb;
    for (var q = -mx; q <= mx + 1e-9; q += stepB) {
      var gy = yb(q);
      out += '<line x1="' + m.l + '" x2="' + (w - m.r) + '" y1="' + gy + '" y2="' + gy +
             '" stroke="' + (Math.abs(q) < 1e-9 ? "#636366" : "#3A3A3C") + '" stroke-width="1"/>';
      out += '<text x="' + (w - m.r + 6) + '" y="' + (gy + 4) + '" fill="#98989F" font-size="11">' +
             barFmt(q, pn, stepB < 1 ? 1 : 0) + '</text>';
    }
    var bw = Math.max(1, slot * 0.7);
    for (i = view.a; i <= view.b; i++) {
      v = pn.list[0].by[i];
      var bx = cx(i) - bw / 2;
      if (v === undefined) {
        out += '<rect x="' + bx.toFixed(1) + '" y="' + (m.t + 2) + '" width="' + bw.toFixed(1) + '" height="' +
               (h - m.t - m.b - 4) + '" fill="none" stroke="#98989F" stroke-opacity="0.6" stroke-width="0.75" stroke-dasharray="2 2"/>';
        continue;
      }
      var col = barColor(v, pn);
      var y1 = yb(Math.max(v, 0)), y2 = yb(Math.min(v, 0));
      out += '<rect x="' + bx.toFixed(1) + '" y="' + y1.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' +
             Math.max(0.8, y2 - y1).toFixed(1) + '" rx="1.5" fill="' + col + '" fill-opacity="0.85"/>';
    }
  } else if (pn.kind === "stack") {
    // Stacked areas from zero: each series sits on top of the ones before it.
    // A month missing any series breaks the stack.
    var hiS = 0;
    for (i = view.a; i <= view.b; i++) {
      var sum = 0, all = true;
      for (var s0 = 0; s0 < pn.list.length; s0++) {
        if (pn.list[s0].by[i] === undefined) { all = false; break; }
        sum += pn.list[s0].by[i];
      }
      if (all) hiS = Math.max(hiS, sum);
    }
    if (!hiS) {
      svg.innerHTML = '<text x="' + (m.l + pw / 2) + '" y="' + (h / 2) +
                      '" fill="#98989F" font-size="13" text-anchor="middle">No data in this stretch</text>';
      return;
    }
    var hiT = hiS * 1.08;
    var ys = function (val) { return m.t + (hiT - val) / hiT * (h - m.t - m.b); };
    g.y = ys;
    var stepS = niceStep(hiT);
    for (var tS = 0; tS <= hiT + 1e-9; tS += stepS) {
      var tyS = ys(tS);
      out += '<line x1="' + m.l + '" x2="' + (w - m.r) + '" y1="' + tyS + '" y2="' + tyS + '" stroke="#3A3A3C" stroke-width="1"/>';
      out += '<text x="' + (w - m.r + 6) + '" y="' + (tyS + 4) + '" fill="#98989F" font-size="11">' + fmtV(tS, pn.unit, 0) + '</text>';
    }
    var cumAt = function (mi, upTo) {
      var c = 0;
      for (var q2 = 0; q2 <= upTo; q2++) {
        var vv = pn.list[q2].by[mi];
        if (vv === undefined) return null;
        c += vv;
      }
      return c;
    };
    for (var sL = 0; sL < pn.list.length; sL++) {
      var runS = [];
      var flushStack = function () {
        if (runS.length > 1) {
          var dTop = "", dBot = "";
          for (var r3 = 0; r3 < runS.length; r3++) {
            dTop += (r3 ? "L" : "M") + cx(runS[r3]).toFixed(1) + " " + ys(cumAt(runS[r3], sL)).toFixed(1) + " ";
          }
          for (var r4 = runS.length - 1; r4 >= 0; r4--) {
            var below = sL ? cumAt(runS[r4], sL - 1) : 0;
            dBot += "L" + cx(runS[r4]).toFixed(1) + " " + ys(below).toFixed(1) + " ";
          }
          out += '<path d="' + dTop + dBot + 'Z" fill="' + pn.list[sL].color + '" fill-opacity="0.85"/>';
        }
        runS = [];
      };
      for (i = view.a; i <= view.b; i++) {
        if (cumAt(i, pn.list.length - 1) !== null) runS.push(i); else flushStack();
      }
      flushStack();
    }
  } else {
    // Lines: one or two series, optional shaded gap and dashed reference line
    var vals = [];
    for (var s = 0; s < pn.list.length; s++) {
      for (i = view.a; i <= view.b; i++) {
        v = pn.list[s].by[i];
        if (v !== undefined) vals.push(v);
      }
    }
    if (pn.ref) vals.push(pn.ref.v);
    (pn.marks || []).forEach(function (q) { var qi = idx(q.m); if (qi >= view.a && qi <= view.b) vals.push(q.v); });
    if (!vals.length) {
      svg.innerHTML = '<text x="' + (m.l + pw / 2) + '" y="' + (h / 2) +
                      '" fill="#98989F" font-size="13" text-anchor="middle">No data in this stretch</text>';
      return;
    }
    var hi = Math.max.apply(null, vals), lo = Math.min.apply(null, vals);
    var pad = (hi - lo) * 0.1; hi += pad; lo -= pad;
    if (hi - lo < pn.minSpan) {
      var midv = (hi + lo) / 2;
      hi = midv + pn.minSpan / 2;
      lo = midv - pn.minSpan / 2;
    }
    var yl = function (val) { return m.t + (hi - val) / (hi - lo) * (h - m.t - m.b); };
    g.y = yl;
    var step = niceStep(hi - lo), dec = step < 1 ? 1 : 0;
    for (var t = Math.ceil(lo / step - 1e-9) * step; t <= hi + 1e-9; t += step) {
      var ty = yl(t);
      out += '<line x1="' + m.l + '" x2="' + (w - m.r) + '" y1="' + ty + '" y2="' + ty +
             '" stroke="#3A3A3C" stroke-width="1"/>';
      out += '<text x="' + (w - m.r + 6) + '" y="' + (ty + 4) + '" fill="#98989F" font-size="11">' +
             fmtV(t, pn.unit, dec) + '</text>';
    }
    // Shaded periods (recessions) behind everything else
    if (pn.bands) {
      for (var bI = 0; bI < pn.bands.length; bI++) {
        var b0 = idx(pn.bands[bI].from), b1 = idx(pn.bands[bI].to);
        if (b1 < view.a || b0 > view.b) continue;
        var bx0 = cx(Math.max(b0, view.a)) - slot / 2, bx1 = cx(Math.min(b1, view.b)) + slot / 2;
        out += '<rect x="' + bx0.toFixed(1) + '" y="' + m.t + '" width="' + (bx1 - bx0).toFixed(1) + '" height="' +
               (h - m.t - m.b) + '" fill="#FFFFFF" fill-opacity="0.08"/>';
      }
    }
    // Shaded gap between the two series, for months where both have a number
    if (pn.shade && pn.list.length >= 2) {
      var A = pn.list[0].by, B = pn.list[1].by, run = [];
      var flushShade = function () {
        if (run.length > 1) {
          var d1 = "", d2 = "";
          for (var r = 0; r < run.length; r++) {
            d1 += (r ? "L" : "M") + cx(run[r]).toFixed(1) + " " + yl(A[run[r]]).toFixed(1) + " ";
          }
          for (var r2 = run.length - 1; r2 >= 0; r2--) {
            d2 += "L" + cx(run[r2]).toFixed(1) + " " + yl(B[run[r2]]).toFixed(1) + " ";
          }
          out += '<path d="' + d1 + d2 + 'Z" fill="' + pn.list[0].color + '" fill-opacity="0.16"/>';
        }
        run = [];
      };
      for (i = view.a; i <= view.b; i++) {
        if (A[i] !== undefined && B[i] !== undefined) run.push(i); else flushShade();
      }
      flushShade();
    }
    if (pn.ref) {
      var ry = yl(pn.ref.v);
      out += '<line x1="' + m.l + '" x2="' + (w - m.r) + '" y1="' + ry + '" y2="' + ry +
             '" stroke="#FFFFFF" stroke-opacity="0.5" stroke-width="1" stroke-dasharray="4 3"/>';
      out += '<text x="' + (m.l + 2) + '" y="' + (ry - 4) + '" fill="#FFFFFF" fill-opacity="0.7" font-size="10">' +
             pn.ref.label + '</text>';
    }
    // Each series: consecutive months joined; a missing month breaks the line
    for (var s2 = 0; s2 < pn.list.length; s2++) {
      var sr = pn.list[s2], seg = [];
      var flushLine = function () {
        if (seg.length === 1) {
          out += '<circle cx="' + cx(seg[0]).toFixed(1) + '" cy="' + yl(sr.by[seg[0]]).toFixed(1) +
                 '" r="2.5" fill="' + sr.color + '"/>';
        } else if (seg.length > 1) {
          var d = "";
          for (var z = 0; z < seg.length; z++) {
            d += (z ? "L" : "M") + cx(seg[z]).toFixed(1) + " " + yl(sr.by[seg[z]]).toFixed(1) + " ";
          }
          out += '<path d="' + d + '" fill="none" stroke="' + sr.color +
                 '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
        }
        seg = [];
      };
      for (i = view.a; i <= view.b; i++) {
        if (sr.by[i] !== undefined) seg.push(i); else flushLine();
      }
      flushLine();
      if (n <= 36) {
        for (i = view.a; i <= view.b; i++) {
          if (sr.by[i] !== undefined) {
            out += '<circle cx="' + cx(i).toFixed(1) + '" cy="' + yl(sr.by[i]).toFixed(1) + '" r="2" fill="' + sr.color + '"/>';
          }
        }
      }
    }
    // Michigan's newer release: a hollow dot, joined to the line by a dotted segment
    var MK = pn.marks || [], c0 = pn.list[0].color, prevI = null, prevV = null;
    for (var fi = I_MAX; fi >= view.a; fi--) if (pn.list[0].by[fi] !== undefined) { prevI = fi; prevV = pn.list[0].by[fi]; break; }
    MK.forEach(function (q, qn) {
      var qi = idx(q.m);
      if (qi < view.a || qi > view.b) return;
      if (prevI !== null && prevI >= view.a) {
        out += '<line x1="' + cx(prevI).toFixed(1) + '" y1="' + yl(prevV).toFixed(1) + '" x2="' + cx(qi).toFixed(1) + '" y2="' + yl(q.v).toFixed(1) +
               '" stroke="' + c0 + '" stroke-width="2" stroke-dasharray="2 3"/>';
      }
      out += '<circle cx="' + cx(qi).toFixed(1) + '" cy="' + yl(q.v).toFixed(1) + '" r="4.5" fill="#1C1C1E" stroke="' + c0 + '" stroke-width="2.2"/>';
      if (qn === MK.length - 1) {
        var firstI = idx(MK[0].m) >= view.a ? idx(MK[0].m) : qi;
        out += '<text x="' + (cx(firstI) - 9).toFixed(1) + '" y="' + (yl(q.v) + 4).toFixed(1) + '" fill="' + c0 + '" font-size="11" font-weight="700" text-anchor="end" stroke="#1C1C1E" stroke-width="3" paint-order="stroke">' + q.label + '</text>';
      }
      prevI = qi; prevV = q.v;
    });
  }

  // Month labels: first and last month in view
  out += '<text x="' + m.l + '" y="' + (h - 5) + '" fill="#98989F" font-size="11">' + fmtShort(view.a) + '</text>';
  out += '<text x="' + (w - m.r) + '" y="' + (h - 5) + '" fill="#98989F" font-size="11" text-anchor="end">' +
         fmtShort(view.b) + '</text>';

  // Scrub cursor, hidden until touched
  out += '<g id="cur' + k + '" visibility="hidden"><line id="curLine' + k + '" y1="' + m.t + '" y2="' + (h - m.b) +
         '" stroke="#FFFFFF" stroke-opacity="0.5" stroke-width="1"/>';
  for (var s3 = 0; s3 < pn.list.length; s3++) {
    out += '<circle id="curDot' + k + '_' + s3 + '" r="4.5" fill="' + (pn.list[s3].color || "#FFFFFF") +
           '" stroke="#1C1C1E" stroke-width="2"/>';
  }
  out += '</g>';
  svg.innerHTML = out;
}

// Values for one month (i) or, with null, the latest month in view that has
// data. A month with no number says so instead of borrowing a neighbor.
function show(i) {
  var focus = i;
  if (focus === null) {
    focus = view.b;
    for (var f = view.b; f >= view.a; f--) {
      if (P[LEAD].list[0].by[f] !== undefined) { focus = f; break; }
    }
  }
  el("month").textContent = fmtLong(focus);
  for (var k = 0; k < P.length; k++) {
    var pn = P[k], g = geo[k], cur = el("cur" + k);
    if (pn.kind === "seasonal") continue;
    if (pn.kind === "bars") {
      var v = pn.list[0].by[focus];
      if (v === undefined) {
        el("val" + k).textContent = "–";
        el("val" + k).style.color = GRAY;
        el("leg" + k).textContent = "No data this month";
      } else {
        el("val" + k).textContent = barFmt(v, pn) + (pn.unit === "pts" ? " pts" : "");
        el("val" + k).style.color = barColor(v, pn);
        el("leg" + k).textContent = "vs " + fmtShort(focus - (pn.vs === "mo" ? 1 : 12));
      }
    } else {
      var html = "", tot = 0, totOk = true;
      for (var s = 0; s < pn.list.length; s++) {
        var sv = pn.list[s].by[focus];
        if (sv === undefined) totOk = false; else tot += sv;
        html += '<span><i style="background:' + pn.list[s].color + '"></i>' + pn.list[s].label +
                '<span>' + (sv === undefined ? "n/a" : fmtV(sv, pn.unit, pn.dec)) + '</span></span>';
      }
      if (pn.kind === "stack") html += '<span>Total<span>' + (totOk ? fmtV(tot, pn.unit, pn.dec) : "n/a") + '</span></span>';
      el("leg" + k).innerHTML = html;
    }
    if (!cur || !g) continue;
    if (i === null) { cur.setAttribute("visibility", "hidden"); continue; }
    var x = g.cx(focus);
    cur.setAttribute("visibility", "visible");
    el("curLine" + k).setAttribute("x1", x);
    el("curLine" + k).setAttribute("x2", x);
    var cumD = 0;
    for (var s4 = 0; s4 < pn.list.length; s4++) {
      var dot = el("curDot" + k + "_" + s4), dv = pn.list[s4].by[focus];
      if (dv !== undefined) cumD += dv;
      if (!dot) continue;
      if (dv === undefined || pn.kind === "bars") { dot.setAttribute("visibility", "hidden"); continue; }
      dot.setAttribute("visibility", "visible");
      dot.setAttribute("cx", x);
      dot.setAttribute("cy", g.y(pn.kind === "stack" ? cumD : dv));
    }
  }
}

// ---- Touch handling ----
// One finger scrubs every panel. Two fingers pinch to zoom the months in view
// and drag to pan, on any panel, and all panels follow. Double-tap resets.
// A vertical swipe still scrolls the page.
var fingers = {}, pinch = null, pinchLock = false;
var rafId = 0, pendingView = null, lastTap = null, activeK = 0;

function fingerIds() { return Object.keys(fingers); }
function posAt(clientX) {
  var g = geo[activeK], r = el("svg" + activeK).getBoundingClientRect();
  var pw = g.w - g.m.l - g.m.r;
  var f = Math.max(0, Math.min(1, (clientX - r.left - g.m.l) / pw));
  return { f: f, pos: view.a - 0.5 + f * (view.b - view.a + 1) };
}
function monthAt(clientX) {
  return Math.max(view.a, Math.min(view.b, Math.floor(posAt(clientX).pos + 0.5)));
}
function pinchNow() {
  var ks = fingerIds(), p = fingers[ks[0]], q = fingers[ks[1]];
  var dx = p.x - q.x, dy = p.y - q.y;
  return { dist: Math.max(Math.sqrt(dx * dx + dy * dy), 10), mid: (p.x + q.x) / 2 };
}
function scheduleView(a, b) {
  pendingView = [a, b];
  if (rafId) return;
  rafId = requestAnimationFrame(function () {
    rafId = 0;
    var v = pendingView; pendingView = null;
    setView(v[0], v[1]);
  });
}
function onDown(k, e) {
  fingers[e.pointerId] = { x: e.clientX, y: e.clientY };
  var n = fingerIds().length;
  if (n === 1) activeK = k;
  if (n === 2) {
    var st = pinchNow();
    pinch = { dist: st.dist, n: view.b - view.a + 1, anchor: posAt(st.mid).pos };
    pinchLock = true;
    touched = true;
    show(null);
  } else if (n === 1 && !pinchLock) {
    var now = Date.now();
    if (lastTap && now - lastTap.t < 320 && Math.abs(e.clientX - lastTap.x) < 30) {
      lastTap = null;
      touched = false;
      resetView();
      return;
    }
    lastTap = { t: now, x: e.clientX };
    show(monthAt(e.clientX));
  }
}
function onMove(k, e) {
  if (!fingers[e.pointerId]) return;
  fingers[e.pointerId] = { x: e.clientX, y: e.clientY };
  if (pinch && fingerIds().length >= 2) {
    var st = pinchNow();
    var n = Math.max(MIN_SPAN + 1, Math.min(FULL + 1, pinch.n * pinch.dist / st.dist));
    var a = pinch.anchor - posAt(st.mid).f * n + 0.5;
    scheduleView(a, a + n - 1);
  } else if (!pinchLock) {
    show(monthAt(e.clientX));
  }
}
function onUp(k, e) {
  delete fingers[e.pointerId];
  var n = fingerIds().length;
  if (n < 2) pinch = null;
  if (n === 0) {
    if (!pinchLock) show(null);
    pinchLock = false;
    if (pendingData) {
      var pd = pendingData;
      pendingData = null;
      applyData(pd);
    }
  }
}
function attach(k) {
  var layer = el("touch" + k);
  if (!layer) return;
  layer.addEventListener("pointerdown", function (e) { onDown(k, e); });
  layer.addEventListener("pointermove", function (e) { onMove(k, e); });
  layer.addEventListener("pointerup", function (e) { onUp(k, e); });
  layer.addEventListener("pointercancel", function (e) { onUp(k, e); });
  layer.addEventListener("pointerleave", function (e) { onUp(k, e); });
}
for (var k3 = 0; k3 < P.length; k3++) attach(k3);
document.addEventListener("gesturestart", function (e) { e.preventDefault(); });
window.addEventListener("resize", function () { setView(view.a, view.b); });
// Redraw once the page knows its real width: some phones lay the page out
// after the first draw, which left charts cut off or squeezed.
function refit() {
  var first = el("svg0"), cw = first ? first.clientWidth : 0;
  if (cw && Math.abs(cw - LAST_W) > 1) setView(view.a, view.b);
}
[60, 250, 700, 1500].forEach(function (ms) { setTimeout(refit, ms); });
window.addEventListener("load", refit);
if (window.ResizeObserver && el("svg0")) new ResizeObserver(refit).observe(el("svg0"));

// Fresher data from the background. Applied once no finger is down. If you
// haven't pinched, the view follows the default; if you have, it stays put.
window.update = function (Dn) {
  if (fingerIds().length) { pendingData = Dn; return; }
  applyData(Dn);
};
function applyData(Dn) {
  var span = view.b - view.a, pinned = view.b === I_MAX;
  load(Dn);
  if (!touched) resetView();
  else if (pinned) setView(I_MAX - span, I_MAX);
  else setView(view.a, view.a + span);
}

el("ticker").textContent = D.ticker;
el("name").textContent = D.name;
resetView();
// For the Share button: what this view is and how current
// Share as PDF: 16:9 slides for the months on screen. 1) the widget's gauge
// beside sentiment's history (recessions shaded, long-run average dashed);
// 2) the change from a year earlier. Each has a headline that states the
// point, value labels at the ends, and a dark banner crediting the source.
window.printPdf = function (jsPDF, fonts) {
  var W = 792, H = 445.5;
  var doc = new jsPDF({ unit: "pt", format: [W, H], orientation: "landscape" });
  var FACE = "helvetica";
  if (fonts && fonts.regular && fonts.bold) {
    doc.addFileToVFS("Narrow-Regular.ttf", fonts.regular); doc.addFont("Narrow-Regular.ttf", "Narrow", "normal");
    doc.addFileToVFS("Narrow-Bold.ttf", fonts.bold); doc.addFont("Narrow-Bold.ttf", "Narrow", "bold");
    FACE = "Narrow";
  }
  var INK = [28, 28, 30], GRY = [110, 110, 115], RULE = [222, 222, 226], LINE = [59, 111, 216], RECC = [234, 234, 238];
  var REDC = [214, 48, 39], AMBC = [242, 154, 31], GRNC = [36, 150, 72];
  function font(bold, size, c) { doc.setFont(FACE, bold ? "bold" : "normal"); doc.setFontSize(size); doc.setTextColor(c[0], c[1], c[2]); }
  function mix(a, b, t) { return [0, 1, 2].map(function (i) { return Math.round(a[i] + (b[i] - a[i]) * t); }); }
  function nice(range, target) {
    var raw = range / (target || 5), p = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), f = raw / p;
    return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p;
  }
  function ms(i) { var m = mOf(i); return MONTHS[+m.slice(5, 7) - 1] + " " + m.slice(0, 4); }
  function sgn(v, dp) { var s = Math.abs(v).toFixed(dp); return (parseFloat(s) === 0 ? "" : v > 0 ? "+" : "-") + s; }
  var SP = P[0], BP = P[1], all = SP.series[0].pts, by = SP.series[0].by;
  var a = Math.max(view.a, I_MIN), b = Math.min(view.b, I_MAX);
  var lastI = b; while (lastI > a && by[lastI] == null) lastI--;
  // Michigan's own newer release (preliminary or final), when FRED doesn't have that month yet
  var marks = (SP.marks || []).filter(function (q) { var qi = idx(q.m); return qi > lastI && qi <= b; });
  var mark = marks.length ? marks[marks.length - 1] : null, mby = {};
  marks.forEach(function (q) { mby[idx(q.m)] = q.v; });
  var curI = mark ? idx(mark.m) : lastI, cur = mark ? mark.v : by[lastI];
  var prevV = by[curI - 1] != null ? by[curI - 1] : mby[curI - 1];
  var kindTag = mark ? (/final/i.test(mark.label) ? " final" : " prelim") : "";
  var vals = all.map(function (p) { return p.v; });
  var avgVals = vals.slice();
  marks.slice(0, -1).forEach(function (q) { vals.push(q.v); }); // Michigan's earlier release(s) count in the ranking
  var lo = Math.floor(Math.min(Math.min.apply(null, vals), cur)), hi = Math.ceil(Math.max(Math.max.apply(null, vals), cur));
  var avg = 0, since = all[0].m.slice(0, 4), below = 0, above = 0;
  var pages = BP ? 2 : 1;

  function headline(text) {
    var size = 21, lines;
    do { font(true, size, INK); lines = doc.splitTextToSize(text, W - 72); size -= 1; } while (lines.length > 1 && size > 15);
    doc.text(lines, 36, 42);
    return 42 + (lines.length - 1) * (size + 4);
  }
  function titles(top, title, sub, cx) {
    cx = cx || W / 2;
    font(true, 11.5, INK); doc.text(title, cx, top + 30, { align: "center" });
    font(false, 9.5, GRY); doc.text(sub, cx, top + 43, { align: "center" });
  }
  function xLabels(L, R, B, X) {
    var years = (b - a + 1) / 12, step = years <= 3 ? 0 : years <= 8 ? 1 : years <= 16 ? 2 : years <= 30 ? 5 : 10, lastX = -99;
    for (var i = a; i <= b; i++) {
      var m = mOf(i), mo = m.slice(5, 7), lab = null;
      if (step === 0) { if (mo === "01" || mo === "07") lab = mo === "01" ? m.slice(0, 4) : "Jul"; }
      else if (mo === "01" && (+m.slice(0, 4)) % step === 0) lab = m.slice(0, 4);
      if (lab && X(i) - lastX > 32) {
        doc.setDrawColor(150, 150, 155); doc.setLineWidth(0.5); doc.line(X(i), B, X(i), B + 3);
        font(false, 8.5, GRY); doc.text(lab, X(i), B + 13, { align: "center" }); lastX = X(i);
      }
    }
  }
  function banner(page) {
    var bh = 44, bY = H - bh;
    doc.setFillColor(28, 28, 30); doc.rect(0, bY, W, bh, "F");
    doc.setFillColor(201, 162, 39); doc.rect(W - 176, bY + 6, 2, bh - 12, "F");
    font(false, 7.2, [235, 235, 240]);
    var src = "Source: University of Michigan, Surveys of Consumers, Index of Consumer Sentiment (1966 Q1 = 100), via FRED (UMCSENT). " +
      "At Michigan's request FRED posts it one month late, so it trails the headline release. Recessions: NBER-dated U.S. recessions, via FRED (USREC).";
    doc.text(doc.splitTextToSize(src, W - 176 - 40 - 110), 28, bY + 15);
    font(false, 7.5, [200, 200, 205]);
    doc.text("Data through " + ms(I_MAX), W - 188, bY + 20, { align: "right" });
    doc.text(page + " of " + pages, W - 188, bY + 31, { align: "right" });
    font(true, 12.5, [255, 255, 255]);
    doc.text("Consumer", W - 162, bY + 20);
    doc.text("Sentiment", W - 162, bY + 34);
  }

  // ---- 1. Gauge and history ----
  avg = avgVals.reduce(function (s, v) { return s + v; }, 0) / avgVals.length;
  below = vals.filter(function (v) { return v > cur; }).length / vals.length; above = vals.filter(function (v) { return v < cur; }).length / vals.length;
  var dAvg = Math.round(cur - avg), vmin = Math.min.apply(null, vals), vmax = Math.max.apply(null, vals);
  var rank = cur <= vmin ? "the Lowest Reading Since " + since : cur >= vmax ? "the Highest Reading Since " + since
    : cur < avg ? "Lower Than " + Math.floor(below * 100) + "% of Readings Since " + since
    : "Higher Than " + Math.floor(above * 100) + "% of Readings Since " + since;
  var head = "Sentiment at " + cur.toFixed(1) + (mark ? (kindTag === " final" ? " (Final)" : " (Prelim)") : "") + ": " + rank + ", " + Math.abs(dAvg) + " Points " + (dAvg < 0 ? "Below" : "Above") + " Average";
  var top = headline(head);
  // left: the gauge
  var gcx = 150, gcy = top + 190, gr = 92;
  titles(top, "Where Sentiment Stands", "Its full range since " + since, gcx);
  var T = function (v) { return Math.max(0, Math.min(1, (v - lo) / (hi - lo))); };
  var at = function (t, rr) { var ang = Math.PI * (1 - t); return [gcx + rr * Math.cos(ang), gcy - rr * Math.sin(ang)]; };
  var N = 72;
  doc.setLineWidth(17);
  if (doc.setLineCap) doc.setLineCap("butt");
  for (var s = 0; s < N; s++) {
    var t0 = s / N, t1 = Math.min(1, (s + 1) / N + 0.004), tm = (s + 0.5) / N;
    var c = tm < 0.5 ? mix(REDC, AMBC, tm / 0.5) : mix(AMBC, GRNC, (tm - 0.5) / 0.5);
    var p0 = at(t0, gr), p1 = at(t1, gr);
    doc.setDrawColor(c[0], c[1], c[2]); doc.line(p0[0], p0[1], p1[0], p1[1]);
  }
  // long-run average: a dark tick outside the arc, labeled
  var q1 = at(T(avg), gr + 11), q2 = at(T(avg), gr + 20);
  doc.setDrawColor(INK[0], INK[1], INK[2]); doc.setLineWidth(2.2); doc.line(q1[0], q1[1], q2[0], q2[1]);
  var qa = at(T(avg), gr + 30);
  font(false, 8, GRY); doc.text("avg " + Math.round(avg), qa[0], qa[1] + 2, { align: "center" });
  // needle and hub
  var tip = at(T(cur), gr - 20);
  doc.setLineWidth(3.5); if (doc.setLineCap) doc.setLineCap("round");
  doc.line(gcx, gcy, tip[0], tip[1]);
  doc.setFillColor(INK[0], INK[1], INK[2]); doc.circle(gcx, gcy, 7, "F");
  doc.setFillColor(255, 255, 255); doc.circle(gcx, gcy, 3, "F");
  if (doc.setLineCap) doc.setLineCap("butt");
  font(false, 9, GRY);
  doc.text(String(lo), gcx - gr, gcy + 16, { align: "center" });
  doc.text(String(hi), gcx + gr, gcy + 16, { align: "center" });
  font(true, 30, INK); doc.text(cur.toFixed(1), gcx, gcy + 46, { align: "center" });
  var sub = ms(curI) + kindTag;
  if (prevV != null) sub += " · " + sgn(cur - prevV, 1) + " vs " + MONTHS[+mOf(curI - 1).slice(5, 7) - 1];
  font(false, 10, GRY); doc.text(sub, gcx, gcy + 62, { align: "center" });

  // right: the history
  var L = 330, R = W - 70, Tt = top + 58, B = H - 92;
  titles(top, "University of Michigan Consumer Sentiment", "Monthly, 1966 = 100 · recessions shaded · " + ms(a) + " to " + ms(curI) + kindTag, (L + R) / 2);
  var vlo = Infinity, vhi = -Infinity;
  for (var i = a; i <= b; i++) if (by[i] != null) { vlo = Math.min(vlo, by[i]); vhi = Math.max(vhi, by[i]); }
  vlo = Math.min(vlo, avg, cur); vhi = Math.max(vhi, avg, cur);
  marks.forEach(function (m2) { vlo = Math.min(vlo, m2.v); vhi = Math.max(vhi, m2.v); });
  var st = nice(vhi - vlo || 10, 5); vlo = Math.floor(vlo / st) * st; vhi = Math.ceil(vhi / st) * st;
  var X = function (k) { return L + (b === a ? 0 : (k - a) / (b - a) * (R - L)); };
  var Y = function (v) { return B - (v - vlo) / (vhi - vlo) * (B - Tt); };
  (SP.bands || []).forEach(function (band) {
    var f = Math.max(a, idx(band.from)), t = Math.min(b, idx(band.to));
    if (t < f) return;
    doc.setFillColor(RECC[0], RECC[1], RECC[2]); doc.rect(X(f), Tt, Math.max(1.5, X(t) - X(f)), B - Tt, "F");
  });
  doc.setLineWidth(0.5);
  for (var v = vlo; v <= vhi + st / 2; v += st) {
    doc.setDrawColor(RULE[0], RULE[1], RULE[2]); doc.line(L, Y(v), R, Y(v));
    font(false, 8.5, GRY); doc.text(String(Math.round(v)), L - 6, Y(v) + 3, { align: "right" });
  }
  doc.setDrawColor(150, 150, 155); doc.line(L, B, R, B);
  xLabels(L, R, B, X);
  doc.setDrawColor(90, 90, 96); doc.setLineWidth(0.9); doc.setLineDashPattern([4, 3], 0);
  doc.line(L, Y(avg), R, Y(avg)); doc.setLineDashPattern([], 0);
  font(false, 8, GRY); doc.text("avg since " + since + " (" + avg.toFixed(1) + ")", L + 4, Y(avg) - 4);
  doc.setDrawColor(LINE[0], LINE[1], LINE[2]); doc.setLineWidth(2.2); if (doc.setLineJoin) doc.setLineJoin("round");
  var px = null, py = null;
  for (i = a; i <= b; i++) {
    if (by[i] == null) continue;
    if (px !== null) doc.line(px, py, X(i), Y(by[i]));
    px = X(i); py = Y(by[i]);
  }
  if (mark) {
    doc.setDrawColor(LINE[0], LINE[1], LINE[2]); doc.setLineWidth(1.6); doc.setLineDashPattern([2, 3], 0);
    var fx = X(lastI), fy = Y(by[lastI]);
    marks.forEach(function (q) {
      var qi = idx(q.m);
      doc.setLineDashPattern([2, 3], 0); doc.setLineWidth(1.6); doc.line(fx, fy, X(qi), Y(q.v)); doc.setLineDashPattern([], 0);
      fx = X(qi); fy = Y(q.v);
    });
    marks.forEach(function (q) { doc.setFillColor(255, 255, 255); doc.setLineWidth(1.8); doc.circle(X(idx(q.m)), Y(q.v), 4, "FD"); });
  }
  font(true, 10, LINE); doc.text(cur.toFixed(1) + kindTag, X(curI) + 7, Y(cur) + 3.5);
  // legend
  var ly = B + 30; font(false, 9, INK);
  doc.setDrawColor(LINE[0], LINE[1], LINE[2]); doc.setLineWidth(2.2); doc.line((L + R) / 2 - 150, ly - 3, (L + R) / 2 - 134, ly - 3);
  doc.text("Consumer sentiment", (L + R) / 2 - 128, ly);
  doc.setFillColor(RECC[0] - 20, RECC[1] - 20, RECC[2] - 20); doc.rect((L + R) / 2 + 10, ly - 8, 14, 9, "F");
  doc.text("Recession", (L + R) / 2 + 30, ly);
  banner(1);

  // ---- 2. Change from a year earlier ----
  if (pages === 2) {
    doc.addPage([W, H], "landscape");
    var yb = BP.list[0].by, yl = b; while (yl > a && yb[yl] == null) yl--;
    var yv = yb[yl], streak = 0;
    for (var k2 = yl; k2 >= I_MIN && yb[k2] != null && (yb[k2] > 0) === (yv > 0) && Math.abs(yb[k2]) >= 0.05; k2--) streak++;
    var ord = function (n) { var t = n % 100; if (t >= 11 && t <= 13) return n + "th"; return n + (["th", "st", "nd", "rd"][n % 10] || "th"); };
    var head2 = Math.abs(yv) < 0.05 ? "Sentiment Is Unchanged From a Year Ago"
      : "Sentiment Is " + (yv > 0 ? "Up " : "Down ") + Math.abs(yv).toFixed(1) + " Points From a Year Ago" +
        (streak >= 2 ? ", the " + ord(streak) + " Straight Monthly " + (yv > 0 ? "Gain" : "Decline") : "");
    top = headline(head2);
    titles(top, "Consumer Sentiment: Change vs a Year Earlier", "Index points vs the same month a year before · " + ms(a) + " to " + ms(yl));
    var L2 = 78, R2 = W - 96, T2 = top + 58, B2 = H - 92, blo = 0, bhi = 0;
    for (i = a; i <= b; i++) if (yb[i] != null) { blo = Math.min(blo, yb[i]); bhi = Math.max(bhi, yb[i]); }
    var st2 = nice(bhi - blo || 10, 5); blo = Math.floor(blo / st2) * st2; bhi = Math.ceil(bhi / st2) * st2;
    var X2 = function (k) { return L2 + (k - a) / (b - a + 1) * (R2 - L2); }, bw = (R2 - L2) / (b - a + 1);
    var Y2 = function (v) { return B2 - (v - blo) / (bhi - blo) * (B2 - T2); };
    doc.setLineWidth(0.5);
    for (v = blo; v <= bhi + st2 / 2; v += st2) {
      var zero = Math.abs(v) < st2 / 1000;
      doc.setDrawColor(zero ? 140 : RULE[0], zero ? 140 : RULE[1], zero ? 145 : RULE[2]); doc.setLineWidth(zero ? 0.9 : 0.5);
      doc.line(L2, Y2(v), R2, Y2(v));
      font(false, 8.5, GRY); doc.text(sgn(v, 0) || "0", L2 - 6, Y2(v) + 3, { align: "right" });
    }
    for (i = a; i <= b; i++) {
      var bv = yb[i];
      if (bv == null) continue;
      var col = bv >= 0 ? GRNC : REDC, y0 = Y2(0), y1 = Y2(bv);
      doc.setFillColor(col[0], col[1], col[2]);
      doc.rect(X2(i), Math.min(y0, y1), bw < 4 ? bw + 0.25 : bw * 0.85, Math.max(0.3, Math.abs(y0 - y1)), "F");
    }
    xLabels(L2, R2, B2, function (k) { return X2(k) + bw / 2; });
    font(true, 10, yv >= 0 ? GRNC : REDC); doc.text(sgn(yv, 1) + " pts", R2 + 6, Y2(yv) + 3.5);
    var ly2 = B2 + 30; font(false, 9, INK);
    doc.setFillColor(GRNC[0], GRNC[1], GRNC[2]); doc.rect(W / 2 - 110, ly2 - 8, 6, 9, "F");
    doc.setFillColor(REDC[0], REDC[1], REDC[2]); doc.rect(W / 2 - 103, ly2 - 8, 6, 9, "F");
    doc.text("Change in index points (green = higher than a year earlier, red = lower)", W / 2 - 91, ly2);
    banner(2);
  }
  return doc;
};
window.shareInfo = function () {
  return { title: D.ticker, name: D.name, asOf: fmtLong(I_MAX) };
};
</script>
<script>__SHARE__</script>
</body>
</html>`;

// Opens straight away with whatever is stored, then runs `background`, which
// can call push(payload) any number of times to update the open view.
async function openMonthly(payload, background) {
  const wv = new WebView();
  await wv.loadHTML(
    MONTHLY_HTML.replace("__DATA__", () => JSON.stringify(payload)).replace("__SHARE__", () => SHARE_PAGE_JS)
  );
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
      await openMonthly(payloadFor(first, !!cached), async (push) => {
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
async function fetchSentiment() {
  const [s, rec, release] = await Promise.all([
    fred("UMCSENT", "1978-01-01"),
    fred("USREC", "1978-01-01").catch(() => []),
    fredReleaseDates("UMCSENT").catch(() => []),
  ]);
  if (!s.length) throw new Error("No consumer sentiment data from FRED");
  return {
    pts: s.map((o) => ({ m: o.date.slice(0, 7), v: o.value })),
    rec: rec.map((o) => ({ m: o.date.slice(0, 7), v: o.value })),
    release,
  };
}
function sentimentStats(pts) {
  const vals = pts.map((p) => p.v);
  return {
    lo: Math.floor(Math.min(...vals)),
    hi: Math.ceil(Math.max(...vals)),
    avg: vals.reduce((a, b) => a + b, 0) / vals.length,
  };
}


// ---------- Michigan's own release: preliminary or final, plus report links ----------
// FRED carries only the final number, a month late. Michigan's Surveys of
// Consumers homepage posts each release (preliminary mid-month, final at month
// end, 10:00 am New York time) with the director's commentary, free to read.
// The page is read for its "Preliminary/Final Results for <Month> <Year>"
// heading, the Index of Consumer Sentiment value, the release date and the
// "special reports" list (date, title, link). The full screen links to the
// release and to each report rather than quoting them. If any of that isn't
// found, it says so and the rest carries on.
// Credit: Surveys of Consumers, University of Michigan (internal,
// non-commercial use per Michigan's terms).
const UMICH_URL = "https://www.sca.isr.umich.edu/";
const UMICH_FILE = "umich-release-v2.json";
const UMICH_CHECK_HOURS = 6;
const UMICH_MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

function htmlToText(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<(br|\/p|\/div|\/tr|\/h\d|\/li)[^>]*>/gi, "\n").replace(/<\/t[dh]>/gi, " \t ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#8217;|&rsquo;/g, "’").replace(/&#8216;|&lsquo;/g, "‘")
    .replace(/&#8220;|&ldquo;/g, "“").replace(/&#8221;|&rdquo;/g, "”").replace(/&#8212;|&mdash;/g, "—")
    .replace(/&#8211;|&ndash;/g, "–").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n");
}
function parseUmich(html) {
  const text = htmlToText(html);
  const head = text.match(/\b(Preliminary|Final)\s+Results\s+for\s+([A-Za-z]+)\s+(\d{4})/i);
  if (!head) throw new Error("no 'Preliminary/Final Results for' heading on Michigan's page");
  const mi = UMICH_MONTHS.indexOf(head[2].toLowerCase());
  if (mi < 0) throw new Error(`unreadable release month '${head[2]}'`);
  const m = `${head[3]}-${String(mi + 1).padStart(2, "0")}`;
  const after = text.slice(head.index);
  const sv = after.match(/Index of Consumer Sentiment[^0-9]{0,80}?(\d{2,3}\.\d)(?:[^0-9]{1,40}?(\d{2,3}\.\d))?/i);
  if (!sv) throw new Error("no Index of Consumer Sentiment value on Michigan's page");
  const v = parseFloat(sv[1]);
  // the table's next column is last month's final
  const pv = sv[2] ? parseFloat(sv[2]) : null;
  const pm = (() => { const y = +head[3], mo = mi === 0 ? 12 : mi; return `${mi === 0 ? y - 1 : y}-${String(mo).padStart(2, "0")}`; })();
  if (!(v > 20 && v < 150)) throw new Error(`implausible sentiment value ${v}`);
  // Release date: the first date near the heading that isn't in the future
  // (the page also names the coming final release's date)
  const soon = Date.now() + 36 * 3600 * 1000;
  const dates = after.slice(0, 2000).match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}/g) || [];
  const date = dates.find((x) => { const t = Date.parse(x); return t > 0 && t <= soon; }) || null;
  const rep = parseReports(html);
  return {
    kind: head[1].toLowerCase() === "final" ? "final" : "prelim",
    m, v,
    prev: pv > 20 && pv < 150 ? { m: pm, v: pv } : null,
    date,
    reports: rep.list,
    moreReports: rep.more,
  };
}
// A link on Michigan's page, made absolute; null for anchors that go nowhere
function umichHref(h) {
  h = String(h || "").replace(/&amp;/g, "&").trim();
  if (!h || /^(#|mailto:|javascript:|tel:)/i.test(h)) return null;
  if (/^https?:\/\//i.test(h)) return h.replace(/^http:/i, "https:");
  if (/^\/\//.test(h)) return "https:" + h;
  if (h[0] === "/") return UMICH_URL.replace(/\/$/, "") + h;
  return UMICH_URL + h.replace(/^\.\//, "");
}
// "10/30/26" -> "2026-10-30"
function umichSlashDate(x) {
  const q = String(x).match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!q) return null;
  const y = +q[3] < 100 ? 2000 + +q[3] : +q[3], mo = +q[1], dd = +q[2];
  if (mo < 1 || mo > 12 || dd < 1 || dd > 31) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}
// The "Read our special reports" list: each a date, a title and its link.
// Uses the mention of special reports that's followed by dates (a menu item
// named "Special Reports" isn't). Without links, the titles still come back.
function parseReports(html) {
  const SLASH = /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/;
  const hits = [...String(html).matchAll(/special\s+reports?/gi)];
  const hit = hits.find((h) => SLASH.test(htmlToText(html.slice(h.index, h.index + 2500))));
  if (!hit) return { list: [], more: null };
  const block = html.slice(hit.index, hit.index + 15000);
  const list = [];
  let more = null, prevEnd = 0, misses = 0;
  const aRe = /<a\b[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let a;
  while ((a = aRe.exec(block))) {
    const before = htmlToText(block.slice(prevEnd, a.index));
    prevEnd = aRe.lastIndex;
    const url = umichHref(a[1]);
    let title = htmlToText(a[2]).replace(/\s+/g, " ").trim();
    let date = null;
    const own = title.match(/^(\d{1,2}\/\d{1,2}\/\d{2,4})\s*[-–:·|]?\s*/);
    if (own) { date = umichSlashDate(own[1]); title = title.slice(own[0].length).trim(); }
    else { const all = before.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/g); if (all) date = umichSlashDate(all[all.length - 1]); }
    if (!date || title.length < 6 || !url) {
      if (url && list.length && /(more|all|previous|past|archive).{0,20}reports?|reports?\s+archive/i.test(title)) more = url;
      if (list.length && ++misses >= 3) break;
      continue;
    }
    misses = 0;
    if (!list.some((r) => r.url === url)) list.push({ date, title: title.slice(0, 180), url });
  }
  if (!list.length) {
    // No links: date + title pairs from the text
    const text = htmlToText(block).replace(/\s+/g, " ");
    const re = /(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(.+?)(?=\s+\d{1,2}\/\d{1,2}\/\d{2,4}\s|$)/g;
    let q;
    while ((q = re.exec(text)) && list.length < 8) {
      const date = umichSlashDate(q[1]);
      const title = q[2].trim().slice(0, 180);
      if (date && title.length >= 6) list.push({ date, title, url: null });
    }
  }
  list.sort((x, y) => (x.date < y.date ? 1 : x.date > y.date ? -1 : 0));
  return { list: list.slice(0, 8), more };
}
// Never throws: the saved copy (with .error) when the page can't be read
async function getUmich() {
  const saved = readSaved(UMICH_FILE);
  const now = Date.now();
  if (saved && saved.m && saved.checkedAt && now - saved.checkedAt < UMICH_CHECK_HOURS * 3600 * 1000) return saved;
  const rank = (x) => (x && x.m ? x.m + (x.kind === "final" ? "b" : "a") : "");
  try {
    const req = new Request(UMICH_URL);
    req.timeoutInterval = 15;
    req.headers = { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" };
    const html = await req.loadString();
    const status = req.response ? req.response.statusCode : 0;
    if (status && status !== 200) throw new Error(`Michigan's page answered ${status}`);
    const r = parseUmich(html);
    const keep = rank(saved) > rank(r) ? saved : r; // older never replaces newer
    const out = { ...keep, checkedAt: now, error: null };
    writeSaved(UMICH_FILE, out);
    return out;
  } catch (e) {
    const msg = String((e && e.message) || e);
    if (saved && saved.m) {
      const out = { ...saved, checkedAt: now - (UMICH_CHECK_HOURS - 1) * 3600 * 1000, error: msg };
      writeSaved(UMICH_FILE, out);
      return out;
    }
    return { error: msg };
  }
}
// The newest reading: Michigan's release when it's past FRED's last month
function newestReading(d) {
  const last = d.pts[d.pts.length - 1];
  const u = d.umich;
  if (u && u.m && u.v > 0 && u.m > last.m) return { m: u.m, v: u.v, kind: u.kind };
  return { m: last.m, v: last.v, kind: null };
}
function valueFor(d, m) {
  const p = d.pts.find((q) => q.m === m);
  if (p) return p;
  const u = d.umich;
  return u && u.prev && u.prev.m === m ? u.prev : null;
}
async function fetchSentimentAll() {
  const [d, umich] = await Promise.all([fetchSentiment(), getUmich()]);
  return { ...d, umich };
}

// ---------- Widget: a gauge on the historical range ----------
function sentimentImage(d, next) {
  const ctx = newCanvas(170, 170);
  const last = newestReading(d); // Michigan's preliminary/final when it's newer than FRED's
  const prev = valueFor(d, monthAdd(last.m, -1));
  const extra = [{ m: last.m, v: last.v }];
  if (prev && !d.pts.some((p) => p.m === prev.m)) extra.push(prev); // Michigan's last-month final, not on FRED yet
  const st = sentimentStats(d.pts.concat(extra));
  drawText(ctx, "Sentiment", new Rect(14, 11, 90, 18), Font.semiboldSystemFont(13), "#FFFFFF", "left");
  headerClock(ctx, d.stale, next);

  const cx = 85;
  const cy = 100;
  const r = 54;
  const T = (v) => Math.max(0, Math.min(1, (v - st.lo) / (st.hi - st.lo)));
  const at = (t, rr) => {
    const a = Math.PI * (1 - t);
    return new Point(cx + rr * Math.cos(a), cy - rr * Math.sin(a));
  };
  // The arc, red through amber to green, drawn as short colored pieces
  const N = 36;
  ctx.setLineWidth(11);
  for (let i = 0; i < N; i++) {
    const t0 = i / N;
    const t1 = Math.min(1, (i + 1) / N + 0.006);
    const t = (i + 0.5) / N;
    ctx.setStrokeColor(new Color(t < 0.5 ? mixHex(RED, AMBER, t / 0.5) : mixHex(AMBER, GREEN, (t - 0.5) / 0.5), 0.9));
    const p = new Path();
    p.move(at(t0, r));
    for (let k = 1; k <= 3; k++) p.addLine(at(t0 + ((t1 - t0) * k) / 3, r));
    ctx.addPath(p);
    ctx.strokePath();
  }
  // Long-run average: a white tick just outside the arc
  ctx.setStrokeColor(new Color("#FFFFFF"));
  ctx.setLineWidth(2);
  const a1 = at(T(st.avg), r + 8);
  const a2 = at(T(st.avg), r + 14);
  strokeSeg(ctx, a1.x, a1.y, a2.x, a2.y);
  // Needle and hub
  ctx.setLineWidth(3);
  const tip = at(T(last.v), r - 13);
  strokeSeg(ctx, cx, cy, tip.x, tip.y);
  ctx.setFillColor(new Color("#232325"));
  ctx.fillEllipse(new Rect(cx - 7, cy - 7, 14, 14));
  ctx.setFillColor(new Color("#FFFFFF"));
  ctx.fillEllipse(new Rect(cx - 5, cy - 5, 10, 10));
  // Range ends
  drawText(ctx, String(st.lo), new Rect(cx - r - 16, cy + 5, 32, 14), Font.systemFont(11), GRAY, "center");
  drawText(ctx, String(st.hi), new Rect(cx + r - 16, cy + 5, 32, 14), Font.systemFont(11), GRAY, "center");
  // Reading, change from the prior month, long-run average
  drawText(ctx, last.v.toFixed(1), new Rect(35, 111, 100, 30), Font.semiboldSystemFont(24), "#FFFFFF", "center");
  // The data month lives here; the white tick already marks the average
  let sub = fmtMonth(last.m) + (last.kind ? ` ${last.kind}` : "");
  if (prev) {
    const ch = last.v - prev.v;
    const s = Math.abs(ch).toFixed(1);
    sub += ` \u00B7 ${parseFloat(s) === 0 ? "" : ch > 0 ? "+" : "-"}${s} vs ${MON[+prev.m.slice(5) - 1]}`;
  }
  drawText(ctx, sub, new Rect(8, 143, 154, 14), Font.systemFont(11), GRAY, "center");
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
function sentimentPayload(d, loading) {
  const st = sentimentStats(d.pts);
  const by = new Map(d.pts.map((p) => [p.m, p.v]));
  const yoy = d.pts
    .filter((p) => by.has(monthAdd(p.m, -12)))
    .map((p) => ({ m: p.m, v: p.v - by.get(monthAdd(p.m, -12)) }));
  return {
    ticker: TICKER,
    name: NAME,
    green: GREEN,
    red: RED,
    defaultMonths: DEFAULT_MONTHS,
    minMonths: MIN_MONTHS,
    progress: progressFor(d, loading),
    panels: [
      {
        kind: "lines", title: "Consumer sentiment", unit: "", dec: 1, minSpan: 10,
        series: [{ label: "Index", color: BLUE, pts: d.pts }],
        ref: { v: st.avg, label: `avg since ${d.pts[0].m.slice(0, 4)}` },
        bands: recessionBands(d.rec || []),
        marks: (() => {
          const nr = newestReading(d);
          if (!nr.kind) return [];
          const out = [];
          const pr = d.umich.prev;
          const lastFred = d.pts[d.pts.length - 1].m;
          if (pr && pr.m > lastFred && pr.m < nr.m) out.push({ m: pr.m, v: pr.v, label: `${MON[+pr.m.slice(5) - 1]} final ${pr.v.toFixed(1)}` });
          out.push({ m: nr.m, v: nr.v, label: `${MON[+nr.m.slice(5) - 1]} ${nr.kind} ${nr.v.toFixed(1)}` });
          return out;
        })(),
      },
      { kind: "bars", title: "Change vs yr ago", unit: "pts", goodUp: true, pts: yoy },
    ],
    note:
      "University of Michigan consumer sentiment (1966 = 100), via FRED. At Michigan's request, " +
      "FRED posts it a month late, so it trails the headline number. Shaded bands are NBER " +
      "recessions. The dashed line is the average since 1978. Bars show the change in index " +
      "points from the same month a year earlier. The hollow dot past the line is Michigan's own newest release (preliminary or final) when FRED doesn't have that month yet. " +
      "Sources: FRED; Surveys of Consumers, University of Michigan.",
    links: d.umich && d.umich.m ? umichLinks(d.umich) : null,
    umichNote: !d.umich ? "" : !d.umich.m ? "Michigan release n/a (" + (d.umich.error || "not read yet") + ")"
      : d.umich.error ? "Michigan's page unreachable \u00b7 showing its " + (d.umich.kind === "final" ? "final" : "preliminary") + " release for " + fmtMonth(d.umich.m) : "",
  };
}

// The link list under the charts: this month's release (where the director's
// commentary is), then the special reports, newest first
function umichLinks(u) {
  const MS = (iso) => {
    const [y, mo, dd] = iso.split("-");
    const thisYear = String(new Date().getFullYear());
    return `${MON[+mo - 1]} ${+dd}` + (y === thisYear ? "" : ` \u2019${y.slice(2)}`);
  };
  const t = Date.parse(u.date || "");
  const rel = t > 0 ? `released ${MON[new Date(t).getMonth()]} ${new Date(t).getDate()}` : "";
  return {
    release: {
      date: MON[+u.m.slice(5) - 1],
      title: `${u.kind === "final" ? "Final" : "Preliminary"} results for ${UMICH_MONTHS[+u.m.slice(5) - 1].replace(/^./, (c) => c.toUpperCase())} ${u.m.slice(0, 4)}`,
      sub: ["Director's commentary and tables", rel].filter(Boolean).join(" \u00b7 "),
      url: UMICH_URL,
    },
    reports: (u.reports || []).map((r) => ({ date: MS(r.date), title: r.title, url: r.url })),
    more: u.moreReports || null,
  };
}

// University of Michigan releases at 10:00 am New York time
await runWidget(CACHE_FILE, fetchSentimentAll, sentimentImage, sentimentPayload, { hh: 10, mm: 0 });
