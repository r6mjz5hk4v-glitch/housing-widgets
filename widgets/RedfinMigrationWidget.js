// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: deep-blue; icon-glyph: route;

// ---- Shared settings (saved on this phone by the Setup script) ----
// Keys and personal settings live in the phone's keychain, not in this file,
// so the file can be shared as is.
function setting(key, fallback) {
  try { if (Keychain.contains(key)) { const v = Keychain.get(key); if (v) return v; } } catch (e) {}
  return fallback;
}


// Redfin Migration for Scriptable
// Where house hunters want to move, from Redfin's U.S. Migration Patterns
// dashboard: Redfin.com users who looked at 20+ homes for sale or rent in a
// metro (combined statistical area) other than their own in a month, summed
// over rolling 3-month windows. Inflow = searchers from elsewhere looking at
// the metro; outflow = locals looking elsewhere; net = the difference. It's
// intent to move, about a quarter old, for about 50 of the biggest metros;
// separate from the Census widget, which counts actual moves a year or more
// later. Same data files Redfin's own dashboard reads; no key.
// Small widget: the top 3 metros drawing and losing house hunters, latest
// period. Tap for the full screen: period, map, leaderboard, any metro's
// inflow / outflow / net over time and where its searchers come from and look.
// Share as PDF: three 16:9 slides.
// Updates itself: Redfin refreshes the files quarterly; the app checks daily
// for a new copy and keeps the last good one if anything fails.

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
const AGG_URL = "https://redfin-public-data.s3.us-west-2.amazonaws.com/redfin_html_public_dashboards/migration_traffic/migration_traffic_aggregated.csv.gz";
const OD_URL = "https://redfin-public-data.s3.us-west-2.amazonaws.com/redfin_html_public_dashboards/migration_traffic/migration_traffic_od_pairs.csv.gz";
const PAGE_URL = "https://www.redfin.com/news/data-center/migration-patterns/";
const STORE_FILE = "redfin-migration-v1.json";
const FACE_FILE = "redfin-migration-face-v1.json";
const CHECK_HOURS = 24;        // the app looks for a new copy this often
const WIDGET_CHECK_DAYS = 3;   // the widget peeks (headers only) this often
const DEFAULT_METRO = setting("home_metro", "Austin, TX");
const PREVIEW_WIDGET_IN_APP = false;
const GREEN = "#30D158";
const RED = "#FF453A";
const GRAY = "#98989F";
const AMBER = "#FF9F0A";
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

// U.S. state outlines in Albers USA (975 x 610), shared with the Payment widget
const STATES = "642,384 689,380 702,427 710,440 707,443 706,450 709,457 708,465 711,469 694,471 661,474 660,477 665,481 666,486 664,490 659,490 656,488 653,482 652,490 646,489 642,455 644,386 642,384|99,570 103,565 105,569 99,570|93,575 99,571 103,571 105,573 95,580 93,575|44,547 50,547 51,551 48,552 44,547|31,601 34,600 38,596 40,598 37,601 31,601|51,505 59,501 66,500 65,504 71,505 74,504 71,500 73,498 67,496 66,492 59,484 62,481 67,481 70,479 72,475 75,471 78,471 82,468 87,468 89,465 94,466 95,469 101,469 104,472 109,471 114,473 123,474 126,472 133,474 147,547 155,547 162,552 164,555 167,552 167,548 169,546 176,552 181,554 193,565 200,567 203,573 201,578 198,575 193,574 188,565 183,563 182,560 178,557 176,557 171,551 175,558 173,557 168,559 160,554 151,551 141,550 135,552 126,547 124,545 119,547 121,553 114,554 109,560 105,560 107,552 107,549 112,544 106,546 102,553 100,557 96,560 96,562 100,564 96,569 90,572 86,576 86,578 82,579 77,586 71,586 67,589 56,592 53,594 47,595 49,592 57,590 62,585 66,585 75,579 81,573 84,563 80,565 78,563 76,566 71,561 65,564 64,558 66,557 64,551 58,553 53,547 54,545 51,538 54,534 61,526 64,528 67,525 71,525 73,523 72,517 73,514 68,517 59,516 55,514 54,509 56,509 51,505|25,603 29,599 31,600 25,603|34,518 39,518 45,522 41,524 39,521 34,518|185,573 187,570 194,576 196,580 190,578 185,573|180,567 182,565 185,564 189,567 184,569 183,572 180,567|175,556 178,557 181,563 180,566 175,556|174,565 177,563 181,573 176,568 174,565|169,561 172,558 175,559 177,563 174,562 174,565 169,561|145,407 149,407 150,401 147,400 148,392 152,389 154,380 157,377 163,374 160,370 158,363 156,359 157,356 159,353 158,345 160,331 167,331 170,335 173,331 176,313 203,318 239,324 265,328 247,456 208,450 172,429 142,412 145,407|277,237 301,240 333,244 361,247 395,249 394,272 390,341 372,339 349,338 315,334 265,328 268,302 268,299 277,237|794,604 795,602 800,598 805,600 796,604 794,604|711,469 714,475 766,471 767,476 770,476 769,466 770,465 780,466 783,476 787,486 795,500 806,514 805,517 807,522 812,529 820,544 823,554 824,575 822,574 821,580 822,583 822,587 820,586 807,590 805,585 801,578 793,574 792,575 785,563 780,559 781,555 778,557 769,546 766,543 771,533 765,530 767,534 765,537 762,533 762,527 764,517 762,510 759,505 755,505 750,500 746,498 745,495 740,491 732,487 727,487 726,492 723,492 716,497 712,498 714,501 707,500 708,497 706,494 696,488 689,486 681,486 664,490 666,486 665,481 660,477 661,474 694,471 711,469|689,380 713,377 735,374 732,379 732,382 738,385 741,385 744,391 748,396 755,400 756,402 762,406 766,412 771,414 774,423 777,424 781,430 781,433 786,435 787,436 783,442 781,451 781,454 778,460 780,461 780,466 770,465 769,466 770,476 767,476 766,471 714,475 711,469 708,465 709,457 706,450 707,443 710,440 702,427 689,380|640,230 642,231 647,231 652,228 686,224 686,225 688,247 693,284 691,286 694,292 688,295 683,295 684,298 680,304 677,305 676,312 674,313 669,309 666,312 666,314 662,315 661,313 657,316 655,319 651,316 647,315 639,320 638,317 642,309 647,298 646,293 643,288 645,284 640,230|394,272 422,273 465,275 510,275 512,277 516,278 514,286 519,293 522,295 523,344 489,344 459,344 433,343 390,341 394,272|910,150 905,145 891,102 895,103 894,99 897,99 895,96 900,86 898,83 898,76 900,74 899,67 906,48 909,48 910,51 912,52 917,49 923,46 930,50 937,74 939,80 945,80 946,87 949,90 952,88 957,95 955,99 953,99 950,106 947,104 944,110 939,114 937,110 935,111 937,115 936,118 932,114 931,110 929,120 930,123 921,129 920,132 918,131 913,138 910,150|918,188 921,184 925,187 918,188|871,168 884,165 903,161 906,156 909,155 911,159 914,158 909,166 917,171 922,178 929,175 931,177 920,183 918,179 915,185 913,186 911,183 910,182 908,181 905,176 899,178 871,184 871,183 871,168|479,71 511,71 511,62 516,64 518,73 520,77 531,79 532,81 536,80 540,78 551,82 553,87 555,84 563,87 566,91 571,90 577,86 578,89 588,88 592,91 596,91 590,94 582,98 573,106 570,109 559,119 560,121 556,122 556,136 551,139 548,144 548,147 551,150 550,154 550,162 549,166 554,170 557,170 564,175 565,178 572,182 576,187 576,193 549,194 516,195 491,195 491,154 487,152 484,147 489,142 489,140 489,131 486,123 485,102 481,89 481,78 479,71|849,246 850,244 851,241 861,231 854,226 850,221 852,216 850,214 855,204 870,209 869,216 869,217 867,221 871,222 872,225 873,237 870,247 867,251 865,257 863,259 863,254 859,254 852,250 849,246|756,334 780,331 812,326 840,320 859,316 866,328 864,328 860,319 856,317 859,323 857,326 851,330 847,330 847,333 856,330 859,330 860,336 860,330 863,329 866,335 860,344 852,345 843,343 854,347 850,356 855,353 859,354 856,360 862,350 863,350 856,361 851,361 844,365 838,370 834,377 833,384 829,383 823,386 798,368 778,371 777,369 772,365 749,367 746,368 735,374 713,377 713,371 717,369 717,366 721,363 726,362 733,356 735,356 738,350 741,351 747,345 751,346 755,338 756,334|377,66 404,68 445,70 479,71 481,78 481,89 485,102 486,123 489,131 489,140 460,139 412,137 371,134 377,66|372,339 390,341 433,343 459,344 489,344 523,344 523,355 527,381 526,421 520,418 517,416 512,413 511,415 506,414 501,416 499,415 493,418 492,420 485,415 484,417 481,414 476,419 475,414 472,417 467,413 463,416 462,413 454,409 452,411 443,407 439,407 438,404 429,403 424,398 426,354 396,352 372,351 372,339|756,209 768,200 769,206 800,201 841,192 847,197 850,202 855,204 850,214 852,216 850,221 854,226 861,231 851,241 847,242 845,245 816,251 782,257 765,260 761,239 756,209|369,156 371,134 412,137 460,139 489,140 489,142 484,147 487,152 491,154 491,195 488,195 488,200 491,204 488,212 491,218 488,218 487,215 476,210 467,210 466,212 457,207 457,206 434,205 404,204 365,201 369,156|372,351 396,352 426,354 424,398 429,403 438,404 439,407 443,407 452,411 454,409 462,413 463,416 467,413 472,417 475,414 476,419 481,414 484,417 485,415 492,420 493,418 499,415 501,416 506,414 511,415 512,413 517,416 520,418 526,421 529,423 535,423 535,435 535,458 540,463 540,467 542,469 545,476 546,484 542,490 543,502 539,507 541,510 535,511 522,517 527,513 522,514 524,509 518,511 517,514 520,515 520,519 523,519 510,530 492,539 480,548 475,555 470,566 470,574 473,587 470,576 470,569 472,560 480,546 489,541 489,540 484,542 482,540 482,544 477,547 474,553 469,552 473,556 469,564 468,576 469,583 472,588 471,592 474,595 467,597 464,593 452,592 447,589 443,588 440,585 434,584 431,574 428,570 428,559 425,556 420,552 419,548 412,541 410,534 406,526 405,522 398,513 394,511 390,506 378,505 373,503 372,505 366,505 364,510 361,517 357,522 353,521 348,517 337,511 330,504 328,498 328,492 325,487 323,480 316,475 312,470 309,468 306,463 302,460 299,454 296,452 295,447 339,451 363,453 365,430 367,408 371,351 372,351|369,156 365,201 361,247 333,244 301,240 277,237 244,232 247,210 256,154 258,142 263,143 298,148 339,153 369,156|871,184 899,178 902,191 902,193 893,197 885,198 882,203 874,208 872,206 876,203 874,201 871,184|502,262 521,262 545,261 571,260 576,265 576,273 578,280 584,286 590,290 591,297 595,296 601,298 598,309 598,313 606,321 607,320 614,326 615,332 614,333 619,340 621,340 620,349 617,349 617,351 616,351 615,352 615,354 612,358 614,360 612,363 600,364 605,357 604,352 586,353 550,355 523,355 523,344 522,295 519,293 514,286 516,278 512,277 510,275 505,268 502,262|733,295 738,293 740,290 739,285 741,280 744,283 746,281 745,278 746,273 750,269 754,269 758,263 760,256 761,247 759,241 761,239 765,260 782,257 784,269 790,261 792,262 794,257 800,258 805,253 811,256 814,260 813,265 803,259 803,266 797,277 794,275 790,286 784,283 784,287 780,297 776,305 777,309 773,310 767,315 761,318 758,316 755,320 750,319 747,313 741,311 734,302 733,295|576,265 577,259 581,258 584,252 584,248 581,245 582,241 588,239 593,236 596,231 596,224 592,222 587,215 618,214 634,212 634,217 637,222 640,230 645,284 643,288 646,293 647,298 642,309 638,317 639,320 637,323 639,327 632,330 634,335 632,337 624,334 621,338 621,340 619,340 614,333 615,332 614,326 607,320 606,321 598,313 598,309 601,298 595,296 591,297 590,290 584,286 578,280 576,273 576,265|265,328 315,334 349,338 372,339 372,351 371,351 367,408 365,430 363,453 339,451 295,447 296,452 264,448 263,458 247,456 265,328|523,355 550,355 586,353 604,352 605,357 600,364 612,363 613,367 608,369 610,372 605,378 607,383 603,387 604,389 598,393 599,400 595,402 593,409 590,411 592,415 589,415 590,418 588,420 591,430 589,433 569,434 535,435 535,423 529,423 526,421 527,381 523,355|57,355 63,359 57,357 57,355|50,355 54,355 52,358 50,355|33,160 84,175 100,179 83,246 157,356 156,359 158,363 160,370 163,374 157,377 154,380 152,389 148,392 147,400 150,401 149,407 145,407 99,402 98,398 99,388 97,382 92,376 86,370 82,369 82,362 76,362 70,357 69,354 65,349 59,348 55,345 49,344 46,340 49,335 50,328 46,325 47,321 42,313 37,300 35,296 36,289 40,286 38,281 35,281 31,274 33,271 32,267 33,261 35,261 35,266 38,270 39,265 36,257 39,256 38,253 33,260 29,255 26,253 28,250 27,243 24,240 20,229 22,227 21,219 24,216 24,209 22,202 18,197 19,193 27,184 28,179 31,173 32,166 30,164 33,160|845,245 847,242 851,241 850,244 849,249 853,252 855,258 860,263 861,263 864,270 853,273 845,245|826,267 830,267 828,270 826,267|305,584 310,578 310,573 315,576 322,578 326,582 326,584 332,589 329,593 322,595 317,598 314,603 309,600 309,594 305,584|292,558 294,555 296,559 300,557 306,561 305,564 299,566 297,561 292,558|284,558 287,558 289,560 286,562 284,558|279,554 280,551 291,553 288,555 279,554|258,543 261,543 265,540 267,546 271,549 262,549 258,543|226,533 231,528 235,529 236,534 233,536 230,536 226,533|491,195 516,195 549,194 576,193 577,196 579,199 577,202 580,211 586,212 587,215 592,222 596,224 596,231 593,236 588,239 582,241 581,245 584,248 584,252 581,258 577,259 576,265 571,260 545,261 521,262 502,262 500,259 501,255 499,245 499,242 496,240 497,234 494,230 491,218 488,212 491,204 488,200 488,195 491,195|621,340 621,338 624,334 632,337 634,335 632,330 639,327 637,323 639,320 647,315 651,316 655,319 657,316 661,313 662,315 666,314 666,312 669,309 674,313 676,312 677,305 680,304 684,298 683,295 688,295 694,292 691,286 693,284 699,283 704,290 710,290 714,293 716,291 721,292 727,288 728,292 733,295 734,302 741,311 747,313 741,320 735,325 733,330 730,332 729,334 720,339 704,341 692,341 681,343 672,343 645,346 641,345 641,350 617,351 617,349 620,349 621,340|782,257 816,251 845,245 853,273 864,270 863,280 855,284 852,285 851,282 848,276 846,279 841,274 842,271 846,271 839,266 839,259 842,252 839,254 837,254 836,259 838,263 836,269 838,274 841,277 840,279 844,284 838,281 835,282 830,278 827,280 825,278 827,274 828,270 830,267 826,267 818,264 819,262 814,260 811,256 805,253 800,258 794,257 792,262 790,261 784,269 782,257|652,228 655,224 659,216 660,205 659,198 652,184 654,180 652,175 655,168 655,160 657,159 657,155 661,154 664,148 665,151 664,156 666,158 668,153 667,146 674,142 670,138 675,133 681,135 685,135 687,138 697,140 701,147 699,149 702,154 702,162 699,166 699,169 695,171 694,177 699,180 705,171 710,168 715,172 719,186 722,191 721,200 716,199 715,207 712,210 713,213 708,222 686,225 686,224 652,228|601,92 610,86 614,84 610,89 603,93 601,92|585,123 591,120 594,117 601,116 613,106 619,101 624,100 622,102 615,112 616,117 619,112 624,112 628,114 633,121 644,121 652,115 662,114 670,111 670,118 676,118 683,115 684,121 690,126 693,124 694,128 685,127 681,129 676,127 674,131 671,128 663,127 661,130 657,132 653,131 650,135 645,139 648,134 644,135 643,138 638,140 632,153 630,151 631,148 627,147 628,140 622,137 623,135 612,134 607,131 590,128 588,124 585,123|589,433 591,430 588,420 590,418 589,415 592,415 590,411 593,409 595,402 599,400 598,393 604,389 603,387 642,384 644,386 642,455 646,489 644,491 636,490 627,494 625,495 618,485 619,477 583,479 584,478 582,473 585,473 584,467 586,466 587,461 593,453 590,451 595,448 591,445 593,442 590,441 591,436 589,433|198,39 233,46 265,52 303,57 340,62 377,66 371,134 369,156 339,153 298,148 263,143 258,142 256,154 253,148 250,148 250,151 237,148 235,151 228,149 227,152 225,149 224,142 219,139 220,134 219,132 215,118 208,123 205,120 206,115 209,114 208,109 213,96 209,96 205,90 205,88 201,80 195,74 197,69 193,62 198,39|886,111 887,105 891,102 905,145 910,150 909,155 906,156 903,161 884,165 882,163 881,146 883,133 882,128 885,126 888,122 886,117 886,111|768,200 776,192 780,186 777,182 775,176 784,172 796,170 800,172 809,169 813,167 817,162 819,161 817,154 819,152 815,150 815,146 820,141 822,138 829,128 832,124 858,118 859,127 862,134 861,140 864,145 864,149 867,150 871,168 871,183 871,184 874,201 876,203 872,206 874,208 874,211 877,208 891,204 895,200 900,202 896,206 886,213 872,219 869,216 870,209 855,204 850,202 847,197 841,192 800,201 769,206 768,200|686,225 708,222 718,225 719,224 726,227 733,223 738,223 742,218 748,213 756,209 761,239 759,241 761,247 760,256 758,263 754,269 750,269 746,273 745,278 746,281 744,283 741,280 739,285 740,290 738,293 733,295 728,292 727,288 721,292 716,291 714,293 710,290 704,290 699,283 693,284 688,247 686,225|71,70 74,74 77,74 80,80 79,87 86,91 94,90 98,91 103,95 112,94 118,96 123,95 136,96 139,95 171,102 172,107 175,109 176,112 167,124 164,129 162,130 157,137 158,140 162,143 158,150 149,191 122,185 100,179 84,175 33,160 31,157 32,149 34,146 33,140 43,126 45,121 57,92 61,81 62,75 65,71 71,70|612,363 614,360 612,358 615,354 615,352 616,351 617,351 641,350 641,345 645,346 672,343 681,343 692,341 704,341 720,339 756,334 755,338 751,346 747,345 741,351 738,350 735,356 733,356 726,362 721,363 717,366 717,369 713,371 713,377 689,380 642,384 603,387 607,383 605,378 610,372 608,369 613,367 612,363|198,201 200,202 247,210 244,232 277,237 268,299 268,302 265,328 239,324 203,318 176,313 198,201|855,284 863,280 858,288 859,292 857,301 855,304 853,301 853,292 855,284|747,313 750,319 755,320 758,316 761,318 767,315 773,310 777,309 776,305 780,297 784,287 784,283 790,286 794,275 797,277 803,266 803,259 813,265 814,260 819,262 818,264 826,267 828,270 827,274 825,279 826,281 830,279 832,283 838,283 840,285 846,287 846,295 848,300 845,299 846,303 849,305 847,309 840,305 846,310 849,308 855,308 859,316 840,320 812,326 780,331 756,334 720,339 729,334 730,332 733,330 735,325 741,320 747,313|95,31 99,28 99,31 97,33 95,31|91,21 96,20 98,22 96,27 92,24 91,21|184,36 171,92 171,102 139,95 136,96 123,95 118,96 112,94 103,95 98,91 94,90 86,91 79,87 80,80 77,74 74,74 71,70 66,69 64,65 66,60 70,59 66,57 67,55 71,54 67,51 67,43 68,34 66,30 66,23 70,20 77,27 81,28 90,33 95,33 95,38 92,43 97,39 95,46 92,52 96,52 96,47 98,42 102,38 101,31 98,25 101,27 102,21 99,19 100,14 115,19 140,25 184,36|560,121 568,120 576,115 580,116 577,123 580,120 585,123 588,124 590,128 607,131 612,134 623,135 622,137 628,140 627,147 631,148 630,151 632,153 632,156 629,157 626,166 628,166 633,159 636,157 638,151 642,148 641,152 639,155 635,165 635,174 633,176 632,181 633,185 631,195 632,201 634,206 634,212 618,214 587,215 586,212 580,211 577,202 579,199 577,196 576,193 576,187 572,182 565,178 564,175 557,170 554,170 549,166 550,162 550,154 551,150 548,147 548,144 551,139 556,136 556,122 560,121|365,201 404,204 434,205 457,206 457,207 466,212 467,210 476,210 487,215 488,218 491,218 494,230 497,234 496,240 499,242 499,245 501,255 500,259 502,262 505,268 510,275 465,275 422,273 394,272 395,249 361,247 365,201|735,374 746,368 749,367 772,365 777,369 778,371 798,368 823,386 816,392 813,399 814,404 811,408 808,408 807,411 803,415 801,419 792,424 793,427 790,429 786,435 781,433 781,430 777,424 774,423 771,414 766,412 762,406 756,402 755,400 748,396 744,391 741,385 738,385 732,382 732,379 735,374|171,102 171,92 184,36 198,39 193,62 197,69 195,74 201,80 205,88 205,90 209,96 213,96 208,109 209,114 206,115 205,120 208,123 215,118 219,132 220,134 219,139 224,142 225,149 227,152 228,149 235,151 237,148 250,151 250,148 253,148 256,154 247,210 200,202 198,201 160,193 149,191 158,150 162,143 158,140 157,137 162,130 164,129 167,124 176,112 175,109 172,107 171,102|100,179 122,185 149,191 160,193 198,201 176,313 173,331 170,335 167,331 160,331 158,345 159,353 157,356 83,246 100,179|858,118 874,114 886,111 886,117 888,122 885,126 882,128 883,133 881,146 882,163 884,165 871,168 867,150 864,149 864,145 861,140 862,134 859,127 858,118|577,511 580,511 583,512 580,514 577,511|535,435 569,434 589,433 591,436 590,441 593,442 591,445 595,448 590,451 593,453 587,461 586,466 584,467 585,473 582,473 584,478 583,479 619,477 618,485 625,495 619,499 619,501 624,502 626,498 628,501 627,507 623,508 623,510 626,513 632,514 635,518 634,522 624,516 620,515 613,521 608,515 601,523 598,520 590,517 590,513 588,514 584,508 579,509 579,506 574,508 575,511 571,513 565,512 554,508 548,508 541,510 539,507 543,502 542,490 546,484 545,476 542,469 540,467 540,463 535,458 535,435|911,183 913,186 909,188 911,183|902,193 902,191 899,178 905,176 908,181 910,182 907,181 908,191 902,193";
const MAP_W = 975;
const MAP_H = 610;


