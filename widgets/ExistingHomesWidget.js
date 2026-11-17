// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: purple; icon-glyph: home;

// ---- Shared settings (saved on this phone by the Setup script) ----
// Keys and personal settings live in the phone's keychain, not in this file,
// so the file can be shared as is.
function setting(key, fallback) {
  try { if (Keychain.contains(key)) { const v = Keychain.get(key); if (v) return v; } } catch (e) {}
  return fallback;
}


// Existing Homes for Scriptable
// Existing homes only (no new construction), from the National Association of
// Realtors via FRED:
// - Existing-home sales, seasonally adjusted annual rate (EXHOSLUSM495S), the
//   headline number: shown per month (÷ 12) in the top chart, as the annual
//   rate in its history chart
// - Homes for sale, existing-home inventory at month end (HOSINVUSM495N)
// NAR releases around the third week of the next month. FRED serves only
// NAR's latest 13 months, so the widget keeps every month it sees and the
// history grows; history is built in (adjusted sales from 1999, raw sales from
// Dec 2023, inventory from 2019).
// Small widget: the trailing-12-month chart of sales and homes for sale.
// Tap for the full screen: one chart of the last 12 months, solid, with the
// same months a year earlier dotted in the same color (tap a chip to hide a
// line), then each line's history, pinch to zoom. Share as PDF: the
// year-over-year chart alone, then the history charts.
// Checks for new numbers every 12 hours and keeps the last good copy.

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

const PREVIEW_WIDGET_IN_APP = false;
const CFG = {
  title: "Existing Homes",
  sub: "Existing-home sales and homes for sale (NAR) · trailing 12 months",
  file: "existing-homes-nar-v2.json",
  lead: "sales",
  banner: ["Existing", "Homes"],
  sources: "Source: National Association of Realtors via FRED: existing-home sales (seasonally adjusted annual rate, EXHOSLUSM495S; shown per month in the top chart) and existing-home inventory (homes for sale at month end, HOSINVUSM495N). Existing homes only: single-family, condos and co-ops previously owned; new construction is left out.",
  note: "Existing homes only, from the National Association of Realtors (single-family homes, condos and co-ops previously owned; new construction is left out). NAR estimates sales at closing from a sample of Realtor boards and MLSs and releases around the third week of the next month. Sales: the seasonally adjusted annual rate, the number in the headlines, shown per month (divided by 12), plus NAR's raw monthly count (EXHOSLUSM495N) in the history chart. Homes for sale: existing-home inventory at the end of the month (not seasonally adjusted), compared on its 12-month average. History charts show the raw count (thin) and a seasonally adjusted line (bold): NAR's own for sales; for inventory, which NAR doesn't adjust, the widget works out seasonal factors from each month against its centered 12-month average (marked *). FRED serves only NAR's latest 13 months, so the widget keeps every month it sees; Built-in history: adjusted sales back to 1999 (before 2024 as NAR published them at the time, rebuilt by thetrading.tools from archived releases; 2024 read off the WSJ's NAR chart, about ±0.01M), raw sales from Dec 2023 and inventory from 2019 (NAR's release tables and releases). In the top chart sales use the right-hand axis and both axes are fitted to their data (not from zero).",
  lines: [
    { k: "nar", label: "Existing-home sales", short: "Sales", head: "Existing Sales", color: "#30D158", print: "#1E9E45", upGood: true, source: "fred", fred: "EXHOSLUSM495S", scale: 1 / 12, accumulate: true,
      histZoom: true, ownSpan: true, histMode: "rawAdj", right: true, refLines: true, headScale: 12, headUnit: "annual rate",
      // the raw (not seasonally adjusted) monthly count, drawn thin in the history
      // chart; Dec 2023-Sep 2025 from NAR's release tables (Dec 2024 and Sep 2025)
      raw: { fred: "EXHOSLUSM495N", seed: [["2023-12", 297000], ["2024-01", 234000], ["2024-02", 271000], ["2024-03", 325000], ["2024-04", 360000], ["2024-05", 405000], ["2024-06", 376000], ["2024-07", 390000], ["2024-08", 379000], ["2024-09", 330000], ["2024-10", 348000], ["2024-11", 315000], ["2024-12", 329000], ["2025-01", 240000], ["2025-02", 257000], ["2025-03", 315000], ["2025-04", 349000], ["2025-05", 390000], ["2025-06", 391000], ["2025-07", 389000], ["2025-08", 376000], ["2025-09", 357000]] },
      // Starting history before FRED's 13 months, in annual-rate units:
      // 1999-2023 from thetrading.tools' NAR series (rebuilt from archived NAR
      // releases and FRED vintages, so older seasonal factors; matches YCharts for
      // 2022-23), 2024 read off the WSJ's chart of NAR data (to about ±0.01M),
      // Jan-Sep 2025 from YCharts (matches the WSJ chart). FRED's numbers replace
      // these wherever they overlap.
      seed: [["1999-01", 5230000], ["1999-02", 5100000], ["1999-03", 5150000], ["1999-04", 5080000], ["1999-05", 5190000], ["1999-06", 5430000], ["1999-07", 5250000], ["1999-08", 5230000], ["1999-09", 5120000], ["1999-10", 5110000], ["1999-11", 5090000], ["1999-12", 5080000], ["2000-01", 5230000], ["2000-02", 5120000], ["2000-03", 5190000], ["2000-04", 5200000], ["2000-05", 5110000], ["2000-06", 5130000], ["2000-07", 5110000], ["2000-08", 5170000], ["2000-09", 5290000], ["2000-10", 5250000], ["2000-11", 5350000], ["2000-12", 5100000], ["2001-01", 5100000], ["2001-02", 5230000], ["2001-03", 5450000], ["2001-04", 5320000], ["2001-05", 5270000], ["2001-06", 5430000], ["2001-07", 5430000], ["2001-08", 5480000], ["2001-09", 5230000], ["2001-10", 5250000], ["2001-11", 5240000], ["2001-12", 5490000], ["2002-01", 5860000], ["2002-02", 5900000], ["2002-03", 5630000], ["2002-04", 5670000], ["2002-05", 5640000], ["2002-06", 5510000], ["2002-07", 5410000], ["2002-08", 5360000], ["2002-09", 5520000], ["2002-10", 5680000], ["2002-11", 5730000], ["2002-12", 5970000], ["2003-01", 6030000], ["2003-02", 6020000], ["2003-03", 5860000], ["2003-04", 5840000], ["2003-05", 5940000], ["2003-06", 5940000], ["2003-07", 6270000], ["2003-08", 6520000], ["2003-09", 6580000], ["2003-10", 6390000], ["2003-11", 6230000], ["2003-12", 6490000], ["2004-01", 6230000], ["2004-02", 6410000], ["2004-03", 6660000], ["2004-04", 6730000], ["2004-05", 6850000], ["2004-06", 6920000], ["2004-07", 6840000], ["2004-08", 6700000], ["2004-09", 6680000], ["2004-10", 6850000], ["2004-11", 6960000], ["2004-12", 6890000], ["2005-01", 7100000], ["2005-02", 6890000], ["2005-03", 6960000], ["2005-04", 7120000], ["2005-05", 7080000], ["2005-06", 7180000], ["2005-07", 7140000], ["2005-08", 7230000], ["2005-09", 7260000], ["2005-10", 7110000], ["2005-11", 7020000], ["2005-12", 6850000], ["2006-01", 6700000], ["2006-02", 6850000], ["2006-03", 6840000], ["2006-04", 6700000], ["2006-05", 6580000], ["2006-06", 6480000], ["2006-07", 6310000], ["2006-08", 6340000], ["2006-09", 6290000], ["2006-10", 6350000], ["2006-11", 6340000], ["2006-12", 6420000], ["2007-01", 5740000], ["2007-02", 5790000], ["2007-03", 5460000], ["2007-04", 5290000], ["2007-05", 5270000], ["2007-06", 5120000], ["2007-07", 5070000], ["2007-08", 4870000], ["2007-09", 4580000], ["2007-10", 4430000], ["2007-11", 4460000], ["2007-12", 4410000], ["2008-01", 4170000], ["2008-02", 4120000], ["2008-03", 4160000], ["2008-04", 4110000], ["2008-05", 4140000], ["2008-06", 4090000], ["2008-07", 4150000], ["2008-08", 4190000], ["2008-09", 4270000], ["2008-10", 4090000], ["2008-11", 3770000], ["2008-12", 4010000], ["2009-01", 3820000], ["2009-02", 3970000], ["2009-03", 3860000], ["2009-04", 3900000], ["2009-05", 4000000], ["2009-06", 4100000], ["2009-07", 4370000], ["2009-08", 4450000], ["2009-09", 4620000], ["2009-10", 5020000], ["2009-11", 5440000], ["2009-12", 4400000], ["2010-01", 4190000], ["2010-02", 4270000], ["2010-03", 4490000], ["2010-04", 4820000], ["2010-05", 4880000], ["2010-06", 4450000], ["2010-07", 3450000], ["2010-08", 3680000], ["2010-09", 3840000], ["2010-10", 3830000], ["2010-11", 4020000], ["2010-12", 4270000], ["2011-01", 4420000], ["2011-02", 4160000], ["2011-03", 4260000], ["2011-04", 4170000], ["2011-05", 4140000], ["2011-06", 4230000], ["2011-07", 4150000], ["2011-08", 4380000], ["2011-09", 4330000], ["2011-10", 4340000], ["2011-11", 4390000], ["2011-12", 4350000], ["2012-01", 4480000], ["2012-02", 4580000], ["2012-03", 4520000], ["2012-04", 4590000], ["2012-05", 4600000], ["2012-06", 4470000], ["2012-07", 4530000], ["2012-08", 4760000], ["2012-09", 4710000], ["2012-10", 4790000], ["2012-11", 4960000], ["2012-12", 4890000], ["2013-01", 4980000], ["2013-02", 5060000], ["2013-03", 5070000], ["2013-04", 5090000], ["2013-05", 5140000], ["2013-06", 5110000], ["2013-07", 5270000], ["2013-08", 5260000], ["2013-09", 5140000], ["2013-10", 5040000], ["2013-11", 4920000], ["2013-12", 4860000], ["2014-01", 4760000], ["2014-02", 4780000], ["2014-03", 4750000], ["2014-04", 4790000], ["2014-05", 4900000], ["2014-06", 4940000], ["2014-07", 4980000], ["2014-08", 4970000], ["2014-09", 5000000], ["2014-10", 5120000], ["2014-11", 4990000], ["2014-12", 5090000], ["2015-01", 4960000], ["2015-02", 5090000], ["2015-03", 5270000], ["2015-04", 5170000], ["2015-05", 5250000], ["2015-06", 5350000], ["2015-07", 5450000], ["2015-08", 5330000], ["2015-09", 5400000], ["2015-10", 5280000], ["2015-11", 4830000], ["2015-12", 5430000], ["2016-01", 5480000], ["2016-02", 5200000], ["2016-03", 5390000], ["2016-04", 5480000], ["2016-05", 5470000], ["2016-06", 5480000], ["2016-07", 5330000], ["2016-08", 5340000], ["2016-09", 5470000], ["2016-10", 5530000], ["2016-11", 5600000], ["2016-12", 5510000], ["2017-01", 5690000], ["2017-02", 5470000], ["2017-03", 5700000], ["2017-04", 5560000], ["2017-05", 5620000], ["2017-06", 5510000], ["2017-07", 5440000], ["2017-08", 5350000], ["2017-09", 5370000], ["2017-10", 5500000], ["2017-11", 5720000], ["2017-12", 5560000], ["2018-01", 5380000], ["2018-02", 5540000], ["2018-03", 5600000], ["2018-04", 5450000], ["2018-05", 5410000], ["2018-06", 5380000], ["2018-07", 5340000], ["2018-08", 5330000], ["2018-09", 5150000], ["2018-10", 5220000], ["2018-11", 5320000], ["2018-12", 4990000], ["2019-01", 4980000], ["2019-02", 5380000], ["2019-03", 5230000], ["2019-04", 5230000], ["2019-05", 5330000], ["2019-06", 5320000], ["2019-07", 5390000], ["2019-08", 5430000], ["2019-09", 5410000], ["2019-10", 5410000], ["2019-11", 5320000], ["2019-12", 5530000], ["2020-01", 5410000], ["2020-02", 5700000], ["2020-03", 5350000], ["2020-04", 4370000], ["2020-05", 4010000], ["2020-06", 4770000], ["2020-07", 5900000], ["2020-08", 5970000], ["2020-09", 6440000], ["2020-10", 6730000], ["2020-11", 6590000], ["2020-12", 6650000], ["2021-01", 6660000], ["2021-02", 6240000], ["2021-03", 6010000], ["2021-04", 5850000], ["2021-05", 5920000], ["2021-06", 5970000], ["2021-07", 6030000], ["2021-08", 5990000], ["2021-09", 6180000], ["2021-10", 6190000], ["2021-11", 6330000], ["2021-12", 6090000], ["2022-01", 6490000], ["2022-02", 5930000], ["2022-03", 5750000], ["2022-04", 5600000], ["2022-05", 5410000], ["2022-06", 5110000], ["2022-07", 4820000], ["2022-08", 4780000], ["2022-09", 4710000], ["2022-10", 4440000], ["2022-11", 4120000], ["2022-12", 4030000], ["2023-01", 4070000], ["2023-02", 4530000], ["2023-03", 4350000], ["2023-04", 4220000], ["2023-05", 4230000], ["2023-06", 4110000], ["2023-07", 4050000], ["2023-08", 4030000], ["2023-09", 3980000], ["2023-10", 3850000], ["2023-11", 3910000], ["2023-12", 3880000], ["2024-01", 4020000], ["2024-02", 4190000], ["2024-03", 4130000], ["2024-04", 4080000], ["2024-05", 4060000], ["2024-06", 3960000], ["2024-07", 4000000], ["2024-08", 3940000], ["2024-09", 3910000], ["2024-10", 4020000], ["2024-11", 4140000], ["2024-12", 4190000], ["2025-01", 4090000], ["2025-02", 4150000], ["2025-03", 4020000], ["2025-04", 4020000], ["2025-05", 4040000], ["2025-06", 3980000], ["2025-07", 4030000], ["2025-08", 4030000], ["2025-09", 4080000]],
      src: "NAR via FRED, homes per month (adjusted = annual rate ÷ 12)",
      histCaption: "Homes sold per month: the raw count (thin) and NAR's seasonally adjusted annual rate divided by 12 (bold), on an axis fitted to the data. Adjusted goes back to 1999 (before 2024 as published at the time, rebuilt by thetrading.tools); raw starts Dec 2023 (NAR release tables); FRED supplies the latest 13 months." },
    { k: "inv", label: "Homes for sale", short: "For sale", head: "Inventory", color: "#BF5AF2", print: "#8E3BB8", upGood: false, stock: true, source: "fred", fred: "HOSINVUSM495N", scale: 1, accumulate: true,
      histZoom: true, ownSpan: true, histMode: "rawAdj", adjust: "widget", refLines: true,
      // Starting history before FRED's 13 months: 2019-2023 from NAR's monthly
      // releases as quoted by Calculated Risk (each month as revised a month later
      // where available; "from one year ago" levels for 2019, 2021 and 2023; Sep
      // 2021 and Aug 2023 worked out from the stated year-over-year change),
      // Jan-Dec 2024 from NAR's December
      // 2024 release tables (Dec 2024 as revised a month later), Jan-Sep 2025 from
      // NAR's monthly releases as reported by Calculated Risk. Each 2025 value
      // matches NAR's stated year-over-year change against the 2024 value.
      seed: [["2019-01", 1590000], ["2019-02", 1630000], ["2019-03", 1670000], ["2019-04", 1830000], ["2019-05", 1910000], ["2019-06", 1920000], ["2019-07", 1900000], ["2019-08", 1830000], ["2019-09", 1820000], ["2019-10", 1770000], ["2019-11", 1640000], ["2019-12", 1390000], ["2020-01", 1400000], ["2020-02", 1460000], ["2020-03", 1490000], ["2020-04", 1460000], ["2020-05", 1550000], ["2020-06", 1570000], ["2020-07", 1500000], ["2020-08", 1490000], ["2020-09", 1460000], ["2020-10", 1420000], ["2020-11", 1280000], ["2020-12", 1070000], ["2021-01", 1030000], ["2021-02", 1030000], ["2021-03", 1050000], ["2021-04", 1150000], ["2021-05", 1210000], ["2021-06", 1230000], ["2021-07", 1310000], ["2021-08", 1280000], ["2021-09", 1260000], ["2021-10", 1230000], ["2021-11", 1110000], ["2021-12", 880000], ["2022-01", 850000], ["2022-02", 850000], ["2022-03", 930000], ["2022-04", 1030000], ["2022-05", 1150000], ["2022-06", 1250000], ["2022-07", 1300000], ["2022-08", 1280000], ["2022-09", 1230000], ["2022-10", 1220000], ["2022-11", 1120000], ["2022-12", 970000], ["2023-01", 980000], ["2023-02", 970000], ["2023-03", 970000], ["2023-04", 1040000], ["2023-05", 1080000], ["2023-06", 1070000], ["2023-07", 1110000], ["2023-08", 1100000], ["2023-09", 1130000], ["2023-10", 1150000], ["2023-11", 1130000], ["2023-12", 990000], ["2024-01", 1010000], ["2024-02", 1060000], ["2024-03", 1110000], ["2024-04", 1200000], ["2024-05", 1280000], ["2024-06", 1320000], ["2024-07", 1340000], ["2024-08", 1370000], ["2024-09", 1360000], ["2024-10", 1370000], ["2024-11", 1330000], ["2024-12", 1140000], ["2025-01", 1180000], ["2025-02", 1230000], ["2025-03", 1330000], ["2025-04", 1450000], ["2025-05", 1540000], ["2025-06", 1540000], ["2025-07", 1550000], ["2025-08", 1530000], ["2025-09", 1550000]],
      src: "NAR via FRED, existing homes for sale at month end",
      histCaption: "Existing homes for sale at month end: the raw count (thin) and a seasonally adjusted line (bold) the widget works out itself, since NAR doesn't adjust inventory (marked *; rough until more years build up). 2019 to Sep 2025 is built in from NAR's releases; FRED supplies the rest." },
  ],
};


