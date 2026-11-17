// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: blue; icon-glyph: home;

// ---- Shared settings (saved on this phone by the Setup script) ----
// Keys and personal settings live in the phone's keychain, not in this file,
// so the file can be shared as is.
function setting(key, fallback) {
  try { if (Keychain.contains(key)) { const v = Keychain.get(key); if (v) return v; } } catch (e) {}
  return fallback;
}


// Housing Affordability Gap for Scriptable
// The income needed to buy the median-priced home vs the median household
// income, from the Atlanta Fed's Home Ownership Affordability Monitor (HOAM).
// "Qualifying income" is the income at which the full monthly cost of owning
// the median-priced home (10% down, Freddie Mac 30-year rate, property tax,
// insurance and PMI) equals 30% of income.
// Data: the Atlanta Fed's free monthly Excel files (U.S. and metro). They are
// downloaded and unpacked on the phone; columns are found by name, and a file
// without them is rejected with the columns it did find, never guessed.
// Small widget: need vs earn for the U.S., the gap, and both lines over the
// last 5 years. Tap for the full screen: the U.S. lines and gap since the
// data starts, and any metro (opens on Austin), all pinch-zoomable. Share as PDF.

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
const US_URL = "https://www.atlantafed.org/-/media/Project/Atlanta/FRBA/Documents/research-and-data/data/hoam/HOAM_US_Affordability_Index.xlsx";
const METRO_URL = "https://www.atlantafed.org/-/media/Project/Atlanta/FRBA/Documents/research-and-data/data/hoam/HOAM_CBSA_Data.xlsx";
const DEFAULT_METRO = setting("home_metro", "Austin, TX").split(",")[0].trim(); // the city, as the metro list names it
const STORE_FILE = "affordability-gap-v1.json";
const CHECK_HOURS = 12;       // how often to ask the Atlanta Fed for newer files
const WIDGET_BUDGET_S = 24;   // a widget only gets seconds; past this it uses the saved copy
const MAX_MB = 45;            // skip files bigger than this (a phone can't unpack them)
const WIDGET_YEARS = 5;       // the widget's mini chart
const PREVIEW_WIDGET_IN_APP = false;

const NEED_HEX = "#5B8DEF";   // income needed (the chart's blue)
const EARN_HEX = "#D1D1D6";   // median household income
const GRAY = "#98989F";
const AMBER = "#FF9F0A";
const RED = "#FF453A";
const GREEN = "#30D158";
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// ---------- Map geometry ----------
// U.S. state outlines, simplified, already projected to Albers USA (Alaska and
// Hawaii as insets) in a 975 x 610 box. Rings split by "|", points "x,y".
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

// Where each metro goes on the map. Redfin's dashboard carries its own table of
// metro coordinates, which the script reads when it can; this built-in table
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
const money = (v) => (v < 0 ? "−" : "+") + "$" + Math.abs(Math.round(v)).toLocaleString("en-US");
const shortMonth = (m) => `${MON[+m.slice(5, 7) - 1]} ’${m.slice(2, 4)}`;
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
        if (s && s.us && s.us.months) return s;
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