// Albers USA, the same projection as the outlines above (d3's geoAlbersUsa at
// scale 1300), so metro dots land in the right place: [lon, lat] -> [x, y]
function conicEqualArea(phi0, phi1) {
  const r = Math.PI / 180;
  const sy0 = Math.sin(phi0 * r);
  const n = (sy0 + Math.sin(phi1 * r)) / 2;
  const c = 1 + sy0 * (2 * n - sy0);
  const r0 = Math.sqrt(c) / n;
  return (lam, phi) => {
    const rr = Math.sqrt(c - 2 * n * Math.sin(phi * r)) / n;
    const l = lam * r * n;
    return [rr * Math.sin(l), r0 - rr * Math.cos(l)];
  };
}
function albersPart(rot, center, par, k, tx, ty) {
  const raw = conicEqualArea(par[0], par[1]);
  const c = raw(center[0], center[1]);
  return (lon, lat) => {
    let l = lon + rot;
    while (l > 180) l -= 360;
    while (l < -180) l += 360;
    const p = raw(l, lat);
    return [tx + k * (p[0] - c[0]), ty - k * (p[1] - c[1])];
  };
}
const K_US = 1300;
const LOWER48 = albersPart(96, [-0.6, 38.7], [29.5, 45.5], K_US, 487.5, 305);
const ALASKA = albersPart(154, [-2, 58.5], [55, 65], 0.35 * K_US, 487.5 - 0.307 * K_US, 305 + 0.201 * K_US);
const HAWAII = albersPart(157, [-3, 19.9], [8, 18], K_US, 487.5 - 0.205 * K_US, 305 + 0.212 * K_US);
function projectUS(lon, lat) {
  if (lat > 50 && lon < -129) return ALASKA(lon, lat);
  if (lat < 24 && lon < -150) return HAWAII(lon, lat);
  return LOWER48(lon, lat);
}