// ---------- Shared settings ----------
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

const REDFIN_COUNTRY = "https://redfin-public-data.s3.us-west-2.amazonaws.com/redfin_data_center/housing_market/monthly/country.csv";
const REDFIN_TRACKER = "https://redfin-public-data.s3.us-west-2.amazonaws.com/redfin_market_tracker/us_national_market_tracker.tsv000.gz";
const ZILLOW_GUESSES = [
  "https://files.zillowstatic.com/research/public_csvs/new_con_sales_count_raw/Metro_new_con_sales_count_raw_uc_sfrcondo_month.csv",
  "https://files.zillowstatic.com/research/public_csvs/new_con_sales_count_raw/National_new_con_sales_count_raw_uc_sfrcondo_month.csv",
];
const ZILLOW_PAGE = "https://www.zillow.com/research/data/";
const REFRESH_HOURS = 12;   // how often to look for new numbers
const WIDGET_SECONDS = 20;  // a widget gets this long to refresh, then uses the saved copy
const GREEN = "#30D158";
const RED = "#FF453A";
const GRAY = "#98989F";
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ---------- Saved copy (shared by the widget and the app) ----------
function docPath(name) {
  const fm = FileManager.local();
  return fm.joinPath(fm.documentsDirectory(), name);
}
function readJSON(name) {
  const fm = FileManager.local();
  const p = docPath(name);
  for (const q of [p, p + ".tmp"]) {
    try { if (fm.fileExists(q)) return JSON.parse(fm.readString(q)); } catch (e) {}
  }
  return null;
}
function writeJSON(name, obj) {
  const fm = FileManager.local();
  const p = docPath(name), tmp = p + ".tmp";
  try {
    fm.writeString(tmp, JSON.stringify(obj));
    if (fm.fileExists(p)) fm.remove(p);
    fm.move(tmp, p);
  } catch (e) {
    try { fm.writeString(p, JSON.stringify(obj)); } catch (e2) {}
  }
}
const sleep = (ms) => new Promise((r) => Timer.schedule(ms, false, r));
const hoursSince = (iso) => (iso ? (Date.now() - new Date(iso).getTime()) / 3600000 : Infinity);

// ---------- Sources ----------
// FRED: monthly, thousands of homes -> homes
// scale: FRED reports most housing series in thousands (x1000); NAR's existing
// sales come as a full annual rate, so they use 1/12 for a per-month figure
async function fredMonthly(id, scale) {
  const url = "https://api.stlouisfed.org/fred/series/observations" + `?series_id=${id}&api_key=${FRED_KEY}&file_type=json&observation_start=1959-01-01`;
  const req = new Request(url);
  req.timeoutInterval = 20;
  const j = await req.loadJSON();
  if (!j.observations) throw new Error(j.error_message || `FRED has no ${id}`);
  return j.observations.filter((o) => o.value !== ".").map((o) => ({ m: o.date.slice(0, 7), v: Math.round(parseFloat(o.value) * (scale || 1000)) }));
}
// A quarterly series (dated at the quarter's first month) spread evenly over
// its three months, so it sits on the same homes-per-month scale as the rest
function quarterToMonths(pts) {
  const out = [];
  for (const p of pts) {
    const y = +p.m.slice(0, 4), m0 = +p.m.slice(5, 7);
    for (let k = 0; k < 3; k++) out.push({ m: `${y}-${String(m0 + k).padStart(2, "0")}`, v: Math.round(p.v / 3) });
  }
  return out;
}
function splitCsv(line, sep) {
  if (line.indexOf('"') < 0) return line.split(sep);
  const out = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true;
    else if (ch === sep) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}