// ---------- Reading the Atlanta Fed's Excel files ----------
// An .xlsx file is a zip of XML files. This runs inside a hidden web page
// (which has the unzipper): it unpacks the workbook, reads every sheet, finds
// the qualifying income, median income and index columns by name, and returns
// only the series, by region. Plain browser JavaScript, no outside libraries.
async function hoamParse(b64, mode) {
  var bin = atob(b64), buf = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  bin = null;
  var dv = new DataView(buf.buffer);
  var dec = new TextDecoder();
  // the zip's table of contents sits at the end of the file
  var eocd = -1;
  for (var e = buf.length - 22; e >= Math.max(0, buf.length - 70000); e--) {
    if (dv.getUint32(e, true) === 0x06054b50) { eocd = e; break; }
  }
  if (eocd < 0) throw new Error("not an Excel file (no zip directory)");
  var count = dv.getUint16(eocd + 10, true), p = dv.getUint32(eocd + 16, true), entries = {};
  for (var k = 0; k < count; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    var nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
    entries[dec.decode(buf.subarray(p + 46, p + 46 + nlen))] = {
      method: dv.getUint16(p + 10, true), csize: dv.getUint32(p + 20, true), off: dv.getUint32(p + 42, true),
    };
    p += 46 + nlen + xlen + clen;
  }
  async function read(name) {
    var en = entries[name];
    if (!en) return null;
    var start = en.off + 30 + dv.getUint16(en.off + 26, true) + dv.getUint16(en.off + 28, true);
    var data = buf.subarray(start, start + en.csize);
    if (en.method === 0) return dec.decode(data);
    return await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text();
  }
  var unxml = function (x) {
    return String(x).replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'").replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(+n); }).replace(/&amp;/g, "&");
  };
  var attr = function (tag, name) { var m = tag.match(new RegExp("\\b" + name + '="([^"]*)"')); return m ? m[1] : null; };

  // shared strings (text cells point into this list)
  var strings = [];
  var sst = await read("xl/sharedStrings.xml");
  if (sst) {
    var si = /<si>([\s\S]*?)<\/si>/g, mm;
    while ((mm = si.exec(sst))) {
      var parts = mm[1].match(/<t[^>]*>[\s\S]*?<\/t>/g) || [];
      strings.push(unxml(parts.join("")));
    }
  }
  // sheet names and where each sheet's XML lives
  var wb = (await read("xl/workbook.xml")) || "", rels = (await read("xl/_rels/workbook.xml.rels")) || "";
  var targets = {};
  (rels.match(/<Relationship\b[^>]*>/g) || []).forEach(function (t) { targets[attr(t, "Id")] = attr(t, "Target"); });
  var sheets = [];
  var sheetTags = wb.match(/<sheet\b[^>]*>/g) || [];
  for (var s = 0; s < sheetTags.length; s++) {
    var tg = targets[attr(sheetTags[s], "r:id")] || "";
    var path = tg.charAt(0) === "/" ? tg.slice(1) : "xl/" + tg.replace(/^\.\//, "");
    var xml = await read(path);
    if (!xml) continue;
    var rows = [], cell = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, c;
    while ((c = cell.exec(xml))) {
      var ref = attr(c[1], "r"), type = attr(c[1], "t"), body = c[2] || "";
      if (!ref) continue;
      var letters = ref.replace(/\d+/g, ""), row = parseInt(ref.replace(/[A-Z]+/g, ""), 10) - 1, col = 0;
      for (var L = 0; L < letters.length; L++) col = col * 26 + (letters.charCodeAt(L) - 64);
      col -= 1;
      var v = body.match(/<v>([\s\S]*?)<\/v>/), val = null;
      if (type === "s") val = v ? strings[+v[1]] : null;
      else if (type === "inlineStr") val = unxml((body.match(/<t[^>]*>[\s\S]*?<\/t>/g) || []).join(""));
      else if (type === "str" || type === "e") val = v ? unxml(v[1]) : null;
      else if (v) val = parseFloat(v[1]);
      if (val === null || val === "" || (typeof val === "number" && isNaN(val))) continue;
      (rows[row] = rows[row] || [])[col] = val;
    }
    sheets.push({ name: unxml(attr(sheetTags[s], "name") || "Sheet" + (s + 1)), rows: rows });
  }
  if (!sheets.length) throw new Error("the workbook had no readable sheets");

  // ----- find the series -----
  var MONS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  var pad = function (n) { return (n < 10 ? "0" : "") + n; };
  function toMonth(v) {
    if (v === null || v === undefined || v === "") return null;
    if (typeof v === "number") {
      if (v > 20000 && v < 80000) { var d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000); return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1); }
      if (v > 190001 && v < 210013 && v % 100 >= 1 && v % 100 <= 12) return Math.floor(v / 100) + "-" + pad(v % 100);
      return null;
    }
    var t = String(v).trim(), m;
    if ((m = t.match(/^(\d{4})[-\/.](\d{1,2})(?:[-\/.]\d{1,2})?(?:[T ].*)?$/))) return m[1] + "-" + pad(+m[2]);
    if ((m = t.match(/^(\d{1,2})\/\d{1,2}\/(\d{2,4})$/))) { var y = +m[2]; if (y < 100) y += 2000; return y + "-" + pad(+m[1]); }
    if ((m = t.match(/^([A-Za-z]{3})[A-Za-z]*\.?[\s\-'’]*(\d{2}|\d{4})$/))) {
      var mi = MONS.indexOf(m[1].toLowerCase());
      if (mi >= 0) { var yy = +m[2]; if (yy < 100) yy += 2000; return yy + "-" + pad(mi + 1); }
    }
    if ((m = t.match(/^(\d{4})\s*M(\d{1,2})$/i))) return m[1] + "-" + pad(+m[2]);
    return null;
  }
  function classify(h) {
    h = String(h == null ? "" : h).replace(/_/g, " ");
    // the gap between qualifying and actual income, in dollars or percent
    if (/differ|gap/i.test(h) && /income/i.test(h)) return /percent|%|pct/i.test(h) ? "pdiff" : "diff";
    // housing cost as a share of income ("Annual Payment Share of Income", "Housing Cost% of Med HHIncome")
    if (/income/i.test(h) && /share|%|percent|pct/i.test(h)) return "share";
    if (/qualif/i.test(h)) return "need";
    if (/income/i.test(h) && !/share|percent|%|ratio|gap|differ|change|need|requir/i.test(h)) return "earn";
    if ((/index/i.test(h) || /^\s*affordability\s*$/i.test(h)) && !/change|chg/i.test(h)) return "idx";
    return null;
  }
  var isUS = function (n) { return /^(u\.?s\.?a?\.?|us|usa|united states|national|nation|total)$/i.test(String(n).trim()) || /united states/i.test(String(n)); };
  var REG = /cbsa|metro|msa|region|area|geograph|market|name|county|city/i;
  var R = {}, diag = [];
  function put(region, measure, month, v) {
    if (!region || !measure || !month || typeof v !== "number" || !isFinite(v)) return;
    var r = R[region] = R[region] || { need: {}, earn: {}, idx: {}, diff: {}, pdiff: {}, share: {} };
    r[measure][month] = v;
  }
  sheets.forEach(function (sh) {
    var rows = sh.rows, H = -1, wide = false;
    for (var h = 0; h < Math.min(25, rows.length); h++) {
      var r = rows[h] || [], dates = 0, hits = 0;
      for (var j = 0; j < r.length; j++) { if (r[j] == null) continue; if (toMonth(r[j])) dates++; if (typeof r[j] === "string" && classify(r[j])) hits++; }
      if (dates >= 12) { H = h; wide = true; break; }
      if (hits >= 1 && H < 0) H = h;
    }
    var head = (rows[H] || []).map(function (x) { return x == null ? "" : String(x); });
    var shown = H >= 0 ? head : (rows.filter(function (x) { return x && x.length; })[0] || []).map(function (x) { return x == null ? "" : String(x); });
    diag.push(sh.name + ": " + (H < 0 ? "no matching header; first row: " : "") + shown.filter(Boolean).slice(0, 8).join(" | "));
    if (H < 0) return;
    if (wide) {
      var dateCols = [], labelCol = -1, regCol = -1;
      for (var j2 = 0; j2 < (rows[H] || []).length; j2++) {
        var mo = toMonth(rows[H][j2]);
        if (mo) dateCols.push([j2, mo]);
        else if (head[j2] && /name|title/i.test(head[j2]) && labelCol < 0) labelCol = j2;
        else if (head[j2] && REG.test(head[j2]) && regCol < 0) regCol = j2;
      }
      if (labelCol < 0) labelCol = regCol >= 0 ? regCol : 0;
      var sheetMeasure = classify(sh.name) || classify(rows.slice(0, H).map(function (x) { return (x || []).join(" "); }).join(" "));
      for (var r2 = H + 1; r2 < rows.length; r2++) {
        var row = rows[r2];
        if (!row || row[labelCol] == null) continue;
        var label = String(row[labelCol]).trim(), rowMeasure = classify(label);
        var region = rowMeasure ? "U.S." : label, measure = rowMeasure || sheetMeasure || (mode === "metro" ? "idx" : null);
        dateCols.forEach(function (dc) { put(region, measure, dc[1], row[dc[0]]); });
      }
      return;
    }
    // long: one row per month (and per region)
    var dateCol = -1, regionCol = -1, nameCol = -1, measures = [];
    head.forEach(function (x, j) {
      var cl = classify(x);
      if (cl) measures.push([j, cl]);
      else if (dateCol < 0 && /^(date|month|period|time|year.?month|as of)/i.test(x.trim())) dateCol = j;
      else if (nameCol < 0 && /name|title/i.test(x)) nameCol = j;
      else if (regionCol < 0 && REG.test(x)) regionCol = j;
    });
    if (nameCol >= 0) regionCol = nameCol;
    if (dateCol < 0) {
      for (var j3 = 0; j3 < head.length && dateCol < 0; j3++) {
        var ok = 0;
        for (var r3 = H + 1; r3 < Math.min(rows.length, H + 8); r3++) if (rows[r3] && toMonth(rows[r3][j3])) ok++;
        if (ok >= 3 && !measures.some(function (mm2) { return mm2[0] === j3; })) dateCol = j3;
      }
    }
    if (dateCol < 0 || !measures.length) return;
    // a measure named twice (e.g., two "income" columns): keep the first
    var seen = {};
    measures = measures.filter(function (mm3) { if (seen[mm3[1]]) return false; seen[mm3[1]] = 1; return true; });
    for (var r4 = H + 1; r4 < rows.length; r4++) {
      var rw = rows[r4];
      if (!rw) continue;
      var mth = toMonth(rw[dateCol]);
      if (!mth) continue;
      var reg = regionCol >= 0 && rw[regionCol] != null ? String(rw[regionCol]).trim() : "U.S.";
      if (isUS(reg)) reg = "U.S.";
      measures.forEach(function (ms) { put(reg, ms[1], mth, rw[ms[0]]); });
    }
  });

  // Each region: one month list with the series aligned to it
  // When the file gives the gap (dollars and percent) rather than the two
  // incomes, work the incomes out: percent gap = dollar gap / base income, so
  // base = dollar / percent. Whether the base is actual or qualifying income,
  // and which way the gap is signed, is checked against the payment share of
  // income (qualifying / actual = share / 30%) and the index, not assumed.
  function derive(r) {
    var cnt = function (o) { return Object.keys(o).length; };
    if (cnt(r.need) >= 24 && cnt(r.earn) >= 24) return null;
    var ms = Object.keys(r.diff).filter(function (m) { return r.pdiff[m] != null || r.share[m] != null; }).sort();
    if (ms.length < 24) return null;
    var med = function (a) { a = a.slice().sort(function (x, y) { return x - y; }); return a.length ? a[Math.floor(a.length / 2)] : 0; };
    var pS = med(ms.filter(function (m) { return r.pdiff[m] != null; }).map(function (m) { return Math.abs(r.pdiff[m]); })) > 2 ? 0.01 : 1;
    var sS = med(ms.filter(function (m) { return r.share[m] != null; }).map(function (m) { return r.share[m]; })) > 1.5 ? 0.01 : 1;
    var P = function (m) { return r.pdiff[m] != null ? r.pdiff[m] * pS : null; };
    var S = function (m) { return r.share[m] != null ? r.share[m] * sS : null; };
    // sign: the gap should be positive when qualifying income is above actual
    var agree = 0, disagree = 0;
    ms.forEach(function (m) {
      var d = r.diff[m], above = S(m) != null ? S(m) > 0.3 : r.idx[m] != null ? r.idx[m] < 100 : null;
      if (above === null || Math.abs(d) < 1) return;
      if ((d > 0) === above) agree++; else disagree++;
    });
    var sign = disagree > agree ? -1 : 1;
    // base of the percent gap: actual income or qualifying income
    var errA = 0, errQ = 0;
    ms.forEach(function (m) {
      var p = P(m), sh = S(m);
      if (p == null || sh == null) return;
      var q = sh / 0.3;
      errA += Math.abs(sign * p - (q - 1)); errQ += Math.abs(sign * p - (1 - 1 / q));
    });
    var base = errQ < errA ? "qualifying" : "actual";
    var A = {}, Q = {};
    ms.forEach(function (m) {
      var d = sign * r.diff[m], p = P(m), sh = S(m), a = null, q = null;
      if (p != null && Math.abs(p) > 0.004) {
        p = sign * p;
        if (base === "actual") { a = d / p; q = a + d; } else { q = d / p; a = q - d; }
      } else if (sh != null && Math.abs(sh / 0.3 - 1) > 0.004) {
        var rq = sh / 0.3; a = d / (rq - 1); q = a * rq;
      }
      if (a > 0 && q > 0) { A[m] = a; Q[m] = q; }
    });
    // months where the gap is about zero can't be solved: fill actual income
    // from its neighbors, and qualifying = actual + gap
    ms.forEach(function (m, i) {
      if (A[m] != null) return;
      var lo = i - 1, hi = i + 1;
      while (lo >= 0 && A[ms[lo]] == null) lo--;
      while (hi < ms.length && A[ms[hi]] == null) hi++;
      if (lo < 0 || hi >= ms.length) return;
      var a = A[ms[lo]] + (A[ms[hi]] - A[ms[lo]]) * (i - lo) / (hi - lo);
      A[m] = a; Q[m] = sh0(m) != null ? a * sh0(m) / 0.3 : a + sign * r.diff[m];
    });
    function sh0(m) { return S(m); }
    Object.keys(A).forEach(function (m) { r.earn[m] = A[m]; r.need[m] = Q[m]; });
    return "worked out from the file's dollar and percent gap (percent of " + base + " income" + (sign < 0 ? ", gap signed actual minus qualifying" : "") + ")";
  }
  function pack(name, r) {
    var how = derive(r);
    var ms = {};
    ["need", "earn", "idx"].forEach(function (k) { Object.keys(r[k]).forEach(function (m) { ms[m] = 1; }); });
    var months = Object.keys(ms).sort();
    var col = function (k, dec) {
      var any = false, out = months.map(function (m) { var v = r[k][m]; if (v == null) return null; any = true; return dec ? Math.round(v * 10) / 10 : Math.round(v); });
      return any ? out : null;
    };
    // incomes given in thousands or per month are put on an annual-dollars basis
    var earnVals = Object.keys(r.earn).map(function (m) { return r.earn[m]; }).sort(function (a, b) { return a - b; });
    var med = earnVals.length ? earnVals[Math.floor(earnVals.length / 2)] : 0, f = 1;
    if (med > 0 && med < 1000) f = 1000; else if (med >= 1000 && med < 15000) f = 12;
    if (f !== 1) ["need", "earn"].forEach(function (k) { Object.keys(r[k]).forEach(function (m) { r[k][m] *= f; }); });
    // housing cost share of income as a fraction, and the gap (need / earn - 1):
    // from the incomes when there are incomes, else share / 30% - 1, else 100 / index - 1
    var shareVals = Object.keys(r.share).map(function (m) { return r.share[m]; }).sort(function (a, b) { return a - b; });
    var sf = shareVals.length && shareVals[Math.floor(shareVals.length / 2)] > 1.5 ? 0.01 : 1;
    var share = months.map(function (m) { var v = r.share[m]; return v == null ? null : Math.round(v * sf * 10000) / 10000; });
    var gap = months.map(function (m, i) {
      var n = r.need[m], e = r.earn[m];
      if (n > 0 && e > 0) return Math.round((n / e - 1) * 10000) / 10000;
      if (share[i] > 0) return Math.round((share[i] / 0.3 - 1) * 10000) / 10000;
      var ix = r.idx[m];
      if (ix > 0) return Math.round((100 / ix - 1) * 10000) / 10000;
      return null;
    });
    var any = function (a) { return a.some(function (x) { return x != null; }) ? a : null; };
    return { name: name, months: months, need: col("need"), earn: col("earn"), idx: col("idx", true), share: any(share), gap: any(gap), scaled: f, derived: how };
  }
  var names = Object.keys(R);
  if (mode === "us") {
    var usName = names.filter(function (n) { return n === "U.S." || isUS(n); })[0] || (names.length === 1 ? names[0] : null);
    var us = usName ? pack("U.S.", R[usName]) : null;
    var n2 = function (a) { return a ? a.filter(function (x) { return x != null; }).length : 0; };
    if (!us || n2(us.need) < 24 || n2(us.earn) < 24) {
      throw new Error("couldn't find qualifying income and median income columns. What the file has: " + diag.join(" ; "));
    }
    return { us: us, diag: diag };
  }
  var metros = names.filter(function (n) { return !isUS(n) && n !== "U.S."; }).map(function (n) { return pack(n, R[n]); })
    .filter(function (m) { return m.gap && m.gap.some(function (x) { return x != null; }); });
  if (!metros.length) throw new Error("no metro series found (" + names.length + " regions read). What the file has: " + diag.join(" ; "));
  metros.sort(function (a, b) { return a.name < b.name ? -1 : 1; });
  return { metros: metros, diag: diag };
}

function headerOf(resp, name) {
  if (!resp || !resp.headers) return null;
  const k = Object.keys(resp.headers).find((h) => h.toLowerCase() === name.toLowerCase());
  return k ? resp.headers[k] : null;
}
// Status, Last-Modified and size, from the headers only
async function headInfo(url) {
  try {
    const req = new Request(url);
    req.method = "HEAD";
    req.timeoutInterval = 12;
    await req.load();
    const r = req.response || {};
    return { status: r.statusCode || 0, lm: headerOf(r, "Last-Modified"), size: parseFloat(headerOf(r, "Content-Length")) || 0 };
  } catch (e) {
    return { status: 0, lm: null, size: 0 };
  }
}
async function pollOut(wv, seconds) {
  for (let i = 0; i < seconds * 4; i++) {
    await sleep(250);
    const out = await wv.evaluateJavaScript("window.__out || ''", false);
    if (out) return JSON.parse(out);
  }
  throw new Error("timed out unpacking the file");
}
// Download in Scriptable; unpack and read in a hidden page
async function fetchWorkbook(url, mode, seconds) {
  const req = new Request(url + (url.includes("?") ? "&" : "?") + "t=" + Date.now());
  req.timeoutInterval = 40;
  const data = await req.load();
  const status = req.response ? req.response.statusCode : 0;
  if (status !== 200) throw new Error(`the Atlanta Fed answered ${status || "nothing"}`);
  const lm = headerOf(req.response, "Last-Modified");
  const wv = updWV(new WebView());
  await wv.loadHTML(...updArgs("<!DOCTYPE html><html><body></body></html>"));
  const js =
    "window.__out='';(" + hoamParse.toString() + ")(" + JSON.stringify(data.toBase64String()) + "," + JSON.stringify(mode) + ")" +
    ".then(function(r){window.__out=JSON.stringify({ok:true,data:r});})" +
    ".catch(function(e){window.__out=JSON.stringify({ok:false,error:String(e&&e.message||e)});});0;";
  await wv.evaluateJavaScript(js, false);
  const out = await pollOut(wv, seconds);
  if (!out.ok) throw new Error(out.error);
  return { ...out.data, lastModified: lm };
}

// The Atlanta Fed posts monthly; the next file is about a month after this one
function estimateNext(lastModified) {
  const d = lastModified ? new Date(lastModified) : new Date();
  if (isNaN(d.getTime())) return null;
  const n = new Date(d.getFullYear(), d.getMonth() + 1, Math.min(d.getDate(), 28));
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

// Bring the saved copy up to date (U.S. always; metros only when asked, since
// the metro file is big). Older data never replaces newer. Throws only when
// there's nothing saved at all.
async function refresh(withMetros, seconds) {
  let s = readStore();
  const now = Date.now();
  const due = !s || !s.checkedAt || now - s.checkedAt >= CHECK_HOURS * 3600 * 1000;
  const metrosDue = withMetros && (!s || !s.metros || !s.metroCheckedAt || now - s.metroCheckedAt >= CHECK_HOURS * 3600 * 1000);
  if (!due && !metrosDue) return s;
  const errors = [];
  if (due) {
    try {
      const h = await headInfo(US_URL);
      if (h.status && h.status !== 200) throw new Error(`the Atlanta Fed answered ${h.status}`);
      if (!s || !h.lm || h.lm !== s.usModified) {
        const z = await fetchWorkbook(US_URL, "us", Math.max(12, seconds - 4));
        if (!s || lastOf(z.us.months) >= lastOf(s.us.months)) {
          s = { ...(s || {}), us: z.us, usModified: h.lm || z.lastModified, diag: z.diag };
        }
      }
      s.checkedAt = now;
      s.error = null;
    } catch (e) {
      errors.push(String(e.message || e));
      if (s) {
        s.checkedAt = now - (CHECK_HOURS - 1) * 3600 * 1000; // try again in about an hour
        s.error = errors[0];
      }
    }
  }
  if (!s) throw new Error(errors.join(" · ") || "No data yet");
  if (metrosDue) {
    try {
      const h = await headInfo(METRO_URL);
      if (h.status && h.status !== 200) throw new Error(`the Atlanta Fed answered ${h.status}`);
      if (h.size > MAX_MB * 1e6) throw new Error(`the metro file is too big for a phone (${Math.round(h.size / 1e6)} MB)`);
      if (!s.metros || !h.lm || h.lm !== s.metroModified) {
        const z = await fetchWorkbook(METRO_URL, "metro", Math.max(20, seconds));
        const newest = (ms) => (ms || []).reduce((a, m) => (lastOf(m.months) > a ? lastOf(m.months) : a), "");
        if (!s.metros || newest(z.metros) >= newest(s.metros)) {
          s.metros = z.metros;
          s.metroModified = h.lm || z.lastModified;
          s.metroDiag = z.diag;
        }
      }
      s.metroCheckedAt = now;
      s.metroError = null;
    } catch (e) {
      s.metroCheckedAt = now - (CHECK_HOURS - 1) * 3600 * 1000;
      s.metroError = String(e.message || e);
    }
  }
  s.next = estimateNext(s.usModified);
  writeStore(s);
  return s;
}

async function refreshWithin(seconds, withMetros) {
  let timer;
  const deadline = new Promise((_, rej) => { timer = Timer.schedule(seconds * 1000, false, () => rej(new Error("took too long"))); });
  try {
    return await Promise.race([refresh(withMetros, seconds), deadline]);
  } catch (e) {
    const s = readStore();
    if (s) return { ...s, error: s.error || String(e.message || e) };
    throw e;
  } finally {
    if (timer) timer.invalidate();
  }
}

// The latest month with both lines, and the gap
function latestGap(r) {
  if (!r || !r.need || !r.earn) return null;
  for (let i = r.months.length - 1; i >= 0; i--) {
    const n = r.need[i];
    const e = r.earn[i];
    if (n > 0 && e > 0) return { m: r.months[i], need: n, earn: e, gap: n / e - 1 };
  }
  return null;
}

// ---------- Widget ----------
const kUSD = (v) => "$" + (v >= 1e6 ? (v / 1e6).toFixed(2) + "M" : (v / 1000).toFixed(1) + "K");
function gapText(g) {
  const pct = Math.round(Math.abs(g) * 100);
  return g >= 0 ? { text: `+${pct}% short`, hex: RED } : { text: `${pct}% cushion`, hex: GREEN };
}

function smallImage(s) {
  const W = 170;
  const ctx = newCanvas(W, W);
  drawText(ctx, "Afford gap", new Rect(12, 10, 90, 17), Font.semiboldSystemFont(13), "#FFFFFF", "left");
  // corner: next update (or "cached" when the last check failed)
  if (s.error) {
    drawText(ctx, "cached", new Rect(W - 72, 12, 60, 14), Font.semiboldSystemFont(10), AMBER, "right");
  } else {
    const nl = nextLabel(s);
    if (nl) {
      drawText(ctx, nl.text, new Rect(W - 72, 12, 60, 14), Font.mediumSystemFont(10), nl.hex, "right");
      clockIcon(ctx, W - 12 - nl.text.length * 5.5 - 8, 18.5, nl.hex);
    }
  }
  const g = latestGap(s.us);
  if (!g) {
    drawText(ctx, "No data yet", new Rect(12, 70, 146, 17), Font.mediumSystemFont(12), GRAY, "left");
    return ctx.getImage();
  }
  // the chart fills the widget: both lines over the last WIDGET_YEARS years,
  // shaded between them, with dollar labels at the line ends and the gap
  const months = s.us.months;
  const idx = [];
  for (let i = Math.max(0, months.length - WIDGET_YEARS * 12); i < months.length; i++) {
    if (s.us.need[i] > 0 && s.us.earn[i] > 0) idx.push(i);
  }
  if (idx.length < 2) return ctx.getImage();
  const vals = idx.flatMap((i) => [s.us.need[i], s.us.earn[i]]);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  const pad = (hi - lo) * 0.06 || 1000;
  lo -= pad;
  hi += pad;
  const x0 = 12;
  const x1 = 110;
  const y0 = 36;
  const y1 = 146;
  const X = (k) => x0 + ((k - idx[0]) / (idx[idx.length - 1] - idx[0])) * (x1 - x0);
  const Y = (v) => y1 - ((v - lo) / (hi - lo)) * (y1 - y0);
  // shade between the lines, one shape per stretch where the same line is on top
  let run = [];
  const flush = () => {
    if (run.length >= 2) {
      const path = new Path();
      run.forEach((i, n) => { const pt = new Point(X(i), Y(s.us.need[i])); if (n) path.addLine(pt); else path.move(pt); });
      [...run].reverse().forEach((i) => path.addLine(new Point(X(i), Y(s.us.earn[i]))));
      path.closeSubpath();
      ctx.addPath(path);
      ctx.setFillColor(new Color(s.us.need[run[0]] > s.us.earn[run[0]] ? RED : GREEN, 0.18));
      ctx.fillPath();
    }
  };
  idx.forEach((i) => {
    const up = s.us.need[i] > s.us.earn[i];
    if (run.length && (s.us.need[run[0]] > s.us.earn[run[0]]) !== up) { const keep = run[run.length - 1]; flush(); run = [keep]; }
    run.push(i);
  });
  flush();
  ctx.setFillColor(new Color("#3A3A3C"));
  ctx.fillRect(new Rect(x0, y1 + 1.5, x1 - x0, 0.75));
  const line = (arr, hex, width) => {
    const path = new Path();
    idx.forEach((i, n) => {
      const pt = new Point(X(i), Y(arr[i]));
      if (n) path.addLine(pt); else path.move(pt);
    });
    ctx.addPath(path);
    ctx.setStrokeColor(new Color(hex));
    ctx.setLineWidth(width);
    ctx.strokePath();
  };
  line(s.us.earn, EARN_HEX, 1.8);
  line(s.us.need, NEED_HEX, 2.2);
  // end labels, kept apart, with the gap between them
  const last = idx[idx.length - 1];
  const yn = Y(s.us.need[last]);
  const ye = Y(s.us.earn[last]);
  let ln = yn;
  let le = ye;
  if (Math.abs(ln - le) < 15) {
    const mid = (ln + le) / 2;
    const up = yn <= ye ? -1 : 1;
    ln = mid + up * 7.5;
    le = mid - up * 7.5;
  }
  drawText(ctx, kUSD(g.need), new Rect(113, ln - 8, 50, 16), Font.semiboldSystemFont(11), NEED_HEX, "left");
  drawText(ctx, kUSD(g.earn), new Rect(113, le - 8, 50, 16), Font.semiboldSystemFont(11), EARN_HEX, "left");
  const pct = `${g.gap >= 0 ? "+" : "−"}${Math.round(Math.abs(g.gap) * 100)}%`;
  const gy = Math.abs(ln - le) >= 32 ? (ln + le) / 2 - 8 : Math.max(ln, le) + 9;
  drawText(ctx, pct, new Rect(113, gy, 50, 16), Font.boldSystemFont(13), g.gap >= 0 ? RED : GREEN, "left");
  drawText(ctx, "’" + months[idx[0]].slice(2, 4), new Rect(12, 151, 40, 13), Font.systemFont(10), GRAY, "left");
  drawText(ctx, shortMonth(g.m), new Rect(58, 151, 52, 13), Font.mediumSystemFont(10), GRAY, "right");
  return ctx.getImage();
}

function finishWidget(img, s) {
  const w = new ListWidget();
  w.backgroundImage = updRing(img);
  w.addSpacer();
  w.url = URLScheme.forRunningScript();
  w.refreshAfterDate = new Date(Date.now() + (s && s.error ? 1 : CHECK_HOURS) * 3600 * 1000);
  return w;
}
function errorWidget(msg) {
  const w = new ListWidget();
  const g = new LinearGradient();
  g.colors = [new Color("#2C2C2E"), new Color("#1C1C1E")];
  g.locations = [0, 1];
  w.backgroundGradient = g;
  const t = w.addText("Afford gap");
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
  .seg { display:flex; gap:6px; margin-top:14px; }
  .legend { display:flex; gap:14px; flex-wrap:wrap; font-size:12.5px; font-weight:600; margin-top:12px; align-items:center; }
  .legend i { display:inline-block; width:14px; height:3px; border-radius:2px; margin-right:6px; vertical-align:middle; }
  .h2 { font-size:12px; font-weight:700; color:var(--gray); letter-spacing:0.4px; margin:22px 0 4px; text-transform:uppercase; }
  .ro { font-size:13.5px; font-weight:600; min-height:20px; margin-bottom:4px; }
  svg.chart { display:block; width:100%; height:230px; }
  svg.chart.short { height:170px; }
  .wrap { position:relative; }
  .touch { position:absolute; left:0; top:0; right:0; bottom:0; touch-action:pan-y; }
  select.pick { width:100%; border:0; border-radius:10px; padding:9px 10px; background:#2C2C2E; color:#FFFFFF;
                font:inherit; font-size:14px; font-weight:600; -webkit-appearance:none; appearance:none; margin:4px 0 8px; }
  .note { color:var(--gray); font-size:10.5px; line-height:1.45; margin-top:22px; }
  .regions { display:flex; gap:6px; overflow-x:auto; margin:6px 0 8px; scrollbar-width:none; }
  .regions::-webkit-scrollbar { display:none; }
  .regions button { flex:none; border:0; border-radius:14px; padding:6px 12px; background:#2C2C2E; color:#FFFFFF; font:inherit; font-size:13px; font-weight:600; }
  .regions button.on { background:#FFFFFF; color:#000000; }
  svg.map { display:block; width:100%; height:auto; }
  .scale { display:flex; align-items:center; gap:8px; font-size:11px; color:var(--gray); margin:6px 0 2px; }
  .scale .bar { flex:1; height:8px; border-radius:4px; }
</style>
</head>
<body>
<div class="ticker">Housing affordability</div>
<div class="name" id="sub"></div>
<div class="hint" id="progress"></div>
<div class="hint loading" id="loading">Loading Atlanta Fed data…</div>
<div class="hint err" id="err" style="display:none"></div>
<div id="blocks" style="display:none">
  <div>
    <div class="legend"><span><i style="background:#5B8DEF"></i>Income needed for the median-priced home</span><span><i style="background:#D1D1D6"></i>Median household income</span></div>
    <div class="hint">Hold to read · pinch to zoom · double-tap to reset</div>
  </div>
  <div>
    <div class="h2">U.S.</div>
    <div class="ro" id="ro1"></div>
    <div class="wrap"><svg class="chart" id="c1"></svg><div class="touch" id="t1"></div></div>
  </div>
  <div>
    <div class="h2">U.S. gap · need vs earn</div>
    <div class="ro" id="ro2"></div>
    <div class="wrap"><svg class="chart short" id="c2"></svg><div class="touch" id="t2"></div></div>
  </div>
  <div id="mapblock">
    <div class="h2">Metros</div>
    <div class="regions" id="regions"></div>
    <div class="ro" id="mapm"></div>
    <svg class="map" id="map"></svg>
    <div class="scale"><span id="scLo"></span><div class="bar" id="scBar"></div><span id="scHi"></span></div>
    <div class="hint">Tap a dot to chart that metro · color = gap (green = cushion, red = short) · size = market size · follows the month on the charts</div>
  </div>
  <div>
    <div class="h2" id="mh">Metro gap · need vs earn</div>
    <div class="seg"><select class="pick" id="pick"></select></div>
    <div class="hint" id="mnote"></div>
    <div class="ro" id="ro3"></div>
    <div class="wrap"><svg class="chart short" id="c3"></svg><div class="touch" id="t3"></div></div>
    <div class="legend" id="mlegend"><span><i style="background:#FF453A"></i>Metro gap (red = short, green = cushion)</span><span><i style="background:#FFFFFF"></i>U.S. gap</span></div>
  </div>
</div>
<div class="note" id="note"></div>
<script>
var D = __DATA__;
var MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
var NEED = "#5B8DEF", EARN = "#D1D1D6", RED = "#FF453A", GREEN = "#30D158";
var state = { metro: -1, cursor: null };
// The timeline: every month the U.S. file has. view.a..view.b index into it;
// all three charts always show the same months.
var TL = [], view = { a: 0, b: 0 }, MIN_SPAN = 12, touched = false;
function el(id) { return document.getElementById(id); }
function esc(s) { return String(s).split("&").join("&amp;").split("<").join("&lt;").split(">").join("&gt;").split('"').join("&quot;"); }
function mLong(m) { return MONTHS[+m.slice(5, 7) - 1] + " " + m.slice(0, 4); }
function usd(v) { return "$" + Math.round(v).toLocaleString("en-US"); }
function axisK(v) { return "$" + Math.round(v / 1000) + "K"; }
function pct(v) { return (v > 0 ? "+" : v < 0 ? "−" : "") + Math.round(Math.abs(v) * 100) + "%"; }
function gapWords(g) { return g >= 0 ? pct(g) + " short" : Math.round(-g * 100) + "% cushion"; }
function setView(a, b) { setViewQuiet(a, b); renderCharts(); }
function setViewQuiet(a, b) {
  var I = TL.length - 1, span = Math.round(Math.max(Math.min(MIN_SPAN, I), Math.min(I, b - a)));
  a = Math.max(0, Math.min(I - span, Math.round(a)));
  view.a = Math.max(0, a); view.b = view.a + span;
}
function resetView() { view.a = 0; view.b = Math.max(0, TL.length - 1); }
function niceStep(range, n) { var raw = range / (n || 5), p = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10)), f = raw / p; return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p; }

// A region's series as month -> value maps
function maps(r) {
  var out = { need: {}, earn: {}, idx: {}, gap: {}, share: {} };
  if (!r) return out;
  r.months.forEach(function (m, i) {
    if (r.gap && r.gap[i] != null) out.gap[m] = r.gap[i];
    if (r.share && r.share[i] != null) out.share[m] = r.share[i];
    if (r.need && r.need[i] != null) out.need[m] = r.need[i];
    if (r.earn && r.earn[i] != null) out.earn[m] = r.earn[i];
    if (r.idx && r.idx[i] != null) out.idx[m] = r.idx[i];
  });
  return out;
}
var US = null, MT = null, MTNAME = "";

// Shared frame for a chart: x by timeline month, y from the visible values
function frame(svg, lists, fmt, opts) {
  var r = svg.getBoundingClientRect(), w = Math.max(240, r.width), h = Math.max(120, r.height);
  var L = 50, R = w - 6, T = 8, B = h - 22, n = view.b - view.a + 1;
  svg.__geo = { L: L, w: R - L };
  var lo = Infinity, hi = -Infinity;
  for (var k = view.a; k <= view.b; k++) {
    var m = TL[k];
    lists.forEach(function (mp) { var v = mp[m]; if (v != null) { lo = Math.min(lo, v); hi = Math.max(hi, v); } });
  }
  if (opts && opts.zero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
  if (opts && opts.ref != null) { lo = Math.min(lo, opts.ref); hi = Math.max(hi, opts.ref); }
  if (!isFinite(lo)) return null;
  var st = niceStep((hi - lo) || Math.abs(hi) || 1, 4);
  lo = Math.floor(lo / st) * st; hi = Math.ceil(hi / st) * st; if (hi === lo) hi = lo + st;
  var bw = (R - L) / n, s = "";
  var F = { X: function (i) { return L + (i - view.a) * bw; }, Y: function (v) { return B - (v - lo) / (hi - lo) * (B - T); }, bw: bw, L: L, R: R, T: T, B: B, h: h, n: n };
  for (var v = lo; v <= hi + st / 2; v += st) {
    var zero = Math.abs(v) < st / 1000;
    s += '<line x1="' + L + '" x2="' + R + '" y1="' + F.Y(v) + '" y2="' + F.Y(v) + '" stroke="' + (zero && opts && opts.zero ? "#636366" : "#3A3A3C") + '" stroke-width="' + (zero ? 1 : 0.6) + '"/>';
    s += '<text x="' + (L - 6) + '" y="' + (F.Y(v) + 3.5) + '" fill="#98989F" font-size="10" text-anchor="end">' + fmt(v) + '</text>';
  }
  // x labels: years, or quarters when zoomed in close
  var years = n / 12, step = years <= 6 ? 1 : years <= 12 ? 2 : years <= 24 ? 4 : 5, lastX = -99;
  for (var i = view.a; i <= view.b; i++) {
    var mm = TL[i], mo = mm.slice(5, 7), lab = null;
    if (years <= 2.5) { if (mo === "01") lab = "’" + mm.slice(2, 4); else if (mo === "04" || mo === "07" || mo === "10") lab = MONTHS[+mo - 1]; }
    else if (mo === "01" && (+mm.slice(0, 4)) % step === 0) lab = mm.slice(0, 4);
    var x = F.X(i) + bw / 2;
    if (lab && x - lastX > 28) { s += '<text x="' + x.toFixed(1) + '" y="' + (h - 6) + '" fill="#98989F" font-size="10" text-anchor="middle">' + lab + '</text>'; lastX = x; }
  }
  F.head = s;
  return F;
}
function cursorLine(F) {
  if (state.cursor == null || state.cursor < view.a || state.cursor > view.b) return "";
  var cx = F.X(state.cursor) + F.bw / 2;
  return '<line x1="' + cx + '" x2="' + cx + '" y1="' + F.T + '" y2="' + F.B + '" stroke="#FFFFFF" stroke-width="1" stroke-dasharray="3 2"/>';
}
function linePath(F, mp, color, width) {
  var d = "", pen = false;
  for (var i = view.a; i <= view.b; i++) {
    var v = mp[TL[i]];
    if (v == null) { pen = false; continue; }
    d += (pen ? "L" : "M") + (F.X(i) + F.bw / 2).toFixed(1) + "," + F.Y(v).toFixed(1); pen = true;
  }
  return '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="' + width + '" stroke-linejoin="round" stroke-linecap="round"/>';
}
function drawLines(svg, a, b, fmt) {
  var F = frame(svg, [a, b], fmt);
  if (!F) { svg.innerHTML = ""; return; }
  // shade between the lines: red where need is above earn, green where below
  var s = F.head;
  for (var i = view.a; i <= view.b; i++) {
    var m = TL[i], va = a[m], vb = b[m];
    if (va == null || vb == null) continue;
    var y0 = F.Y(Math.max(va, vb)), y1 = F.Y(Math.min(va, vb));
    s += '<rect x="' + F.X(i).toFixed(2) + '" y="' + y0.toFixed(2) + '" width="' + (F.bw + 0.35).toFixed(2) + '" height="' + Math.max(0, y1 - y0).toFixed(2) + '" fill="' + (va > vb ? RED : GREEN) + '" fill-opacity="0.13"/>';
  }
  s += linePath(F, b, EARN, 2) + linePath(F, a, NEED, 2.2) + cursorLine(F);
  svg.innerHTML = s;
}
function drawGap(svg, g, overlay) {
  var F = frame(svg, overlay ? [g, overlay] : [g], function (v) { return pct(v); }, { zero: true });
  if (!F) { svg.innerHTML = ""; return; }
  var s = F.head, y0 = F.Y(0);
  for (var i = view.a; i <= view.b; i++) {
    var v = g[TL[i]];
    if (v == null) continue;
    var y = F.Y(v);
    s += '<rect x="' + F.X(i).toFixed(2) + '" y="' + Math.min(y, y0).toFixed(2) + '" width="' + (F.bw + 0.35).toFixed(2) + '" height="' + Math.abs(y0 - y).toFixed(2) + '" fill="' + (v >= 0 ? RED : GREEN) + '" fill-opacity="0.85"/>';
  }
  if (overlay) s += linePath(F, overlay, "#FFFFFF", 1.6);
  svg.innerHTML = s + cursorLine(F);
}
function drawIndex(svg, mp) {
  var F = frame(svg, [mp], function (v) { return String(Math.round(v)); }, { ref: 100 });
  if (!F) { svg.innerHTML = ""; return; }
  var y = F.Y(100);
  var s = F.head + '<line x1="' + F.L + '" x2="' + F.R + '" y1="' + y + '" y2="' + y + '" stroke="#FFFFFF" stroke-opacity="0.55" stroke-dasharray="4 3"/>' +
    '<text x="' + (F.L + 2) + '" y="' + (y - 4) + '" fill="#FFFFFF" fill-opacity="0.75" font-size="10">100 = just affordable</text>';
  svg.innerHTML = s + linePath(F, mp, NEED, 2.2) + cursorLine(F);
}
function gapMap(mp) {
  var g = {};
  Object.keys(mp.need).forEach(function (m) { var e = mp.earn[m]; if (e > 0) g[m] = mp.need[m] / e - 1; });
  return g;
}
var usGap = {};
function curMonth() { var k = state.cursor != null ? state.cursor : view.b; return TL[Math.max(0, Math.min(TL.length - 1, k))]; }
function readouts() {
  var m = curMonth();
  if (!m) return;
  var n = US.need[m], e = US.earn[m];
  el("ro1").innerHTML = mLong(m) + (n != null && e != null ? ' · <span style="color:' + NEED + '">need ' + usd(n) + '</span> · <span style="color:' + EARN + '">earn ' + usd(e) + "</span>" : " · no data");
  var g = usGap[m];
  el("ro2").innerHTML = mLong(m) + (g != null ? ' · <span style="color:' + (g >= 0 ? RED : GREEN) + '">' + gapWords(g) + "</span> (" + (n >= e ? "short " : "over by ") + usd(Math.abs(n - e)) + ")" : " · no data");
  if (!MT) { el("ro3").textContent = ""; return; }
  var mg = MT.gap[m], sh = MT.share[m], ix = MT.idx[m];
  if (mg == null) { el("ro3").textContent = mLong(m) + " · no data"; return; }
  el("ro3").innerHTML = mLong(m) + " · " + esc(MTNAME) + ' <span style="color:' + (mg >= 0 ? RED : GREEN) + '">' + gapWords(mg) + "</span>" +
    (g != null ? ' <span style="color:#98989F">(U.S. ' + gapWords(g) + ")</span>" : "") +
    (sh != null ? " · housing cost " + Math.round(sh * 100) + "% of income" : "") + (ix != null ? " · index " + Math.round(ix) : "");
}
// ---------- Metro map ----------
var REGIONS = [
  { k: "U.S." },
  { k: "West", vb: [20, 20, 460, 460] },
  { k: "Texas", vb: [380, 390, 200, 170] },
  { k: "Midwest", vb: [465, 110, 350, 240] },
  { k: "Southeast", vb: [575, 315, 310, 290] },
  { k: "Northeast", vb: [715, 75, 260, 245] }
];
var mapRegion = 0, STATE_PATH = "", MG = {};
function mix(a, b, t) {
  var pa = [1, 3, 5].map(function (i) { return parseInt(a.slice(i, i + 2), 16); }), pb = [1, 3, 5].map(function (i) { return parseInt(b.slice(i, i + 2), 16); });
  return "#" + pa.map(function (v, i) { var x = Math.round(v + (pb[i] - v) * t).toString(16); return x.length < 2 ? "0" + x : x; }).join("");
}
// Gray near even; amber then red as the shortfall grows; green where incomes clear the bar
function colorFor(v, vmax) {
  var t = Math.min(1, Math.abs(v) / vmax);
  if (v < 0) return mix("#98989F", "#30D158", t);
  return t < 0.5 ? mix("#98989F", "#FF9F0A", t * 2) : mix("#FF9F0A", "#FF453A", (t - 0.5) * 2);
}
function gapOf(i, m) { if (!MG[i]) MG[i] = maps(D.metros[i]).gap; return MG[i][m]; }
function renderMap() {
  var dots = D.dots || [];
  el("mapblock").style.display = dots.length ? "" : "none";
  if (!dots.length) return;
  var m = curMonth(), svg = el("map"), vb = REGIONS[mapRegion].vb || [0, 0, D.mapW, D.mapH], z = D.mapW / vb[2];
  svg.setAttribute("viewBox", vb.join(" "));
  var pts = [];
  dots.forEach(function (d) { var g = gapOf(d.i, m); if (g != null) pts.push({ d: d, g: g, name: D.metros[d.i].name }); });
  var abs = pts.map(function (p) { return Math.abs(p.g); }).sort(function (a, b) { return a - b; });
  var vmax = Math.max(0.1, abs.length ? abs[Math.floor(0.9 * (abs.length - 1))] : 0.5);
  pts.sort(function (a, b) { return (a.d.rank || 60) - (b.d.rank || 60); }); // biggest first, small ones drawn on top
  var s = '<path d="' + STATE_PATH + '" fill="#2C2C2E" stroke="#48484A" stroke-width="1" vector-effect="non-scaling-stroke"/>', labels = "", boxes = [], sel = null;
  pts.forEach(function (p) {
    p.r = Math.max(6, 30 * Math.pow(1 / Math.max(1, p.d.rank || 60), 0.375)) / Math.sqrt(z);
    if (p.d.i === state.metro) sel = p;
    s += '<circle cx="' + p.d.x + '" cy="' + p.d.y + '" r="' + p.r.toFixed(2) + '" fill="' + colorFor(p.g, vmax) + '" fill-opacity="0.9" stroke="#000000" stroke-width="' + (1.4 / z).toFixed(2) + '"/>';
  });
  if (z >= 1.9) {
    var fs = 26 / z;
    pts.forEach(function (p) {
      var name = p.name.split(",")[0].split("-")[0], w = name.length * fs * 0.56, h = fs * 1.1, gap = 4 / z;
      var tries = [p.d.x + p.r + gap, p.d.x - p.r - gap - w];
      for (var t = 0; t < 2; t++) {
        var bx = tries[t], by = p.d.y - h / 2, ok = true;
        for (var j = 0; j < boxes.length && ok; j++) { var o = boxes[j]; if (bx < o.x + o.w && bx + w > o.x && by < o.y + o.h && by + h > o.y) ok = false; }
        if (ok) {
          boxes.push({ x: bx, y: by, w: w, h: h });
          labels += '<text x="' + bx.toFixed(1) + '" y="' + (p.d.y + fs * 0.35).toFixed(1) + '" font-size="' + fs.toFixed(1) + '" font-weight="600" fill="#E5E5EA" stroke="#000000" stroke-width="' + (5 / z).toFixed(2) + '" paint-order="stroke">' + esc(name) + '</text>';
          break;
        }
      }
    });
  }
  if (sel) s += '<circle cx="' + sel.d.x + '" cy="' + sel.d.y + '" r="' + (sel.r + 5 / z).toFixed(2) + '" fill="none" stroke="#FFFFFF" stroke-width="' + (4 / z).toFixed(2) + '"/>';
  svg.innerHTML = s + labels;
  svg.__pts = pts;
  el("mapm").textContent = mLong(m) + " · " + pts.length + " metros" + (US.gap && usGap[m] != null ? " · U.S. " + gapWords(usGap[m]) : "");
  el("scLo").textContent = "−" + Math.round(vmax * 100) + "%";
  el("scHi").textContent = "+" + Math.round(vmax * 100) + "%";
  el("scBar").style.background = "linear-gradient(90deg, #30D158, #98989F 50%, #FF9F0A 75%, #FF453A)";
  el("regions").innerHTML = REGIONS.map(function (r, i) { return '<button data-i="' + i + '" class="' + (i === mapRegion ? "on" : "") + '">' + r.k + "</button>"; }).join("");
  var bs = el("regions").querySelectorAll("button");
  for (var i = 0; i < bs.length; i++) bs[i].onclick = function () { mapRegion = +this.getAttribute("data-i"); renderMap(); };
}
// Tap a dot to chart it: inside overlapping dots the smallest wins, else the nearest within 22 points
el("map").addEventListener("click", function (e) {
  var svg = el("map"), r = svg.getBoundingClientRect(), vb = REGIONS[mapRegion].vb || [0, 0, D.mapW, D.mapH];
  var k = vb[2] / r.width, qx = vb[0] + (e.clientX - r.left) * k, qy = vb[1] + (e.clientY - r.top) * k, inside = null, best = null, bd = Infinity;
  (svg.__pts || []).forEach(function (p) {
    var d = Math.sqrt((p.d.x - qx) * (p.d.x - qx) + (p.d.y - qy) * (p.d.y - qy)) - p.r;
    if (d <= 0 && (!inside || p.r < inside.r)) inside = p;
    if (d < bd) { bd = d; best = p; }
  });
  var hit = inside || (best && bd / k < 22 ? best : null);
  if (hit) { state.metro = hit.d.i; state.cursor = null; renderPicker(); renderAll(); }
});
function renderCharts() {
  drawLines(el("c1"), US.need, US.earn, axisK);
  drawGap(el("c2"), usGap);
  if (MT) drawGap(el("c3"), MT.gap, usGap); else el("c3").innerHTML = "";
  renderMap();
  readouts();
}
function renderPicker() {
  el("pick").innerHTML = (D.metros || []).map(function (m, i) { return '<option value="' + i + '"' + (i === state.metro ? " selected" : "") + ">" + esc(m.name) + "</option>"; }).join("");
}
function renderAll() {
  US = maps(D.us);
  usGap = gapMap(US);
  var oldEnd = TL.length ? TL[view.b] : null;
  TL = D.us.months.slice();
  if (!touched) resetView();
  else { var span = view.b - view.a, e = oldEnd ? TL.indexOf(oldEnd) : -1; setViewQuiet(e >= 0 ? e - span : TL.length - 1 - span, e >= 0 ? e : TL.length - 1); }
  var last = null;
  for (var i = TL.length - 1; i >= 0; i--) if (US.need[TL[i]] != null && US.earn[TL[i]] != null) { last = TL[i]; break; }
  var ny = D.next ? D.next.split("-") : null;
  el("sub").textContent = "U.S. · data " + (last ? mLong(last) : "n/a") + (ny ? " · next ~" + MONTHS[+ny[1] - 1] + " " + (+ny[2]) : "");
  var mt = (D.metros || [])[state.metro];
  MT = mt ? maps(mt) : null;
  MTNAME = mt ? mt.name.split(",")[0].split("-")[0].trim() : "";
  el("pick").style.display = (D.metros || []).length ? "" : "none";
  el("mnote").textContent = !D.metros || !D.metros.length ? (D.metroError ? "Metro data didn’t load: " + D.metroError : "Metro data loads the first time the full screen checks for updates.") : "";
  el("mlegend").style.display = MT ? "" : "none";
  renderCharts();
  el("note").textContent = "Income needed (“qualifying income”) is the household income at which the full monthly cost of owning the median-priced home equals 30% of income: " +
    "10% down, the Freddie Mac 30-year fixed rate, property tax, homeowner’s insurance and private mortgage insurance (PMI). Median household income is the Atlanta Fed’s estimate for the same month and area. " +
    "Gap = income needed / median income − 1; red = the median household falls short, green = it clears the bar. " +
    "The metro file gives housing cost as a share of median household income, not dollar incomes, so a metro’s gap is that share / 30% − 1 (the same ratio: income needed / median income), with the affordability index as a fallback. " +
    "Source: Federal Reserve Bank of Atlanta, Home Ownership Affordability Monitor (HOAM), monthly Excel files" + (D.usModified ? " (U.S. file dated " + D.usModified + (D.metroModified ? ", metro file " + D.metroModified : "") + ")" : "") +
    ". The Atlanta Fed posts monthly with a lag of a few months; the next date is an estimate." +
    (D.us.derived ? " The U.S. file gives the gap between qualifying and median income in dollars and in percent, not the two incomes; they are worked out here from those two columns (" + D.us.derived + "), checked against the file’s payment share of income." : " Figures are the Atlanta Fed’s, not recalculated here.");
  el("progress").textContent = D.progress || "";
  el("progress").style.color = /unreachable|didn|couldn/i.test(D.progress || "") ? "#FF9F0A" : "";
}
// One finger reads a month on all charts. Two fingers pinch to zoom and drag
// to pan; double-tap resets to the full history. A vertical swipe still scrolls.
var fingers = {}, pinch = null, pinchLock = false, rafId = 0, pendingView = null, lastTap = null, activeSvg = "c1";
function fingerIds() { return Object.keys(fingers); }
function posAt(clientX) {
  var svg = el(activeSvg), g = svg.__geo || { L: 50, w: 300 }, r = svg.getBoundingClientRect();
  var f = Math.max(0, Math.min(1, (clientX - r.left - g.L) / g.w));
  return { f: f, pos: view.a + f * (view.b - view.a + 1) };
}
function idxAt(clientX) { return Math.max(view.a, Math.min(view.b, Math.floor(posAt(clientX).pos))); }
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
    pinchLock = true; touched = true; lastTap = null; state.cursor = null;
  } else if (n === 1 && !pinchLock) {
    var now = Date.now();
    if (lastTap && now - lastTap.t < 320 && Math.abs(e.clientX - lastTap.x) < 30) {
      lastTap = null; touched = false; state.cursor = null; resetView(); renderCharts(); return;
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
    var a = pinch.anchor - posAt(st.mid).f * (n + 1);
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
el("pick").addEventListener("change", function () { state.metro = +this.value; state.cursor = null; renderAll(); });

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
  var prevName = D && D.metros && D.metros[state.metro] ? D.metros[state.metro].name : null;
  D = n; window.__wantData = false; MG = {};
  STATE_PATH = (D.states || "").split("|").map(function (r) { return "M" + r.split(" ").join("L") + "Z"; }).join("");
  var ms = D.metros || [], idx = -1, i;
  if (prevName) for (i = 0; i < ms.length; i++) if (ms[i].name === prevName) { idx = i; break; }
  if (idx < 0) for (i = 0; i < ms.length; i++) if (ms[i].name.indexOf(D.defaultMetro) === 0) { idx = i; break; }
  state.metro = idx >= 0 ? idx : 0;
  renderPicker();
  safeRender();
  return "ok";
};
window.addEventListener("resize", function () { if (rendered) { try { renderAll(); } catch (e) {} } });
window.shareInfo = function () { var m = TL.length ? TL[view.b] : null; return { title: "Housing affordability", name: "Atlanta Fed HOAM", asOf: m ? mLong(m) : "" }; };
// Share as PDF: 16:9 slides, one per chart, for the months on screen.
// 1) U.S. income needed vs median income, 2) the U.S. gap, 3) the metro
// picked vs the U.S. Each has a headline that states the point, the chart
// large, value labels at the ends, and a dark banner crediting the source.
// Vector, so it stays sharp.
window.printPdf = function (jsPDF, fonts) {
  var W = 792, H = 445.5;
  var doc = new jsPDF({ unit: "pt", format: [W, H], orientation: "landscape" });
  var FACE = "helvetica";
  if (fonts && fonts.regular && fonts.bold) {
    doc.addFileToVFS("Narrow-Regular.ttf", fonts.regular); doc.addFont("Narrow-Regular.ttf", "Narrow", "normal");
    doc.addFileToVFS("Narrow-Bold.ttf", fonts.bold); doc.addFont("Narrow-Bold.ttf", "Narrow", "bold");
    FACE = "Narrow";
  }
  var INK = [28, 28, 30], GRY = [110, 110, 115], RULE = [222, 222, 226], BLUE = [59, 111, 216], DARK = [72, 72, 78], REDC = [214, 48, 39], GRNC = [36, 150, 72];
  function font(bold, size, c) { doc.setFont(FACE, bold ? "bold" : "normal"); doc.setFontSize(size); doc.setTextColor(c[0], c[1], c[2]); }
  function kd(v) { return "$" + (v / 1000).toFixed(1) + "K"; }
  function pctTxt(v) { return (v >= 0 ? "+" : "-") + Math.round(Math.abs(v) * 100) + "%"; }
  var a = view.a, b = view.b;
  function lastIn(fn) { for (var k = b; k >= a; k--) if (fn(TL[k])) return TL[k]; return null; }
  var last = lastIn(function (m) { return US.need[m] != null && US.earn[m] != null; });
  if (!last) throw new Error("no data in the months shown");
  var mt = (D.metros || [])[state.metro], mtLast = MT ? lastIn(function (m) { return MT.gap[m] != null; }) : null;
  var pages = mt && mtLast ? 3 : 2;

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
  // the chart frame: y from the values given (plus zero for gap charts)
  function frame(top, mapsList, fmt, withZero, pL, pR) {
    var L = pL || 76, R = pR || W - 104, T = top + 58, B = H - 92, lo = Infinity, hi = -Infinity;
    for (var k = a; k <= b; k++) mapsList.forEach(function (mp) { var v = mp[TL[k]]; if (v != null) { lo = Math.min(lo, v); hi = Math.max(hi, v); } });
    if (withZero) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
    var st = niceStep((hi - lo) || 1, 5); lo = Math.floor(lo / st) * st; hi = Math.ceil(hi / st) * st; if (hi === lo) hi = lo + st;
    var F = { L: L, R: R, T: T, B: B,
      X: function (i) { return L + (b === a ? 0 : (i - a) / (b - a) * (R - L)); },
      Y: function (v) { return B - (v - lo) / (hi - lo) * (B - T); } };
    doc.setLineWidth(0.5);
    for (var v = lo; v <= hi + st / 2; v += st) {
      var zero = withZero && Math.abs(v) < st / 1000;
      doc.setDrawColor(zero ? 120 : RULE[0], zero ? 120 : RULE[1], zero ? 125 : RULE[2]); doc.setLineWidth(zero ? 0.9 : 0.5);
      doc.line(L, F.Y(v), R, F.Y(v));
      font(false, 8.5, GRY); doc.text(fmt(v), L - 6, F.Y(v) + 3, { align: "right" });
    }
    doc.setLineWidth(0.5); doc.setDrawColor(150, 150, 155); doc.line(L, B, R, B);
    var narrow = R - L < 450, yrs = (b - a + 1) / 12, step = yrs <= 3 ? 0 : yrs <= (narrow ? 6 : 10) ? 1 : yrs <= (narrow ? 12 : 20) ? 2 : 4, lastX = -99;
    for (k = a; k <= b; k++) {
      var m = TL[k], mo = m.slice(5, 7), lab = null;
      if (step === 0) { if (mo === "01" || mo === "07") lab = (mo === "01" ? m.slice(0, 4) : "Jul"); }
      else if (mo === "01" && (+m.slice(0, 4)) % step === 0) lab = m.slice(0, 4);
      if (lab && F.X(k) - lastX > 34) {
        doc.setDrawColor(150, 150, 155); doc.line(F.X(k), B, F.X(k), B + 3);
        font(false, 8.5, GRY); doc.text(lab, F.X(k), B + 13, { align: "center" }); lastX = F.X(k);
      }
    }
    return F;
  }
  function series(F, mp, c, w) {
    doc.setDrawColor(c[0], c[1], c[2]); doc.setLineWidth(w); if (doc.setLineJoin) doc.setLineJoin("round");
    var px = null, py = null;
    for (var i = a; i <= b; i++) {
      var val = mp[TL[i]];
      if (val == null) { px = null; continue; }
      var x = F.X(i), y = F.Y(val);
      if (px !== null) doc.line(px, py, x, y);
      px = x; py = y;
    }
  }
  function bars(F, mp) {
    var n = b - a + 1, bw = (F.R - F.L) / n, y0 = F.Y(0);
    for (var i = a; i <= b; i++) {
      var val = mp[TL[i]];
      if (val == null) continue;
      var c = val >= 0 ? REDC : GRNC, y = F.Y(val);
      doc.setFillColor(c[0], c[1], c[2]);
      doc.rect(F.L + (i - a) * bw, Math.min(y, y0), bw < 4 ? bw + 0.25 : bw * 0.9, Math.max(0.3, Math.abs(y0 - y)), "F");
    }
  }
  // value labels at the line ends, nudged apart if they'd overlap
  function endLabels(F, items) {
    items.sort(function (p, q) { return p.y - q.y; });
    for (var k = 1; k < items.length; k++) if (items[k].y - items[k - 1].y < 13) items[k].y = items[k - 1].y + 13;
    items.forEach(function (it) { font(true, 10, it.c); doc.text(it.t, F.R + 7, it.y + 3.5); });
  }
  function legend(F, items, cx) {
    var y = F.B + 30, total = 0;
    font(false, 9, INK);
    items.forEach(function (it) { it.w = doc.getTextWidth(it.t); total += 22 + it.w + 26; });
    var x = (cx || W / 2) - (total - 26) / 2;
    items.forEach(function (it) {
      if (it.box) {
        doc.setFillColor(REDC[0], REDC[1], REDC[2]); doc.rect(x, y - 7, 7, 8, "F");
        doc.setFillColor(GRNC[0], GRNC[1], GRNC[2]); doc.rect(x + 8, y - 7, 7, 8, "F");
      } else { doc.setLineWidth(it.lw || 2); doc.setDrawColor(it.c[0], it.c[1], it.c[2]); doc.line(x, y - 3, x + 16, y - 3); }
      font(false, 9, INK); doc.text(it.t, x + 22, y);
      x += 22 + it.w + 26;
    });
  }
  function banner(page, extra) {
    var bh = 44, by = H - bh;
    doc.setFillColor(28, 28, 30); doc.rect(0, by, W, bh, "F");
    doc.setFillColor(201, 162, 39); doc.rect(W - 176, by + 6, 2, bh - 12, "F");
    font(false, 7.2, [235, 235, 240]);
    var src = "Source: Federal Reserve Bank of Atlanta, Home Ownership Affordability Monitor (HOAM). Income needed = the income at which owning the median-priced home " +
      "(10% down, 30-year fixed, property tax, insurance, PMI) costs 30% of income." + (extra || "");
    doc.text(doc.splitTextToSize(src, W - 176 - 40 - 110), 28, by + 15);
    font(false, 7.5, [200, 200, 205]);
    doc.text("Data through " + mLong(last), W - 188, by + 20, { align: "right" });
    doc.text(page + " of " + pages, W - 188, by + 31, { align: "right" });
    font(true, 12.5, [255, 255, 255]);
    doc.text("Housing", W - 162, by + 20);
    doc.text("Affordability", W - 162, by + 34);
  }
  var span = mLong(TL[a]) + " to " + mLong(last);
  var derivedNote = D.us && D.us.derived ? " U.S. incomes worked out from the HOAM's dollar and percent gap." : "";

  // ---- 1. U.S. income needed vs median income ----
  var n = US.need[last], e = US.earn[last], g = n / e - 1;
  var top = headline(g >= 0
    ? "Buying the Median-Priced Home Takes " + Math.round(g * 100) + "% More Income Than the Median Household Earns"
    : "The Median Household Earns " + Math.round(-g * 100) + "% More Than It Takes to Buy the Median-Priced Home");
  titles(top, "Income Needed to Buy the Median-Priced Home vs Median Household Income", "U.S. annual income, monthly · " + span);
  var F = frame(top, [US.need, US.earn], function (v) { return "$" + Math.round(v / 1000) + "K"; });
  series(F, US.earn, DARK, 1.8);
  series(F, US.need, BLUE, 2.2);
  var iL = TL.indexOf(last), yn = F.Y(n), ye = F.Y(e);
  endLabels(F, [{ y: yn, t: kd(n), c: BLUE }, { y: ye, t: kd(e), c: DARK }]);
  if (Math.abs(yn - ye) > 30) {
    var bx = F.X(iL) + 54, gc = g >= 0 ? REDC : GRNC;
    doc.setDrawColor(gc[0], gc[1], gc[2]); doc.setLineWidth(1);
    doc.line(bx, yn, bx, ye); doc.line(bx - 3, yn, bx, yn); doc.line(bx - 3, ye, bx, ye);
    font(true, 11, gc); doc.text(pctTxt(g), bx + 4, (yn + ye) / 2 + 2);
    font(false, 7.5, gc); doc.text(g >= 0 ? "short" : "cushion", bx + 4, (yn + ye) / 2 + 11);
  }
  legend(F, [{ t: "Income needed for the median-priced home", c: BLUE, lw: 2.2 }, { t: "Median household income", c: DARK, lw: 1.8 }]);
  banner(1, derivedNote);

  // ---- 2. U.S. gap ----
  doc.addPage([W, H], "landscape");
  var gl = usGap[last], start = last;
  for (var k = TL.indexOf(last); k >= a; k--) { var gv = usGap[TL[k]]; if (gv == null || (gv >= 0) !== (gl >= 0)) break; start = TL[k]; }
  var whole = start === TL[a];
  top = headline(gl >= 0
    ? (whole ? "Income Needed Has Exceeded Median Income in Every Month Shown" : "Income Needed Has Exceeded Median Household Income Every Month Since " + mLong(start))
    : (whole ? "Median Income Has Cleared the Bar in Every Month Shown" : "Median Household Income Has Cleared the Bar Every Month Since " + mLong(start)));
  titles(top, "Affordability Gap: Income Needed vs Median Household Income", "U.S., income needed / median household income - 1 · " + span);
  F = frame(top, [usGap], function (v) { return (v > 0 ? "+" : v < 0 ? "-" : "") + Math.round(Math.abs(v) * 100) + "%"; }, true);
  bars(F, usGap);
  endLabels(F, [{ y: F.Y(gl), t: pctTxt(gl), c: gl >= 0 ? REDC : GRNC }]);
  legend(F, [{ t: "Gap (red = the median household falls short, green = it clears the bar)", box: true }]);
  banner(2, derivedNote);

  // ---- 3. Metro vs U.S.: the map on the left, the metro's gap chart on the right ----
  if (pages === 3) {
    doc.addPage([W, H], "landscape");
    var mg = MT.gap[mtLast], ug = usGap[mtLast], diff = Math.round((mg - (ug == null ? mg : ug)) * 100), nm = MTNAME;
    var vs = ug == null ? "" : Math.abs(diff) < 1 ? ", in Line With the U.S." : ", " + Math.abs(diff) + " Points " + (diff > 0 ? "Worse" : "Better") + " Than the U.S.";
    top = headline(mg >= 0
      ? nm + " Buyers Need " + Math.round(mg * 100) + "% More Income Than Median Earners" + vs
      : nm + "'s Median Household Earns " + Math.round(-mg * 100) + "% More Than the Median Home Requires" + vs);

    // left panel: the map, as zoomed on screen, colored for the slide's month
    var region = REGIONS[mapRegion], vb = region.vb || [0, 0, D.mapW, D.mapH];
    var pL = 30, pR = 382, cxL = (pL + pR) / 2;
    titles(top, "Affordability Gap by Metro", mLong(mtLast) + (region.vb ? " · " + region.k : "") + " · income needed / median income - 1", cxL);
    var mT = top + 58, mB = H - 104, sc = Math.min((pR - pL) / vb[2], (mB - mT) / vb[3]);
    var ox = cxL - vb[2] * sc / 2, oy = mT + ((mB - mT) - vb[3] * sc) / 2;
    var MX = function (x) { return ox + (x - vb[0]) * sc; }, MY = function (y) { return oy + (y - vb[1]) * sc; };
    doc.saveGraphicsState();
    doc.rect(ox, oy, vb[2] * sc, vb[3] * sc, null); doc.clip(); doc.discardPath();
    doc.setFillColor(237, 237, 240); doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.6);
    (D.states || "").split("|").forEach(function (ring) {
      var pts = ring.split(" ").map(function (q) { var c = q.split(","); return [MX(+c[0]), MY(+c[1])]; });
      if (pts.length < 3) return;
      var rel = [];
      for (var k2 = 1; k2 < pts.length; k2++) rel.push([pts[k2][0] - pts[k2 - 1][0], pts[k2][1] - pts[k2 - 1][1]]);
      doc.lines(rel, pts[0][0], pts[0][1], [1, 1], "FD", true);
    });
    var z = D.mapW / vb[2], dotPts = [];
    (D.dots || []).forEach(function (d) { var gv = gapOf(d.i, mtLast); if (gv != null) dotPts.push({ d: d, g: gv, name: D.metros[d.i].name }); });
    var absG = dotPts.map(function (q) { return Math.abs(q.g); }).sort(function (x, y) { return x - y; });
    var vmax = Math.max(0.1, absG.length ? absG[Math.floor(0.9 * (absG.length - 1))] : 0.5);
    var rgb = function (hex) { return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]; };
    dotPts.sort(function (x, y) { return (x.d.rank || 60) - (y.d.rank || 60); });
    var selDot = null;
    dotPts.forEach(function (q) {
      q.r = Math.max(6, 30 * Math.pow(1 / Math.max(1, q.d.rank || 60), 0.375)) / Math.sqrt(z) * sc;
      var c = rgb(colorFor(q.g, vmax));
      doc.setFillColor(c[0], c[1], c[2]); doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.5);
      doc.circle(MX(q.d.x), MY(q.d.y), q.r, "FD");
      if (q.d.i === state.metro) selDot = q;
    });
    // names when zoomed into a region (kept from overlapping), and the picked metro always
    var boxes2 = [];
    if (z >= 1.9) {
      dotPts.forEach(function (q) {
        if (q === selDot) return;
        font(true, 7, [80, 80, 86]);
        var nmq = q.name.split(",")[0].split("-")[0], tw = doc.getTextWidth(nmq), bx2 = MX(q.d.x) + q.r + 2, by2 = MY(q.d.y) - 4;
        var clash = boxes2.some(function (o) { return bx2 < o.x + o.w && bx2 + tw > o.x && by2 < o.y + o.h && by2 + 8 > o.y; });
        if (!clash) { boxes2.push({ x: bx2, y: by2, w: tw, h: 8 }); doc.text(nmq, bx2, MY(q.d.y) + 2.5); }
      });
    }
    if (selDot) {
      doc.setDrawColor(28, 28, 30); doc.setLineWidth(1.3);
      doc.circle(MX(selDot.d.x), MY(selDot.d.y), selDot.r + 2.5, "S");
      font(true, 9.5, INK);
      doc.text(nm + " " + pctTxt(selDot.g), MX(selDot.d.x) + selDot.r + 5, MY(selDot.d.y) + 3.5);
    }
    doc.restoreGraphicsState();
    // color scale under the map
    var sy = H - 96, sx0 = pL + 40, sx1 = pR - 40, steps = 48;
    for (var q2 = 0; q2 < steps; q2++) {
      var vv = -vmax + (2 * vmax) * (q2 + 0.5) / steps, c2 = rgb(colorFor(vv, vmax));
      doc.setFillColor(c2[0], c2[1], c2[2]); doc.rect(sx0 + (sx1 - sx0) * q2 / steps, sy, (sx1 - sx0) / steps + 0.3, 5, "F");
    }
    font(false, 8, GRY);
    doc.text("-" + Math.round(vmax * 100) + "%", sx0 - 4, sy + 4.5, { align: "right" });
    doc.text("+" + Math.round(vmax * 100) + "%", sx1 + 4, sy + 4.5);
    font(false, 7.5, GRY);
    doc.text("green = cushion · red = short · size = market size", cxL, sy + 15, { align: "center" });

    // right panel: the metro's gap with the U.S. gap
    var rL = 448, rR = W - 96, cxR = (rL + rR) / 2;
    titles(top, nm + " vs U.S. Affordability Gap", mt.name.split(",")[0].length > 34 ? nm + " · " + mLong(TL[a]) + " to " + mLong(mtLast) : mt.name + " · " + mLong(TL[a]) + " to " + mLong(mtLast), cxR);
    F = frame(top, [MT.gap, usGap], function (v) { return (v > 0 ? "+" : v < 0 ? "-" : "") + Math.round(Math.abs(v) * 100) + "%"; }, true, rL, rR);
    bars(F, MT.gap);
    series(F, usGap, DARK, 1.8);
    var ends = [{ y: F.Y(mg), t: nm + " " + pctTxt(mg), c: mg >= 0 ? REDC : GRNC }];
    if (ug != null) ends.push({ y: F.Y(ug), t: "U.S. " + pctTxt(ug), c: DARK });
    endLabels(F, ends);
    legend(F, [{ t: nm + " gap", box: true }, { t: "U.S. gap", c: DARK, lw: 1.8 }], cxR);
    banner(3, " Metro gap = housing cost share of median household income / 30% - 1, from the HOAM metro file. Map: the big metros, sized by market size.");
  }
  return doc;
};
if (D) window.update(D); else window.__wantData = true;
</script>
__SHARE__
</body>
</html>`;

// ---------- Which metros go on the map, where, and how big ----------
// The map shows the same big metros as the Redfin Buyers vs Sellers widget
// (read from its saved copy; Redfin's sub-areas such as Fort Worth count as
// their parent metro). Dot size is market size: Zillow's size rank, read from
// the Payment widget's saved copy. Without those, the 50 largest by rank, or
// every metro this script can place, at one size.
const REDFIN_DIVISION_PARENT = {
  "Nassau County|NY": "New York|NY", "Newark|NJ": "New York|NY", "New Brunswick|NJ": "New York|NY",
  "Fort Worth|TX": "Dallas|TX", "Anaheim|CA": "Los Angeles|CA", "Oakland|CA": "San Francisco|CA",
  "San Rafael|CA": "San Francisco|CA", "Warren|MI": "Detroit|MI", "Montgomery County|PA": "Philadelphia|PA",
  "Camden|NJ": "Philadelphia|PA", "Wilmington|DE": "Philadelphia|PA", "Fort Lauderdale|FL": "Miami|FL",
  "West Palm Beach|FL": "Miami|FL", "Tacoma|WA": "Seattle|WA", "Elgin|IL": "Chicago|IL",
  "Lake County|IL": "Chicago|IL", "Gary|IN": "Chicago|IL", "Frederick|MD": "Washington|DC",
  "Arlington|VA": "Washington|DC", "Bethesda|MD": "Washington|DC", "Rockville|MD": "Washington|DC",
  "Silver Spring|MD": "Washington|DC", "Cambridge|MA": "Boston|MA", "Everett|WA": "Seattle|WA",
  "Bellevue|WA": "Seattle|WA", "Naperville|IL": "Chicago|IL",
};
const cityKey = (name, st) => `${String(name).split(",")[0].split("-")[0].split("/")[0].trim()}|${(st || (String(name).split(",")[1] || "").trim().slice(0, 2)).toUpperCase()}`;
function readDocJson(file) {
  try {
    const fm = FileManager.local();
    const p = fm.joinPath(fm.documentsDirectory(), file);
    return fm.fileExists(p) ? JSON.parse(fm.readString(p)) : null;
  } catch (e) {
    return null;
  }
}
function redfinMetroKeys() {
  const r = readDocJson("redfin-buyers-sellers-v1.json");
  if (!r || !r.metros || !r.metros.length) return null;
  const keys = new Set();
  for (const m of r.metros) {
    const k = cityKey(m.city || m.name, m.st);
    keys.add(REDFIN_DIVISION_PARENT[k] || k);
  }
  return keys;
}
function paymentRanks() {
  const p = readDocJson("payment-change-v1.json");
  if (!p || !p.metros || !p.metros.length) return null;
  const ranks = new Map();
  p.metros.forEach((m, i) => {
    const k = cityKey(String(m.name).replace(/^Urban /, ""), m.st);
    if (!ranks.has(k)) ranks.set(k, m.rank || i + 1);
  });
  return ranks;
}
function placeMetro(name) {
  const k = cityKey(name);
  const c = METRO_COORDS_FALLBACK[k] || METRO_COORDS_FALLBACK[`Urban ${k}`];
  if (!c) return null;
  const p = projectUS(c[1], c[0]);
  return { x: Math.round(p[0] * 10) / 10, y: Math.round(p[1] * 10) / 10 };
}
function mapDots(metros) {
  const keys = redfinMetroKeys();
  const ranks = paymentRanks();
  let dots = metros.map((m, i) => {
    const key = cityKey(String(m.name).replace(/^Urban /, ""));
    const parent = REDFIN_DIVISION_PARENT[key] || key;
    const p = placeMetro(m.name);
    return p ? { i, x: p.x, y: p.y, k: parent, rank: ranks ? ranks.get(parent) || null : null } : null;
  }).filter(Boolean);
  const big = keys ? dots.filter((d) => keys.has(d.k)) : [];
  if (big.length >= 10) dots = big;
  else if (ranks) {
    const top = dots.filter((d) => d.rank && d.rank <= 50);
    if (top.length >= 10) dots = top;
  }
  return dots.map(({ i, x, y, rank }) => ({ i, x, y, rank }));
}

function pagePayload(s, progress) {
  const day = (lm) => (lm && !isNaN(new Date(lm).getTime()) ? isoDay(new Date(lm)) : null);
  return {
    us: s.us,
    metros: s.metros || [],
    dots: mapDots(s.metros || []),
    states: STATES, mapW: MAP_W, mapH: MAP_H,
    defaultMetro: DEFAULT_METRO,
    next: s.next || null,
    usModified: day(s.usModified),
    metroModified: day(s.metroModified),
    metroError: s.metroError || null,
    progress: progress || "",
  };
}
function progressOf(s, checking) {
  if (checking) return "Checking the Atlanta Fed for newer data…";
  const parts = [];
  if (s.error) parts.push("Atlanta Fed unreachable · showing the saved copy (" + s.error + ")");
  if (s.metroError && s.metros && s.metros.length) parts.push("Metro file didn’t update (" + s.metroError + ")");
  return parts.join(" · ");
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
        try { fresh = await refreshWithin(120, true); } catch (e) { fresh = { ...s, error: String(e.message || e) }; }
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
    const s = await refreshWithin(WIDGET_BUDGET_S, false);
    widget = finishWidget(smallImage(s), s);
  } catch (e) {
    widget = errorWidget(`Couldn't load the data yet. Open the script once in Scriptable. (${e.message || e})`);
  }
  if (config.runsInWidget) Script.setWidget(widget);
  else await widget.presentSmall();
} else {
  try {
    const saved = readStore();
    if (saved) await openFullScreen(saved, true);
    else await openFullScreen(await refreshWithin(150, true), false);
  } catch (e) {
    const a = new Alert();
    a.title = "Couldn't load the data";
    a.message = String(e.message || e) + "\n\nCheck the connection and run it again.";
    a.addAction("OK");
    await a.present();
  }
}
Script.complete();