// Fallback metro positions (principal city, [lat, lon]) if the Census Gazetteer can't be read
// (principal city, [lat, lon]) covers the usual Redfin metros if it can't.
const METRO_COORDS_FALLBACK = {
  "Albany|NY": [42.653, -73.757], "Albuquerque|NM": [35.084, -106.651], "Allentown|PA": [40.608, -75.49],
  "Anaheim|CA": [33.836, -117.914], "Anchorage|AK": [61.218, -149.9], "Arlington|VA": [38.88, -77.1],
  "Atlanta|GA": [33.749, -84.388], "Augusta|GA": [33.473, -82.01], "Austin|TX": [30.267, -97.743],
  "Bakersfield|CA": [35.373, -119.019], "Baltimore|MD": [39.29, -76.612], "Baton Rouge|LA": [30.452, -91.187],
  "Bethesda|MD": [38.985, -77.095], "Birmingham|AL": [33.519, -86.81], "Boise|ID": [43.615, -116.202],
  "Boise City|ID": [43.615, -116.202], "Boston|MA": [42.36, -71.059], "Bridgeport|CT": [41.186, -73.195],
  "Buffalo|NY": [42.886, -78.878], "Cambridge|MA": [42.373, -71.11], "Camden|NJ": [39.926, -75.12],
  "Cape Coral|FL": [26.563, -81.95], "Charleston|SC": [32.776, -79.931], "Charlotte|NC": [35.227, -80.843],
  "Chattanooga|TN": [35.046, -85.309], "Chicago|IL": [41.878, -87.63], "Cincinnati|OH": [39.103, -84.512],
  "Cleveland|OH": [41.499, -81.694], "Colorado Springs|CO": [38.834, -104.821], "Columbia|SC": [34.0, -81.035],
  "Columbus|OH": [39.961, -82.999], "Dallas|TX": [32.777, -96.797], "Dayton|OH": [39.758, -84.192],
  "Deltona|FL": [28.9, -81.264], "Denver|CO": [39.739, -104.99], "Des Moines|IA": [41.587, -93.625],
  "Detroit|MI": [42.331, -83.046], "Durham|NC": [35.994, -78.899], "El Paso|TX": [31.762, -106.485],
  "Elgin|IL": [42.037, -88.281], "Everett|WA": [47.979, -122.202], "Fort Lauderdale|FL": [26.122, -80.137],
  "Fort Worth|TX": [32.755, -97.331], "Frederick|MD": [39.414, -77.411], "Fresno|CA": [36.738, -119.787],
  "Gary|IN": [41.593, -87.346], "Grand Rapids|MI": [42.963, -85.668], "Greensboro|NC": [36.073, -79.792],
  "Greenville|SC": [34.853, -82.394], "Harrisburg|PA": [40.274, -76.884], "Hartford|CT": [41.764, -72.685],
  "Honolulu|HI": [21.307, -157.858], "Urban Honolulu|HI": [21.307, -157.858], "Houston|TX": [29.76, -95.37],
  "Huntsville|AL": [34.73, -86.586], "Indianapolis|IN": [39.768, -86.158], "Jacksonville|FL": [30.332, -81.656],
  "Kansas City|MO": [39.1, -94.579], "Knoxville|TN": [35.961, -83.921], "Lake County|IL": [42.364, -87.845],
  "Lakeland|FL": [28.039, -81.95], "Las Vegas|NV": [36.17, -115.14], "Little Rock|AR": [34.746, -92.29],
  "Los Angeles|CA": [34.052, -118.244], "Louisville|KY": [38.253, -85.759], "Madison|WI": [43.073, -89.401],
  "McAllen|TX": [26.203, -98.23], "Memphis|TN": [35.15, -90.049], "Miami|FL": [25.762, -80.192],
  "Milwaukee|WI": [43.039, -87.906], "Minneapolis|MN": [44.978, -93.265], "Montgomery County|PA": [40.121, -75.34],
  "Montgomery County|MD": [39.084, -77.153], "Nashville|TN": [36.163, -86.781], "Nassau County|NY": [40.733, -73.589],
  "New Brunswick|NJ": [40.486, -74.452], "New Haven|CT": [41.308, -72.928], "New Orleans|LA": [29.951, -90.072],
  "New York|NY": [40.713, -74.006], "Newark|NJ": [40.736, -74.172], "North Port|FL": [27.044, -82.236],
  "Oakland|CA": [37.804, -122.271], "Ogden|UT": [41.223, -111.974], "Oklahoma City|OK": [35.468, -97.516],
  "Omaha|NE": [41.257, -95.995], "Orlando|FL": [28.538, -81.379], "Oxnard|CA": [34.197, -119.177],
  "Palm Bay|FL": [28.035, -80.588], "Philadelphia|PA": [39.953, -75.165], "Phoenix|AZ": [33.448, -112.074],
  "Pittsburgh|PA": [40.441, -79.996], "Port St. Lucie|FL": [27.273, -80.354], "Portland|OR": [45.515, -122.679],
  "Providence|RI": [41.824, -71.413], "Provo|UT": [40.234, -111.659], "Raleigh|NC": [35.78, -78.639],
  "Reno|NV": [39.53, -119.814], "Richmond|VA": [37.541, -77.436], "Riverside|CA": [33.953, -117.396],
  "Rochester|NY": [43.157, -77.616], "Rockville|MD": [39.084, -77.153], "Sacramento|CA": [38.582, -121.494],
  "Salt Lake City|UT": [40.761, -111.891], "San Antonio|TX": [29.424, -98.494], "San Diego|CA": [32.716, -117.161],
  "San Francisco|CA": [37.775, -122.419], "San Jose|CA": [37.338, -121.886], "San Rafael|CA": [37.974, -122.531],
  "Santa Rosa|CA": [38.44, -122.714], "Sarasota|FL": [27.336, -82.531], "Savannah|GA": [32.081, -81.091],
  "Seattle|WA": [47.606, -122.332], "Silver Spring|MD": [38.991, -77.026], "Spokane|WA": [47.659, -117.426],
  "Springfield|MA": [42.101, -72.59], "St. Louis|MO": [38.627, -90.199], "Stockton|CA": [37.958, -121.291],
  "Syracuse|NY": [43.049, -76.147], "Tacoma|WA": [47.253, -122.444], "Tampa|FL": [27.951, -82.457],
  "Toledo|OH": [41.654, -83.537], "Tucson|AZ": [32.222, -110.975], "Tulsa|OK": [36.154, -95.993],
  "Virginia Beach|VA": [36.853, -75.978], "Warren|MI": [42.514, -83.015], "Washington|DC": [38.907, -77.037],
  "West Palm Beach|FL": [26.715, -80.054], "Wichita|KS": [37.688, -97.336], "Wilmington|DE": [39.739, -75.539],
  "Winston-Salem|NC": [36.1, -80.244], "Worcester|MA": [42.263, -71.802], "Akron|OH": [41.081, -81.519],
  "Bellevue|WA": [47.61, -122.201], "Naperville|IL": [41.785, -88.147], "Dutchess County|NY": [41.7, -73.921],
};

// More metros (Zillow's 150 largest reach smaller places than Redfin's list)
Object.assign(METRO_COORDS_FALLBACK, {
  "Spartanburg|SC": [34.95, -81.93], "Myrtle Beach|SC": [33.689, -78.887], "Wilmington|NC": [34.226, -77.945], "Asheville|NC": [35.595, -82.551],
  "Fayetteville|AR": [36.082, -94.171], "Fayetteville|NC": [35.053, -78.878], "Killeen|TX": [31.117, -97.728], "Corpus Christi|TX": [27.8, -97.396],
  "Lubbock|TX": [33.578, -101.855], "Waco|TX": [31.549, -97.147], "Brownsville|TX": [25.901, -97.497], "Beaumont|TX": [30.08, -94.127],
  "Tyler|TX": [32.351, -95.301], "College Station|TX": [30.628, -96.334], "Amarillo|TX": [35.222, -101.831], "Midland|TX": [31.997, -102.078],
  "Odessa|TX": [31.846, -102.368], "Laredo|TX": [27.506, -99.507], "Shreveport|LA": [32.525, -93.75], "Lafayette|LA": [30.224, -92.02],
  "Mobile|AL": [30.695, -88.04], "Montgomery|AL": [32.367, -86.3], "Pensacola|FL": [30.421, -87.217], "Tallahassee|FL": [30.438, -84.281],
  "Gainesville|FL": [29.652, -82.325], "Ocala|FL": [29.187, -82.14], "Naples|FL": [26.142, -81.795], "Crestview|FL": [30.762, -86.571],
  "Panama City|FL": [30.159, -85.66], "Columbus|GA": [32.461, -84.988], "Macon|GA": [32.841, -83.632], "Athens|GA": [33.951, -83.357],
  "Clarksville|TN": [36.53, -87.359], "Kingsport|TN": [36.548, -82.562], "Lexington|KY": [38.04, -84.503], "Evansville|IN": [37.975, -87.556],
  "Fort Wayne|IN": [41.079, -85.139], "South Bend|IN": [41.676, -86.252], "Lansing|MI": [42.733, -84.556], "Ann Arbor|MI": [42.281, -83.743],
  "Kalamazoo|MI": [42.292, -85.587], "Flint|MI": [43.012, -83.687], "Green Bay|WI": [44.519, -88.02], "Appleton|WI": [44.261, -88.415],
  "Rockford|IL": [42.271, -89.094], "Peoria|IL": [40.694, -89.589], "Champaign|IL": [40.116, -88.243], "Springfield|IL": [39.781, -89.65],
  "Davenport|IA": [41.524, -90.578], "Cedar Rapids|IA": [41.978, -91.666], "Sioux Falls|SD": [43.546, -96.731], "Fargo|ND": [46.877, -96.79],
  "Lincoln|NE": [40.814, -96.703], "Topeka|KS": [39.048, -95.678], "Springfield|MO": [37.209, -93.292], "Columbia|MO": [38.952, -92.334],
  "Fort Collins|CO": [40.585, -105.084], "Boulder|CO": [40.015, -105.27], "Greeley|CO": [40.423, -104.709], "Santa Fe|NM": [35.687, -105.938],
  "Prescott Valley|AZ": [34.61, -112.316], "Lake Havasu City|AZ": [34.484, -114.322], "Kennewick|WA": [46.211, -119.137], "Olympia|WA": [47.037, -122.9],
  "Bremerton|WA": [47.567, -122.633], "Bellingham|WA": [48.75, -122.478], "Salem|OR": [44.943, -123.035], "Eugene|OR": [44.052, -123.087],
  "Medford|OR": [42.327, -122.873], "Bend|OR": [44.058, -121.315], "Vallejo|CA": [38.104, -122.256], "Santa Cruz|CA": [36.974, -122.031],
  "Salinas|CA": [36.678, -121.656], "San Luis Obispo|CA": [35.283, -120.66], "Santa Maria|CA": [34.953, -120.436], "Visalia|CA": [36.33, -119.292],
  "Modesto|CA": [37.639, -120.997], "Merced|CA": [37.302, -120.483], "Redding|CA": [40.587, -122.392], "Chico|CA": [39.729, -121.837],
  "Portland|ME": [43.661, -70.255], "Manchester|NH": [42.995, -71.455], "Burlington|VT": [44.476, -73.212], "Barnstable Town|MA": [41.7, -70.3],
  "Norwich|CT": [41.524, -72.076], "Poughkeepsie|NY": [41.7, -73.921], "Scranton|PA": [41.409, -75.662], "Lancaster|PA": [40.038, -76.306],
  "York|PA": [39.963, -76.728], "Reading|PA": [40.336, -75.927], "Trenton|NJ": [40.217, -74.743], "Atlantic City|NJ": [39.364, -74.423],
  "Salisbury|MD": [38.361, -75.6], "Hagerstown|MD": [39.642, -77.72], "Roanoke|VA": [37.271, -79.941], "Lynchburg|VA": [37.414, -79.142],
  "Charlottesville|VA": [38.03, -78.479], "Winchester|VA": [39.186, -78.163], "Hickory|NC": [35.733, -81.341], "Tuscaloosa|AL": [33.21, -87.569],
  "Jackson|MS": [32.299, -90.185], "Gulfport|MS": [30.367, -89.093], "Youngstown|OH": [41.099, -80.65], "Canton|OH": [40.799, -81.378],
  "Erie|PA": [42.129, -80.085], "St. George|UT": [37.096, -113.568], "Daphne|AL": [30.603, -87.904], "Port St. Lucie|FL": [27.273, -80.354],
  "Deltona|FL": [28.9, -81.264], "Palm Bay|FL": [28.035, -80.588], "Sebastian|FL": [27.816, -80.471], "Punta Gorda|FL": [26.93, -82.045],
  "Kingston|NY": [41.927, -73.997], "Utica|NY": [43.1, -75.233], "Binghamton|NY": [42.099, -75.918], "Duluth|MN": [46.787, -92.1],
  "Rochester|MN": [44.022, -92.47], "Savannah|GA": [32.081, -81.091], "Gainesville|GA": [34.298, -83.824], "Warner Robins|GA": [32.62, -83.6],
  "Huntington|WV": [38.419, -82.445], "Charleston|WV": [38.35, -81.633], "Morgantown|WV": [39.629, -79.956], "Las Cruces|NM": [32.312, -106.778],
  "Yuma|AZ": [32.693, -114.628], "Flagstaff|AZ": [35.198, -111.651], "Yakima|WA": [46.602, -120.506], "Coeur d'Alene|ID": [47.678, -116.78],
  "Idaho Falls|ID": [43.492, -112.034], "Missoula|MT": [46.872, -113.994], "Billings|MT": [45.783, -108.501], "Cheyenne|WY": [41.14, -104.82],
  "Rapid City|SD": [44.081, -103.231], "Bismarck|ND": [46.808, -100.784], "Manhattan|KS": [39.184, -96.572], "Lawrence|KS": [38.972, -95.235],
  "Joplin|MO": [37.084, -94.513], "Fort Smith|AR": [35.386, -94.398], "Jonesboro|AR": [35.842, -90.704], "Hot Springs|AR": [34.503, -93.055],
});


// ---------- Saved copies (shared by the widget and the app) ----------
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
function headerOf(resp, name) {
  const h = (resp && resp.headers) || {};
  const k = Object.keys(h).find((x) => x.toLowerCase() === name.toLowerCase());
  return k ? String(h[k]) : null;
}
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// "2026-06-30" -> "Q2 2026" when the 3-month window is a calendar quarter, else "Apr–Jun 2026"
function periodLabel(end, short) {
  const y = +end.slice(0, 4), m = +end.slice(5, 7);
  if (m % 3 === 0) return short ? `Q${m / 3} ’${String(y).slice(2)}` : `Q${m / 3} ${y}`;
  const b = (m + 9) % 12;
  return short ? `${MON[b]}–${MON[m - 1]}` : `${MON[b]}–${MON[m - 1]} ${y}`;
}