// Redfin national monthly: homes sold, new listings, active listings. Picks
// all residential and the not-seasonally-adjusted rows (so fiscal-year totals
// are real counts), by column name.
// Redfin's files have changed header styles over time (lower-case, or
// upper-case and quoted), so columns are matched by name first, then by the
// words they contain; filters only apply when they leave rows to use.
function redfinRows(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
  if (lines.length < 2) throw new Error("file is empty");
  const sep = lines[0].split("\t").length > lines[0].split(",").length ? "\t" : ",";
  const head = splitCsv(lines[0], sep).map((h) => h.trim().replace(/"/g, "").toLowerCase().replace(/[\s-]+/g, "_"));
  const exact = (...names) => { for (const n of names) { const i = head.indexOf(n); if (i >= 0) return i; } return -1; };
  const loose = (has, not) => head.findIndex((h) => has.some((w) => h.includes(w)) && !not.some((w) => h.includes(w)));
  const pick1 = (names, has, not) => { const i = exact(...names); return i >= 0 ? i : loose(has, not); };
  const NOT = ["yoy", "mom", "pct", "price", "ratio", "median_", "avg", "months_of", "above", "below", "off_market", "per_", "_rank", "share"];
  const iB = pick1(["period_begin", "period_start", "month", "date", "month_date_yyyymm"], ["period_begin", "period_start"], []);
  const iE = exact("period_end");
  const iSA = pick1(["is_seasonally_adjusted", "seasonally_adjusted"], ["seasonal"], []);
  const iPT = pick1(["property_type"], ["property_type"], ["_id"]);
  const iReg = exact("region_type");
  const iSold = pick1(["homes_sold", "home_sales", "total_homes_sold"], ["homes_sold", "home_sold", "sales_count"], NOT);
  const iNew = pick1(["new_listings", "new_listing_count"], ["new_listing"], NOT);
  const iInv = pick1(["inventory", "active_listings", "active_listing_count", "total_active_listings"], ["inventory", "active_listing"], NOT.concat(["new_"]));
  const iDur = exact("period_duration");
  if ((iB < 0 && iE < 0) || (iSold < 0 && iNew < 0 && iInv < 0)) throw new Error("columns not recognized: " + head.slice(0, 14).join(", "));
  const rows = [];
  for (let r = 1; r < lines.length; r++) rows.push(splitCsv(lines[r], sep).map((x) => String(x == null ? "" : x).replace(/"/g, "").trim()));
  const ymOf = (s) => { let m = s.match(/^(\d{4})-(\d{2})/); if (m) return m[1] + "-" + m[2]; m = s.match(/^(\d{1,2})\/\d{1,2}\/(\d{4})/); if (m) return m[2] + "-" + m[1].padStart(2, "0"); m = s.match(/^(\d{4})(\d{2})$/); return m ? m[1] + "-" + m[2] : null; };
  const num = (f, i) => { if (i < 0) return null; const v = parseFloat(String(f[i]).replace(/,/g, "")); return isFinite(v) ? Math.round(v) : null; };
  const keep = [
    (f) => iPT < 0 || /all residential/i.test(f[iPT]),
    (f) => iSA < 0 || !/^(t|true|1|yes|y)$/i.test(f[iSA]),
    (f) => iDur < 0 || !f[iDur] || +f[iDur] === 30 || +f[iDur] === 1 || /month/i.test(f[iDur]),
    (f) => iReg < 0 || !/metro|county|state|city|zip|neighbo/i.test(f[iReg]),
  ];
  // drop any filter that would leave nothing (e.g. a property-type label Redfin renamed)
  let use = rows;
  for (const k of keep) { const next = use.filter(k); if (next.length) use = next; }
  const by = {};
  for (const f of use) {
    const d = ymOf(f[iB >= 0 ? iB : iE] || "");
    if (!d) continue;
    by[d] = { sold: num(f, iSold), newl: num(f, iNew), inv: num(f, iInv) };
  }
  const ms = Object.keys(by).sort();
  if (ms.length < 24) throw new Error(`only ${ms.length} months after filtering (${rows.length} rows; columns ${head.slice(0, 10).join(", ")})`);
  const pick = (k) => ms.filter((m) => by[m][k] != null).map((m) => ({ m, v: by[m][k] }));
  return { sold: pick("sold"), newl: pick("newl"), inv: pick("inv") };
}
async function redfinMonthly(allowWebView) {
  let why1 = "";
  try {
    const req = new Request(REDFIN_COUNTRY + "?t=" + Math.floor(Date.now() / 3600000));
    req.timeoutInterval = 30;
    req.headers = { "User-Agent": UA };
    const text = await req.loadString();
    const st = req.response && req.response.statusCode;
    if (st !== 200) why1 = `status ${st}`;
    else if (!text || text.length < 200) why1 = `only ${text ? text.length : 0} characters`;
    else return { ...redfinRows(text), src: "country.csv" };
  } catch (e) { why1 = e.message || String(e); }
  if (!allowWebView) throw new Error(`monthly file: ${why1} (open the script to try Redfin's tracker file)`);
  // fallback: the national market tracker (gzipped), unpacked in a hidden page
  let why2 = "";
  try {
    const r2 = new Request(REDFIN_TRACKER);
    r2.timeoutInterval = 90;
    r2.headers = { "User-Agent": UA };
    const data = await r2.load();
    const st2 = r2.response && r2.response.statusCode;
    const b64 = data ? data.toBase64String() : "";
    if (st2 !== 200) throw new Error(`status ${st2}`);
    if (!b64.startsWith("H4sI")) throw new Error(`not a gzip file (${Math.round(b64.length * 0.75 / 1024)} KB)`);
    const wv = updWV(new WebView());
    await wv.loadHTML(...updArgs("<!DOCTYPE html><html><body></body></html>"));
    await wv.evaluateJavaScript("window.__out='';(function(){try{var b=atob(" + JSON.stringify(b64) + "),u=new Uint8Array(b.length);for(var i=0;i<b.length;i++)u[i]=b.charCodeAt(i);" +
      "new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))).text().then(function(t){window.__out=t||'ERR empty';}).catch(function(e){window.__out='ERR '+e;});}catch(e){window.__out='ERR '+e;}})();0;", false);
    let len = 0;
    for (let i = 0; i < 480 && !len; i++) { await sleep(250); len = await wv.evaluateJavaScript("window.__out.length", false); }
    if (!len) throw new Error(`still unpacking after 2 minutes (${Math.round(b64.length * 0.75 / 1048576)} MB)`);
    const text = await wv.evaluateJavaScript("window.__out", false);
    if (/^ERR /.test(text)) throw new Error("unpack failed: " + text.slice(4, 120));
    return { ...redfinRows(text), src: "market tracker" };
  } catch (e) { why2 = e.message || String(e); }
  throw new Error(`monthly file: ${why1} · tracker file: ${why2}`);
}
// Zillow new-construction sales count (closings from recorded deeds), U.S.
function zillowRows(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.length);
  const head = splitCsv(lines[0], ",").map((h) => h.trim());
  const iN = head.indexOf("RegionName"), iT = head.indexOf("RegionType");
  const dates = head.map((h, i) => (/^\d{4}-\d{2}-\d{2}$/.test(h) ? i : -1)).filter((i) => i >= 0);
  if (iN < 0 || !dates.length) throw new Error("Zillow file layout not recognized");
  for (let r = 1; r < lines.length; r++) {
    const f = splitCsv(lines[r], ",");
    if (!(/country/i.test(f[iT] || "") || /^united states$/i.test(f[iN] || ""))) continue;
    const pts = dates.map((i) => ({ m: head[i].slice(0, 7), v: f[i] === "" ? null : Math.round(parseFloat(f[i])) })).filter((p) => p.v != null && isFinite(p.v));
    if (pts.length < 12) throw new Error("Zillow U.S. row is too short");
    return pts;
  }
  throw new Error("Zillow file has no U.S. row");
}
async function zillowNewCon(saved, allowWebView) {
  const tryUrl = async (u) => {
    const req = new Request(u);
    req.timeoutInterval = 25;
    req.headers = { "User-Agent": UA };
    const text = await req.loadString();
    if ((req.response && req.response.statusCode) !== 200 || !text || text.length < 200) throw new Error("no file");
    return { pts: zillowRows(text), url: u };
  };
  const urls = [...new Set([saved && saved.zillowUrl, ...ZILLOW_GUESSES].filter(Boolean))];
  for (const u of urls) { try { return await tryUrl(u); } catch (e) {} }
  // find the link on Zillow's research data page
  let html = "";
  try {
    const req = new Request(ZILLOW_PAGE);
    req.timeoutInterval = 20;
    req.headers = { "User-Agent": UA };
    html = await req.loadString();
  } catch (e) {}
  if (!/new_con/i.test(html) && allowWebView) {
    try {
      const wv = updWV(new WebView());
      await wv.loadURL(ZILLOW_PAGE);
      await sleep(3000);
      html = await wv.evaluateJavaScript("document.documentElement.outerHTML", false);
    } catch (e) {}
  }
  const found = [...new Set((html.match(/https:\/\/files\.zillowstatic\.com\/research\/public_csvs\/[^"'\s<>]*\.csv[^"'\s<>]*/gi) || []).filter((u) => /new_con/i.test(u) && /sales_count/i.test(u)))];
  found.sort((a, b) => (/national/i.test(b) ? 2 : /metro/i.test(b) ? 1 : 0) - (/national/i.test(a) ? 2 : /metro/i.test(a) ? 1 : 0));
  for (const u of found) { try { return await tryUrl(u.replace(/&amp;/g, "&")); } catch (e) {} }
  throw new Error("couldn't find Zillow's new-construction file");
}

// ---------- Refresh (keeps the last good copy of every line) ----------
// Every series to download: the configured lines, plus the raw companion of a
// line whose history chart shows raw vs adjusted (stored as "<key>Raw")
const ALL_LINES = CFG.lines.concat(CFG.lines.filter((L) => L.raw).map((L) => ({ k: L.k + "Raw", label: L.label + " (raw)", source: "fred", fred: L.raw.fred, scale: L.raw.scale || 1, accumulate: true, seed: L.raw.seed })));
// A line added to the script since the saved copy was made (e.g. finished specs)
const missingLine = (s) => ALL_LINES.some((L) => (!(s.lines && s.lines[L.k] && s.lines[L.k].length) && !(s.tried || []).includes(L.k)) ||
  (L.seed && s.lines && s.lines[L.k] && !s.lines[L.k].some((p) => p.m === L.seed[0][0])));
async function refresh(saved, force, allowWebView) {
  if (saved && saved.lines && !force && hoursSince(saved.checked) < REFRESH_HOURS && !missingLine(saved)) return saved;
  const prev = saved && saved.lines ? saved.lines : {};
  const lines = {}, errors = [];
  let extra = { zillowUrl: saved && saved.zillowUrl };
  const tasks = await Promise.all(ALL_LINES.map(async (L) => {
    try {
      if (L.source === "fred" && L.quarterly) return [L.k, quarterToMonths(await fredMonthly(L.fred))];
      if (L.source === "fred") return [L.k, await fredMonthly(L.fred, L.scale)];
      return [L.k, null];
    } catch (e) { errors.push(`${L.label}: ${e.message || e}`); return [L.k, null]; }
  }));
  for (const [k, v] of tasks) if (v) lines[k] = v;
  if (ALL_LINES.some((L) => L.source === "redfin")) {
    try {
      const r = await redfinMonthly(allowWebView);
      for (const L of ALL_LINES) if (L.source === "redfin" && r[L.redfin] && r[L.redfin].length) lines[L.k] = r[L.redfin];
      extra.redfinSrc = r.src;
    } catch (e) { errors.push(`Redfin: ${e.message || e}`); }
  }
  if (ALL_LINES.some((L) => L.source === "zillow")) {
    try {
      const z = await zillowNewCon(saved, allowWebView);
      for (const L of ALL_LINES) if (L.source === "zillow") lines[L.k] = z.pts;
      extra.zillowUrl = z.url;
    } catch (e) { errors.push(`Zillow: ${e.message || e}`); }
  }
  for (const L of ALL_LINES) if (!lines[L.k] && prev[L.k]) lines[L.k] = prev[L.k]; // keep the last good copy
  // starting history built into the script (NAR before FRED's 13 months);
  // anything FRED or the saved copy has takes precedence
  for (const L of ALL_LINES) {
    if (!L.seed || !lines[L.k]) continue;
    const have = new Set(lines[L.k].map((p) => p.m).concat((prev[L.k] || []).map((p) => p.m)));
    const add = L.seed.filter(([m]) => !have.has(m)).map(([m, v]) => ({ m, v: Math.round(v * (L.scale || 1)) }));
    if (add.length) lines[L.k] = add.concat(lines[L.k]).sort((a, b) => (a.m < b.m ? -1 : 1));
  }
  // lines FRED only serves a short window of (NAR): keep older saved months so history builds up
  for (const L of ALL_LINES) {
    if (!L.accumulate || !lines[L.k] || !prev[L.k] || lines[L.k] === prev[L.k]) continue;
    const have = new Set(lines[L.k].map((p) => p.m));
    lines[L.k] = prev[L.k].filter((p) => !have.has(p.m)).concat(lines[L.k]).sort((a, b) => (a.m < b.m ? -1 : 1));
  }
  if (!Object.keys(lines).length) throw new Error(errors.join(" · ") || "no data");
  const out = { ...extra, lines, tried: ALL_LINES.map((L) => L.k), checked: new Date().toISOString(), errors: errors.length ? errors : null };
  writeJSON(CFG.file, out);
  return out;
}

// ---------- Fiscal years (October to September) ----------
const fyOf = (m) => (+m.slice(5, 7) >= 10 ? +m.slice(0, 4) + 1 : +m.slice(0, 4));
const fyMonths = (fy) => { const out = []; for (let i = 0; i < 12; i++) { const mm = ((9 + i) % 12) + 1, yy = mm >= 10 ? fy - 1 : fy; out.push(`${yy}-${String(mm).padStart(2, "0")}`); } return out; };
function latestMonth(s) {
  let mx = "";
  for (const L of CFG.lines) { const p = s.lines[L.k]; if (p && p.length && p[p.length - 1].m > mx) mx = p[p.length - 1].m; }
  return mx;
}
// This fiscal year so far vs the same months a year earlier
function fyCompare(pts, fy, stock) {
  const map = new Map((pts || []).map((p) => [p.m, p.v]));
  const cur = fyMonths(fy), prev = fyMonths(fy - 1);
  let a = 0, b = 0, n = 0;
  cur.forEach((m, i) => { if (map.has(m) && map.has(prev[i])) { a += map.get(m); b += map.get(prev[i]); n++; } });
  if (!n) return null;
  if (stock) { a /= n; b /= n; }
  return { cur: a, prev: b, pct: b ? (a / b - 1) * 100 : null, n, through: cur[n - 1] };
}
function fmtCount(v) {
  const a = Math.abs(v);
  return a >= 1e6 ? (a / 1e6).toFixed(2) + "M" : a >= 1e3 ? Math.round(a / 1e3) + "k" : String(Math.round(a));
}

// ---------- Widget ----------
function drawText(ctx, str, rect, font, hex, align) {
  ctx.setFont(font);
  ctx.setTextColor(new Color(hex));
  if (align === "right") ctx.setTextAlignedRight(); else if (align === "center") ctx.setTextAlignedCenter(); else ctx.setTextAlignedLeft();
  ctx.drawTextInRect(str, rect);
}
// Face: the trailing-12-month chart filling the tile (the last 12 months
// solid, the same months a year earlier dotted, only the lines left on in the full-screen legend),
// each line's latest month value at its right end.
function legendFile() { return CFG.file.replace(/\.json$/, "-legend.json"); }
function smallImage(s) {
  const W = 170, ctx = new DrawContext();
  ctx.size = new Size(W, W);
  ctx.opaque = true;
  ctx.respectScreenScale = true;
  for (let i = 0; i < 34; i++) {
    const f = i / 33, c = [0x2c, 0x2c, 0x2e].map((v, j) => Math.round(v + ([0x1c, 0x1c, 0x1e][j] - v) * f).toString(16).padStart(2, "0")).join("");
    ctx.setFillColor(new Color("#" + c));
    ctx.fillRect(new Rect(0, (W * i) / 34, W, W / 34 + 1));
  }
  drawText(ctx, CFG.title, new Rect(14, 10, 142, 17), Font.boldSystemFont(13), "#FFFFFF", "left");
  // the trailing 12 months, and the same months a year earlier
  const lm = latestMonth(s), li = +lm.slice(0, 4) * 12 + +lm.slice(5, 7) - 1;
  const ms = (i) => Math.floor(i / 12) + "-" + String((i % 12) + 1).padStart(2, "0");
  const cm = [], pm = [];
  for (let i = 11; i >= 0; i--) { cm.push(ms(li - i)); pm.push(ms(li - i - 12)); }
  const hidden = readJSON(legendFile()) || {};
  // ---- chart, filling the tile; each line's latest value at its right end ----
  const L0 = 14, R = 122, T = 34, B = 128;
  const lines = CFG.lines.filter((L) => !L.bar && !L.histOnly && !hidden[L.k] && s.lines[L.k] && s.lines[L.k].length);
  // the scale hugs the data (not zero-based) so the lines fill the tile
  let hi = -Infinity, lo = Infinity;
  const maps = {};
  lines.forEach((L) => { const mp = new Map(s.lines[L.k].map((p) => [p.m, p.v])); maps[L.k] = mp; cm.concat(pm).forEach((m) => { if (mp.has(m)) { hi = Math.max(hi, mp.get(m)); lo = Math.min(lo, mp.get(m)); } }); });
  if (!isFinite(hi)) { hi = 1; lo = 0; }
  const pad = Math.max((hi - lo) * 0.08, hi * 0.02);
  hi += pad; lo = Math.max(0, lo - pad);
  const X = (i) => L0 + (i / 11) * (R - L0), Y = (v) => B - ((v - lo) / (hi - lo || 1)) * (B - T);
  ctx.setFillColor(new Color("#48484A"));
  ctx.fillRect(new Rect(L0, B, R - L0, 0.6));
  ctx.setFillColor(new Color("#3A3A3C"));
  ctx.fillRect(new Rect(L0, (T + B) / 2, R - L0, 0.5));
  if (!lines.length) drawText(ctx, "All lines are switched off in the legend", new Rect(L0, (T + B) / 2 - 14, 142, 26), Font.systemFont(9.5), GRAY, "left");
  const tags = [];
  lines.forEach((L) => {
    const mp = maps[L.k];
    // points along a run of months; quarterly lines are flat steps per month
    const hs = (X(1) - X(0)) / 2, clampX = (x) => Math.max(L0, Math.min(R, x));
    const runs = (months) => {
      const out = [];
      let run = [];
      months.forEach((m, i) => {
        if (!mp.has(m)) { if (run.length) out.push(run); run = []; return; }
        const y = Y(mp.get(m));
        if (L.quarterly) run.push([clampX(X(i) - hs), y], [clampX(X(i) + hs), y]);
        else run.push([X(i), y]);
      });
      if (run.length) out.push(run);
      return out;
    };
    // last year: dots along the line
    ctx.setFillColor(new Color(L.color, 0.8));
    runs(pm).forEach((run) => {
      for (let i = 1; i < run.length; i++) {
        const [x0, y0] = run[i - 1], [x1, y1] = run[i];
        const len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(len / 3.6));
        for (let k = 0; k < n; k++) { const f = k / n; ctx.fillEllipse(new Rect(x0 + (x1 - x0) * f - 0.7, y0 + (y1 - y0) * f - 0.7, 1.4, 1.4)); }
      }
    });
    // this year: solid
    let pts = [];
    let last = -1;
    cm.forEach((m, i) => { if (mp.has(m)) last = i; });
    const cr = runs(cm);
    cr.forEach((run, ri) => { if (ri === cr.length - 1) pts = run.map(([x, y]) => new Point(x, y)); else if (run.length > 1) { const path = new Path(); path.addLines(run.map(([x, y]) => new Point(x, y))); ctx.addPath(path); ctx.setStrokeColor(new Color(L.color)); ctx.setLineWidth(2.4); ctx.strokePath(); } });
    if (pts.length > 1) {
      const path = new Path();
      path.addLines(pts);
      ctx.addPath(path);
      ctx.setStrokeColor(new Color(L.color));
      ctx.setLineWidth(2.4);
      ctx.strokePath();
    }
    if (last >= 0) {
      const v = mp.get(cm[last]), r = new Rect(X(last) - 2.8, Y(v) - 2.8, 5.6, 5.6);
      const prelim = L.prelim && cm[last] === s.lines[L.k][s.lines[L.k].length - 1].m;
      if (prelim) { ctx.setFillColor(new Color("#1E1E20")); ctx.fillEllipse(r); ctx.setStrokeColor(new Color(L.color)); ctx.setLineWidth(1.4); ctx.strokeEllipse(r); }
      else { ctx.setFillColor(new Color(L.color)); ctx.fillEllipse(r); }
      tags.push({ y: Y(v), t: fmtCount(v), c: L.color });
    }
  });
  // latest values at the right edge, nudged apart so they don't overlap
  tags.sort((a, b) => a.y - b.y);
  for (let k = 1; k < tags.length; k++) if (tags[k].y - tags[k - 1].y < 13) tags[k].y = tags[k - 1].y + 13;
  const over = tags.length ? tags[tags.length - 1].y - B : 0;
  if (over > 0) tags.forEach((t) => { t.y -= over; });
  tags.forEach((t) => drawText(ctx, t.t, new Rect(R + 5, t.y - 7, 156 - R - 3, 14), Font.boldSystemFont(11), t.c, "left"));
  [0, 3, 6, 9, 11].map((i) => [i, MONTH_NAMES[+cm[i].slice(5, 7) - 1]]).forEach(([i, t]) => drawText(ctx, t, i === 0 ? new Rect(L0, B + 3, 30, 10) : new Rect(X(i) - 15, B + 3, 30, 10), Font.systemFont(8), GRAY, i === 0 ? "left" : "center"));
  drawText(ctx, "Last 12 mo · dotted: year before", new Rect(14, 151, 142, 12), Font.mediumSystemFont(8.5), GRAY, "left");
  return ctx.getImage();
}
function errorWidget(msg) {
  const w = new ListWidget();
  const g = new LinearGradient();
  g.colors = [new Color("#2C2C2E"), new Color("#1C1C1E")];
  g.locations = [0, 1];
  w.backgroundGradient = g;
  const t = w.addText(CFG.title);
  t.font = Font.semiboldSystemFont(12);
  t.textColor = new Color("#FFFFFF");
  w.addSpacer(4);
  const m = w.addText(String(msg));
  m.font = Font.systemFont(10);
  m.textColor = new Color(GRAY);
  w.addSpacer();
  w.url = URLScheme.forRunningScript();
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
// Note: the page script below avoids backticks, backslashes and dollar-brace
// on purpose, because the whole page lives inside a template literal.
const PAGE_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<title>Housing Activity</title>
<style>
  :root { --bg:#1C1C1E; --fg:#FFFFFF; --gray:#98989F; }
  * { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  body { margin:0; padding:20px 16px 36px; background:var(--bg); color:var(--fg);
         font-family:-apple-system,system-ui,sans-serif; -webkit-user-select:none; user-select:none; }
  .ticker { font-size:26px; font-weight:800; letter-spacing:-0.3px; }
  .name { color:var(--gray); font-size:13.5px; font-weight:600; margin-top:3px; line-height:1.35; }
  .hint { color:var(--gray); font-size:12px; margin-top:6px; line-height:1.4; }
  .hl { font-size:15.5px; font-weight:700; line-height:1.35; margin-top:12px; }
  .h2 { font-size:12px; font-weight:700; color:var(--gray); letter-spacing:0.4px; margin:22px 0 6px; text-transform:uppercase; }
  .seg { display:flex; gap:6px; margin-top:8px; }
  .seg button { flex:1; border:0; border-radius:10px; padding:7px 0; background:#2C2C2E; color:#FFFFFF; font:inherit; font-size:13.5px; font-weight:600; }
  .seg button.on { background:#FFFFFF; color:#000000; }
  .legend { display:flex; flex-wrap:wrap; gap:6px; margin:8px 0 4px; }
  .chip { border-radius:10px; padding:5px 8px; background:#2C2C2E; font-size:12.5px; font-weight:700; line-height:1.25; }
  .chip.off { opacity:0.35; }
  .chip small { display:block; font-weight:500; color:var(--gray); font-size:10.5px; }
  .rawtog { text-decoration:underline dotted; text-underline-offset:3px; cursor:pointer; }
  .chip .v { color:#FFFFFF; font-variant-numeric:tabular-nums; }
  .chip .p { color:var(--gray); font-weight:600; font-size:11.5px; font-variant-numeric:tabular-nums; }
  .ro { font-size:12.5px; font-weight:600; min-height:18px; margin:6px 0 2px; line-height:1.4; font-variant-numeric:tabular-nums; }
  svg.chart { display:block; width:100%; height:250px; }
  svg.hist { display:block; width:100%; height:150px; }
  .wrap { position:relative; }
  .touch { position:absolute; left:0; top:0; right:0; bottom:0; touch-action:pan-y; }
  .ct { font-size:14.5px; font-weight:700; margin-top:16px; }
  .desc { color:var(--gray); font-size:11.5px; line-height:1.4; margin-top:1px; }
  .note { color:var(--gray); font-size:10.5px; line-height:1.45; margin-top:24px; }
  .warn { color:#FF9F0A; }
</style>
</head>
<body>
<div class="ticker" id="ttl"></div>
<div class="hint warn" id="errs"></div>
<div class="hl" id="headline"></div>
<div class="h2" id="ovh"></div>
<div class="legend" id="legend"></div>
<div class="wrap"><svg class="chart" id="ov"></svg><div class="touch" id="tov"></div></div>
<div class="h2">Full history</div>
<div class="hint" id="hwin"></div>
<div id="hist"></div>
<div class="note" id="note"></div>
__SHARE__
<script>
var D = __DATA__;
var MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
var GREEN = "#30D158", RED = "#FF453A";
var hidden = {}, FY = 0, inited = false, cur = null, HV = null, hcurM = null;
function el(id) { return document.getElementById(id); }
function esc(s) { return String(s).split("&").join("&amp;").split("<").join("&lt;").split(">").join("&gt;"); }
function fmt(v) { var a = Math.abs(v); return a >= 1e6 ? (a / 1e6).toFixed(2) + "M" : a >= 1e3 ? Math.round(a / 1e3) + "k" : String(Math.round(a)); }
function pct(v) { return (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(1) + "%"; }
// The top chart is the trailing 12 months: window 0 is the 12 months ending
// with the latest month any line has, window -1 the same months a year earlier.
function fyMonths(off) { var end = mIdx(D.latest) + 12 * off, out = []; for (var i = 11; i >= 0; i--) out.push(mStr(end - i)); return out; }
function winM(off) { return fyMonths(off).map(function (m) { return MON[+m.slice(5, 7) - 1]; }); }
function mapOf(L) { if (!L.__map) { L.__map = {}; L.pts.forEach(function (p) { L.__map[p.m] = p.v; }); } return L.__map; }
function mLabel(m) { return MON[+m.slice(5, 7) - 1] + " " + m.slice(0, 4); }
function cmp(L, fy) {
  var mp = mapOf(L), c = fyMonths(fy), p = fyMonths(fy - 1), a = 0, b = 0, n = 0, last = null;
  c.forEach(function (m, i) { if (mp[m] != null && mp[p[i]] != null) { a += mp[m]; b += mp[p[i]]; n++; last = m; } });
  if (!n) return null;
  if (L.stock) { a /= n; b /= n; }
  var first = null; c.forEach(function (m, i) { if (first == null && mp[m] != null && mp[p[i]] != null) first = m; });
  return { cur: a, prev: b, pct: b ? (a / b - 1) * 100 : null, n: n, last: last, first: first };
}
function good(L, v) { return L.upGood ? v >= 0 : v <= 0; }
function niceStep(range, n) { var raw = range / (n || 4), p = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), f = raw / p; return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p; }
function axis(v) { return v >= 1e6 ? +(v / 1e6).toFixed(2) + "M" : v >= 1e3 ? +(v / 1e3).toFixed(1) + "k" : String(+v.toFixed(2)); }
// History-chart view for one line: the shared zoom, but a line with only a
// short history (ownSpan: NAR) starts where its data starts, so it isn't a
// stub at the right edge of a 2012-2026 axis.
function viewFor(i) {
  var L = D.hist[i], a = HV.a, b = HV.b;
  if (L && L.ownSpan && L.pts.length) { a = Math.max(a, mIdx(L.pts[0].m) - 1); if (b - a < MIN_SPAN) a = b - MIN_SPAN; }
  return { a: a, b: b };
}
// Axis fitted to the data instead of starting at zero (histZoom lines)
function zoomAxis(lo, hi, n) {
  var rng = Math.max(hi - lo, hi * 0.02), st = niceStep(rng * 1.25, n), base = Math.floor((lo - rng * 0.12) / st) * st, top = Math.ceil((hi + rng * 0.08) / st) * st;
  return { base: Math.max(0, base), top: top, st: st };
}
function fyName(off) { return off === 0 ? "the last 12 months" : "the year before"; }
function fySpan(off) { var m = fyMonths(off); return mLabel(m[0]) + " to " + mLabel(m[11]); }
// months a comparison covers when a line lags, e.g. "Oct-Aug"
function partial(c) { return c.n < 12 ? (c.n === 1 ? MON[+c.first.slice(5, 7) - 1] + " only" : MON[+c.first.slice(5, 7) - 1] + "-" + MON[+c.last.slice(5, 7) - 1]) : ""; }

// ---- headline ----
var SMALL = { from: 1, a: 1, its: 1, the: 1, of: 1, "in": 1, to: 1, at: 1, vs: 1, and: 1, on: 1, back: 1, since: 0 };
function titleCase(t) { return t.split(" ").map(function (w, i) { var lw = w.toLowerCase(); if (i > 0 && SMALL[lw]) return lw; return w.charAt(0).toUpperCase() + w.slice(1); }).join(" "); }
// "October: Existing Sales at 3.75M Annual Rate, Lowest Since Aug 2010; Inventory 1.59M, Up 5% From a Year Ago"
function insightText(ls) {
  var mo = null, parts = [];
  ls.forEach(function (L) {
    var pts = L.pts; if (!pts || !pts.length) return;
    var last = pts[pts.length - 1], hs = L.headScale || 1, mp = mapOf(L), ya = mp[mStr(mIdx(last.m) - 12)];
    if (!mo || last.m > mo) mo = last.m;
    var st = refStats(L), ex = extremeText(st), yo = ya ? (last.v / ya - 1) * 100 : null;
    var t = L.head + " " + (L.headUnit ? "at " : "") + fmt(last.v * hs) + (L.headUnit ? " " + L.headUnit : "");
    if (ex) t += ", " + ex;
    else if (yo != null) t += ", " + (Math.abs(yo) < 0.5 ? "flat" : (yo > 0 ? "up " : "down ") + Math.abs(yo).toFixed(1) + "%") + " from a year ago";
    parts.push(t);
  });
  if (!parts.length) return "";
  return titleCase(MONTHS_LONG[+mo.slice(5, 7) - 1] + ": " + parts.join("; "));
}
var MONTHS_LONG = ["January","February","March","April","May","June","July","August","September","October","November","December"];
function headlineText() {
  var refs = D.lines.filter(function (L) { return L.refLines && !hidden[L.k]; });
  if (refs.length) return insightText(refs);
  var parts = [], maxN = 0;
  D.lines.forEach(function (L) {
    var c = cmp(L, FY); if (!c || c.pct == null) return;
    maxN = Math.max(maxN, c.n);
    var up = c.pct >= 0;
    parts.push(L.head + " " + (Math.abs(c.pct) < 0.5 ? "Held Flat" : (up ? (L.stock ? "Up " : "Rose ") : (L.stock ? "Down " : "Fell ")) + Math.abs(c.pct).toFixed(1) + "%"));
  });
  if (!parts.length) return "";
  var last = parts.pop();
  return "Last 12 Months: " + (parts.length ? parts.join(", ") + " and " : "") + last + " vs the Year Before";
}

// ---- legend ----
// The chips are both legend and readout: each shows its line's value for the
// selected month (tap the chart to pick one; otherwise the latest) and the
// change from the same month a year earlier. Tap a chip to hide its line.
var selI = -1;
function renderLegend() {
  var cm = fyMonths(FY), pm = fyMonths(FY - 1);
  el("legend").innerHTML = D.lines.map(function (L) {
    var mp = mapOf(L), i = selI, lag = "";
    if (i >= 0 && mp[cm[i]] == null && cur == null) { for (var j = i; j >= 0; j--) if (mp[cm[j]] != null) { i = j; lag = (L.quarterly ? "Q" + Math.ceil(+cm[j].slice(5, 7) / 3) : MON[+cm[j].slice(5, 7) - 1]) + " "; break; } }
    var a = i >= 0 ? mp[cm[i]] : null, b = i >= 0 ? mp[pm[i]] : null, t = "";
    if (a == null) t = ' <span class="v">–</span>';
    else {
      t = ' <span class="v">' + lag + fmt(a) + "</span>";
      if (b) { var ch = (a / b - 1) * 100; t += ' <span class="p">' + (ch >= 0 ? "+" : "−") + Math.abs(ch).toFixed(0) + "%</span>"; }
    }
    return '<div class="chip' + (hidden[L.k] ? " off" : "") + '" data-k="' + L.k + '" style="color:' + L.color + '">' + esc(L.short || L.label) + t + "</div>";
  }).join("");
  var cs = el("legend").querySelectorAll(".chip");
  for (var k = 0; k < cs.length; k++) cs[k].onclick = function () { var key = this.getAttribute("data-k"); hidden[key] = !hidden[key]; renderOverlay(); renderLegend(); };
  var sh = function (m) { return MON[+m.slice(5, 7) - 1] + " '" + m.slice(2, 4); };
  el("ovh").textContent = sh(cm[0]) + " – " + sh(cm[11]) + " vs year before" + (cur != null ? " · " + sh(cm[cur]) : "");
}

// ---- the overlay: the last 12 months solid, the same months a year earlier dotted ----
function geom() { var svg = el("ov"), r = svg.getBoundingClientRect(); return { svg: svg, W: r.width || 360, H: r.height || 250 }; }
// Lines on the left axis; bar lines (finished specs) on a right axis, this
// fiscal year solid with last year's bar faint in front, overlapping 70%.
// Right-hand axis for the bars, zoomed to their range so month-to-month and
// year-over-year differences show. It does not start at zero (the chart marks
// the break), and its ticks share the left axis's gridlines.
function barAxis(visB, cm, pm, nSt) {
  var lo = Infinity, hi = -Infinity;
  visB.forEach(function (L) { var mp = mapOf(L); cm.concat(pm).forEach(function (m) { if (mp[m] != null) { lo = Math.min(lo, mp[m]); hi = Math.max(hi, mp[m]); } }); });
  if (!isFinite(lo)) return { base: 0, step: 1, top: nSt };
  var rng = Math.max(hi - lo, hi * 0.04), step = niceUp(rng * 1.6 / nSt), base = 0;
  for (var t = 0; t < 8; t++) {
    base = Math.max(0, Math.floor((lo - rng * 0.5) / step) * step);
    if (base + nSt * step >= hi + rng * 0.08) break;
    step = niceUp(step * 1.01);
  }
  return { base: base, step: step, top: base + nSt * step };
}
// When lines and bars share the chart, both axes zoom to their own range so
// each fills the same middle band (about 20% to 92% of the height) and they
// overlay instead of the lines riding on top and the bars sitting below.
function rangeOf(ls, cm, pm) { var lo = Infinity, hi = -Infinity; ls.forEach(function (L) { var mp = mapOf(L); cm.concat(pm).forEach(function (m) { if (mp[m] != null) { lo = Math.min(lo, mp[m]); hi = Math.max(hi, mp[m]); } }); }); return { lo: lo, hi: hi }; }
function fitAxis(r, n, fLo, fHi) {
  if (!isFinite(r.lo)) return { base: 0, step: 1, top: n };
  var rng = Math.max(r.hi - r.lo, r.hi * 0.04), step = niceUp(rng / (fHi - fLo) / n), base = 0;
  for (var t = 0; t < 10; t++) {
    base = Math.max(0, Math.floor((r.lo - fLo * n * step) / step) * step);
    if (base + n * step >= r.hi + rng * 0.03) break;
    step = niceUp(step * 1.01);
  }
  return { base: base, step: step, top: base + n * step };
}
function niceUp(x) { var p = Math.pow(10, Math.floor(Math.log(x) / Math.LN10)), f = x / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; }
function renderOverlay() {
  var g = geom(), L0 = 40, T = 8, B = g.H - 22;
  var hasBar = D.lines.some(function (L) { return L.bar; }), pad = hasBar ? 0.5 : 0;
  var X = function (i) { return L0 + (i + pad) / (11 + 2 * pad) * (R - L0); };
  var vis = D.lines.filter(function (L) { return !hidden[L.k]; });
  // left axis: lines; right axis: bars (specs) and lines marked right (sales)
  var visL = vis.filter(function (L) { return !L.bar && !L.right; }), visB = vis.filter(function (L) { return L.bar; }), visR = vis.filter(function (L) { return L.right && !L.bar; }), visA = visB.concat(visR);
  var R = g.W - (visA.length ? 108 : 80), LX = R + (visA.length ? 35 : 7);
  var cm = fyMonths(FY), pm = fyMonths(FY - 1), FYM = winM(FY), hi = 1, hiB = 1;
  visL.forEach(function (L) { var mp = mapOf(L); cm.concat(pm).forEach(function (m) { if (mp[m] != null) hi = Math.max(hi, mp[m]); }); });
  visA.forEach(function (L) { var mp = mapOf(L); cm.concat(pm).forEach(function (m) { if (mp[m] != null) hiB = Math.max(hiB, mp[m]); }); });
  var st = niceStep(hi * 1.05, 5), nSt = Math.ceil(hi * 1.05 / st); hi = nSt * st;
  if (!visL.length) { st = niceStep(hiB * 1.05, 5); nSt = Math.ceil(hiB * 1.05 / st); hi = nSt * st; }
  var BA = barAxis(visA, cm, pm, nSt), stB = BA.step, baseL = 0;
  if (visL.length && visA.length) { nSt = 5; var FA = fitAxis(rangeOf(visL, cm, pm), nSt, 0.2, 0.92); baseL = FA.base; st = FA.step; hi = FA.top; BA = fitAxis(rangeOf(visA, cm, pm), nSt, 0.2, 0.92); stB = BA.step; }
  var Y = function (v) { return B - (v - baseL) / (hi - baseL) * (B - T); }, YB = function (v) { return B - (v - BA.base) / (BA.top - BA.base) * (B - T); };
  var s = "";
  for (var q = 0; q <= nSt; q++) {
    var yy = Y(baseL + q * st);
    s += '<line x1="' + L0 + '" x2="' + R + '" y1="' + yy + '" y2="' + yy + '" stroke="#3A3A3C"/>';
    if (visL.length) s += '<text x="' + (L0 - 4) + '" y="' + (yy + 3.5) + '" font-size="10" fill="#8E8E93" text-anchor="end">' + axis(baseL + q * st) + "</text>";
    if (visA.length) s += '<text x="' + (R + 4) + '" y="' + (yy + 3.5) + '" font-size="10" fill="' + visA[0].color + '" opacity="0.9" text-anchor="start">' + axis(BA.base + q * stB) + "</text>";
  }
  if (cur != null) s += '<line x1="' + X(cur) + '" x2="' + X(cur) + '" y1="' + T + '" y2="' + B + '" stroke="#FFFFFF" stroke-dasharray="3 3"/>';
  if (visL.length && baseL > 0) s += '<path d="M' + (L0 - 1) + "," + (B - 9) + "l-4,-3l4,-3M" + (L0 - 1) + "," + (B - 4) + "l-4,-3l4,-3" + '" fill="none" stroke="#8E8E93" stroke-width="1.2"/>';
  if (visA.length && BA.base > 0) s += '<path d="M' + (R + 1) + "," + (B - 9) + "l4,-3l-4,-3M" + (R + 1) + "," + (B - 4) + "l4,-3l-4,-3" + '" fill="none" stroke="' + visA[0].color + '" stroke-width="1.2" opacity="0.9"/>';
  var items = [], bw = (R - L0) / 12 * 0.56;
  visB.forEach(function (L) {
    var mp = mapOf(L), lastI = -1;
    cm.forEach(function (m, i) { var v2 = mp[m]; if (v2 == null) return; lastI = i; s += '<rect x="' + (X(i) - 0.65 * bw).toFixed(1) + '" y="' + YB(v2).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + (B - YB(v2)).toFixed(1) + '" fill="' + L.color + '" opacity="0.3"/>'; });
    pm.forEach(function (m, i) { var v2 = mp[m]; if (v2 == null) return; s += '<rect x="' + (X(i) - 0.35 * bw).toFixed(1) + '" y="' + YB(v2).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + (B - YB(v2)).toFixed(1) + '" fill="' + L.color + '" fill-opacity="0.1" stroke="' + L.color + '" stroke-opacity="0.45" stroke-width="0.8"/>'; });
    if (lastI >= 0) items.push({ y: YB(mp[cm[lastI]]), t: fmt(mp[cm[lastI]]), n: L.short || L.label, c: L.color });
    else { var lp = -1; pm.forEach(function (m, i) { if (mp[m] != null) lp = i; }); if (lp >= 0) items.push({ y: YB(mp[pm[lp]]), t: fmt(mp[pm[lp]]), n: (L.short || L.label) + " (yr before)", c: L.color }); }
  });
  visL.concat(visR).forEach(function (L) {
    var Yl = L.right ? YB : Y;
    var mp = mapOf(L), dp = "", dc = "", pen = false, lastI = -1;
    // quarterly lines (for-sale starts) are flat steps across each month's slot
    var hs = (X(1) - X(0)) / 2, pt = function (i, v2) { var y = Yl(v2).toFixed(1); return L.quarterly ? (pen ? "L" : "M") + (X(i) - hs).toFixed(1) + "," + y + "L" + (X(i) + hs).toFixed(1) + "," + y : (pen ? "L" : "M") + X(i).toFixed(1) + "," + y; };
    pm.forEach(function (m, i) { var v2 = mp[m]; if (v2 == null) { pen = false; return; } dp += pt(i, v2); pen = true; });
    pen = false;
    cm.forEach(function (m, i) { var v2 = mp[m]; if (v2 == null) { pen = false; return; } dc += pt(i, v2); pen = true; lastI = i; });
    if (dp) s += '<path d="' + dp + '" fill="none" stroke="' + L.color + '" stroke-width="1.8" stroke-dasharray="2 4" stroke-linecap="round" opacity="0.9"/>';
    if (dc) s += '<path d="' + dc + '" fill="none" stroke="' + L.color + '" stroke-width="2.6" stroke-linejoin="round"/>';
    if (lastI >= 0) {
      var lm = cm[lastI], prelim = L.prelim && lm === L.pts[L.pts.length - 1].m;
      s += '<circle cx="' + X(lastI) + '" cy="' + Yl(mp[lm]) + '" r="3.4" fill="' + (prelim ? "#1C1C1E" : L.color) + '" stroke="' + L.color + '" stroke-width="2"/>';
      items.push({ y: Yl(mp[lm]), t: fmt(mp[lm]), n: L.short || L.label, c: L.color });
    } else {
      var lp2 = -1; pm.forEach(function (m, i) { if (mp[m] != null) lp2 = i; });
      if (lp2 >= 0) items.push({ y: Yl(mp[pm[lp2]]), t: fmt(mp[pm[lp2]]), n: (L.short || L.label) + " (yr before)", c: L.color });
    }
  });
  items.sort(function (a, b) { return a.y - b.y; });
  for (var k = 1; k < items.length; k++) if (items[k].y - items[k - 1].y < 25) items[k].y = items[k - 1].y + 25;
  var over = items.length ? items[items.length - 1].y - B : 0; if (over > 0) items.forEach(function (it) { it.y -= over; });
  items.forEach(function (it) { s += '<text x="' + LX + '" y="' + (it.y + 1) + '" font-size="12" font-weight="700" fill="' + it.c + '">' + it.t + '</text><text x="' + LX + '" y="' + (it.y + 12) + '" font-size="10" fill="' + it.c + '">' + esc(it.n.length > 14 ? it.n.slice(0, 13) + "…" : it.n) + "</text>"; });
  var slot = (X(11) - X(0)) / 11;
  FYM.forEach(function (m, i) { if (slot < 24 && (11 - i) % 2) return; s += '<text x="' + X(i) + '" y="' + (g.H - 6) + '" font-size="9.5" fill="#8E8E93" text-anchor="middle">' + m + "</text>"; });
  g.svg.innerHTML = s;
  g.svg.__g = { L: L0, R: R, pad: pad };
  // selected month for the chips: the tapped one, or the latest any line has
  selI = cur;
  if (selI == null) { selI = -1; D.lines.forEach(function (L) { var mp = mapOf(L); cm.forEach(function (m, i) { if (mp[m] != null && i > selI) selI = i; }); }); }
}
el("tov").addEventListener("click", function (e) {
  var g = el("ov").__g, r = el("ov").getBoundingClientRect(); if (!g) return;
  var i = Math.round((e.clientX - r.left - g.L) / (g.R - g.L) * (11 + 2 * (g.pad || 0)) - (g.pad || 0));
  cur = i >= 0 && i <= 11 && cur !== i ? i : null; renderOverlay(); renderLegend();
});

// ---- full history, one chart per line, all on the same dates ----
// Pinch any chart to zoom (down to 6 months), drag two fingers to pan, tap to
// read a month on every chart, double-tap to go back to the full history.
function mIdx(m) { return (+m.slice(0, 4)) * 12 + (+m.slice(5, 7)) - 1; }
function mStr(i) { var y = Math.floor(i / 12), mo = (i % 12) + 1; return y + "-" + (mo < 10 ? "0" : "") + mo; }
function span() { var a = Infinity, b = -Infinity; D.hist.forEach(function (L) { a = Math.min(a, mIdx(L.pts[0].m)); b = Math.max(b, mIdx(L.pts[L.pts.length - 1].m)); }); return { a: a, b: b }; }
var MIN_SPAN = 6;
function clampView(v) {
  var S = span(), w = Math.max(MIN_SPAN, Math.min(S.b - S.a, v.b - v.a));
  var a = Math.max(S.a, Math.min(S.b - w, v.a));
  return { a: a, b: a + w };
}
function hGeom(svg) { var r = svg.getBoundingClientRect(); return { W: r.width || 360, H: r.height || 150, L: 40, R: (r.width || 360) - 80 }; }
function renderHist() {
  if (!HV) HV = span();
  el("hist").innerHTML = D.hist.map(function (L, i) {
    return '<div class="ct" style="color:' + L.color + '">' + esc(L.label) + '</div><div class="desc">' + esc(L.src) + '</div><div class="ro" id="hr' + i + '"></div><div class="wrap"><svg class="hist" id="h' + i + '"></svg><div class="touch zoom" data-i="' + i + '"></div></div>';
  }).join("");
  drawAllHist();
  var ts = el("hist").querySelectorAll(".touch");
  for (var t = 0; t < ts.length; t++) bindZoom(ts[t]);
}
el("hist").addEventListener("click", function (e) {
  var t = e.target && e.target.closest ? e.target.closest(".rawtog") : null;
  if (!t) return;
  var key = "raw:" + t.getAttribute("data-k");
  hidden[key] = !hidden[key];
  drawAllHist();
});
function drawAllHist() {
  var a = mStr(Math.round(HV.a)), b = mStr(Math.round(HV.b)), S = span();
  el("hwin").textContent = mLabel(a) + " to " + mLabel(b) + (HV.a <= S.a && HV.b >= S.b ? " · full history" : "");
  D.hist.forEach(function (L, i) { drawHist(L, i); });
}
function bindZoom(t) {
  var start = null, lastTap = 0, tapStart = null;
  function px(e) { var r = t.getBoundingClientRect(); return e.clientX - r.left; }
  t.addEventListener("touchstart", function (e) {
    if (e.touches.length === 2) {
      e.preventDefault();
      var ci = +t.getAttribute("data-i") || 0, g = hGeom(el("h" + ci)), x1 = px(e.touches[0]), x2 = px(e.touches[1]);
      start = { d: Math.max(20, Math.abs(x2 - x1)), c: (x1 + x2) / 2, v: viewFor(ci), g: g };
      tapStart = null;
    } else if (e.touches.length === 1) tapStart = { x: px(e.touches[0]), y: e.touches[0].clientY, t: Date.now() };
  }, { passive: false });
  t.addEventListener("touchmove", function (e) {
    if (e.touches.length === 2 && start) {
      e.preventDefault();
      var x1 = px(e.touches[0]), x2 = px(e.touches[1]), d = Math.max(20, Math.abs(x2 - x1)), c = (x1 + x2) / 2;
      var g = start.g, w0 = start.v.b - start.v.a, w = w0 * start.d / d;
      var f = (start.c - g.L) / (g.R - g.L), anchor = start.v.a + f * w0;
      var fNow = (c - g.L) / (g.R - g.L);
      HV = clampView({ a: anchor - fNow * w, b: anchor - fNow * w + w });
      drawAllHist();
    } else if (tapStart && e.touches.length === 1 && Math.abs(e.touches[0].clientY - tapStart.y) > 10) tapStart = null;
  }, { passive: false });
  t.addEventListener("touchend", function (e) {
    if (e.touches.length < 2) start = null;
    if (tapStart && e.changedTouches.length === 1 && Date.now() - tapStart.t < 400) {
      var now = Date.now();
      if (now - lastTap < 320) { HV = span(); hcurM = null; lastTap = 0; drawAllHist(); }
      else { lastTap = now; pickMonth(tapStart.x, +t.getAttribute("data-i") || 0); }
      tapStart = null;
    }
  });
  t.addEventListener("click", function (e) { if (!("ontouchstart" in window)) pickMonth(px(e), +t.getAttribute("data-i") || 0); });
  t.addEventListener("gesturestart", function (e) { e.preventDefault(); });
}
function pickMonth(x, ci) {
  var g = hGeom(el("h" + (ci || 0))), f = (x - g.L) / (g.R - g.L), vw = viewFor(ci || 0);
  if (f < 0 || f > 1) { hcurM = null; drawAllHist(); return; }
  var m = mStr(Math.round(vw.a + f * (vw.b - vw.a)));
  hcurM = hcurM === m ? null : m;
  drawAllHist();
}
// Seasonal factors worked out by the widget (for series NAR doesn't adjust,
// i.e. inventory): each month against its centered 12-month average, averaged
// by calendar month over the years available, then normalized to average 1.
function seasonalAdjust(pts) {
  var mp = {}; pts.forEach(function (p) { mp[mIdx(p.m)] = p.v; });
  var sum = {}, cnt = {};
  pts.forEach(function (p) {
    var k = mIdx(p.m), ok = true, s = 0;
    for (var j = -6; j <= 6; j++) { if (mp[k + j] == null) { ok = false; break; } s += (Math.abs(j) === 6 ? 0.5 : 1) * mp[k + j]; }
    if (!ok) return;
    var mo = k % 12; sum[mo] = (sum[mo] || 0) + p.v / (s / 12); cnt[mo] = (cnt[mo] || 0) + 1;
  });
  var f = [], tot = 0, n = 0;
  for (var mo = 0; mo < 12; mo++) { f[mo] = cnt[mo] ? sum[mo] / cnt[mo] : null; if (f[mo]) { tot += f[mo]; n++; } }
  if (n < 12) return null; // not enough history yet to cover every month
  for (var m2 = 0; m2 < 12; m2++) f[m2] = f[m2] / (tot / n);
  return pts.map(function (p) { return { m: p.m, v: p.v / f[mIdx(p.m) % 12] }; });
}
// What a history chart draws: a thin line and a bold line, both {m, v} lists.
// Default: each month (thin) and its 12-month average (bold). histMode
// "rawAdj": the raw count (thin) and the seasonally adjusted value (bold).
function histSeries(L) {
  var hs = L.histScale || 1, sc = function (a) { return a.map(function (p) { return { m: p.m, v: p.v * hs }; }); };
  if (L.histMode === "rawAdj") {
    var thin = sc(L.raw && L.raw.length ? L.raw : L.pts);
    var bold = L.adjust === "widget" ? seasonalAdjust(thin) : sc(L.pts);
    return { thin: thin, bold: bold || [], thinName: "raw", boldName: L.adjust === "widget" ? (bold ? "adjusted*" : "") : "adjusted" };
  }
  var all = sc(L.pts), ma = [];
  all.forEach(function (p, k) { if (k < 11) return; var s2 = 0; for (var j = k - 11; j <= k; j++) s2 += all[j].v; ma.push({ m: p.m, v: s2 / 12 }); });
  return { thin: all, bold: ma, thinName: "", boldName: "12-mo avg" };
}
// ---- patterns for reference lines and PDF titles (refLines lines) ----
// Worked out from the line's bold history series (seasonally adjusted).
function boldOf(L) { var HS = histSeries(L); return HS.bold && HS.bold.length ? HS.bold : HS.thin; }
function refStats(L) {
  var b = boldOf(L); if (!b.length) return null;
  var last = b[b.length - 1], li = mIdx(last.m), five = b.filter(function (p) { return mIdx(p.m) > li - 60; });
  var s = 0; five.forEach(function (p) { s += p.v; });
  var pool = b.filter(function (p) { return p.m >= "2000-01"; }), low = pool[0], high = pool[0];
  pool.forEach(function (p) { if (p.v < low.v) low = p; if (p.v > high.v) high = p; });
  var lowerAt = null, higherAt = null;
  for (var k = b.length - 2; k >= 0 && (!lowerAt || !higherAt); k--) { if (!lowerAt && b[k].v <= last.v) lowerAt = b[k].m; if (!higherAt && b[k].v >= last.v) higherAt = b[k].m; }
  return { last: last, avg5: five.length >= 48 ? s / five.length : null, low: low, high: high, lowerAt: lowerAt, higherAt: higherAt, first: pool.length ? pool[0].m : b[0].m };
}
// "lowest since Aug 2010" when the last month as low is 2+ years back (or never)
function extremeText(st) {
  if (!st) return "";
  var li = mIdx(st.last.m), yr = st.first.slice(0, 4);
  if (!st.lowerAt) return "lowest in the data back to " + yr;
  if (li - mIdx(st.lowerAt) >= 24) return "lowest since " + mLabel(st.lowerAt);
  if (!st.higherAt) return "highest in the data back to " + yr;
  if (li - mIdx(st.higherAt) >= 24) return "highest since " + mLabel(st.higherAt);
  return "";
}
function lowName(st) { return st.first <= "2000-01" ? "Low since 2000" : "Low since " + st.first.slice(0, 4); }
function vsAvgText(st) { if (!st || !st.avg5) return ""; var d = (st.last.v / st.avg5 - 1) * 100; return Math.abs(d) < 1 ? "near its 5-year average" : Math.abs(d).toFixed(0) + "% " + (d < 0 ? "below" : "above") + " its 5-year average"; }
function drawHist(L, i) {
  var svg = el("h" + i), g = hGeom(svg), W = g.W, H = g.H, L0 = g.L, R = g.R, T = 8, B = H - 20;
  var HS = histSeries(L), all = HS.thin, bold = HS.bold, bmap = {}; bold.forEach(function (p) { bmap[p.m] = p.v; });
  var vw = viewFor(i), va = vw.a, vb = vw.b, X = function (mi) { return L0 + (mi - va) / Math.max(1, vb - va) * (R - L0); };
  var inV = function (p, pad) { var mi = mIdx(p.m); return mi >= va - pad && mi <= vb + pad; };
  // tapping "raw" in the readout hides the raw line, and the axis re-fits to the adjusted line
  var rawOff = !!(HS.thinName && hidden["raw:" + L.k] && bold.length);
  var vis = rawOff ? [] : all.filter(function (p) { return inV(p, 1); }), bvis = bold.filter(function (p) { return inV(p, 1); }), hi = 1, lo = Infinity;
  vis.concat(bold).forEach(function (p) { if (inV(p, 0)) { hi = Math.max(hi, p.v); lo = Math.min(lo, p.v); } });
  var base = 0, st;
  if (L.histZoom && isFinite(lo)) { var ZA = zoomAxis(lo, hi, 4); base = ZA.base; st = ZA.st; hi = ZA.top; }
  else { st = niceStep(hi * 1.05, 3); hi = Math.ceil(hi * 1.05 / st) * st; }
  var Y = function (v) { return B - (v - base) / (hi - base) * (B - T); };
  var s = '<defs><clipPath id="cp' + i + '"><rect x="' + L0 + '" y="0" width="' + (R - L0) + '" height="' + H + '"/></clipPath></defs>';
  if (base > 0) s += '<path d="M' + (L0 - 1) + "," + (B - 9) + "l-4,-3l4,-3M" + (L0 - 1) + "," + (B - 4) + "l-4,-3l4,-3" + '" fill="none" stroke="#8E8E93" stroke-width="1.2"/>';
  for (var v = base; v <= hi + st / 2; v += st) s += '<line x1="' + L0 + '" x2="' + R + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="#3A3A3C"/><text x="' + (L0 - 4) + '" y="' + (Y(v) + 3.5) + '" font-size="10" fill="#8E8E93" text-anchor="end">' + axis(v) + "</text>";
  // reference lines: 5-year average (dashed) and the low since 2000 (dotted);
  // one that falls outside the zoomed view is noted at the chart's edge instead
  var ST = L.refLines ? refStats(L) : null, rt = "";
  if (ST) {
    [ST.avg5 ? { v: ST.avg5, t: "5-yr avg " + fmt(ST.avg5), d: "6 4" } : null, { v: ST.low.v, t: lowName(ST) + " " + fmt(ST.low.v) + " (" + MON[+ST.low.m.slice(5, 7) - 1] + " " + ST.low.m.slice(0, 4) + ")", d: "1.5 3" }].forEach(function (r) {
      if (!r) return;
      if (r.v >= base && r.v <= hi) { s += '<line x1="' + L0 + '" x2="' + R + '" y1="' + Y(r.v).toFixed(1) + '" y2="' + Y(r.v).toFixed(1) + '" stroke="#E5E5EA" stroke-opacity="0.75" stroke-width="1.2" stroke-dasharray="' + r.d + '"/>'; rt += '<text x="' + (L0 + 4) + '" y="' + (Y(r.v) - 4).toFixed(1) + '" font-size="9.5" fill="#E5E5EA" stroke="#1C1C1E" stroke-width="3" paint-order="stroke" opacity="0.9">' + esc(r.t) + "</text>"; }
      else rt += '<text x="' + (L0 + 4) + '" y="' + (r.v < base ? B - 4 : T + 10) + '" font-size="9.5" fill="#E5E5EA" opacity="0.7">' + (r.v < base ? "↓ " : "↑ ") + esc(r.t) + "</text>";
    });
  }
  // a gap in the months breaks the line instead of drawing across it
  var path = function (arr) { var d = "", prev = null; arr.forEach(function (p) { var mi = mIdx(p.m); d += (prev != null && mi === prev + 1 ? "L" : "M") + X(mi).toFixed(1) + "," + Y(p.v).toFixed(1); prev = mi; }); return d; };
  var few = vb - va <= 36;
  s += '<g clip-path="url(#cp' + i + ')"><path d="' + path(vis) + '" fill="none" stroke="' + L.color + '" stroke-width="' + (few ? 1.8 : 1) + '" opacity="' + (few ? 0.8 : 0.45) + '"/><path d="' + path(bvis) + '" fill="none" stroke="' + L.color + '" stroke-width="2.4" stroke-linejoin="round"/>';
  if (vb - va <= 30) vis.forEach(function (p) { s += '<circle cx="' + X(mIdx(p.m)).toFixed(1) + '" cy="' + Y(p.v).toFixed(1) + '" r="2.4" fill="' + L.color + '"/>'; });
  s += "</g>" + rt;
  if (!vis.length && !bvis.length) s += '<text x="' + ((L0 + R) / 2) + '" y="' + ((T + B) / 2) + '" font-size="11.5" fill="#8E8E93" text-anchor="middle">' + esc(L.label) + " data starts " + mLabel(all[0].m) + "</text>";
  // right label: the bold line at the right edge of the view
  var lb = null; bvis.forEach(function (p) { if (mIdx(p.m) <= vb) lb = p; });
  if (lb && HS.boldName) {
    // "low since" / "Aug ’10" under the value when the latest month is a multi-year extreme
    var ex = ST && lb.m === ST.last.m ? extremeText(ST) : "", tag1 = "", tag2 = "";
    if (ex.indexOf("since ") > 0) { tag1 = ex.split(" since ")[0].replace("lowest", "low").replace("highest", "high") + " since"; tag2 = ex.split(" since ")[1].replace(/ (19|20)([0-9][0-9])$/, " ’$2"); }
    else if (ex) { tag1 = ex.indexOf("lowest") === 0 ? "record low" : "record high"; }
    s += '<text x="' + (R + 7) + '" y="' + (Y(lb.v) + 1) + '" font-size="12" font-weight="700" fill="' + L.color + '">' + fmt(lb.v) + '</text><text x="' + (R + 7) + '" y="' + (Y(lb.v) + 12) + '" font-size="10" fill="' + L.color + '">' + HS.boldName + "</text>" + (tag1 ? '<text x="' + (R + 7) + '" y="' + (Y(lb.v) + 23) + '" font-size="10" fill="' + L.color + '" opacity="0.85">' + esc(tag1) + "</text>" : "") + (tag2 ? '<text x="' + (R + 7) + '" y="' + (Y(lb.v) + 34) + '" font-size="10" fill="' + L.color + '" opacity="0.85">' + esc(tag2) + "</text>" : "");
  }
  // date ticks: years, or months when zoomed in
  var spanM = vb - va;
  if (spanM > 30) {
    var yrs = spanM / 12, step = yrs > 40 ? 10 : yrs > 16 ? 4 : yrs > 6 ? 2 : 1;
    for (var y = Math.ceil(mStr(Math.ceil(va)).slice(0, 4) / step) * step; y * 12 <= vb; y += step) { var xi = y * 12; if (xi >= va) s += '<text x="' + X(xi) + '" y="' + (H - 4) + '" font-size="9.5" fill="#8E8E93" text-anchor="middle">' + y + "</text>"; }
  } else {
    var every = spanM > 15 ? 3 : spanM > 8 ? 2 : 1;
    for (var mi2 = Math.ceil(va); mi2 <= vb; mi2++) { if ((mi2 % 12) % every) continue; var ms = mStr(mi2); s += '<text x="' + X(mi2) + '" y="' + (H - 4) + '" font-size="9.5" fill="#8E8E93" text-anchor="middle">' + MON[+ms.slice(5, 7) - 1] + (ms.slice(5, 7) === "01" || mi2 === Math.ceil(va) ? " ’" + ms.slice(2, 4) : "") + "</text>"; }
  }
  var showM = hcurM;
  if (showM) s += '<line x1="' + X(mIdx(showM)) + '" x2="' + X(mIdx(showM)) + '" y1="' + T + '" y2="' + B + '" stroke="#FFFFFF" stroke-dasharray="3 3"/>';
  svg.innerHTML = s;
  // readout: the tapped month, or the latest month in view
  var tmap = {}; all.forEach(function (p) { tmap[p.m] = p.v; });
  var m3 = showM;
  if (!m3) { var lt = null; vis.concat(bvis).forEach(function (p) { if (mIdx(p.m) <= vb && (!lt || p.m > lt)) lt = p.m; }); m3 = lt; }
  var ro = el("hr" + i);
  if (!m3) { ro.innerHTML = ""; return; }
  var tv = tmap[m3], bv = bmap[m3], seed = L.seedThrough && m3 <= L.seedThrough ? ' <span style="color:#98989F">(seed)</span>' : "";
  if (HS.thinName) ro.innerHTML = mLabel(m3) + ': <span class="rawtog" data-k="' + L.k + '">' + (rawOff ? "raw hidden (tap to show)" : "raw " + (tv != null ? fmt(tv) : "–")) + "</span>" + (HS.boldName ? ' · <span style="color:#98989F">' + HS.boldName + " " + (bv != null ? fmt(bv) : "–") + "</span>" : "") + seed;
  else ro.innerHTML = mLabel(m3) + ": " + (tv != null ? fmt(tv) : "–") + (L.histUnit ? " " + L.histUnit : "") + seed + (bv != null ? ' · <span style="color:#98989F">12-mo avg ' + fmt(bv) + "</span>" : "") + (L.prelim && m3 === all[all.length - 1].m ? ' <span class="warn">preliminary</span>' : "");
}

function renderAll() {
  el("headline").textContent = ""; el("headline").style.display = "none";
  renderOverlay(); renderLegend();
}
window.update = function (d) {
  if (!d) return;
  var first = !inited; inited = true;
  D = d;
  if (first && D.hidden) { hidden = {}; for (var hk in D.hidden) if (D.hidden[hk]) hidden[hk] = true; }
  if (!D.hist) D.hist = D.lines;
  D.lines.concat(D.hist).forEach(function (L) { L.__map = null; });
  el("ttl").textContent = D.title;
  el("errs").textContent = D.errors ? "Couldn't refresh: " + D.errors.join(" · ") + " (showing the last good copy)" : "";
  el("note").textContent = D.note + " Data through " + mLabel(D.latest) + " · checked " + D.checked + ".";
  if (HV) HV = clampView(HV);
  renderAll(); renderHist();
  window.__rendered = true;
};
window.__hidden = function () { var o = {}; for (var hk in hidden) if (hidden[hk]) o[hk] = true; return o; };
window.shareInfo = function () { return { title: D ? D.title : "", name: "", asOf: D ? mLabel(D.latest) : "" }; };
window.addEventListener("resize", function () { if (D) { renderOverlay(); drawAllHist(); } });
// Share as PDF: 16:9 slides. 1) The trailing-12-month chart on its own
// (the last 12 months solid, the same months a year earlier dotted, bar lines on a right-hand axis
// with last year's bar faint in front; hidden lines left out). Then each
// line's history, two per slide, over the dates zoomed to on screen (each
// month and its 12-month average).
// Headline states the result; captions say what each chart shows; labels sit at
// the right edge; a dark banner credits the sources. Vector.
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
  function rgb(hex) { return [1, 3, 5].map(function (i) { return parseInt(hex.slice(i, i + 2), 16); }); }
  function ink(L) { return rgb(L.print); }
  function font(bold, size, c) { doc.setFont(FACE, bold ? "bold" : "normal"); doc.setFontSize(size); doc.setTextColor(c[0], c[1], c[2]); }
  function clean(t) { return String(t).split("−").join("-").split("’").join("'").split("–").join("-").split("…").join("...").split("▲ ").join("").split("▼ ").join(""); }
  function headline(text) {
    var size = 21, lines;
    do { font(true, size, INK); lines = doc.splitTextToSize(clean(text), W - 72); size -= 1; } while (lines.length > 1 && size > 15);
    if (lines.length > 2) lines = [lines[0], lines.slice(1).join(" ")];
    doc.text(lines, 36, 42);
    return 42 + (lines.length - 1) * (size + 4);
  }
  function titles(top, title, sub, cx) { font(true, 11.5, INK); doc.text(clean(title), cx, top + 28, { align: "center" }); font(false, 9, GRY); doc.text(clean(sub), cx, top + 41, { align: "center" }); }
  function caption(text, x0, x1, y, max) { font(false, 8.4, GRY); doc.text(doc.splitTextToSize(clean(text), x1 - x0).slice(0, max || 4), x0, y); }
  function labels(items, x, B) {
    items.sort(function (a, b) { return a.y - b.y; });
    for (var k = 1; k < items.length; k++) if (items[k].y - items[k - 1].y < 22) items[k].y = items[k - 1].y + 22;
    var over = items.length ? items[items.length - 1].y - B : 0; if (over > 0) items.forEach(function (it) { it.y -= over; });
    items.forEach(function (it) { font(true, 9.5, it.c); doc.text(clean(it.t), x, it.y + 2); font(false, 8, it.c); doc.text(clean(it.n), x, it.y + 11); });
  }
  var NH = Math.ceil(D.hist.length / 2), PAGES = 1 + NH;
  function banner(page) {
    var bh = 44, by = H - bh;
    doc.setFillColor(28, 28, 30); doc.rect(0, by, W, bh, "F");
    doc.setFillColor(201, 162, 39); doc.rect(W - 176, by + 6, 2, bh - 12, "F");
    font(false, 7.2, [235, 235, 240]); doc.text(doc.splitTextToSize(clean(D.sources), W - 176 - 40 - 110).slice(0, 4), 28, by + 11);
    font(false, 7.5, [200, 200, 205]); doc.text("Data through " + mLabel(D.latest), W - 188, by + 20, { align: "right" }); doc.text(page + " of " + PAGES + " · trailing 12 months", W - 188, by + 31, { align: "right" });
    font(true, 12.5, [255, 255, 255]); doc.text(D.banner[0], W - 162, by + 20); doc.text(D.banner[1], W - 162, by + 34);
  }
  // ---- slide 1: the year-over-year chart on its own ----
  var top = headline(headlineText());
  var L0 = 70, R = W - 150, T = top + 58, B = H - 150, cm = fyMonths(FY), pm = fyMonths(FY - 1), FYM = winM(FY);
  var vis = D.lines.filter(function (L) { return !hidden[L.k]; });
  var visL = vis.filter(function (L) { return !L.bar && !L.right; }), visB = vis.filter(function (L) { return L.bar; }), visR = vis.filter(function (L) { return L.right && !L.bar; }), visA = visB.concat(visR);
  var hasBar = D.lines.some(function (L) { return L.bar; }), pad = hasBar ? 0.5 : 0, hi = 1, hiB = 1;
  visL.forEach(function (L) { var mp = mapOf(L); cm.concat(pm).forEach(function (m) { if (mp[m] != null) hi = Math.max(hi, mp[m]); }); });
  visA.forEach(function (L) { var mp = mapOf(L); cm.concat(pm).forEach(function (m) { if (mp[m] != null) hiB = Math.max(hiB, mp[m]); }); });
  var st = niceStep(hi * 1.05, 5), nSt = Math.ceil(hi * 1.05 / st); hi = nSt * st;
  if (!visL.length) { st = niceStep(hiB * 1.05, 5); nSt = Math.ceil(hiB * 1.05 / st); hi = nSt * st; }
  var BA = barAxis(visA, cm, pm, nSt), stB = BA.step, baseL = 0;
  if (visL.length && visA.length) { nSt = 5; var FA = fitAxis(rangeOf(visL, cm, pm), nSt, 0.2, 0.92); baseL = FA.base; st = FA.step; hi = FA.top; BA = fitAxis(rangeOf(visA, cm, pm), nSt, 0.2, 0.92); stB = BA.step; }
  var X = function (i) { return L0 + (i + pad) / (11 + 2 * pad) * (R - L0); }, Y = function (v) { return B - (v - baseL) / (hi - baseL) * (B - T); }, YB = function (v) { return B - (v - BA.base) / (BA.top - BA.base) * (B - T); };
  titles(top, "Last 12 Months vs the Year Before, Homes per Month", "Lines: " + fySpan(FY) + " solid, the same months a year earlier dotted" + (vis.some(function (L) { return L.quarterly; }) ? " · steps: quarterly, per month" : "") + (visR.length ? " · " + visR.map(function (L) { return L.short; }).join(", ") + " on the right axis" : "") + (visB.length ? " · bars: " + visB.map(function (L) { return L.short; }).join(", ") + " (right axis), last year faint in front" : ""), (L0 + R) / 2);
  for (var q = 0; q <= nSt; q++) {
    doc.setDrawColor(RULE[0], RULE[1], RULE[2]); doc.setLineWidth(0.5); doc.line(L0, Y(baseL + q * st), R, Y(baseL + q * st));
    if (visL.length) { font(false, 8, GRY); doc.text(axis(baseL + q * st), L0 - 5, Y(baseL + q * st) + 3, { align: "right" }); }
    if (visA.length) { font(false, 8, ink(visA[0])); doc.text(axis(BA.base + q * stB), R + 5, Y(baseL + q * st) + 3); }
  }
  if (visL.length && baseL > 0) { doc.setDrawColor(GRY[0], GRY[1], GRY[2]); doc.setLineWidth(0.9); doc.lines([[-4, -3], [4, -3]], L0 - 1, B - 3); doc.lines([[-4, -3], [4, -3]], L0 - 1, B - 8); }
  if (visA.length && BA.base > 0) { var bc = ink(visA[0]); doc.setDrawColor(bc[0], bc[1], bc[2]); doc.setLineWidth(0.9); doc.lines([[4, -3], [-4, -3]], R + 1, B - 3); doc.lines([[4, -3], [-4, -3]], R + 1, B - 8); }
  var items = [], bw = (R - L0) / 12 * 0.56;
  visB.forEach(function (L) {
    // see-through bars like the phone: this year about 35% color, last year a
    // faint tint with a thin outline in front (falls back to an outline only
    // if this PDF library has no transparency)
    var mp = mapOf(L), c = ink(L), last = -1, GS = doc.GState ? function (o) { doc.setGState(new doc.GState({ opacity: o, "stroke-opacity": Math.min(1, o * 3) })); } : null;
    doc.setFillColor(c[0], c[1], c[2]);
    if (GS) GS(0.35);
    cm.forEach(function (m, i) { if (mp[m] == null) return; last = i; doc.rect(X(i) - 0.65 * bw, YB(mp[m]), bw, B - YB(mp[m]), GS ? "F" : "F"); });
    if (GS) GS(0.12);
    doc.setDrawColor(c[0], c[1], c[2]); doc.setLineWidth(0.7);
    pm.forEach(function (m, i) { if (mp[m] == null) return; doc.rect(X(i) - 0.35 * bw, YB(mp[m]), bw, B - YB(mp[m]), GS ? "FD" : "D"); });
    if (GS) doc.setGState(new doc.GState({ opacity: 1, "stroke-opacity": 1 }));
    var cc = cmp(L, FY), tail = cc && cc.pct != null ? " · " + pct(cc.pct) + " y/y" : "";
    if (last >= 0) items.push({ y: YB(mp[cm[last]]), t: fmt(mp[cm[last]]), n: (L.short || L.label) + tail, c: c });
  });
  visL.concat(visR).forEach(function (L) {
    var Yl = L.right ? YB : Y;
    var mp = mapOf(L), c = ink(L), last = -1;
    doc.setDrawColor(c[0], c[1], c[2]);
    doc.setLineWidth(1.4); doc.setLineDashPattern([2, 3], 0);
    var hs = (X(1) - X(0)) / 2;
    var draw = function (ms) {
      if (!L.quarterly) { for (var i = 1; i < 12; i++) if (mp[ms[i - 1]] != null && mp[ms[i]] != null) doc.line(X(i - 1), Yl(mp[ms[i - 1]]), X(i), Yl(mp[ms[i]])); return; }
      for (var i2 = 0; i2 < 12; i2++) { if (mp[ms[i2]] == null) continue; doc.line(X(i2) - hs, Yl(mp[ms[i2]]), X(i2) + hs, Yl(mp[ms[i2]])); if (i2 < 11 && mp[ms[i2 + 1]] != null && mp[ms[i2 + 1]] !== mp[ms[i2]]) doc.line(X(i2) + hs, Yl(mp[ms[i2]]), X(i2) + hs, Yl(mp[ms[i2 + 1]])); }
    };
    draw(pm);
    doc.setLineDashPattern([], 0); doc.setLineWidth(2.6);
    draw(cm);
    cm.forEach(function (m, i2) { if (mp[m] != null) last = i2; });
    var cc = cmp(L, FY), tail = cc && cc.pct != null ? " · " + pct(cc.pct) + " y/y" : "";
    if (last >= 0) { doc.setFillColor(c[0], c[1], c[2]); doc.circle(X(last), Yl(mp[cm[last]]), 2.6, "F"); items.push({ y: Yl(mp[cm[last]]), t: fmt(mp[cm[last]]), n: (L.short || L.label) + tail, c: c }); }
  });
  labels(items, R + (visA.length ? 38 : 10), B);
  FYM.forEach(function (m, i) { font(false, 8.5, GRY); doc.text(m, X(i), B + 12, { align: "center" }); });
  var cap = vis.map(function (L) { var c = cmp(L, FY); return c && c.pct != null ? L.label + " " + (L.stock ? "averaged " : "totaled ") + fmt(c.cur) + " (" + pct(c.pct) + " vs the year before" + (partial(c) ? ", " + partial(c) : "") + ")" : L.label + ": no data in the last 12 months"; }).join("; ");
  caption(cap + "." + (visB.length ? " Bars use the right-hand axis; with bars shown, both axes are zoomed to their data (not from zero, marked by the zigzags)." : visR.length && visL.length ? " " + visR.map(function (L) { return L.short; }).join(", ") + " uses the right-hand axis; both axes are zoomed to their data (not from zero, marked by the zigzags)." : "") + " Labels show the latest month and the change vs the year before.", L0 - 34, W - 40, H - 122, 3);
  font(false, 7, [140, 140, 145]); doc.text(doc.splitTextToSize(clean(D.note), W - 40 - (L0 - 34)).slice(0, 6), L0 - 34, H - 93, { lineHeightFactor: 1.12 });
  banner(1);
  // ---- then the history charts, two per slide, on the dates zoomed to on screen ----
  var S = span(), va = HV ? HV.a : S.a, vb = HV ? HV.b : S.b, full = va <= S.a && vb >= S.b;
  var win = mLabel(mStr(Math.round(va))) + " to " + mLabel(mStr(Math.round(vb)));
  // the bold line's value at the right edge of the view (12-month average, or seasonally adjusted)
  function lastBold(L) { var HS = histSeries(L), vw = viewFor(D.hist.indexOf(L)), lb = null; HS.bold.forEach(function (p) { if (mIdx(p.m) <= vw.b) lb = p; }); return lb ? { v: lb.v, n: HS.boldName } : null; }
  for (var pg = 0; pg < NH; pg++) {
    doc.addPage([W, H], "landscape");
    var grp = D.hist.slice(pg * 2, pg * 2 + 2);
    var kinds = grp.map(function (L) { return histSeries(L).boldName; });
    var heads = grp.map(function (L) { var b0 = lastBold(L); return b0 && b0.n ? (L.short || L.label) + " " + fmt(b0.v) : null; }).filter(Boolean);
    var allAvg = kinds.every(function (k) { return k === "12-mo avg"; });
    var refG = grp.filter(function (L) { return L.refLines; });
    if (refG.length) top = headline(titleCase(refG.map(function (L) { var st = refStats(L); if (!st) return ""; var bits = [extremeText(st), vsAvgText(st)].filter(Boolean); return L.short + " " + fmt(st.last.v * (L.headScale || 1)) + (L.headUnit ? " " + L.headUnit : "") + (L.adjust === "widget" ? " seasonally adjusted" : "") + (bits.length ? ", " + bits.join(" and ") : ""); }).filter(Boolean).join("; ")));
    else top = headline((full ? "Full History" : win) + ": " + (allAvg ? "12-Month Averages " : "Seasonally Adjusted ") + heads.join(", "));
    var n = grp.length, gap = 60, x0 = 66, x1 = W - 30, cw = (x1 - x0 - gap * (n - 1)) / n;
    grp.forEach(function (L, i) {
      var vw = viewFor(D.hist.indexOf(L)), va = vw.a, vb = vw.b, HS = histSeries(L);
      var cL = x0 + i * (cw + gap), cR = cL + cw - 64, cT = top + 62, cB = H - 124, c = ink(L), light = c.map(function (x) { return Math.round(x + (255 - x) * 0.6); });
      var inV = function (p) { var mi = mIdx(p.m); return mi >= va && mi <= vb; };
      var rawOff = !!(HS.thinName && hidden["raw:" + L.k] && HS.bold.length);
      var tv = rawOff ? [] : HS.thin.filter(inV), bv = HS.bold.filter(inV);
      var h2 = 1, l2 = Infinity, b2 = 0, s4; tv.concat(bv).forEach(function (p) { h2 = Math.max(h2, p.v); l2 = Math.min(l2, p.v); });
      if (L.histZoom && isFinite(l2)) { var ZA = zoomAxis(l2, h2, 4); b2 = ZA.base; s4 = ZA.st; h2 = ZA.top; }
      else { s4 = niceStep(h2 * 1.05, 4); h2 = Math.ceil(h2 * 1.05 / s4) * s4; }
      var XX = function (mi) { return cL + (mi - va) / Math.max(1, vb - va) * (cR - cL); }, YY = function (v4) { return cB - (v4 - b2) / (h2 - b2) * (cB - cT); };
      if (b2 > 0) { doc.setDrawColor(GRY[0], GRY[1], GRY[2]); doc.setLineWidth(0.9); doc.lines([[-4, -3], [4, -3]], cL - 1, cB - 3); doc.lines([[-4, -3], [4, -3]], cL - 1, cB - 8); }
      var first = [HS.thin[0], HS.bold[0], L.pts[0]].filter(Boolean).map(function (p) { return p.m; }).sort()[0];
      font(true, 11.5, c); doc.text(clean(L.label), (cL + cR) / 2, top + 28, { align: "center" });
      font(false, 8.5, GRY); doc.text(clean("Since " + first.slice(0, 4) + (L.histUnit ? " · " + L.histUnit : "") + (HS.thinName && rawOff ? " · seasonally adjusted" + (L.adjust === "widget" ? " (by the widget)" : "") + "; raw count hidden" : HS.thinName ? " · light: raw count · bold: seasonally adjusted" + (L.adjust === "widget" ? " (by the widget)" : "") : " · light: each month · bold: 12-month average")), (cL + cR) / 2, top + 41, { align: "center" });
      for (var v5 = b2; v5 <= h2 + s4 / 2; v5 += s4) { doc.setDrawColor(RULE[0], RULE[1], RULE[2]); doc.setLineWidth(0.5); doc.line(cL, YY(v5), cR, YY(v5)); font(false, 8, GRY); doc.text(axis(v5), cL - 4, YY(v5) + 3, { align: "right" }); }
      var ST = L.refLines ? refStats(L) : null, refCap = "", refLbl = [];
      if (ST) {
        [ST.avg5 ? { v: ST.avg5, t: "5-yr avg " + fmt(ST.avg5), d: [4, 3] } : null, { v: ST.low.v, t: lowName(ST) + " " + fmt(ST.low.v) + " (" + MON[+ST.low.m.slice(5, 7) - 1] + " " + ST.low.m.slice(0, 4) + ")", d: [1, 2] }].forEach(function (r) {
          if (!r) return;
          if (r.v >= b2 && r.v <= h2) { doc.setDrawColor(90, 90, 95); doc.setLineWidth(0.8); doc.setLineDashPattern(r.d, 0); doc.line(cL, YY(r.v), cR, YY(r.v)); doc.setLineDashPattern([], 0); refLbl.push(r); }
          else { font(false, 7.5, [120, 120, 125]); doc.text(clean((r.v < b2 ? "(below) " : "(above) ") + r.t), cL + 3, r.v < b2 ? cB - 3 : cT + 8); }
        });
        refCap = " Dashed: 5-year average" + (ST.avg5 ? " (" + fmt(ST.avg5) + ")" : "") + "; dotted: " + lowName(ST).toLowerCase() + " (" + fmt(ST.low.v) + ", " + mLabel(ST.low.m) + "). " + (extremeText(ST) ? "The latest month is the " + extremeText(ST) + ". " : "");
      }
      // consecutive months joined; a gap in the months breaks the line
      var drawRun = function (arr) { for (var k = 1; k < arr.length; k++) if (mIdx(arr[k].m) === mIdx(arr[k - 1].m) + 1) doc.line(XX(mIdx(arr[k - 1].m)), YY(arr[k - 1].v), XX(mIdx(arr[k].m)), YY(arr[k].v)); };
      doc.setDrawColor(light[0], light[1], light[2]); doc.setLineWidth(vb - va <= 36 ? 1.2 : 0.55); drawRun(tv);
      if (vb - va <= 30) { doc.setFillColor(light[0], light[1], light[2]); tv.forEach(function (p) { doc.circle(XX(mIdx(p.m)), YY(p.v), 1.5, "F"); }); }
      doc.setDrawColor(c[0], c[1], c[2]); doc.setLineWidth(2); drawRun(bv);
      // reference labels on top of the data, on a white patch
      refLbl.forEach(function (r) { font(false, 7.5, [90, 90, 95]); var tw = doc.getTextWidth(clean(r.t)); doc.setFillColor(255, 255, 255); doc.rect(cL + 2, YY(r.v) - 10, tw + 3, 8.5, "F"); doc.text(clean(r.t), cL + 3, YY(r.v) - 3); });
      var lb = bv.length ? bv[bv.length - 1] : null;
      if (lb && HS.boldName) labels([{ y: YY(lb.v), t: fmt(lb.v), n: HS.boldName, c: c }], cR + 6, cB);
      if (!tv.length && !bv.length) { font(false, 9, GRY); doc.text("Data starts " + mLabel(first), (cL + cR) / 2, (cT + cB) / 2, { align: "center" }); }
      var spanM = vb - va, wide = cR - cL > 400;
      if (spanM > 48) { var yrs = spanM / 12, step = yrs > 40 ? (wide ? 5 : 10) : yrs > 16 ? (wide ? 2 : 4) : yrs > 6 ? (wide ? 1 : 2) : 1; for (var y = Math.ceil(va / 12 / step) * step; y * 12 <= vb; y += step) { font(false, 8, GRY); doc.text(String(y), XX(y * 12), cB + 11, { align: "center" }); } }
      else { var every = spanM > 24 ? (wide ? 3 : 6) : spanM > 12 ? (wide ? 2 : 3) : wide ? 1 : 2; for (var mi3 = Math.ceil(va); mi3 <= vb; mi3++) { if ((mi3 % 12) % every) continue; var ms3 = mStr(mi3); font(false, 8, GRY); doc.text(MON[+ms3.slice(5, 7) - 1] + (ms3.slice(5, 7) === "01" || mi3 - Math.ceil(va) < every ? " '" + ms3.slice(2, 4) : ""), XX(mi3), cB + 11, { align: "center" }); } }
      caption((refCap ? refCap.trim() + " " : "") + L.histCaption + " Source: " + L.src + ".", cL - 30, cR + 58, H - 100, 5);
    });
    banner(2 + pg);
  }
  return doc;
};

if (D) window.update(D); else el("headline").textContent = "Loading the data… the first time takes a few seconds.";
</script>
</body>
</html>`;


// ---------- Run ----------
function payload(s) {
  const mapL = (L) => ({
    k: L.k, label: L.label, short: L.short, head: L.head, color: L.color, print: L.print, upGood: L.upGood,
    stock: !!L.stock, prelim: !!L.prelim, bar: !!L.bar, right: !!L.right, refLines: !!L.refLines, headScale: L.headScale || 1, headUnit: L.headUnit || "", quarterly: !!L.quarterly, histScale: L.histScale || 1, histZoom: !!L.histZoom, histUnit: L.histUnit || "", ownSpan: !!L.ownSpan, seedThrough: L.seed ? L.seed[L.seed.length - 1][0] : "", src: L.src, histCaption: L.histCaption, pts: s.lines[L.k],
    histMode: L.histMode || "", adjust: L.adjust || "", raw: L.raw ? s.lines[L.k + "Raw"] || [] : null,
  });
  const have = CFG.lines.filter((L) => s.lines[L.k] && s.lines[L.k].length);
  return {
    title: CFG.title, sub: CFG.sub, banner: CFG.banner, sources: CFG.sources, note: CFG.note, lead: CFG.lead,
    latest: latestMonth(s),
    // lines: the top chart, chips and headline; hist: the history charts
    // (histOnly lines appear only below, noHist lines only on top)
    lines: have.filter((L) => !L.histOnly).map(mapL),
    hist: have.filter((L) => !L.noHist).map(mapL),
    errors: s.errors || null,
    hidden: readJSON(legendFile()) || {},
    checked: s.checked ? new Date(s.checked).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "",
  };
}
async function openFullScreen(saved) {
  const wv = updWV(new WebView());
  const html = PAGE_HTML.replace("__DATA__", () => JSON.stringify(saved ? payload(saved) : null)).replace("__SHARE__", () => "<script>" + SHARE_PAGE_JS + "</script>");
  await wv.loadHTML(...updArgs(html));
  // the legend's on/off choices are saved so the widget face draws the same lines
  let legend = JSON.stringify(readJSON(legendFile()) || {});
  const watchLegend = async (isOpen) => {
    while (isOpen()) {
      await sleep(800);
      try {
        const h = await wv.evaluateJavaScript("JSON.stringify(window.__hidden ? window.__hidden() : null)");
        if (h && h !== "null" && h !== legend) { legend = h; writeJSON(legendFile(), JSON.parse(h)); }
      } catch (e) {}
    }
  };
  await presentWithSharing(wv, async (isOpen) => {
    const load = (async () => {
      try {
        const fresh = await refresh(saved, false, true);
        if (fresh !== saved && isOpen()) await wv.evaluateJavaScript(`window.update(${JSON.stringify(payload(fresh))});0`);
      } catch (e) {
        if (!saved) { try { await wv.evaluateJavaScript(`document.getElementById("headline").textContent = ${JSON.stringify("Couldn't load the data: " + (e.message || e))};0`); } catch (e2) {} }
      }
    })();
    await Promise.all([load, watchLegend(isOpen)]);
  });
}
if (config.runsInWidget || PREVIEW_WIDGET_IN_APP) {
  let widget;
  try {
    let s = readJSON(CFG.file);
    if (!s || hoursSince(s.checked) >= REFRESH_HOURS || missingLine(s)) {
      const fresh = await Promise.race([refresh(s, false, false).catch(() => null), sleep(WIDGET_SECONDS * 1000).then(() => null)]);
      if (fresh) s = fresh;
    }
    if (!s || !s.lines) throw new Error("Couldn't load the data yet. Open the script once in Scriptable.");
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
  const s = readJSON(CFG.file);
  await openFullScreen(s && s.lines ? s : null);
}
Script.complete();