// ---------- Download, unzip and read Redfin's two files ----------
const OD_VER = 2; // bump when the origin-destination reader changes, so saved copies are re-read
async function headInfo(url) {
  const req = new Request(url);
  req.method = "HEAD";
  req.timeoutInterval = 12;
  req.headers = { "User-Agent": UA };
  try {
    await req.load();
    return { status: (req.response && req.response.statusCode) || 0, lm: headerOf(req.response, "Last-Modified") };
  } catch (e) {
    return { status: 0 };
  }
}
// Page-side readers (plain browser JS; they get the unzipped text)
function aggParse(text) {
  var lines = text.split(/\r?\n/);
  var sp = function (l) { var o = [], c = "", q = false; for (var i = 0; i < l.length; i++) { var ch = l[i]; if (q) { if (ch === '"') q = false; else c += ch; } else if (ch === '"') q = true; else if (ch === ",") { o.push(c); c = ""; } else c += ch; } o.push(c); return o; };
  var head = sp(lines[0]).map(function (h) { return h.trim().toLowerCase(); });
  var at = function (n) { return head.indexOf(n); };
  var iT = at("region_type"), iN = at("region_name"), iE = at("period_end"), iI = at("inflow"), iO = at("outflow"), iF = at("net_flow");
  var iId = at("region_id"), iR = at("population_rank"), iPI = at("pct_searching_in"), iPO = at("pct_searching_out"), iPY = at("net_flow_prior_year");
  if (iT < 0 || iN < 0 || iE < 0 || iI < 0 || iO < 0 || iF < 0) throw new Error("Redfin's migration file changed layout (" + head.join(", ") + ")");
  var rows = [], ends = {};
  for (var r = 1; r < lines.length; r++) {
    if (!lines[r]) continue;
    var f = sp(lines[r]), t = String(f[iT]).toLowerCase();
    if (t !== "csa" && t !== "national") continue;
    var num = function (i) { if (i < 0) return null; var v = parseFloat(f[i]); return isFinite(v) ? v : null; };
    var e = String(f[iE]).slice(0, 10);
    ends[e] = 1;
    rows.push({ t: t, id: iId >= 0 ? String(f[iId]).trim() : null, n: String(f[iN]).trim(), e: e, i: num(iI), o: num(iO), f: num(iF), r: num(iR), pi: num(iPI), po: num(iPO), py: num(iPY) });
  }
  var periods = Object.keys(ends).sort(), pIdx = {};
  periods.forEach(function (p, k) { pIdx[p] = k; });
  var by = {}, nat = null;
  rows.forEach(function (x) {
    var key = x.t === "national" ? "__US" : x.n;
    var g = by[key];
    if (!g) {
      var blank = function () { return periods.map(function () { return null; }); };
      g = by[key] = { n: x.t === "national" ? "United States" : x.n, id: x.id, rank: x.r, inflow: blank(), outflow: blank(), net: blank(), prior: blank(), pin: blank(), pout: blank() };
      if (x.t === "national") nat = g;
    }
    var k = pIdx[x.e], r0 = function (v) { return v == null ? null : Math.round(v); }, r4 = function (v) { return v == null ? null : Math.round(v * 10000) / 10000; };
    g.inflow[k] = r0(x.i); g.outflow[k] = r0(x.o); g.net[k] = r0(x.f); g.prior[k] = r0(x.py); g.pin[k] = r4(x.pi); g.pout[k] = r4(x.po);
    if (x.r != null) g.rank = x.r;
  });
  var csas = Object.keys(by).filter(function (k) { return k !== "__US"; }).map(function (k) { return by[k]; });
  return { periods: periods, csas: csas, nat: nat };
}
function odParse(text) {
  var lines = text.split(/\r?\n/);
  var sp = function (l) { var o = [], c = "", q = false; for (var i = 0; i < l.length; i++) { var ch = l[i]; if (q) { if (ch === '"') q = false; else c += ch; } else if (ch === '"') q = true; else if (ch === ",") { o.push(c); c = ""; } else c += ch; } o.push(c); return o; };
  var head = sp(lines[0]).map(function (h) { return h.trim().toLowerCase(); });
  var find = function (test) { for (var i = 0; i < head.length; i++) if (test(head[i])) return i; return -1; };
  var iO = find(function (h) { return h.indexOf("origin") >= 0 && h.indexOf("name") >= 0; });
  var iD = find(function (h) { return h.indexOf("dest") >= 0 && h.indexOf("name") >= 0; });
  var iF = find(function (h) { return h === "flow"; });
  if (iF < 0) iF = find(function (h) { return h.indexOf("flow") >= 0 && h.indexOf("net") < 0 && h.indexOf("rank") < 0 && h.indexOf("pct") < 0 && h.indexOf("yoy") < 0; });
  var iE = find(function (h) { return h === "period_end"; });
  var iOT = find(function (h) { return h.indexOf("origin") >= 0 && h.indexOf("type") >= 0 && h.indexOf("id") < 0; });
  var iDT = find(function (h) { return h.indexOf("dest") >= 0 && h.indexOf("type") >= 0 && h.indexOf("id") < 0; });
  var iOI = find(function (h) { return h.indexOf("origin") >= 0 && h.indexOf("id") >= 0 && h.indexOf("type") < 0; });
  var iDI = find(function (h) { return h.indexOf("dest") >= 0 && h.indexOf("id") >= 0 && h.indexOf("type") < 0; });
  if (iO < 0 || iD < 0 || iF < 0 || iE < 0) throw new Error("Redfin's origin-destination file changed layout (" + head.join(", ") + ")");
  var pairs = {}, n = 0;
  for (var r = 1; r < lines.length; r++) {
    if (!lines[r]) continue;
    var f = sp(lines[r]);
    if (iOT >= 0 && String(f[iOT]).toLowerCase().indexOf("state") >= 0) continue;
    if (iDT >= 0 && String(f[iDT]).toLowerCase().indexOf("state") >= 0) continue;
    var v = parseFloat(f[iF]);
    if (!isFinite(v) || v <= 0) continue;
    var e = String(f[iE]).slice(0, 10);
    (pairs[e] = pairs[e] || []).push([String(f[iO]).trim(), String(f[iD]).trim(), Math.round(v * 10) / 10, iOI >= 0 ? String(f[iOI]).trim() : null, iDI >= 0 ? String(f[iDI]).trim() : null]);
    n++;
  }
  var first = Object.keys(pairs)[0], sample = first ? pairs[first].slice(0, 4).map(function (r) { return r[0] + (r[3] ? " #" + r[3] : ""); }) : [];
  return { periods: Object.keys(pairs).sort(), pairs: pairs, rows: n, head: head, sample: sample };
}
async function fetchAndRead(url, parser, seconds) {
  const req = new Request(url + "?t=" + Date.now());
  req.timeoutInterval = 45;
  req.headers = { "User-Agent": UA };
  const data = await req.load();
  const status = (req.response && req.response.statusCode) || 0;
  if (status !== 200) throw new Error(`Redfin answered ${status || "nothing"}`);
  const lm = headerOf(req.response, "Last-Modified");
  const wv = updWV(new WebView());
  await wv.loadHTML(...updArgs("<!DOCTYPE html><html><body></body></html>"));
  const js =
    "window.__out='';(function(){var b64=" + JSON.stringify(data.toBase64String()) + ";" +
    "try{var bin=atob(b64),buf=new Uint8Array(bin.length);for(var i=0;i<bin.length;i++)buf[i]=bin.charCodeAt(i);b64=null;bin=null;" +
    "var go=(buf[0]===31&&buf[1]===139)?new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).text():Promise.resolve(new TextDecoder().decode(buf));" +
    "go.then(function(t){window.__out=JSON.stringify({ok:true,data:(" + parser.toString() + ")(t)});})" +
    ".catch(function(e){window.__out=JSON.stringify({ok:false,error:String(e&&e.message||e)});});" +
    "}catch(e){window.__out=JSON.stringify({ok:false,error:String(e&&e.message||e)});}})();0;";
  await wv.evaluateJavaScript(js, false);
  const t0 = Date.now();
  while (Date.now() - t0 < seconds * 1000) {
    await sleep(250);
    const out = await wv.evaluateJavaScript("window.__out || ''", false);
    if (out) {
      const o = JSON.parse(out);
      if (!o.ok) throw new Error(o.error);
      return { ...o.data, lm };
    }
  }
  throw new Error("timed out reading Redfin's file");
}

// Daily: is Redfin's copy newer than ours? Keeps the last good copy on failure.
async function refresh(saved, force) {
  const odOk = saved && saved.od && saved.odVer === OD_VER;
  if (saved && saved.csas && odOk && !force && hoursSince(saved.checked) < CHECK_HOURS) return saved;
  const now = new Date().toISOString();
  try {
    const [ha, ho] = await Promise.all([headInfo(AGG_URL), headInfo(OD_URL)]);
    const aggNew = !saved || !saved.csas || !saved.csas[0] || !("id" in saved.csas[0]) || !ha.lm || ha.lm !== saved.lmAgg;
    const odNew = !odOk || !ho.lm || ho.lm !== saved.lmOd;
    if (!aggNew && !odNew) {
      const out = { ...saved, checked: now, error: null };
      writeJSON(STORE_FILE, out);
      return out;
    }
    let agg = null, od = null, odError = saved ? saved.odError || null : null;
    if (aggNew) {
      agg = await fetchAndRead(AGG_URL, aggParse, 60);
      if (agg.csas.length < 20 || agg.periods.length < 4) throw new Error(`Redfin's file looks incomplete (${agg.csas.length} metros)`);
    }
    if (odNew) {
      try {
        od = await fetchAndRead(OD_URL, odParse, 60);
        odError = od.rows ? null : "no rows read (columns: " + od.head.join(", ") + ")";
        if (!od.rows) od = null;
      } catch (e) { od = null; odError = String(e.message || e); }
    }
    const out = {
      checked: now, fetched: now, error: null,
      lmAgg: agg ? agg.lm : saved.lmAgg,
      periods: agg ? agg.periods : saved.periods,
      csas: agg ? agg.csas : saved.csas,
      nat: agg ? agg.nat : saved.nat,
      lmOd: od ? od.lm : saved && saved.lmOd,
      od: od ? { periods: od.periods, pairs: od.pairs, head: od.head, sample: od.sample } : saved && saved.od,
      odVer: od ? OD_VER : saved && saved.odVer,
      odError,
    };
    writeJSON(STORE_FILE, out);
    writeFace(out, null);
    return out;
  } catch (e) {
    if (saved && saved.csas) {
      const out = { ...saved, checked: now, error: String(e.message || e) };
      writeJSON(STORE_FILE, out);
      return out;
    }
    throw e;
  }
}

// ---------- Widget summary ----------
function writeFace(s, pending) {
  const k = s.periods.length - 1;
  const rows = s.csas.filter((c) => c.net[k] != null).map((c) => [c.n, c.net[k]]).sort((a, b) => b[1] - a[1]);
  const old = readJSON(FACE_FILE) || {};
  const face = {
    end: s.periods[k], up: rows.slice(0, 3), down: rows.slice(-3).reverse(),
    lmAgg: s.lmAgg, probed: old.probed || null, pending: pending === undefined ? old.pending || null : pending,
  };
  writeJSON(FACE_FILE, face);
  return face;
}
// The widget only peeks at the file's date (no download) and says when a new
// copy is waiting; the app does the downloading
async function widgetProbe(face) {
  if (!face || hoursSince(face.probed) < WIDGET_CHECK_DAYS * 24) return face;
  writeJSON(FACE_FILE, { ...face, probed: new Date().toISOString() });
  const h = await headInfo(AGG_URL);
  const pending = h.status === 200 && h.lm && face.lmAgg && h.lm !== face.lmAgg ? "new" : face.pending || null;
  const out = { ...face, probed: new Date().toISOString(), pending };
  writeJSON(FACE_FILE, out);
  return out;
}


// ---------- Widget ----------
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
function kFmt(v) {
  const a = Math.abs(v), s = v < 0 ? "−" : "+";
  if (a >= 100000) return s + Math.round(a / 1000) + "k";
  if (a >= 1000) return s + (a / 1000).toFixed(1) + "k";
  return s + Math.round(a);
}
function rateFmt(v) {
  return (v < 0 ? "−" : "+") + Math.abs(v).toFixed(1);
}
function fit(name, max) {
  const s = name.split(",")[0];
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}
function smallImage(face) {
  const W = 170;
  const ctx = newCanvas(W, W);
  drawText(ctx, "Redfin Moves", new Rect(14, 11, 100, 17), Font.boldSystemFont(13), "#FFFFFF", "left");
  drawText(ctx, periodLabel(face.end, true), new Rect(W - 64, 13, 50, 14), Font.mediumSystemFont(10), GRAY, "right");
  const block = (label, list, y, hex) => {
    drawText(ctx, label, new Rect(14, y, 142, 13), Font.semiboldSystemFont(9.5), hex, "left");
    (list || []).forEach((r, i) => {
      const ry = y + 13 + i * 15;
      drawText(ctx, fit(r[0], 15), new Rect(14, ry, 96, 15), Font.semiboldSystemFont(11.5), "#FFFFFF", "left");
      drawText(ctx, kFmt(r[1]), new Rect(96, ry, 60, 15), Font.boldSystemFont(11.5), hex, "right");
    });
  };
  block("DRAWING", face.up, 31, GREEN);
  block("LOSING", face.down, 91, RED);
  if (face.pending) drawText(ctx, "New data · tap to load", new Rect(14, 151, 142, 12), Font.semiboldSystemFont(9), AMBER, "left");
  else drawText(ctx, "Net house hunters, Redfin", new Rect(14, 151, 142, 12), Font.mediumSystemFont(9), GRAY, "left");
  return ctx.getImage();
}
function finishWidget(img) {
  const w = new ListWidget();
  w.backgroundImage = updRing(img);
  w.addSpacer();
  w.url = URLScheme.forRunningScript();
  w.refreshAfterDate = new Date(Date.now() + 12 * 3600 * 1000);
  return w;
}
function errorWidget(msg) {
  const w = new ListWidget();
  const g = new LinearGradient();
  g.colors = [new Color("#2C2C2E"), new Color("#1C1C1E")];
  g.locations = [0, 1];
  w.backgroundGradient = g;
  const t = w.addText("Redfin Moves");
  t.font = Font.semiboldSystemFont(12);
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

// ---------- Full screen ----------

// ---------- Full screen ----------
// Note: the page script below avoids backticks, backslashes and dollar-brace
// on purpose, because the whole page lives inside a template literal.
const PAGE_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<title>Redfin Migration</title>
<style>
  :root { --bg:#1C1C1E; --fg:#FFFFFF; --gray:#98989F; --rule:#3A3A3C; }
  * { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  body { margin:0; padding:20px 16px 36px; background:var(--bg); color:var(--fg);
         font-family:-apple-system,system-ui,sans-serif; -webkit-user-select:none; user-select:none; }
  .ticker { font-size:26px; font-weight:800; letter-spacing:-0.3px; }
  .name { color:var(--gray); font-size:13.5px; font-weight:600; margin-top:3px; line-height:1.35; }
  .hint { color:var(--gray); font-size:12px; margin-top:6px; line-height:1.4; }
  .loading { font-size:15px; margin-top:40px; text-align:center; }
  .err { color:#FF9F0A; font-size:13px; margin-top:24px; line-height:1.4; }
  .hl { font-size:16px; font-weight:700; line-height:1.32; margin-top:14px; }
  .seg { display:flex; gap:6px; margin-top:10px; }
  .seg button { flex:1; border:0; border-radius:10px; padding:7px 0; background:#2C2C2E; color:#FFFFFF; font:inherit; font-size:13.5px; font-weight:600; }
  .seg button.on { background:#FFFFFF; color:#000000; }
  .h2 { font-size:12px; font-weight:700; color:var(--gray); letter-spacing:0.4px; margin:24px 0 4px; text-transform:uppercase; }
  .ct { font-size:15px; font-weight:700; margin-top:16px; }
  .desc { color:var(--gray); font-size:12px; line-height:1.45; margin-top:4px; }
  .ro { font-size:13px; font-weight:600; min-height:18px; margin:6px 0 2px; line-height:1.4; font-variant-numeric:tabular-nums; }
  svg.chart { display:block; width:100%; height:220px; }
  svg.map { display:block; width:100%; height:auto; }
  .wrap { position:relative; }
  .touch { position:absolute; left:0; top:0; right:0; bottom:0; touch-action:pan-y; }
  select.pick { width:100%; border:0; border-radius:10px; padding:9px 10px; background:#2C2C2E; color:#FFFFFF;
                font:inherit; font-size:14px; font-weight:600; -webkit-appearance:none; appearance:none; margin:6px 0 2px; }
  .lbh { font-size:12px; font-weight:700; margin:12px 0 4px; letter-spacing:0.3px; }
  .lr { display:flex; align-items:center; font-size:13px; padding:4px 0; border-bottom:1px solid #2C2C2E; }
  .lr.sel { background:#2C2C2E; border-radius:6px; }
  .lr .nm { flex:0 0 44%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-weight:600; padding-left:2px; }
  .lr .nm b { color:var(--gray); font-weight:600; display:inline-block; width:24px; }
  .lr .bar { flex:1; height:8px; margin:0 8px; }
  .lr .bar i { display:block; height:8px; border-radius:4px; }
  .lr .v { flex:0 0 62px; text-align:right; font-weight:700; font-variant-numeric:tabular-nums; }
  .lr .sub { color:var(--gray); font-size:11px; font-weight:500; display:block; }
  .tiles { display:flex; flex-wrap:wrap; gap:8px; margin-top:10px; }
  .tile { flex:1 1 calc(50% - 8px); background:#2C2C2E; border-radius:10px; padding:8px 10px; }
  .tile .k { color:var(--gray); font-size:11.5px; font-weight:600; }
  .tile .v { font-size:20px; font-weight:800; margin-top:1px; }
  .tile .s { color:var(--gray); font-size:11px; margin-top:1px; }
  .note { color:var(--gray); font-size:10.5px; line-height:1.45; margin-top:22px; }
</style>
</head>
<body>
<div class="ticker">Redfin Migration</div>
<div class="name">Where house hunters want to move · Redfin.com searches, rolling 3 months</div>
<div class="hint" id="progress"></div>
<div class="hint loading" id="loading">Loading Redfin's data…</div>
<div class="hint err" id="err" style="display:none"></div>
<div id="blocks" style="display:none">
  <div class="hl" id="headline"></div>
  <div class="h2">Period</div>
  <select class="pick" id="period"></select>
  <div class="hint">Each period is 3 months of searches. Quarters are listed, plus the newest window if it isn't one.</div>

  <div class="h2">Map</div>
  <svg class="map" id="map"></svg>
  <div class="hint">Bubble size: net house hunters (in minus out). <span style="color:#30D158">Green</span>: more searchers looking in than locals looking out. <span style="color:#FF453A">Red</span>: the reverse. Tap a bubble to pick a metro.</div>

  <div class="h2">Leaderboard</div>
  <div class="seg" id="metric"><button data-k="net">Net</button><button data-k="yoy">Change vs a year ago</button></div>
  <div class="hint" id="lbNote"></div>
  <div class="lbh" style="color:#30D158" id="upH">DRAWING</div><div id="lbUp"></div>
  <div class="lbh" style="color:#FF453A" id="downH">LOSING</div><div id="lbDown"></div>

  <div class="h2">Metro</div>
  <select class="pick" id="pick"></select>
  <div class="tiles" id="tiles"></div>
  <div class="ct">House hunters in and out</div>
  <div class="ro" id="roT"></div>
  <div class="wrap"><svg class="chart" id="cT"></svg><div class="touch" id="tT"></div></div>
  <div class="desc">Inflow: Redfin users elsewhere looking at homes here. Outflow: locals looking at homes in other metros. Net: the difference. Each point is a rolling 3-month window; tap to read one. The shaded window is the period picked above.</div>

  <div class="h2">Where they come from and look</div>
  <div class="seg" id="fmode"><button data-k="in">Coming from</button><button data-k="out">Looking at</button><button data-k="net">Net</button></div>
  <div class="ro" id="roF"></div>
  <svg class="map" id="fmap"></svg>
  <div id="flist"></div>
  <div class="hint" id="fnote"></div>
</div>
<div class="note" id="note"></div>
__SHARE__
<script>
var D = null, P = 0, metric = "net", fmode = "in", sel = 0, cur = null, STATE_PATH = "";
var GREEN = "#30D158", RED = "#FF453A", GRAY = "#98989F";
var MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function el(id) { return document.getElementById(id); }
function esc(s) { return String(s).split("&").join("&amp;").split("<").join("&lt;").split(">").join("&gt;"); }
function sgn(v) { return v < 0 ? "−" : "+"; }
function num(v) { return Math.round(Math.abs(v)).toLocaleString("en-US"); }
function full(v) { return sgn(v) + num(v); }
function kFmt(v) { var a = Math.abs(v); return sgn(v) + (a >= 10000 ? (a / 1000).toFixed(0) + "k" : a >= 1000 ? (a / 1000).toFixed(1) + "k" : String(Math.round(a))); }
function city(n) { return n.split(",")[0]; }
function pLabel(end) { var y = +end.slice(0, 4), m = +end.slice(5, 7); if (m % 3 === 0) return "Q" + (m / 3) + " " + y; var b = (m + 9) % 12; return MONTHS[b] + "–" + MONTHS[m - 1] + " " + y; }
function pLong(end) { var y = +end.slice(0, 4), m = +end.slice(5, 7), b = (m + 9) % 12, by = m < 3 ? y - 1 : y; return MONTHS[b] + " " + (by !== y ? by + " " : "") + "to " + MONTHS[m - 1] + " " + y; }
function selC() { return D.csas[sel]; }
function niceStep(range, n) { var raw = range / (n || 4), p = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), f = raw / p; return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p; }
function axisK(v) { var a = Math.abs(v); return (v < 0 ? "−" : "") + (a >= 1000 ? (a / 1000) + "k" : String(a)); }
function yoyOf(c, k) { var v = c.net[k], p = c.prior[k]; if (v == null) return null; if (p == null) { var j = k - 12; p = j >= 0 ? c.net[j] : null; } return p == null ? null : v - p; }
function coord(c) { return D.pos[c.n] || null; }
function rows() {
  var out = [];
  D.csas.forEach(function (c, i) { var v = metric === "yoy" ? yoyOf(c, P) : c.net[P]; if (v != null) out.push({ c: c, i: i, v: v, net: c.net[P] }); });
  return out.sort(function (a, b) { return b.v - a.v; });
}
function headlineText() {
  var r = D.csas.map(function (c, i) { return { c: c, v: c.net[P] }; }).filter(function (x) { return x.v != null; }).sort(function (a, b) { return b.v - a.v; });
  if (r.length < 2) return "";
  var t = r[0], b = r[r.length - 1];
  return "House Hunters Looked Hardest at " + city(t.c.n) + " in " + pLabel(D.periods[P]) + " (" + full(t.v) + " Net Searchers); " + city(b.c.n) + " Lost the Most (" + full(b.v) + ")";
}

// ---- period ----
function renderPeriods() {
  var opts = [];
  D.periods.forEach(function (p, k) { if (+p.slice(5, 7) % 3 === 0 || k === D.periods.length - 1) opts.push(k); });
  opts.reverse();
  el("period").innerHTML = opts.map(function (k) { return '<option value="' + k + '">' + pLabel(D.periods[k]) + (k === D.periods.length - 1 ? " (latest)" : "") + "</option>"; }).join("");
  el("period").value = String(P);
  el("period").onchange = function () { P = +this.value; cur = null; renderAll(); };
}

// ---- map ----
function renderMap() {
  var svg = el("map");
  svg.setAttribute("viewBox", "0 0 " + D.mapW + " " + D.mapH);
  var pts = [], mx = 1;
  D.csas.forEach(function (c, i) { var xy = coord(c), v = c.net[P]; if (xy && v != null) { pts.push({ c: c, i: i, x: xy[0], y: xy[1], v: v }); mx = Math.max(mx, Math.abs(v)); } });
  pts.forEach(function (p) { p.r = 4 + 26 * Math.sqrt(Math.abs(p.v) / mx); });
  pts.sort(function (a, b) { return b.r - a.r; });
  var s = '<path d="' + STATE_PATH + '" fill="#2C2C2E" stroke="#48484A" stroke-width="1" vector-effect="non-scaling-stroke"/>', selP = null;
  pts.forEach(function (p) {
    s += '<circle cx="' + p.x + '" cy="' + p.y + '" r="' + p.r.toFixed(1) + '" fill="' + (p.v >= 0 ? GREEN : RED) + '" fill-opacity="0.72" stroke="#000000" stroke-width="1"/>';
    if (p.i === sel) selP = p;
  });
  var lab = pts.slice().sort(function (a, b) { return Math.abs(b.v) - Math.abs(a.v); }).slice(0, 8), boxes = [], ls = "";
  lab.forEach(function (p) {
    var name = city(p.c.n), fs = 21, w = name.length * fs * 0.56, h = fs * 1.1, tries = [p.x + p.r + 3, p.x - p.r - 3 - w];
    for (var t = 0; t < 2; t++) {
      var bx = tries[t], by = p.y - h / 2, ok = bx > 0 && bx + w < D.mapW;
      for (var j = 0; j < boxes.length && ok; j++) { var o = boxes[j]; if (bx < o.x + o.w && bx + w > o.x && by < o.y + o.h && by + h > o.y) ok = false; }
      if (ok) { boxes.push({ x: bx, y: by, w: w, h: h }); ls += '<text x="' + bx.toFixed(1) + '" y="' + (p.y + fs * 0.35).toFixed(1) + '" font-size="' + fs + '" font-weight="600" fill="#E5E5EA" stroke="#000000" stroke-width="4" paint-order="stroke">' + esc(name) + "</text>"; break; }
    }
  });
  if (selP) s += '<circle cx="' + selP.x + '" cy="' + selP.y + '" r="' + (selP.r + 5) + '" fill="none" stroke="#FFFFFF" stroke-width="3.5"/>';
  svg.innerHTML = s + ls;
  svg.__pts = pts;
}
el("map").addEventListener("click", function (e) {
  var svg = el("map"), r = svg.getBoundingClientRect(), k = D.mapW / r.width, qx = (e.clientX - r.left) * k, qy = (e.clientY - r.top) * k, best = null, bd = Infinity;
  (svg.__pts || []).forEach(function (p) { var d = Math.sqrt((p.x - qx) * (p.x - qx) + (p.y - qy) * (p.y - qy)) - p.r; if (d < bd) { bd = d; best = p; } });
  if (best && bd / k < 24) pick(best.i);
});

// ---- leaderboard ----
function lbRows(list, max, color, rankOf) {
  return list.map(function (r, k) {
    var w = Math.max(2, Math.abs(r.v) / max * 100);
    var sub = metric === "yoy" ? "net " + full(r.net) : (function () { var y = yoyOf(r.c, P); return y == null ? "" : (y >= 0 ? "▲ " : "▼ ") + kFmt(y) + " vs a year ago"; })();
    return '<div class="lr' + (r.i === sel ? " sel" : "") + '" data-i="' + r.i + '"><span class="nm"><b>' + rankOf(k) + "</b>" + esc(r.c.n) + '<span class="sub">' + sub + '</span></span><span class="bar"><i style="width:' + w.toFixed(1) + "%;background:" + color + '"></i></span><span class="v" style="color:' + color + '">' + kFmt(r.v) + "</span></div>";
  }).join("");
}
function renderBoard() {
  var R = rows(), up = R.slice(0, 10).filter(function (r) { return r.v > 0; }), down = R.slice(-10).reverse().filter(function (r) { return r.v < 0; });
  var max = Math.max.apply(null, up.concat(down).map(function (r) { return Math.abs(r.v); }).concat([1]));
  el("lbUp").innerHTML = lbRows(up, max, GREEN, function (k) { return k + 1; }) || '<div class="hint">None</div>';
  el("lbDown").innerHTML = lbRows(down, max, RED, function (k) { return R.length - k; }) || '<div class="hint">None</div>';
  el("upH").textContent = metric === "yoy" ? "GAINING MOST VS A YEAR AGO" : "DRAWING";
  el("downH").textContent = metric === "yoy" ? "SLIPPING MOST VS A YEAR AGO" : "LOSING";
  el("lbNote").textContent = (metric === "yoy" ? "Change in net house hunters vs the same window a year earlier" : "Net house hunters: searchers looking in minus locals looking out") + " · " + pLong(D.periods[P]) + " · " + R.length + " metros";
  var bs = el("metric").querySelectorAll("button");
  for (var i = 0; i < bs.length; i++) { bs[i].className = bs[i].getAttribute("data-k") === metric ? "on" : ""; bs[i].onclick = function () { metric = this.getAttribute("data-k"); renderBoard(); }; }
  var rs = document.querySelectorAll("#lbUp .lr, #lbDown .lr");
  for (var j = 0; j < rs.length; j++) rs[j].onclick = function () { pick(+this.getAttribute("data-i")); };
}

// ---- the picked metro ----
function pick(i) { sel = i; cur = null; el("pick").value = String(i); renderAll(); }
function renderPicker() {
  var order = D.csas.map(function (c, i) { return { n: c.n, i: i }; }).sort(function (a, b) { return a.n < b.n ? -1 : 1; });
  el("pick").innerHTML = order.map(function (o) { return '<option value="' + o.i + '">' + esc(o.n) + "</option>"; }).join("");
  el("pick").value = String(sel);
  el("pick").onchange = function () { pick(+this.value); };
}
function tile(k, v, s, c) { return '<div class="tile"><div class="k">' + k + '</div><div class="v" style="color:' + (c || "#FFFFFF") + '">' + v + '</div><div class="s">' + s + "</div></div>"; }
function renderTiles() {
  var c = selC(), R = rows(), rank = 0;
  var byNet = D.csas.map(function (x) { return x.net[P]; }).filter(function (v) { return v != null; }).sort(function (a, b) { return b - a; });
  rank = byNet.indexOf(c.net[P]) + 1;
  var y = yoyOf(c, P);
  if (c.net[P] == null) { el("tiles").innerHTML = '<div class="hint">No data for this period.</div>'; return; }
  el("tiles").innerHTML =
    tile("Net house hunters", kFmt(c.net[P]), "rank " + rank + " of " + byNet.length, c.net[P] >= 0 ? GREEN : RED) +
    tile("vs a year ago", y == null ? "–" : kFmt(y), y == null ? "" : y >= 0 ? "more pull than a year ago" : "less pull than a year ago", y == null ? GRAY : y >= 0 ? GREEN : RED) +
    tile("Looking in", num(c.inflow[P] || 0), c.pin[P] != null ? (c.pin[P] * 100).toFixed(0) + "% of searches here are from outside" : "searchers from other metros", GREEN) +
    tile("Locals looking out", num(c.outflow[P] || 0), c.pout[P] != null ? (c.pout[P] * 100).toFixed(0) + "% of locals searching elsewhere" : "local searchers looking elsewhere", RED);
}
function renderTrend() {
  var svg = el("cT"), W = svg.getBoundingClientRect().width || 360, H = svg.getBoundingClientRect().height || 220;
  var c = selC(), n = D.periods.length, L = 38, R = W - 96, T = 10, B = H - 20;
  var X = function (i) { return L + i / (n - 1) * (R - L); };
  var all = c.inflow.concat(c.outflow).concat(c.net).filter(function (v) { return v != null; });
  var lo = Math.min(0, Math.min.apply(null, all)), hi = Math.max.apply(null, all.concat([1]));
  var st = niceStep(hi - lo, 4); lo = Math.floor(lo / st) * st; hi = Math.ceil(hi / st) * st;
  var Y = function (v) { return B - (v - lo) / (hi - lo) * (B - T); };
  var s = '<rect x="' + (X(P) - 4) + '" y="' + T + '" width="8" height="' + (B - T) + '" fill="#3A3A3C"/>';
  for (var v = lo; v <= hi + st / 2; v += st) {
    s += '<line x1="' + L + '" x2="' + R + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="' + (Math.abs(v) < st / 1000 ? "#8E8E93" : "#3A3A3C") + '"/>';
    s += '<text x="' + (L - 5) + '" y="' + (Y(v) + 3.5) + '" font-size="10.5" text-anchor="end" fill="#8E8E93">' + axisK(v) + "</text>";
  }
  function line(vals, color, w) { var d = "", pen = false; vals.forEach(function (v, i) { if (v == null) { pen = false; return; } d += (pen ? "L" : "M") + X(i).toFixed(1) + "," + Y(v).toFixed(1); pen = true; }); return '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="' + w + '" stroke-linejoin="round"/>'; }
  s += line(c.inflow, GREEN, 2.2) + line(c.outflow, RED, 2.2) + line(c.net, "#FFFFFF", 2.6);
  var li = n - 1, items = [{ y: Y(c.inflow[li]), t: num(c.inflow[li] || 0), s: "looking in", c: GREEN }, { y: Y(c.outflow[li]), t: num(c.outflow[li] || 0), s: "looking out", c: RED }, { y: Y(c.net[li]), t: full(c.net[li] || 0), s: "net", c: "#FFFFFF" }];
  items.sort(function (a, b) { return a.y - b.y; });
  for (var k = 1; k < items.length; k++) if (items[k].y - items[k - 1].y < 26) items[k].y = items[k - 1].y + 26;
  items.forEach(function (it) { s += '<text x="' + (R + 8) + '" y="' + (it.y + 1) + '" font-size="12.5" font-weight="700" fill="' + it.c + '">' + it.t + '</text><text x="' + (R + 8) + '" y="' + (it.y + 13) + '" font-size="10.5" fill="' + it.c + '">' + it.s + "</text>"; });
  var lastY = null;
  D.periods.forEach(function (p, i) { var y = p.slice(0, 4); if (p.slice(5, 7) === "03" && y !== lastY) { lastY = y; s += '<text x="' + X(i) + '" y="' + (H - 4) + '" font-size="10.5" text-anchor="middle" fill="#8E8E93">' + "’" + y.slice(2) + "</text>"; } });
  if (cur != null) s += '<line x1="' + X(cur) + '" x2="' + X(cur) + '" y1="' + T + '" y2="' + B + '" stroke="#FFFFFF" stroke-dasharray="3 3"/>';
  svg.innerHTML = s;
  svg.__g = { L: L, R: R, n: n };
  var k2 = cur != null ? cur : P;
  el("roT").innerHTML = esc(pLong(D.periods[k2])) + ': <span style="color:' + GREEN + '">in ' + num(c.inflow[k2] || 0) + '</span> · <span style="color:' + RED + '">out ' + num(c.outflow[k2] || 0) + "</span> · net " + full(c.net[k2] || 0);
}
el("tT").addEventListener("click", function (e) {
  var g = el("cT").__g, r = el("cT").getBoundingClientRect(); if (!g) return;
  var i = Math.round((e.clientX - r.left - g.L) / (g.R - g.L) * (g.n - 1));
  cur = i >= 0 && i < g.n && cur !== i ? i : null; renderTrend();
});

// ---- origins and destinations ----
function odPeriod() {
  var ps = D.od ? D.od.periods : [];
  if (!ps.length) return null;
  var want = D.periods[P];
  if (ps.indexOf(want) >= 0) return { p: want, near: false };
  var best = ps.slice().sort(function (a, b) { return Math.abs(Date.parse(a) - Date.parse(want)) - Math.abs(Date.parse(b) - Date.parse(want)); })[0];
  return { p: best, near: true };
}
// Redfin may name a metro in full in one file and short in the other, so
// pairs are matched by Redfin's region id when both files carry it, else by
// the first city and first state ("Austin-Round Rock-Georgetown, TX CSA" = "Austin, TX")
function nkey(name) {
  var s = String(name).split(" CSA").join("").split(" Metro Area").join("").split(" metro area").join("").trim(), c = s.indexOf(",");
  if (c < 0) return s.toLowerCase();
  var cities = s.substring(0, c), st = s.substring(c + 1).trim().split("-")[0].split(" ")[0];
  var first = cities.split("--")[0].split("/")[0], parts = first.split("-"), out = parts[0];
  for (var i = 1; i < parts.length; i++) { if (/^[A-Z]/.test(parts[i])) break; out += "-" + parts[i]; }
  return (out.split("Urban ").join("").trim() + "|" + st).toLowerCase();
}
function csaFor(name, id) {
  if (!D.__byId) { D.__byId = {}; D.__byKey = {}; D.csas.forEach(function (x) { if (x.id != null) D.__byId[String(x.id)] = x; D.__byKey[nkey(x.n)] = x; }); }
  return (id != null && D.__byId[String(id)]) || D.__byKey[nkey(name)] || null;
}
function flowParts() {
  var op = odPeriod(); if (!op) return null;
  var me = selC(), P2 = {};
  (D.od.pairs[op.p] || []).forEach(function (r) {
    var o = csaFor(r[0], r[3]), d = csaFor(r[1], r[4]);
    var on = o ? o.n : r[0], dn = d ? d.n : r[1];
    if (d === me && o !== me) { (P2[on] = P2[on] || [0, 0])[0] += r[2]; }
    if (o === me && d !== me) { (P2[dn] = P2[dn] || [0, 0])[1] += r[2]; }
  });
  var parts = Object.keys(P2).map(function (k) { return { n: k, i: P2[k][0], o: P2[k][1] }; });
  return { op: op, parts: parts };
}
function fv(p) { return fmode === "in" ? p.i : fmode === "out" ? p.o : p.i - p.o; }
function topFlows(F, n) { return F.parts.filter(function (p) { return fmode === "net" ? fv(p) !== 0 : fv(p) > 0; }).sort(function (a, b) { return Math.abs(fv(b)) - Math.abs(fv(a)); }).slice(0, n); }
function fcolor(v) { return fmode === "in" ? GREEN : fmode === "out" ? RED : v >= 0 ? GREEN : RED; }
function posOf(name) { var c = csaFor(name, null); return c ? coord(c) : null; }
function fitBox(pts) {
  var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  pts.forEach(function (p) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); });
  var pad = 34, w = Math.max(220, x1 - x0 + 2 * pad), h = Math.max(140, y1 - y0 + 2 * pad), asp = D.mapW / D.mapH;
  if (w / h < asp) w = h * asp; else h = w / asp;
  if (w > D.mapW) { w = D.mapW; h = D.mapH; }
  var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  return [Math.max(0, Math.min(D.mapW - w, cx - w / 2)), Math.max(0, Math.min(D.mapH - h, cy - h / 2)), w, h];
}
function arc(a, b) { var mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1]; return "M" + a[0].toFixed(1) + "," + a[1].toFixed(1) + "Q" + (mx - dy * 0.22).toFixed(1) + "," + (my + dx * 0.22).toFixed(1) + " " + b[0].toFixed(1) + "," + b[1].toFixed(1); }
function renderFlows() {
  var bs = el("fmode").querySelectorAll("button");
  for (var i = 0; i < bs.length; i++) { bs[i].className = bs[i].getAttribute("data-k") === fmode ? "on" : ""; bs[i].onclick = function () { fmode = this.getAttribute("data-k"); renderFlows(); }; }
  var F = flowParts(), svg = el("fmap"), c = selC(), here = coord(c);
  if (!F) { svg.innerHTML = ""; el("flist").innerHTML = ""; el("roF").textContent = "Redfin's origin-destination file isn't loaded" + (D.odError ? ": " + D.odError : ".") + " It's retried each time you open this."; el("fnote").textContent = ""; return; }
  if (!F.parts.length) { svg.innerHTML = ""; svg.removeAttribute("viewBox"); el("flist").innerHTML = ""; el("roF").textContent = "Couldn't find " + c.n + " in Redfin's origin-destination file."; el("fnote").textContent = "For the fix, a screenshot of this helps: the file names metros like " + ((D.od && D.od.sample) || []).join("; ") + " · columns: " + ((D.od && D.od.head) || []).join(", "); return; }
  var top = topFlows(F, 10), ti = 0, to = 0;
  F.parts.forEach(function (p) { ti += p.i; to += p.o; });
  el("roF").innerHTML = (F.op.near ? '<span style="color:#FF9F0A">Nearest period with this detail: </span>' : "") + esc(pLong(F.op.p)) + '<br><span style="color:' + GREEN + '">Looking in: ' + num(ti) + '</span> · <span style="color:' + RED + '">locals looking out: ' + num(to) + "</span> (the 50 biggest metros only)";
  var items = [], pts = [];
  top.forEach(function (p) { var xy = posOf(p.n); if (xy) { items.push({ p: p, xy: xy }); pts.push(xy); } });
  if (here && items.length) {
    pts.push(here);
    var vb = fitBox(pts), k = vb[2] / (svg.getBoundingClientRect().width || 360), mx = 1;
    items.forEach(function (it) { mx = Math.max(mx, Math.abs(fv(it.p))); });
    svg.setAttribute("viewBox", vb.join(" "));
    var s = '<path d="' + STATE_PATH + '" fill="#2C2C2E" stroke="#48484A" stroke-width="1" vector-effect="non-scaling-stroke"/>';
    items.slice().reverse().forEach(function (it) { var v = fv(it.p), out = fmode === "out" || (fmode === "net" && v < 0); s += '<path d="' + (out ? arc(here, it.xy) : arc(it.xy, here)) + '" fill="none" stroke="' + fcolor(v) + '" stroke-opacity="0.75" stroke-width="' + (1.2 + 6 * Math.sqrt(Math.abs(v) / mx)).toFixed(1) + '" stroke-linecap="round" vector-effect="non-scaling-stroke"/>'; });
    items.forEach(function (it) { var v = fv(it.p); s += '<circle cx="' + it.xy[0] + '" cy="' + it.xy[1] + '" r="' + ((2.5 + 3.5 * Math.sqrt(Math.abs(v) / mx)) * k).toFixed(2) + '" fill="' + fcolor(v) + '" stroke="#000000" stroke-width="' + (0.8 * k).toFixed(2) + '"/>'; });
    s += '<circle cx="' + here[0] + '" cy="' + here[1] + '" r="' + (6 * k).toFixed(2) + '" fill="#FFFFFF" stroke="#000000" stroke-width="' + (1.2 * k).toFixed(2) + '"/>';
    var fs = 11 * k, boxes = [];
    var lab = function (txt, x, y, color, bold) {
      var w = txt.length * fs * 0.55, h = fs * 1.15, tries = [[x + 6 * k, y - h / 2], [x - 6 * k - w, y - h / 2], [x - w / 2, y - h - 6 * k], [x - w / 2, y + 6 * k]];
      for (var q = 0; q < tries.length; q++) {
        var bx = tries[q][0], by = tries[q][1], ok = bx >= vb[0] && bx + w <= vb[0] + vb[2];
        for (var j = 0; j < boxes.length && ok; j++) { var o = boxes[j]; if (bx < o.x + o.w && bx + w > o.x && by < o.y + o.h && by + h > o.y) ok = false; }
        if (ok) { boxes.push({ x: bx, y: by, w: w, h: h }); return '<text x="' + bx.toFixed(1) + '" y="' + (by + h * 0.8).toFixed(1) + '" font-size="' + fs.toFixed(2) + '" font-weight="' + (bold ? 800 : 600) + '" fill="' + color + '" stroke="#000000" stroke-width="' + (3 * k).toFixed(2) + '" paint-order="stroke">' + esc(txt) + "</text>"; }
      }
      return "";
    };
    s += lab(city(c.n), here[0], here[1], "#FFFFFF", true);
    boxes.push({ x: here[0] - 7 * k, y: here[1] - 7 * k, w: 14 * k, h: 14 * k });
    items.slice(0, 7).forEach(function (it) { s += lab(city(it.p.n), it.xy[0], it.xy[1], "#E5E5EA", false); });
    svg.innerHTML = s;
  } else { svg.innerHTML = ""; svg.removeAttribute("viewBox"); }
  var mx2 = Math.max.apply(null, top.map(function (p) { return Math.abs(fv(p)); }).concat([1]));
  el("flist").innerHTML = top.map(function (p, k2) {
    var v = fv(p), col = fcolor(v), sub = fmode === "net" ? "in " + num(p.i) + " · out " + num(p.o) : fmode === "in" ? (ti ? Math.round(p.i / ti * 100) + "% of searchers looking in" : "") : (to ? Math.round(p.o / to * 100) + "% of locals looking out" : "");
    return '<div class="lr"><span class="nm"><b>' + (k2 + 1) + "</b>" + esc(p.n) + '<span class="sub">' + esc(sub) + '</span></span><span class="bar"><i style="width:' + Math.max(2, Math.abs(v) / mx2 * 100).toFixed(1) + "%;background:" + col + '"></i></span><span class="v" style="color:' + col + '">' + (fmode === "net" ? full(v) : num(v)) + "</span></div>";
  }).join("") || '<div class="hint">No flows to show.</div>';
  el("fnote").textContent = "Redfin keeps origin-destination detail for its most recent periods only, and only between its ~50 biggest metros; searchers from smaller places count in the totals above but not in these pairs.";
}

function renderAll() {
  if (!D) return;
  el("headline").textContent = headlineText();
  el("period").value = String(P);
  renderMap(); renderBoard(); renderTiles(); renderTrend(); renderFlows();
  el("pick").value = String(sel);
}
window.update = function (d) {
  if (!d) return;
  var first = !D;
  D = d;
  STATE_PATH = D.states.split("|").map(function (r) { return "M" + r.split(" ").join("L") + "Z"; }).join("");
  if (first) { P = D.periods.length - 1; D.csas.forEach(function (c, i) { if (c.n === D.defaultMetro) sel = i; }); }
  else P = Math.min(P, D.periods.length - 1);
  el("loading").style.display = "none"; el("blocks").style.display = "";
  el("progress").textContent = D.progress || "";
  renderPeriods(); renderPicker(); renderAll();
  el("note").textContent = "Source: Redfin U.S. Migration Patterns (redfin.com/news/data-center/migration-patterns). A Redfin.com user counts as looking to move when they view 20 or more homes for sale or rent in a metro other than their own in a month; users looking at several metros are split among them. Metros are Census combined statistical areas (about 50 of the biggest). This is intent to move from people shopping on Redfin, not actual moves (the Census widget has those). Redfin updates quarterly. Data checked " + D.checked + "." + (D.error ? " Last check failed: " + D.error : "");
  window.__rendered = true;
};
window.shareInfo = function () { return { title: "Redfin Migration", name: D ? selC().n : "", asOf: D ? pLong(D.periods[D.periods.length - 1]) : "" }; };
window.showError = function (msg) { el("loading").style.display = "none"; var e = el("err"); e.style.display = ""; e.textContent = msg; };
window.addEventListener("resize", function () { if (D) renderAll(); });
// Share as PDF: three 16:9 slides for the period picked on screen.
// 1) the map beside the leaderboard; 2) the picked metro's inflow and outflow
// beside its net vs a year earlier; 3) where its house hunters come from and
// look. Headlines state the result, captions explain each chart, labels sit at
// the right edge, and a dark banner credits the source. Vector.
window.printPdf = function (jsPDF, fonts) {
  var W = 792, H = 445.5, pages = 3;
  var doc = new jsPDF({ unit: "pt", format: [W, H], orientation: "landscape" });
  var FACE = "helvetica";
  if (fonts && fonts.regular && fonts.bold) {
    doc.addFileToVFS("Narrow-Regular.ttf", fonts.regular); doc.addFont("Narrow-Regular.ttf", "Narrow", "normal");
    doc.addFileToVFS("Narrow-Bold.ttf", fonts.bold); doc.addFont("Narrow-Bold.ttf", "Narrow", "bold");
    FACE = "Narrow";
  }
  var INK = [28, 28, 30], GRY = [110, 110, 115], RULE = [222, 222, 226], PG = [30, 158, 69], PR = [215, 0, 21];
  function font(bold, size, c) { doc.setFont(FACE, bold ? "bold" : "normal"); doc.setFontSize(size); doc.setTextColor(c[0], c[1], c[2]); }
  function clean(t) { return String(t).split("−").join("-").split("’").join("'").split("–").join("-").split("▲ ").join("").split("▼ ").join(""); }
  function fill(c) { doc.setFillColor(c[0], c[1], c[2]); }
  function stroke(c) { doc.setDrawColor(c[0], c[1], c[2]); }
  function headline(text) {
    var size = 21, lines;
    do { font(true, size, INK); lines = doc.splitTextToSize(clean(text), W - 72); size -= 1; } while (lines.length > 1 && size > 15);
    if (lines.length > 2) lines = [lines[0], lines.slice(1).join(" ")];
    doc.text(lines, 36, 42);
    return 42 + (lines.length - 1) * (size + 4);
  }
  function titles(top, title, sub, cx) { font(true, 11.5, INK); doc.text(clean(title), cx, top + 28, { align: "center" }); font(false, 9, GRY); doc.text(clean(sub), cx, top + 41, { align: "center" }); }
  function caption(text, x0, x1, y) { font(false, 8.4, GRY); doc.text(doc.splitTextToSize(clean(text), x1 - x0).slice(0, 4), x0, y); }
  function banner(page) {
    var bh = 44, by = H - bh;
    doc.setFillColor(28, 28, 30); doc.rect(0, by, W, bh, "F");
    doc.setFillColor(201, 162, 39); doc.rect(W - 176, by + 6, 2, bh - 12, "F");
    font(false, 7.2, [235, 235, 240]);
    var src = "Source: Redfin U.S. Migration Patterns. Redfin.com users who viewed 20+ homes for sale or rent in a metro other than their own in a month, rolling 3-month windows; metros are combined statistical areas (about the 50 biggest). Intent to move from Redfin shoppers, not actual moves.";
    doc.text(doc.splitTextToSize(src, W - 176 - 40 - 110), 28, by + 13);
    font(false, 7.5, [200, 200, 205]);
    doc.text("Data through " + pLabel(D.periods[D.periods.length - 1]), W - 188, by + 20, { align: "right" });
    doc.text(page + " of " + pages, W - 188, by + 31, { align: "right" });
    font(true, 12.5, [255, 255, 255]);
    doc.text("Redfin", W - 162, by + 20);
    doc.text("Migration", W - 162, by + 34);
  }
  function statesIn(MX, MY) {
    doc.setFillColor(237, 237, 240); doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.6);
    D.states.split("|").forEach(function (ring) {
      var pts = ring.split(" ").map(function (q) { var c = q.split(","); return [MX(+c[0]), MY(+c[1])]; });
      if (pts.length < 3) return;
      var rel = []; for (var k = 1; k < pts.length; k++) rel.push([pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]]);
      doc.lines(rel, pts[0][0], pts[0][1], [1, 1], "FD", true);
    });
  }
  function mapFrame(vb, x0, x1, y0, y1) {
    var sc = Math.min((x1 - x0) / vb[2], (y1 - y0) / vb[3]), ox = (x0 + x1) / 2 - vb[2] * sc / 2, oy = y0 + ((y1 - y0) - vb[3] * sc) / 2;
    return { sc: sc, ox: ox, oy: oy, w: vb[2] * sc, h: vb[3] * sc, X: function (x) { return ox + (x - vb[0]) * sc; }, Y: function (y) { return oy + (y - vb[1]) * sc; } };
  }
  function clipTo(f) { doc.saveGraphicsState(); doc.rect(f.ox, f.oy, f.w, f.h, null); doc.clip(); doc.discardPath(); }
  function bars(list, L, R, y, rh, nameW, color, valOf, rankOf, subOf) {
    var mx = Math.max.apply(null, list.map(function (r) { return Math.abs(valOf(r)); }).concat([1])), bx0 = L + nameW + 6, bx1 = R - 64;
    list.forEach(function (r, k) {
      font(r.n === selC().n, 8.6, INK);
      var nm = clean(r.n); while (doc.getTextWidth(rankOf(k) + ". " + nm) > nameW && nm.length > 4) nm = nm.slice(0, -2);
      doc.text(rankOf(k) + ". " + nm, L, y + 3);
      var w = Math.max(1.5, Math.abs(valOf(r)) / mx * (bx1 - bx0));
      fill(color); doc.rect(bx0, y - 4, w, 8, "F");
      font(true, 8.6, color); var t = clean(subOf ? subOf(r) : kFmt(valOf(r))); doc.text(t, bx0 + w + 4, y + 3);
      y += rh;
    });
    return y;
  }
  var c = selC(), cm = city(c.n), per = pLabel(D.periods[P]), perL = pLong(D.periods[P]);

  // ---- 1. map + leaderboard ----
  var top = headline(headlineText());
  var pL = 30, pR = 384;
  titles(top, "Net House Hunters by Metro", perL + " · bubble size = net searchers", (pL + pR) / 2);
  var mf = mapFrame([0, 0, D.mapW, D.mapH], pL, pR, top + 52, H - 112);
  clipTo(mf); statesIn(mf.X, mf.Y);
  var mpts = [], mx = 1;
  D.csas.forEach(function (x, i) { var xy = coord(x), v = x.net[P]; if (xy && v != null) { mpts.push({ c: x, i: i, x: xy[0], y: xy[1], v: v }); mx = Math.max(mx, Math.abs(v)); } });
  mpts.forEach(function (p) { p.r = (4 + 26 * Math.sqrt(Math.abs(p.v) / mx)) * mf.sc; });
  mpts.sort(function (a, b) { return b.r - a.r; });
  doc.setGState && doc.GState && doc.setGState(new doc.GState({ opacity: 0.8 }));
  mpts.forEach(function (p) { fill(p.v >= 0 ? PG : PR); doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.5); doc.circle(mf.X(p.x), mf.Y(p.y), p.r, "FD"); });
  doc.setGState && doc.GState && doc.setGState(new doc.GState({ opacity: 1 }));
  var boxes = [];
  mpts.slice().sort(function (a, b) { return Math.abs(b.v) - Math.abs(a.v); }).slice(0, 8).concat(mpts.filter(function (p) { return p.i === sel; })).forEach(function (p) {
    var me = p.i === sel; font(me, me ? 9 : 7.8, me ? INK : [60, 60, 65]);
    var nm = clean(city(p.c.n)), w = doc.getTextWidth(nm), tries = [mf.X(p.x) + p.r + 3, mf.X(p.x) - p.r - 3 - w];
    for (var t = 0; t < 2; t++) {
      var bx = tries[t], by = mf.Y(p.y) - 5, ok = bx > mf.ox && bx + w < mf.ox + mf.w;
      for (var j = 0; j < boxes.length && ok; j++) { var o = boxes[j]; if (bx < o.x + o.w && bx + w > o.x && by < o.y + o.h && by + 9 > o.y) ok = false; }
      if (ok) { boxes.push({ x: bx, y: by, w: w, h: 9 }); doc.text(nm, bx, by + 7.5); break; }
    }
    if (me) { stroke(INK); doc.setLineWidth(1.2); doc.circle(mf.X(p.x), mf.Y(p.y), p.r + 2.5, "S"); }
  });
  doc.restoreGraphicsState();
  caption("Each bubble is one of the ~50 biggest metros, sized by net house hunters: Redfin users elsewhere looking at homes there minus locals looking at homes elsewhere. Green draws more searchers than it loses; red the reverse. " + cm + " is circled.", pL + 6, pR - 6, H - 96);
  var R = rows(), up = R.slice(0, 8).filter(function (r) { return r.v > 0; }), dn = R.slice(-8).reverse().filter(function (r) { return r.v < 0; });
  var cL = 424, cR = W - 36;
  titles(top, metric === "yoy" ? "Biggest Changes in Net House Hunters vs a Year Ago" : "Biggest Draws and Biggest Losers", perL, (cL + cR) / 2);
  var ry = top + 64, rh = Math.min(14, (H - 128 - ry - 16) / (up.length + dn.length + 2));
  font(true, 8.5, PG); doc.text(metric === "yoy" ? "GAINING" : "DRAWING", cL, ry); ry += rh;
  ry = bars(up.map(function (r) { return { n: r.c.n, v: r.v }; }), cL, cR, ry, rh, 118, PG, function (r) { return r.v; }, function (k) { return k + 1; });
  ry += 4; font(true, 8.5, PR); doc.text(metric === "yoy" ? "SLIPPING" : "LOSING", cL, ry); ry += rh;
  bars(dn.map(function (r) { return { n: r.c.n, v: r.v }; }), cL, cR, ry, rh, 118, PR, function (r) { return r.v; }, function (k) { return R.length - k; });
  caption((metric === "yoy" ? "Change in net house hunters vs the same 3 months a year earlier. " : "Net house hunters in the 3 months. ") + "Search intent tends to lead actual moves and purchase demand by months; the Census widget shows the moves themselves, a year or more later.", cL, cR, H - 96);
  banner(1);

  // ---- 2. the picked metro ----
  doc.addPage([W, H], "landscape");
  var y1 = yoyOf(c, P);
  top = headline(cm + (c.net[P] >= 0 ? " Drew " + num(c.net[P]) + " More House Hunters Than It Lost" : " Lost " + num(c.net[P]) + " More House Hunters Than It Drew") + " in " + per + (y1 == null ? "" : ", " + (y1 >= 0 ? "Up " : "Down ") + num(y1) + " From a Year Earlier"));
  var n = D.periods.length, aL = 74, aR = 300, aT = top + 58, aB = H - 120;
  titles(top, "Looking In vs Locals Looking Out", "Redfin users, rolling 3 months", (aL + aR + 60) / 2);
  var all = c.inflow.concat(c.outflow).filter(function (v) { return v != null; });
  var lo = 0, hi = Math.max.apply(null, all.concat([1])), st = niceStep(hi, 4); hi = Math.ceil(hi / st) * st;
  var X = function (i) { return aL + i / (n - 1) * (aR - aL); }, Y = function (v) { return aB - (v - lo) / (hi - lo) * (aB - aT); };
  fill([243, 243, 246]); doc.rect(X(P) - 3, aT, 6, aB - aT, "F");
  for (var v = lo; v <= hi + st / 2; v += st) { stroke(RULE); doc.setLineWidth(0.5); doc.line(aL, Y(v), aR, Y(v)); font(false, 8, GRY); doc.text(clean(axisK(v)), aL - 5, Y(v) + 3, { align: "right" }); }
  function lineP(vals, col, w, XF, YF) { stroke(col); doc.setLineWidth(w); var px = null, py = null; vals.forEach(function (v2, i) { if (v2 == null) { px = null; return; } var x = XF(i), y = YF(v2); if (px != null) doc.line(px, py, x, y); px = x; py = y; }); }
  lineP(c.inflow, PG, 2, X, Y); lineP(c.outflow, PR, 2, X, Y);
  var yr = null; D.periods.forEach(function (p, i) { var yy = p.slice(0, 4); if (p.slice(5, 7) === "03" && yy !== yr) { yr = yy; font(false, 8, GRY); doc.text(yy, X(i), aB + 11, { align: "center" }); } });
  var it = [{ y: Y(c.inflow[n - 1]), v: num(c.inflow[n - 1] || 0), t: "looking in", c: PG }, { y: Y(c.outflow[n - 1]), v: num(c.outflow[n - 1] || 0), t: "looking out", c: PR }];
  it.sort(function (a, b) { return a.y - b.y; }); if (it[1].y - it[0].y < 24) it[1].y = it[0].y + 24;
  it.forEach(function (q) { font(true, 10, q.c); doc.text(q.v, aR + 8, q.y + 2); font(false, 8.2, q.c); doc.text(q.t, aR + 8, q.y + 12); });
  caption("Green: Redfin users in other metros looking at homes in " + cm + ". Red: " + cm + " users looking at homes elsewhere. The gap between them is the net; the shaded line marks " + perL + ".", aL - 40, aR + 90, H - 98);
  // right: net, bars, with the year-earlier window for comparison
  var bL = 470, bR = W - 118, bT = top + 58, bB = H - 120;
  titles(top, "Net House Hunters, Each 3 Months", "In minus out · quarters", (bL + bR + 60) / 2);
  var qs = []; D.periods.forEach(function (p, i) { if (+p.slice(5, 7) % 3 === 0 && c.net[i] != null) qs.push(i); });
  var nv = qs.map(function (i) { return c.net[i]; }), lo2 = Math.min(0, Math.min.apply(null, nv)), hi2 = Math.max(0, Math.max.apply(null, nv.concat([1])));
  var st2 = niceStep(hi2 - lo2 || 1, 5); lo2 = Math.floor(lo2 / st2) * st2; hi2 = Math.ceil(hi2 / st2) * st2;
  var Y2 = function (v3) { return bB - (v3 - lo2) / (hi2 - lo2) * (bB - bT); }, slot = (bR - bL) / Math.max(1, qs.length), bw = Math.max(2, slot * 0.68);
  for (var v4 = lo2; v4 <= hi2 + st2 / 2; v4 += st2) { var z = Math.abs(v4) < st2 / 1000; stroke(z ? [120, 120, 125] : RULE); doc.setLineWidth(z ? 0.9 : 0.5); doc.line(bL, Y2(v4), bR, Y2(v4)); font(false, 8, GRY); doc.text(clean(axisK(v4)), bL - 5, Y2(v4) + 3, { align: "right" }); }
  qs.forEach(function (i, k) { var v5 = c.net[i], x = bL + slot * (k + 0.5); fill(i === P ? (v5 >= 0 ? PG : PR) : (v5 >= 0 ? [140, 205, 160] : [236, 140, 148])); doc.rect(x - bw / 2, Math.min(Y2(v5), Y2(0)), bw, Math.max(0.6, Math.abs(Y2(v5) - Y2(0))), "F"); if (D.periods[i].slice(5, 7) === "03") { font(false, 8, GRY); doc.text(D.periods[i].slice(0, 4), x, bB + 11, { align: "center" }); } });
  var lq = qs[qs.length - 1]; if (lq != null) { var lv = c.net[lq]; font(true, 10, lv >= 0 ? PG : PR); doc.text(clean(full(lv)), bR + 8, Y2(lv) + 2); font(false, 8.2, lv >= 0 ? PG : PR); doc.text(pLabel(D.periods[lq]), bR + 8, Y2(lv) + 12); }
  caption("Net house hunters each quarter; the darker bar is " + per + (y1 == null ? "." : ", " + (y1 >= 0 ? "up " : "down ") + num(y1) + " from the same quarter a year earlier.") + " Rising net interest usually shows up later as stronger purchase demand and prices; a fading net is an early warning.", bL - 30, W - 36, H - 98);
  banner(2);

  // ---- 3. where they come from and look ----
  doc.addPage([W, H], "landscape");
  var F = flowParts();
  if (!F) { headline(cm + ": Where House Hunters Come From and Look"); font(false, 12, GRY); doc.text("Redfin's origin-destination file isn't loaded.", 60, 110); banner(3); return doc; }
  var ins = F.parts.filter(function (p) { return p.i > 0; }).sort(function (a, b) { return b.i - a.i; }), outs = F.parts.filter(function (p) { return p.o > 0; }).sort(function (a, b) { return b.o - a.o; });
  top = headline(cm + "'s House Hunters Came Most From " + (ins[0] ? city(ins[0].n) : "Elsewhere") + "; Locals Looked Most at " + (outs[0] ? city(outs[0].n) : "Elsewhere") + ", " + pLabel(F.op.p));
  var fL = 30, fR = 384, topF = topFlows(F, 10), here = coord(c), items = [], fp = [];
  titles(top, fmode === "in" ? "Where Searchers Looking at " + cm + " Live" : fmode === "out" ? "Where " + cm + " Locals Are Looking" : "Net Flows by Metro", pLong(F.op.p) + " · line width = searchers", (fL + fR) / 2);
  topF.forEach(function (p) { var xy = posOf(p.n); if (xy) { items.push({ p: p, xy: xy }); fp.push(xy); } });
  if (here && items.length) {
    fp.push(here);
    var vb = fitBox(fp), ff = mapFrame(vb, fL, fR, top + 52, H - 112), fmx = 1;
    items.forEach(function (q) { fmx = Math.max(fmx, Math.abs(fv(q.p))); });
    clipTo(ff); statesIn(ff.X, ff.Y);
    items.slice().reverse().forEach(function (q) {
      var v6 = fv(q.p), out = fmode === "out" || (fmode === "net" && v6 < 0), col = fmode === "in" ? PG : fmode === "out" ? PR : v6 >= 0 ? PG : PR;
      var a = out ? here : q.xy, b = out ? q.xy : here, mx2 = (a[0] + b[0]) / 2, my2 = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1], cx = mx2 - dy * 0.22, cy = my2 + dx * 0.22;
      stroke(col); doc.setLineWidth(0.8 + 4.5 * Math.sqrt(Math.abs(v6) / fmx));
      var lx = ff.X(a[0]), ly = ff.Y(a[1]);
      for (var s2 = 1; s2 <= 16; s2++) { var t = s2 / 16, u = 1 - t, x = u * u * a[0] + 2 * u * t * cx + t * t * b[0], y = u * u * a[1] + 2 * u * t * cy + t * t * b[1]; doc.line(lx, ly, ff.X(x), ff.Y(y)); lx = ff.X(x); ly = ff.Y(y); }
    });
    items.forEach(function (q) { var v7 = fv(q.p); fill(fmode === "in" ? PG : fmode === "out" ? PR : v7 >= 0 ? PG : PR); doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.5); doc.circle(ff.X(q.xy[0]), ff.Y(q.xy[1]), 2 + 3 * Math.sqrt(Math.abs(v7) / fmx), "FD"); });
    fill(INK); doc.circle(ff.X(here[0]), ff.Y(here[1]), 4.5, "F");
    var bx2 = [];
    var labP = function (txt, x, y, bold) {
      font(bold, bold ? 9.5 : 8, bold ? INK : [70, 70, 75]);
      var w = doc.getTextWidth(clean(txt)), tries = [[x + 6, y + 3], [x - 6 - w, y + 3], [x - w / 2, y - 7], [x - w / 2, y + 13]];
      for (var q2 = 0; q2 < tries.length; q2++) {
        var bx = tries[q2][0], by = tries[q2][1] - 8, ok = bx >= ff.ox && bx + w <= ff.ox + ff.w;
        for (var j = 0; j < bx2.length && ok; j++) { var o = bx2[j]; if (bx < o.x + o.w && bx + w > o.x && by < o.y + o.h && by + 9 > o.y) ok = false; }
        if (ok) { bx2.push({ x: bx, y: by, w: w, h: 9 }); doc.text(clean(txt), tries[q2][0], tries[q2][1]); return; }
      }
    };
    labP(cm, ff.X(here[0]), ff.Y(here[1]), true);
    items.slice(0, 7).forEach(function (q) { labP(city(q.p.n), ff.X(q.xy[0]), ff.Y(q.xy[1]), false); });
    doc.restoreGraphicsState();
  }
  caption("Lines join " + cm + " with the 10 metros " + (fmode === "out" ? "its locals look at most" : fmode === "net" ? "with the biggest net swings (green: more looking in than out)" : "whose Redfin users look at it most") + "; thicker means more searchers. Only the ~50 biggest metros are paired.", fL + 6, fR - 6, H - 96);
  var gL = 424, gR = W - 36;
  titles(top, "Top Origins and Top Destinations", pLong(F.op.p) + " · Redfin users", (gL + gR) / 2);
  var oi = ins.slice(0, 7), oo = outs.slice(0, 7), yy2 = top + 64, rh2 = Math.min(14, (H - 128 - yy2 - 16) / (oi.length + oo.length + 2));
  font(true, 8.5, PG); doc.text("LOOKING AT " + cm.toUpperCase() + " FROM", gL, yy2); yy2 += rh2;
  yy2 = bars(oi, gL, gR, yy2, rh2, 108, PG, function (p) { return p.i; }, function (k) { return k + 1; }, function (p) { return num(p.i); });
  yy2 += 4; font(true, 8.5, PR); doc.text(cm.toUpperCase() + " LOCALS LOOKING AT", gL, yy2); yy2 += rh2;
  bars(oo, gL, gR, yy2, rh2, 108, PR, function (p) { return p.o; }, function (k) { return k + 1; }, function (p) { return num(p.o); });
  caption("Searchers split across several metros are divided among them, so the numbers are weighted users, not people. Origins feed a metro's demand; destinations show where its own buyers are drifting.", gL, gR, H - 96);
  banner(3);
  return doc;
};

</script>
</body>
</html>`;

// ---------- Full screen ----------
function posFor(name) {
  const parts = String(name).split(",");
  const city = parts[0].split("-")[0].split("/")[0].trim().replace(/^Urban /, "");
  const st = (parts[1] || "").trim().split("-")[0].slice(0, 2);
  const ll = METRO_COORDS_FALLBACK[`${city}|${st}`];
  if (!ll) return null;
  const xy = projectUS(ll[1], ll[0]);
  return xy ? [Math.round(xy[0] * 10) / 10, Math.round(xy[1] * 10) / 10] : null;
}
function payload(s, progress) {
  const pos = {};
  for (const c of s.csas) { const p = posFor(c.n); if (p) pos[c.n] = p; }
  return {
    periods: s.periods, csas: s.csas, nat: s.nat, od: s.od || null, pos,
    states: STATES, mapW: MAP_W, mapH: MAP_H, defaultMetro: DEFAULT_METRO,
    checked: s.checked ? new Date(s.checked).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "",
    error: s.error || null, odError: s.odError || null, progress: progress || "",
  };
}
async function openFullScreen(saved) {
  const wv = updWV(new WebView());
  await wv.loadHTML(...updArgs(PAGE_HTML.replace("__SHARE__", () => "<script>" + SHARE_PAGE_JS + "</script>")));
  const push = async (s, progress) => {
    for (let i = 0; i < 8; i++) {
      try { await wv.evaluateJavaScript(`window.update(${JSON.stringify(payload(s, progress))});0`); } catch (e) {}
      await sleep(250);
      let ok = false;
      try { ok = (await wv.evaluateJavaScript("window.__rendered === true")) === true; } catch (e) {}
      if (ok) break;
    }
  };
  await presentWithSharing(wv, async (isOpen) => {
    await sleep(300);
    if (saved) await push(saved, "");
    try {
      const fresh = await refresh(saved, false);
      if (!saved || fresh.fetched !== saved.fetched || fresh.error !== saved.error) await push(fresh, "");
      const face = readJSON(FACE_FILE);
      if (face && face.pending && !fresh.error) writeFace(fresh, null);
    } catch (e) {
      if (!saved) {
        try { await wv.evaluateJavaScript(`window.showError(${JSON.stringify("Couldn't load Redfin's data: " + (e.message || e) + ". Check the connection and open it again.")});0`); } catch (e2) {}
      }
    }
  });
}

// ---------- Run ----------
if (config.runsInWidget || PREVIEW_WIDGET_IN_APP) {
  let widget;
  try {
    let face = readJSON(FACE_FILE);
    if (!face) { const s = readJSON(STORE_FILE); if (s && s.csas) face = writeFace(s, null); }
    if (!face) throw new Error("Open the script once in Scriptable to download Redfin's data.");
    // drawn from the saved copy; the peek for a newer file gets 8 seconds at most
    const probed = await Promise.race([widgetProbe(face).catch(() => null), sleep(8000).then(() => null)]);
    if (probed) face = probed;
    widget = finishWidget(smallImage(face));
  } catch (e) {
    widget = errorWidget(e.message || String(e));
  }
  if (config.runsInWidget) Script.setWidget(widget);
  else await widget.presentSmall();
} else {
  const saved = readJSON(STORE_FILE);
  await openFullScreen(saved && saved.csas ? saved : null);
}
Script.complete();
// Update test, Nov 17, 2026 (no change in behavior)
